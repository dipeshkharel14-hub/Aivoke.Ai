import { requireOnboarded } from "@/lib/auth/session";
import { NotificationsForm } from "@/components/settings-forms";

export default async function NotificationSettings() {
  const me = await requireOnboarded("/settings/notifications");
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="mb-4 text-xl">Notifications</h2>
      <NotificationsForm initial={{ notify_product: me.notify_product, notify_social: me.notify_social }} />
    </section>
  );
}
