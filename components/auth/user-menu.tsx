"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";

type Who = { username: string | null; display_name: string | null; avatar_url: string | null };

export function UserMenu() {
  const { openAuth } = useAuth();
  const [state, setState] = useState<"loading" | "out" | Who>("loading");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { session } } = await supabase.auth.getSession(); // display only; access control is server-side
      if (!session) return setState("out");
      const { data } = await supabase.from("profiles").select("username, display_name, avatar_url").eq("id", session.user.id).single();
      setState((data as Who) ?? { username: null, display_name: null, avatar_url: null });
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (state === "loading") return <div className="skeleton h-9 w-20" aria-hidden />;
  if (state === "out") return <button type="button" className="btn btn-primary" onClick={() => openAuth()}>Sign in</button>;

  const label = state.display_name || state.username || "Account";
  return (
    <div ref={root} className="relative">
      <button type="button" className="btn btn-ghost gap-2 px-2" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {state.avatar_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={state.avatar_url} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
          : <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-text">{label[0]?.toUpperCase()}</span>}
        <span className="hidden max-w-[10rem] truncate text-sm sm:inline">{label}</span>
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-40 mt-2 w-52 p-1">
          {!state.username && <Link role="menuitem" href="/onboarding" className="btn btn-ghost w-full justify-start" onClick={() => setOpen(false)}>Finish setup</Link>}
          <Link role="menuitem" href="/settings/profile" className="btn btn-ghost w-full justify-start" onClick={() => setOpen(false)}>Edit profile</Link>
          <Link role="menuitem" href="/settings/privacy" className="btn btn-ghost w-full justify-start" onClick={() => setOpen(false)}>Settings</Link>
          <form action="/auth/signout" method="post">
            <button role="menuitem" className="btn btn-ghost w-full justify-start">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
