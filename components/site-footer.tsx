import { supportEmail } from "@/lib/site";

// Server component: SUPPORT_EMAIL is read here and never shipped as a client import.
export function SiteFooter() {
  const email = supportEmail();
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Aivoke</p>
        <p>
          Questions or feedback:{" "}
          <a className="text-accent-text underline underline-offset-2" href={`mailto:${email}`}>{email}</a>
        </p>
      </div>
    </footer>
  );
}
