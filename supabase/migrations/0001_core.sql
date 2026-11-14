-- Aivoke 0001: extensions, helpers, profiles, social graph, moderation, categories, tools
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists vector   with schema extensions;

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- https-only links, max 5, each {label,url}
create or replace function public.links_valid(l jsonb) returns boolean
language plpgsql immutable as $$
declare item jsonb;
begin
  if l is null then return true; end if;
  if jsonb_typeof(l) <> 'array' or jsonb_array_length(l) > 5 then return false; end if;
  for item in select * from jsonb_array_elements(l) loop
    if jsonb_typeof(item) <> 'object'
       or coalesce(item->>'label','') = '' or length(item->>'label') > 40
       or coalesce(item->>'url','') !~* '^https://[^\s]{3,500}$' then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- username: 3-20 chars, lowercase letters/digits/underscore, not reserved
create or replace function public.username_ok(u text) returns boolean
language sql immutable as $$
  select u ~ '^[a-z0-9_]{3,20}$' and u not in
    ('admin','administrator','support','help','aivoke','root','moderator','mod','staff','official',
     'null','undefined','api','settings','people','tools','rewards','leaderboard','go','u','login','signup')
$$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,                       -- null until onboarding is finished
  display_name text,
  avatar_url text,
  bio text,
  links jsonb not null default '[]'::jsonb,
  country text,                               -- ISO 3166-1 alpha-2
  is_public boolean not null default false,
  show_on_leaderboard boolean not null default true,
  featured_opt_in boolean not null default false,
  is_verified boolean not null default false, -- admin-set badge
  is_banned boolean not null default false,
  locale text not null default 'en',
  notify_product boolean not null default true,
  notify_social boolean not null default true,
  points integer not null default 0,          -- spendable balance
  lifetime_points integer not null default 0, -- drives level
  level text not null default 'Explorer',
  streak_days integer not null default 0,
  last_active_date date,
  follower_count integer not null default 0,
  following_count integer not null default 0,
  referral_code text not null unique,
  referred_by uuid references public.profiles(id) on delete set null,
  role text not null default 'user',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_ok check (username is null or public.username_ok(username)),
  constraint display_name_len check (display_name is null or char_length(display_name) between 1 and 50),
  constraint bio_len check (bio is null or char_length(bio) <= 280),
  constraint links_ok check (public.links_valid(links)),
  constraint country_fmt check (country is null or country ~ '^[A-Z]{2}$'),
  constraint points_non_negative check (points >= 0 and lifetime_points >= 0),
  constraint level_ok check (level in ('Explorer','Builder','Pro','Master')),
  constraint role_ok check (role in ('user','admin')),
  constraint locale_ok check (locale in ('en','ne'))
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create index profiles_public_points_idx on public.profiles (points desc) where is_public and not is_banned;
create index profiles_followers_idx on public.profiles (follower_count desc) where is_public and not is_banned;
create index profiles_username_trgm on public.profiles using gin (username extensions.gin_trgm_ops);
create index profiles_display_name_trgm on public.profiles using gin (display_name extensions.gin_trgm_ops);

-- ---------- social graph ----------
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','tool','review','collection')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','abuse','impersonation','inappropriate','broken_link','malicious_link','other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_status_idx on public.reports (status, created_at desc);

-- ---------- directory ----------
create table public.categories (
  slug text primary key,
  name text not null unique,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tagline text not null,
  description text not null,
  url text not null,
  tags text[] not null default '{}',
  category_slug text not null references public.categories(slug) on update cascade,
  is_trending boolean not null default false,
  is_new boolean not null default false,
  upvote_count integer not null default 0,
  rating_avg numeric(3,2) not null default 0,
  review_count integer not null default 0,
  embedding extensions.vector(768),   -- must match GEMINI_EMBEDDING_DIMENSIONS
  fts tsvector,
  status text not null default 'published' check (status in ('draft','published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tool_url_https check (url ~* '^https://'),
  constraint tool_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create trigger tools_updated before update on public.tools
  for each row execute function public.set_updated_at();

create or replace function public.tools_fts_update() returns trigger
language plpgsql as $$
begin
  new.fts :=
    setweight(to_tsvector('english', coalesce(new.name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.tagline,'') || ' ' || array_to_string(new.tags,' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description,'')), 'C');
  return new;
end $$;
create trigger tools_fts before insert or update of name, tagline, description, tags on public.tools
  for each row execute function public.tools_fts_update();

create index tools_fts_idx on public.tools using gin (fts);
create index tools_name_trgm on public.tools using gin (name extensions.gin_trgm_ops);
create index tools_category_idx on public.tools (category_slug) where status = 'published';
create index tools_tags_idx on public.tools using gin (tags);
create index tools_embedding_idx on public.tools using hnsw (embedding extensions.vector_cosine_ops);
