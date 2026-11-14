"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/security/ratelimit";
import { clientIp, hashIp } from "@/lib/security/ip";
import { logSecurityEvent } from "@/lib/security/log";
import { isUnsafeUrl } from "@/lib/security/safe-browsing";
import { normalizeLinkUrl } from "@/lib/validation/links";
import { notificationsSchema, privacySchema, profileSchema } from "@/lib/validation/profile";

export type ActionResult = { ok: true; username?: string } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}
const tooMany = (s: number): ActionResult => ({ ok: false, error: `You are doing that too often. Try again in ${Math.ceil(s / 60)} min.` });
const SIGN_IN: ActionResult = { ok: false, error: "Sign in to continue" };

async function persistProfile(input: unknown, finish: boolean): Promise<ActionResult> {
  const a = await authed();
  if (!a) return SIGN_IN;
  const { user } = a;
  const rl = await rateLimit("profileEdit", user.id);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const parsed = profileSchema.safeParse(input);
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form") + (i.path[1] !== undefined ? `.${i.path[1]}.${String(i.path[2] ?? "")}` : "")] ??= i.message;
    return { ok: false, fieldErrors };
  }
  const v = parsed.data;

  // Link safety: https-only rules, blocked hosts, then Google Safe Browsing when a key is configured.
  const links: { label: string; url: string }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < v.links.length; i++) {
    const c = normalizeLinkUrl(v.links[i].url);
    if (!c.ok) { fieldErrors[`links.${i}.url`] = c.reason; continue; }
    if (seen.has(c.url)) { fieldErrors[`links.${i}.url`] = "You already added this link"; continue; }
    seen.add(c.url);
    if (await isUnsafeUrl(c.url)) {
      fieldErrors[`links.${i}.url`] = "This link was flagged as unsafe";
      await logSecurityEvent("unsafe_link_rejected", { userId: user.id, meta: { host: new URL(c.url).hostname } });
      continue;
    }
    links.push({ label: v.links[i].label, url: c.url });
  }
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const admin = createAdminClient();
  const { data: cur } = await admin.from("profiles").select("onboarded_at, is_banned, referred_by, created_at").eq("id", user.id).single();
  if (!cur || cur.is_banned) return { ok: false, error: "Your account cannot do this" };

  const { error } = await admin.from("profiles").update({
    username: v.username,
    display_name: v.display_name,
    bio: v.bio || null,
    country: v.country || null,
    links,
    onboarded_at: cur.onboarded_at ?? (finish ? new Date().toISOString() : null),
  }).eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { username: "That username is taken" } };
    return { ok: false, error: "Could not save your profile. Try again." };
  }

  if (finish && !cur.referred_by) await applyReferral(user.id, cur.created_at);
  revalidatePath("/settings/profile");
  return { ok: true, username: v.username };
}

/** Attribute a signup to a referrer when the OAuth path could not pass the code (cookie set by ?ref=CODE). */
async function applyReferral(userId: string, createdAt: string) {
  const jar = await cookies();
  const code = jar.get("aivoke_ref")?.value?.toUpperCase();
  jar.delete("aivoke_ref");
  if (!code || !/^[A-Z0-9]{6,12}$/.test(code)) return;
  if (Date.now() - new Date(createdAt).getTime() > 7 * 24 * 3600 * 1000) return;
  const admin = createAdminClient();
  const { data: ref } = await admin.from("profiles").select("id").eq("referral_code", code).eq("is_banned", false).maybeSingle();
  if (!ref || ref.id === userId) return;
  const { error } = await admin.from("referrals").insert({ referrer_id: ref.id, referred_id: userId });
  if (!error) await admin.from("profiles").update({ referred_by: ref.id }).eq("id", userId).is("referred_by", null);
}

export async function completeOnboarding(input: unknown): Promise<ActionResult> {
  const res = await persistProfile((input as { profile?: unknown })?.profile, true);
  if (!res.ok) return res;
  // visibility is the one choice made during onboarding that is not part of the profile content
  const is_public = (input as { is_public?: unknown })?.is_public === true;
  const a = await authed();
  if (a) await a.supabase.from("profiles").update({ is_public }).eq("id", a.user.id);
  return res;
}

export async function saveProfile(input: unknown): Promise<ActionResult> {
  return persistProfile(input, false);
}

export async function savePrivacy(input: unknown): Promise<ActionResult> {
  const a = await authed();
  if (!a) return SIGN_IN;
  const rl = await rateLimit("privacyEdit", a.user.id);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const p = privacySchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Those settings are not valid" };
  const { is_public, show_on_leaderboard } = p.data;
  const featured_opt_in = is_public && p.data.featured_opt_in; // featuring requires a public profile
  const { error } = await a.supabase.from("profiles").update({ is_public, show_on_leaderboard, featured_opt_in }).eq("id", a.user.id);
  if (error) return { ok: false, error: "Could not save your privacy settings" };
  revalidatePath("/settings/privacy");
  return { ok: true };
}

export async function saveNotifications(input: unknown): Promise<ActionResult> {
  const a = await authed();
  if (!a) return SIGN_IN;
  const rl = await rateLimit("privacyEdit", a.user.id);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const p = notificationsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Those settings are not valid" };
  const { error } = await a.supabase.from("profiles").update(p.data).eq("id", a.user.id);
  if (error) return { ok: false, error: "Could not save your notification settings" };
  return { ok: true };
}

/** Deletes the auth user; every user-owned table cascades (see migrations). Also clears what does not cascade. */
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  const a = await authed();
  if (!a) return SIGN_IN;
  const { user, supabase } = a;
  const rl = await rateLimit("deleteAccount", user.id);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("username").eq("id", user.id).single();
  const expected = p?.username ?? "DELETE";
  if (confirmation.trim() !== expected) return { ok: false, fieldErrors: { confirm: `Type ${expected} to confirm` } };

  const ipHash = hashIp(clientIp(await headers()));
  // 1) files
  const { data: files } = await admin.storage.from("avatars").list(user.id);
  if (files?.length) await admin.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));
  // 2) rows that would otherwise survive (set-null FKs or keyed by email / subject key)
  await admin.from("submissions").delete().eq("user_id", user.id);
  await admin.from("usage_limits").delete().eq("subject_key", `u:${user.id}`);
  if (user.email) await admin.from("newsletter_subscribers").delete().eq("email_lower", user.email.toLowerCase());
  // 3) the user (cascades profile, reviews, follows, blocks, bookmarks, collections, ledger, chats, ...)
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: "Could not delete your account. Try again or contact support." };

  await logSecurityEvent("account_deleted", { ipHash });
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?deleted=1");
}
