import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Best-effort security event log (table: security_events). Never throws. */
export async function logSecurityEvent(
  event: string,
  opts: { userId?: string | null; ipHash?: string | null; meta?: Record<string, unknown> } = {},
) {
  try {
    await createAdminClient().from("security_events").insert({
      event,
      user_id: opts.userId ?? null,
      ip_hash: opts.ipHash ?? null,
      meta: opts.meta ?? {},
    });
  } catch {
    /* logging must never break a request */
  }
}
