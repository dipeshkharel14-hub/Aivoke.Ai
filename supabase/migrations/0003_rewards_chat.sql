-- Aivoke 0003: visits, points ledger, badges, rewards, referrals, featured creators, chat, quotas
create table public.tool_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  visited_at timestamptz not null default now(),
  day date not null default (now() at time zone 'utc')::date,
  ip_hash text,
  unique (user_id, tool_id, day)         -- one reward per tool per user per day
);
create index tool_visits_user_day_idx on public.tool_visits (user_id, day);

-- Append-only. Rows are inserted only by public.award_points() (0004).
create table public.points_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null,
  ref_id text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index points_ledger_user_idx on public.points_ledger (user_id, created_at desc);
create index points_ledger_reason_day_idx on public.points_ledger (user_id, reason, created_at);

create table public.badges (
  slug text primary key,
  name text not null,
  description text not null,
  icon text
);
create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_slug text not null references public.badges(slug) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_slug)
);

create table public.rewards_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  cost_points integer not null check (cost_points > 0),
  kind text not null check (kind in ('profile_highlight','extra_ai_questions','priority_listing','early_access','pro_discount')),
  needs_admin_review boolean not null default false,
  stock integer check (stock is null or stock >= 0),
  is_active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id uuid not null references public.rewards_catalog(id),
  cost_points integer not null check (cost_points > 0),
  status text not null default 'pending' check (status in ('pending','approved','fulfilled','rejected','cancelled')),
  code text,
  admin_note text,
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index redemptions_status_idx on public.redemptions (status, created_at desc);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','completed','rejected')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint no_self_referral check (referrer_id <> referred_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id, completed_at);

create table public.weekly_featured_creators (
  week_start date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank smallint not null,
  reason text,
  primary key (week_start, user_id)
);

-- ---------- AI assistant ----------
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,  -- null = guest (server-only access)
  guest_key_hash text,
  title text,
  created_at timestamptz not null default now()
);
create index chat_sessions_user_idx on public.chat_sessions (user_id, created_at desc);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 8000),
  tool_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index chat_messages_session_idx on public.chat_messages (session_id, created_at);

-- Server-side quota mirror (Upstash is the enforcement point). No client access.
create table public.usage_limits (
  subject_key text not null,           -- 'u:<uuid>' or 'ip:<hash>'
  kind text not null,                  -- 'assistant', 'search_ai', ...
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0,
  primary key (subject_key, kind, day)
);
