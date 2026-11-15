import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const missing = [!url ? "NEXT_PUBLIC_SUPABASE_URL" : null, !key ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null]
      .filter(Boolean)
      .join(" and ");

    const message = `Supabase is not configured. Missing: ${missing}. Set the required environment variables before using the browser client.`;

    if (process.env.NODE_ENV === "development") {
      throw new Error(message);
    }

    return null;
  }

  return createBrowserClient(url, key);
}
