"use client";

import { useState, useTransition } from "react";
import { deleteAccount, saveNotifications, savePrivacy } from "@/app/actions/account";
import { useToast } from "@/components/toast";

function Check({ id, checked, onChange, label, hint, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1.5 h-4 w-4" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-describedby={`${id}-h`} />
      <label htmlFor={id} className="text-sm"><span className="font-semibold">{label}</span><span id={`${id}-h`} className="block text-muted">{hint}</span></label>
    </div>
  );
}

export function PrivacyForm({ initial }: { initial: { is_public: boolean; show_on_leaderboard: boolean; featured_opt_in: boolean } }) {
  const { toast } = useToast();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="card max-w-xl space-y-5 p-5" onSubmit={(e) => {
      e.preventDefault(); setError(null);
      start(async () => { const r = await savePrivacy(v); if (r.ok) toast("Privacy settings saved"); else setError(r.error ?? "Could not save"); });
    }}>
      <Check id="pub" checked={v.is_public} onChange={(x) => setV({ ...v, is_public: x, featured_opt_in: x && v.featured_opt_in })} label="Public profile"
        hint="Anyone can see your profile page, and you appear in People search. Private profiles are visible only to you." />
      <Check id="lb" checked={v.show_on_leaderboard} disabled={!v.is_public} onChange={(x) => setV({ ...v, show_on_leaderboard: x })} label="Show me on leaderboards"
        hint="Only public profiles are ever listed. Turn this off to opt out." />
      <Check id="feat" checked={v.featured_opt_in} disabled={!v.is_public} onChange={(x) => setV({ ...v, featured_opt_in: x })} label="Allow weekly featured creator spotlight"
        hint="You may be highlighted on the homepage if you rank among top contributors." />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving" : "Save privacy settings"}</button>
    </form>
  );
}

export function NotificationsForm({ initial }: { initial: { notify_product: boolean; notify_social: boolean } }) {
  const { toast } = useToast();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="card max-w-xl space-y-5 p-5" onSubmit={(e) => {
      e.preventDefault(); setError(null);
      start(async () => { const r = await saveNotifications(v); if (r.ok) toast("Notification settings saved"); else setError(r.error ?? "Could not save"); });
    }}>
      <Check id="np" checked={v.notify_product} onChange={(x) => setV({ ...v, notify_product: x })} label="Product updates" hint="Occasional emails about new Aivoke features." />
      <Check id="ns" checked={v.notify_social} onChange={(x) => setV({ ...v, notify_social: x })} label="Activity on your profile" hint="Emails when someone follows you." />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving" : "Save notification settings"}</button>
    </form>
  );
}

export function DeleteAccountForm({ expected }: { expected: string }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="card max-w-xl space-y-3 border-danger p-5" onSubmit={(e) => {
      e.preventDefault(); setError(null);
      start(async () => { const r = await deleteAccount(value); if (r && !r.ok) setError(r.fieldErrors?.confirm ?? r.error ?? "Could not delete your account"); });
    }}>
      <h3 className="text-base text-danger">Delete account</h3>
      <p className="text-sm">This permanently deletes your profile, photo, reviews, collections, follows, points and badges. It cannot be undone.</p>
      <label className="block text-sm font-semibold">Type <code>{expected}</code> to confirm
        <input className="input mt-1 font-normal" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn btn-danger" disabled={pending || value.trim() !== expected}>{pending ? "Deleting" : "Delete my account"}</button>
    </form>
  );
}
