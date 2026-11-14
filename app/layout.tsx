import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ToastProvider } from "@/components/toast";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, url: SITE_URL, title: `${SITE_NAME}: ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
  // Per-page dynamic OG images are added in phase 8 (opengraph-image routes).
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1020" },
  ],
};

// Runs before paint so there is no light/dark flash.
const themeScript = `try{var t=localStorage.getItem("aivoke-theme");if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[8px] focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent">Skip to content</a>
        <ToastProvider>
          <AuthProvider>
            <SiteHeader />
            <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
            <SiteFooter />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
