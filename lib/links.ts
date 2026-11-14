// Pure helpers (no imports) so they can be unit-tested with plain Node.
const BLOCKED_HOSTS = [
  // URL shorteners hide the real destination
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "rb.gy", "ow.ly", "shorturl.at", "tiny.cc", "buff.ly",
];

export type LinkItem = { label: string; url: string };
export type UrlCheck = { ok: true; url: string } | { ok: false; reason: string };

export function normalizeLinkUrl(raw: string): UrlCheck {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return { ok: false, reason: "Enter a full link starting with https://" }; }
  if (u.protocol !== "https:") return { ok: false, reason: "Links must start with https://" };
  if (u.username || u.password) return { ok: false, reason: "Links cannot contain a username or password" };
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host))
    return { ok: false, reason: "Use a website address, not an IP address" };
  if (host === "localhost" || /\.(local|localhost|internal|lan)$/.test(host))
    return { ok: false, reason: "That address is not allowed" };
  if (BLOCKED_HOSTS.some((d) => host === d || host.endsWith("." + d)))
    return { ok: false, reason: "Shortened links are not allowed. Use the full link" };
  if (u.href.length > 500) return { ok: false, reason: "That link is too long" };
  return { ok: true, url: u.href };
}

export function hostLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
