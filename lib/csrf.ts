/** Same-origin check for cookie-authenticated route handlers (server actions already do this themselves). */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false; // browsers always send Origin on cross-site and same-site POST/DELETE
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
