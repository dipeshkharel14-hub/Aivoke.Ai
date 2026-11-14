import { hostLabel, type LinkItem } from "@/lib/validation/links";

type Props = { avatarUrl: string | null; displayName: string; username: string; bio: string; links: LinkItem[]; isPublic?: boolean };

/** What others will see. Links shown here are unvalidated drafts; they are checked on save. */
export function ProfilePreview({ avatarUrl, displayName, username, bio, links, isPublic }: Props) {
  const name = displayName.trim() || "Your name";
  return (
    <aside aria-label="Profile preview" className="card p-5">
      <p className="text-xs font-semibold text-muted">Preview</p>
      <div className="mt-3 flex items-center gap-3">
        {avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={avatarUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
          : <span aria-hidden className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-xl font-bold text-accent-text">{name[0]?.toUpperCase()}</span>}
        <div className="min-w-0">
          <p className="truncate font-bold">{name}</p>
          <p className="truncate text-sm text-muted">@{username || "username"}</p>
        </div>
      </div>
      {bio.trim() && <p className="mt-3 whitespace-pre-line text-sm">{bio}</p>}
      {links.filter((l) => l.label.trim() && l.url.trim()).length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {links.filter((l) => l.label.trim() && l.url.trim()).map((l, i) => (
            <li key={i}><span className="chip" title={hostLabel(l.url)}>{l.label}</span></li>
          ))}
        </ul>
      )}
      {isPublic === false && <p className="mt-4 rounded-[8px] bg-surface-2 p-2 text-xs text-muted">Your profile is private. Only you can see it.</p>}
    </aside>
  );
}
