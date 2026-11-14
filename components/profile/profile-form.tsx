"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { completeOnboarding, saveProfile } from "@/app/actions/account";
import { countryOptions } from "@/lib/countries";
import { useToast } from "@/components/toast";
import { AvatarUploader } from "./avatar-uploader";
import { ProfilePreview } from "./profile-preview";
import type { LinkItem } from "@/lib/validation/links";

type Initial = { username: string | null; display_name: string | null; bio: string | null; country: string | null; links: LinkItem[]; avatar_url: string | null; is_public: boolean };
type Props = { initial: Initial; mode: "onboarding" | "settings"; next?: string };
type Avail = "idle" | "invalid" | "checking" | "available" | "taken";

const FORMAT = /^[a-z0-9_]{3,20}$/;

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={`text-xs ${value.length > max ? "text-danger" : "text-muted"}`} aria-hidden>{value.length}/{max}</span>;
}

export function ProfileForm({ initial, mode, next = "/" }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [username, setUsername] = useState(initial.username ?? "");
  const [displayName, setDisplayName] = useState(initial.display_name ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [links, setLinks] = useState<LinkItem[]>(initial.links);
  const [avatar, setAvatar] = useState<string | null>(initial.avatar_url);
  const [isPublic, setIsPublic] = useState(initial.is_public);
  const [avail, setAvail] = useState<Avail>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const countries = useMemo(() => countryOptions(), []);

  // username availability (debounced; the database function is the source of truth)
  useEffect(() => {
    if (!username) return setAvail("idle");
    if (!FORMAT.test(username)) return setAvail("invalid");
    if (username === initial.username) return setAvail("available");
    setAvail("checking");
    const t = setTimeout(async () => {
      const { data, error } = await createClient().rpc("username_available", { p_username: username });
      setAvail(error ? "idle" : data ? "available" : "taken");
    }, 400);
    return () => clearTimeout(t);
  }, [username, initial.username]);

  function updateLink(i: number, patch: Partial<LinkItem>) { setLinks((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x))); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({}); setFormError(null);
    const profile = { username, display_name: displayName, bio, country, links };
    start(async () => {
      const res = mode === "onboarding" ? await completeOnboarding({ profile, is_public: isPublic }) : await saveProfile(profile);
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); setFormError(res.error ?? (res.fieldErrors ? "Fix the highlighted fields." : null)); return; }
      if (mode === "onboarding") { toast("Profile created"); router.replace(next); router.refresh(); }
      else { toast("Profile saved"); router.refresh(); }
    });
  }

  const availMsg: Record<Avail, string> = {
    idle: "", checking: "Checking availability", available: "Username is available", taken: "That username is taken",
    invalid: "Use 3 to 20 lowercase letters, numbers or underscores",
  };
  const err = (k: string) => errors[k] && <p role="alert" className="mt-1 text-sm text-danger">{errors[k]}</p>;

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
      <form onSubmit={submit} className="space-y-6" noValidate>
        <AvatarUploader url={avatar} initial={(displayName || username || "A")[0].toUpperCase()} onChange={setAvatar} />

        <div>
          <label htmlFor="username" className="text-sm font-semibold">Username</label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted" aria-hidden>@</span>
            <input id="username" className="input" value={username} maxLength={20} autoComplete="off" spellCheck={false}
              aria-describedby="username-status" aria-invalid={avail === "taken" || avail === "invalid" || !!errors.username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
          </div>
          <p id="username-status" aria-live="polite" className={`mt-1 text-sm ${avail === "available" ? "text-success" : avail === "taken" || avail === "invalid" ? "text-danger" : "text-muted"}`}>{availMsg[avail]}</p>
          {err("username")}
        </div>

        <div>
          <div className="flex justify-between"><label htmlFor="dn" className="text-sm font-semibold">Display name</label><Counter value={displayName} max={50} /></div>
          <input id="dn" className="input mt-1" value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
          {err("display_name")}
        </div>

        <div>
          <div className="flex justify-between"><label htmlFor="bio" className="text-sm font-semibold">Bio <span className="font-normal text-muted">(optional)</span></label><Counter value={bio} max={280} /></div>
          <textarea id="bio" rows={4} className="input mt-1 py-2" value={bio} maxLength={300} onChange={(e) => setBio(e.target.value)} />
          {err("bio")}
        </div>

        <div>
          <label htmlFor="country" className="text-sm font-semibold">Country <span className="font-normal text-muted">(optional)</span></label>
          <select id="country" className="input mt-1" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Prefer not to say</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          {err("country")}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">Links <span className="font-normal text-muted">(up to 5, https only)</span></legend>
          <div className="mt-2 space-y-3">
            {links.map((l, i) => (
              <div key={i}>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className="input sm:w-40" placeholder="Label" aria-label={`Link ${i + 1} label`} value={l.label} maxLength={40} onChange={(e) => updateLink(i, { label: e.target.value })} />
                  <input className="input flex-1" placeholder="https://" aria-label={`Link ${i + 1} address`} inputMode="url" value={l.url} onChange={(e) => updateLink(i, { url: e.target.value })} />
                  <button type="button" className="btn btn-ghost" onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}>Remove</button>
                </div>
                {err(`links.${i}.label`)}{err(`links.${i}.url`)}
              </div>
            ))}
          </div>
          {errors.links && <p role="alert" className="mt-1 text-sm text-danger">{errors.links}</p>}
          {links.length < 5 && <button type="button" className="btn btn-secondary mt-3" onClick={() => setLinks((l) => [...l, { label: "", url: "" }])}>Add link</button>}
        </fieldset>

        {mode === "onboarding" && (
          <fieldset>
            <legend className="text-sm font-semibold">Who can see your profile?</legend>
            <label className="mt-2 flex items-start gap-2 text-sm"><input type="radio" name="vis" checked={!isPublic} onChange={() => setIsPublic(false)} className="mt-1" /><span><b>Private.</b> Only you. You will not appear in People or leaderboards. You can change this any time.</span></label>
            <label className="mt-2 flex items-start gap-2 text-sm"><input type="radio" name="vis" checked={isPublic} onChange={() => setIsPublic(true)} className="mt-1" /><span><b>Public.</b> Listed in People search, leaderboards and your own profile page.</span></label>
          </fieldset>
        )}

        {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
        <button className="btn btn-primary" disabled={pending || avail === "taken" || avail === "invalid" || avail === "checking"}>
          {pending ? "Saving" : mode === "onboarding" ? "Create profile" : "Save profile"}
        </button>
      </form>

      <div className="md:sticky md:top-6 md:self-start">
        <ProfilePreview avatarUrl={avatar} displayName={displayName} username={username} bio={bio} links={links} isPublic={mode === "onboarding" ? isPublic : undefined} />
      </div>
    </div>
  );
}
