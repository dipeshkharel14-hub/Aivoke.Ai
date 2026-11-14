import type { Metadata } from "next";
import { requireOnboarded } from "@/lib/auth/session";
import { SettingsNav } from "@/components/settings-nav";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOnboarded("/settings/profile");
  return (
    <div>
      <h1 className="text-3xl">Settings</h1>
      <div className="mt-6 grid gap-8 md:grid-cols-[12rem_1fr]">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
