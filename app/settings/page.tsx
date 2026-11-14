import { requireOnboarded } from "@/lib/auth/session";
import { PrivacyForm } from "@/components/settings-forms";

export default async function PrivacySettings() {
  const me = await requireOnboarded("/settings/privacy");
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="mb-4 text-xl">Privacy</h2>
      <PrivacyForm initial={{ is_public: me.is_public, show_on_leaderboard: me.show_on_leaderboard, featured_opt_in: me.featured_opt_in }} />
    </section>
  );
}
