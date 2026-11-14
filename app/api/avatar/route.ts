import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/ratelimit";
import { clientIp, hashIp } from "@/lib/security/ip";
import { logSecurityEvent } from "@/lib/security/log";

export const runtime = "nodejs";
const MAX_BYTES = 2 * 1024 * 1024;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/** Magic-byte sniff: JPEG, PNG or WebP. The declared MIME type and file name are never trusted. */
function sniff(b: Buffer): boolean {
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP";
  return jpeg || png || webp;
}

async function authed(req: Request) {
  if (!isSameOrigin(req)) return { error: json({ error: "Request blocked" }, 403) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: json({ error: "Sign in to continue" }, 401) };
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("is_banned").eq("id", user.id).single();
  if (!p || p.is_banned) return { error: json({ error: "Your account cannot do this" }, 403) };
  return { user, admin };
}

async function removeOldFiles(admin: ReturnType<typeof createAdminClient>, uid: string, keep?: string) {
  const { data } = await admin.storage.from("avatars").list(uid);
  const stale = (data ?? []).map((f) => `${uid}/${f.name}`).filter((p) => p !== keep);
  if (stale.length) await admin.storage.from("avatars").remove(stale);
}

export async function POST(req: Request) {
  const a = await authed(req);
  if ("error" in a) return a.error;
  const { user, admin } = a;
  const ipHash = hashIp(clientIp(req.headers));

  const [byUser, byIp] = await Promise.all([rateLimit("avatar", user.id), rateLimit("avatarIp", ipHash)]);
  if (!byUser.ok || !byIp.ok) {
    await logSecurityEvent("rate_limited", { userId: user.id, ipHash, meta: { route: "avatar" } });
    return json({ error: "Too many uploads. Try again later." }, 429);
  }

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) return json({ error: "Image is larger than 2 MB" }, 413);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose an image" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "Image is larger than 2 MB" }, 413);

  const input = Buffer.from(await file.arrayBuffer());
  if (!sniff(input)) {
    await logSecurityEvent("upload_rejected", { userId: user.id, ipHash, meta: { reason: "magic_bytes", declared: file.type } });
    return json({ error: "Use a JPG, PNG or WebP image" }, 415);
  }

  // Decoding and re-encoding is the real verification: it also strips metadata (EXIF/GPS) and any appended payload.
  let output: Buffer;
  try {
    output = await sharp(input, { limitInputPixels: 25_000_000, failOn: "error" })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    await logSecurityEvent("upload_rejected", { userId: user.id, ipHash, meta: { reason: "decode_failed" } });
    return json({ error: "That image could not be read" }, 415);
  }

  const path = `${user.id}/avatar-${Date.now()}.webp`;
  const up = await admin.storage.from("avatars").upload(path, output, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (up.error) return json({ error: "Upload failed. Try again." }, 500);

  const url = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const upd = await admin.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (upd.error) {
    await admin.storage.from("avatars").remove([path]);
    return json({ error: "Could not save your photo" }, 500);
  }
  await removeOldFiles(admin, user.id, path);
  return json({ url });
}

export async function DELETE(req: Request) {
  const a = await authed(req);
  if ("error" in a) return a.error;
  const { user, admin } = a;
  const rl = await rateLimit("avatar", user.id);
  if (!rl.ok) return json({ error: "Too many changes. Try again later." }, 429);
  await admin.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  await removeOldFiles(admin, user.id);
  return json({ ok: true });
}
