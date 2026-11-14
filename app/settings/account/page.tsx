import { requireOnboarded } from "@/lib/auth/session";
import { DeleteAccountForm } from "@/components/settings-forms";

export default async function AccountSettings() {
  const me = await requireOnboarded("/settings/account");
  return (
    <section aria-labelledby="h" className="space-y-6">
      <h2 id="h" className="text-xl">Account</h2>
      <p className="text-sm text-muted">Signed in as {me.email}</p>
      <DeleteAccountForm expected={me.username!} />
    </section>
  );
}
