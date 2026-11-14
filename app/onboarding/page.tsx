import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth/session";
import { safeNext } from "@/lib/security/redirect";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = { title: "Set up your profile", robots: { index: false } };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  const me = await requireMe("/onboarding");
  if (me.onboarded_at && me.username) redirect(dest);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl">Set up your profile</h1>
      <p className="mt-2 max-w-xl text-muted">Choose a username and a photo. Everything except your username is optional, and you can change any of it later.</p>
      <div className="mt-8">
        <ProfileForm mode="onboarding" next={dest}
          initial={{ username: me.username, display_name: me.display_name, bio: me.bio, country: me.country, links: me.links, avatar_url: me.avatar_url, is_public: false }} />
      </div>
    </div>
  );
}
