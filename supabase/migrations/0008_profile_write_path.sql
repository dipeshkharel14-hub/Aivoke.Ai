-- Aivoke 0008: profile content can only be written by the server (profanity filter, link safety, rate limits).
-- Clients keep direct UPDATE on is_public, show_on_leaderboard, featured_opt_in, locale, notify_* (RLS: own row only).
revoke update (username, display_name, bio, links, country, avatar_url, onboarded_at)
  on public.profiles from authenticated;

-- avatar_url may only point at this project's public avatars bucket, in the format the upload route writes.
-- (Local Supabase uses http://127.0.0.1, so this check applies to hosted projects.)
alter table public.profiles add constraint avatar_url_storage check (
  avatar_url is null or avatar_url ~
  '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/[0-9a-f-]{36}/avatar-[0-9]+\.webp$');
