import "server-only";
import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env";

export function clientIp(h: Headers): string {
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Salted hash so raw IPs are never stored or used as Redis keys. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(serverEnv().IP_HASH_SALT + ip).digest("hex").slice(0, 32);
}
