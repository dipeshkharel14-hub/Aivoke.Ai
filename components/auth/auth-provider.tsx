"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Turnstile, turnstileEnabled } from "./turnstile";
import { useToast } from "@/components/toast";

type Ctx = { openAuth: (next?: string) => void };
const AuthCtx = createContext<Ctx>({ openAuth: () => {} });
export const useAuth = () => useContext(AuthCtx);

function readRefCookie(): string | undefined {
  return document.cookie.split("; ").find((c) => c.startsWith("aivoke_ref="))?.split("=")[1];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("/");
  const [notice, setNotice] = useState<string | null>(null);
  const openAuth = useCallback((n = "/") => { setNext(n); setNotice(null); setOpen(true); }, []);
  return (
    <AuthCtx.Provider value={{ openAuth }}>
      {children}
      <Suspense fallback={null}>
        <UrlEffects openAuth={openAuth} setNotice={setNotice} />
      </Suspense>
      <AuthDialog open={open} onClose={() => setOpen(false)} next={next} notice={notice} />
    </AuthCtx.Provider>
  );
}

/** Reads ?auth=login, ?auth=error, ?ref=CODE from the URL, then cleans the URL. */
function UrlEffects({ openAuth, setNotice }: { openAuth: (n?: string) => void; setNotice: (s: string | null) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  useEffect(() => {
    if (params.get("deleted") === "1") toast("Account deleted");
    if (params.get("account") === "suspended") toast("Your account is suspended. Contact support for help.", "error");
    const ref = params.get("ref");
    if (ref && /^[A-Za-z0-9]{6,12}$/.test(ref)) document.cookie = `aivoke_ref=${ref.toUpperCase()}; max-age=2592000; path=/; samesite=lax`;
    const auth = params.get("auth");
    if (auth === "login" || auth === "error") {
      if (auth === "error") setNotice("That sign-in link did not work or has expired. Please try again.");
      openAuth(params.get("next") ?? "/");
    }
    if (auth || ref || params.get("deleted") || params.get("account")) {
      const q = new URLSearchParams(params.toString());
      ["auth", "next", "ref", "deleted", "account"].forEach((k) => q.delete(k));
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [params, openAuth, setNotice, router, pathname, toast]);
  return null;
}

function AuthDialog({ open, onClose, next, notice }: { open: boolean; onClose: () => void; next: string; notice: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tsReset, setTsReset] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => { if (cooldown > 0) { const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); } }, [cooldown]);

  const redirectTo = () => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) setError("Could not start Google sign-in. Please try again.");
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (turnstileEnabled && !token) { setError("Complete the verification first."); return; }
    setStatus("sending");
    const ref = readRefCookie();
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo(), captchaToken: token ?? undefined, data: ref ? { ref } : undefined },
    });
    setTsReset((n) => n + 1);
    if (error) {
      setStatus("idle");
      setError(error.status === 429 ? "Too many emails sent. Wait a minute and try again." : "We could not send the link. Check the address and try again.");
      return;
    }
    setStatus("sent");
    setCooldown(60);
  }

  const title = mode === "login" ? "Sign in to Aivoke" : "Create your Aivoke account";
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby="auth-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[10px] border border-border bg-surface p-0 text-text backdrop:bg-black/50">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="auth-title" className="text-xl">{title}</h2>
          <button type="button" className="btn btn-ghost -mr-2 -mt-2" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <p className="mt-1 text-sm text-muted">Members can save tools, write reviews, earn points and build a public profile.</p>

        {notice && <p role="alert" className="mt-4 rounded-[8px] bg-accent-soft p-3 text-sm">{notice}</p>}

        <button type="button" className="btn btn-secondary mt-5 w-full" onClick={google}>Continue with Google</button>
        <div className="my-4 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>

        {status === "sent" ? (
          <div role="status" className="rounded-[8px] bg-accent-soft p-4 text-sm">
            <p className="font-semibold">Check your inbox</p>
            <p className="mt-1">We sent a sign-in link to {email}. It works once and expires soon.</p>
            <button type="button" className="btn btn-secondary mt-3" disabled={cooldown > 0} onClick={() => setStatus("idle")}>
              {cooldown > 0 ? `Send again in ${cooldown}s` : "Use a different email"}
            </button>
          </div>
        ) : (
          <form onSubmit={magicLink} className="space-y-3">
            <label className="block text-sm font-semibold">
              Email address
              <input type="email" required autoComplete="email" className="input mt-1 font-normal" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" />
            </label>
            <Turnstile onToken={setToken} resetKey={tsReset} />
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button className="btn btn-primary w-full" disabled={status === "sending" || cooldown > 0}>
              {status === "sending" ? "Sending link" : "Email me a sign-in link"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted">
          {mode === "login" ? "New here? " : "Already a member? "}
          <button type="button" className="font-semibold text-accent-text underline underline-offset-2" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
        <p className="mt-3 text-center text-xs text-muted">By continuing you agree to the Terms and Privacy Policy.</p>
      </div>
    </dialog>
  );
}
