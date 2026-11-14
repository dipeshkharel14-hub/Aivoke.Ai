"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/settings/profile", "Profile"],
  ["/settings/privacy", "Privacy"],
  ["/settings/notifications", "Notifications"],
  ["/settings/account", "Account"],
] as const;

export function SettingsNav() {
  const path = usePathname();
  return (
    <nav aria-label="Settings" className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
          className={`btn justify-start whitespace-nowrap ${path === href ? "bg-accent-soft text-accent-text" : "btn-ghost"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
