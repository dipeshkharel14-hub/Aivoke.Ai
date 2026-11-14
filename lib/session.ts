import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LinkItem } from "@/lib/validation/links";

export type Me = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  links: LinkItem[];
  country: string | null;
  is_public: boolean;
  role: string;
  onboarded_at: string | null;
  show_on_leaderboard: boolean;
  featured_opt_in: boolean;
  notify_product: boolean;
  notify_social: boolean;
  is_banned: boolean;
};

/** Current signed-in user plus profile, or null. Uses getUser() (validated), not getSession(). */
export async function getMe(): Promise<Me | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [pub, acct] = await Promise.all([
    supabase.from("profiles").select("username, display_name, avatar_url, bio, links, country, is_public").eq("id", user.id).single(),
    supabase.rpc("my_account").single(),
  ]);
  if (pub.error || acct.error || !pub.data || !acct.data) return null;
  const a = acct.data as Record<string, any>;
  return {
    id: user.id,
    email: user.email ?? null,
    ...(pub.data as any),
    links: Array.isArray((pub.data as any).links) ? (pub.data as any).links : [],
    role: a.role,
    onboarded_at: a.onboarded_at,
    show_on_leaderboard: a.show_on_leaderboard,
    featured_opt_in: a.featured_opt_in,
    notify_product: a.notify_product,
    notify_social: a.notify_social,
    is_banned: a.is_banned,
  };
}

export async function requireMe(next: string): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/?auth=login&next=${encodeURIComponent(next)}`);
  if (me.is_banned) redirect("/?account=suspended");
  return me;
}

/** Signed in AND finished onboarding (username chosen). */
export async function requireOnboarded(next: string): Promise<Me> {
  const me = await requireMe(next);
  if (!me.onboarded_at || !me.username) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return me;
}
