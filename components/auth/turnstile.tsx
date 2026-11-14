"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, o: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Cloudflare Turnstile widget. Renders nothing when no site key is configured (local development). */
export function Turnstile({ onToken, resetKey }: { onToken: (t: string | null) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey || !box.current) return;
    let cancelled = false;

    function mount() {
      if (cancelled || !box.current || !window.turnstile) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: siteKey,
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(null),
        "error-callback": () => cb.current(null),
      });
    }
    if (window.turnstile) mount();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
      if (!s) { s = document.createElement("script"); s.src = SRC; s.async = true; document.head.appendChild(s); }
      s.addEventListener("load", mount);
    }
    return () => { cancelled = true; if (widget.current) window.turnstile?.remove(widget.current); };
  }, []);

  useEffect(() => { if (resetKey > 0 && widget.current) { cb.current(null); window.turnstile?.reset(widget.current); } }, [resetKey]);

  return <div ref={box} className="min-h-[65px]" />;
}
