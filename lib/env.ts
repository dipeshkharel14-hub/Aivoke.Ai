import "server-only";
import { z } from "zod";

// Server-side environment. Importing this file from a client component fails the build (server-only).
// Only variables used by the current phase are required. Gemini, Resend and the Turnstile secret are optional
// until the features that use them ship, so profile saves and avatar uploads do not fail without them.
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://aivokeai.vercel.app"),
  SUPPORT_EMAIL: z.string().email().default("info@khareldipesh.com.np"),
  RESEND_FROM_ADDRESS: z.string().optional(),
  IP_HASH_SALT: z.string().min(16),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_CHAT_MODEL: z.string().optional(),
  GEMINI_EMBEDDING_MODEL: z.string().optional(),
  GEMINI_EMBEDDING_DIMENSIONS: z.coerce.number().int().default(768),
  GUEST_DAILY_QUESTIONS: z.coerce.number().int().default(3),
  MEMBER_DAILY_QUESTIONS: z.coerce.number().int().default(20),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  GOOGLE_SAFE_BROWSING_API_KEY: z.string().optional(),
});

let cached: z.infer<typeof schema> | undefined;

/** Validated on first use so `next build` for static pages does not need every secret. */
export function serverEnv() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid or missing environment variables: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}
