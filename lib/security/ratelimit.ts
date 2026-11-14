import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env";

type Dur = `${number} ${"s" | "m" | "h" | "d"}`;
const RULES: Record<string, [number, Dur]> = {
  profileEdit: [10, "1 h"],
  avatar: [5, "1 h"],
  avatarIp: [20, "1 h"],
  privacyEdit: [30, "1 h"],
  deleteAccount: [3, "1 h"],
};

let redis: Redis | undefined;
const limiters = new Map<string, Ratelimit>();

/** Fails CLOSED: if Redis is unreachable the action is refused rather than left unlimited. */
export async function rateLimit(rule: keyof typeof RULES, key: string) {
  const env = serverEnv();
  redis ??= new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  let limiter = limiters.get(rule as string);
  if (!limiter) {
    const [n, window] = RULES[rule as string];
    limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(n, window), prefix: `rl:${String(rule)}` });
    limiters.set(rule as string, limiter);
  }
  try {
    const r = await limiter.limit(key);
    return { ok: r.success, retryAfterSec: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
  } catch {
    return { ok: false, retryAfterSec: 60 };
  }
}
