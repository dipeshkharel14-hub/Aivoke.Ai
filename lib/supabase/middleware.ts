import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/settings", "/onboarding", "/rewards", "/collections", "/admin"];

/** Refreshes the auth session cookie on every request and gates protected routes. */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Misconfigured deployment: do not crash every request (MIDDLEWARE_INVOCATION_FAILED); let public pages render.
  if (!url || !anon) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims() verifies the JWT signature and avoids a network round-trip on every request.
  // `data` is null for signed-out visitors, so it must NOT be destructured directly.
  let isAuthenticated = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    isAuthenticated = !error && typeof data?.claims?.sub === "string";
  } catch {
    isAuthenticated = false;
  }

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));
  if (!isAuthenticated && isProtected) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/";
    dest.search = "";
    dest.searchParams.set("auth", "login");
    dest.searchParams.set("next", path);
    const redirect = NextResponse.redirect(dest);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c.name, c.value));
    return redirect;
  }
  return response;
}
