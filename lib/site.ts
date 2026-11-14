// Public, non-secret site constants. Safe in server components; pass values to client components as props.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://aivokeai.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "Aivoke";
export const SITE_TAGLINE = "Find the right AI tool, faster";
export const SITE_DESCRIPTION =
  "Aivoke is a directory of AI tools with honest reviews, side-by-side comparisons and an assistant that recommends from the catalog.";

/** The only public email on the site. Read on the server and pass down; never hardcode it elsewhere. */
export function supportEmail(): string {
  const v = process.env.SUPPORT_EMAIL;
  if (!v) throw new Error("SUPPORT_EMAIL is not set");
  return v;
}
