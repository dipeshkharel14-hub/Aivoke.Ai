import { requireOnboarded } from "@/lib/auth/session";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfileSettings() {
  const me = await requireOnboarded("/settings/profile");
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="mb-4 text-xl">Profile</h2>
      <ProfileForm mode="settings"
        initial={{ username: me.username, display_name: me.display_name, bio: me.bio, country: me.country, links: me.links, avatar_url: me.avatar_url, is_public: me.is_public }} />
    </section>
  );
}
