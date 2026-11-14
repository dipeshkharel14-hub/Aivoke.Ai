-- Aivoke 0002: reviews, upvotes, bookmarks, collections, submissions, newsletter, security log
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or char_length(title) <= 100),
  body text not null check (char_length(body) between 20 and 2000),
  status text not null default 'published' check (status in ('published','pending','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tool_id)
);
create trigger reviews_updated before update on public.reviews for each row execute function public.set_updated_at();
create index reviews_tool_idx on public.reviews (tool_id, created_at desc);

create table public.upvotes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tool_id)
);
create index upvotes_tool_idx on public.upvotes (tool_id);

create table public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tool_id)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 280),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger collections_updated before update on public.collections for each row execute function public.set_updated_at();
create index collections_owner_idx on public.collections (owner_id);

create table public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (collection_id, tool_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  url text not null check (url ~* '^https://'),
  tagline text check (tagline is null or char_length(tagline) <= 140),
  description text check (description is null or char_length(description) <= 2000),
  category_slug text references public.categories(slug),
  tags text[] not null default '{}',
  ai_prefill jsonb,                      -- raw AI auto-fill output, for admin review only
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  tool_id uuid references public.tools(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index submissions_status_idx on public.submissions (status, created_at desc);

-- Written only by server routes (service role). No client policies.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_lower text generated always as (lower(email)) stored unique,
  confirm_token_hash text,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.security_events (
  id bigint generated always as identity primary key,
  event text not null,               -- e.g. rate_limited, turnstile_failed, upload_rejected, rls_denied
  user_id uuid references public.profiles(id) on delete set null,
  ip_hash text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index security_events_created_idx on public.security_events (created_at desc);
