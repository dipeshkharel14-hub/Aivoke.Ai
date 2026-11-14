-- Aivoke 0005: Row Level Security on EVERY table + column-level grants
-- Server-only tables have RLS enabled and no client policies (service role bypasses RLS).

alter table public.profiles                 enable row level security;
alter table public.follows                  enable row level security;
alter table public.blocks                   enable row level security;
alter table public.reports                  enable row level security;
alter table public.categories               enable row level security;
alter table public.tools                    enable row level security;
alter table public.reviews                  enable row level security;
alter table public.upvotes                  enable row level security;
alter table public.bookmarks                enable row level security;
alter table public.collections              enable row level security;
alter table public.collection_items         enable row level security;
alter table public.submissions              enable row level security;
alter table public.newsletter_subscribers   enable row level security;
alter table public.security_events          enable row level security;
alter table public.tool_visits              enable row level security;
alter table public.points_ledger            enable row level security;
alter table public.badges                   enable row level security;
alter table public.user_badges              enable row level security;
alter table public.rewards_catalog          enable row level security;
alter table public.redemptions              enable row level security;
alter table public.referrals                enable row level security;
alter table public.weekly_featured_creators enable row level security;
alter table public.chat_sessions            enable row level security;
alter table public.chat_messages            enable row level security;
alter table public.usage_limits             enable row level security;

-- ---------- column-level grants ----------
-- profiles: clients can read only public-safe columns and write only editable ones.
-- Points, level, role, bans, counts and referral fields can never be written by a client.
-- Any column added later is invisible/unwritable to clients until granted here (safe default).
revoke all on public.profiles from anon, authenticated;
grant select (id, username, display_name, avatar_url, bio, links, country, is_public, is_verified, is_banned,
              points, lifetime_points, level, streak_days, follower_count, following_count, created_at)
  on public.profiles to anon, authenticated;
grant update (username, display_name, avatar_url, bio, links, country, is_public,
              show_on_leaderboard, featured_opt_in, locale, notify_product, notify_social, onboarded_at)
  on public.profiles to authenticated;

-- tools: never expose the embedding or tsvector to clients
revoke all on public.tools from anon, authenticated;
grant select (id, name, slug, tagline, description, url, tags, category_slug, is_trending, is_new,
              upvote_count, rating_avg, review_count, status, created_at, updated_at)
  on public.tools to anon, authenticated;

-- server-only or read-only tables: remove client write privileges outright (defence in depth)
revoke insert, update, delete on public.points_ledger, public.tool_visits, public.user_badges,
  public.redemptions, public.referrals, public.weekly_featured_creators, public.usage_limits,
  public.newsletter_subscribers, public.security_events, public.chat_messages,
  public.categories, public.badges, public.rewards_catalog from anon, authenticated;
revoke insert, update on public.chat_sessions from anon, authenticated;
revoke insert, update on public.reviews from anon, authenticated;       -- written by server route (spam checks, Turnstile)
revoke all on public.blocks, public.reports, public.upvotes, public.bookmarks, public.tool_visits,
  public.points_ledger, public.redemptions, public.referrals, public.chat_sessions, public.chat_messages,
  public.usage_limits, public.newsletter_subscribers, public.security_events, public.submissions from anon;
revoke all on public.usage_limits, public.newsletter_subscribers, public.security_events from authenticated;

-- ---------- profiles ----------
create policy profiles_select on public.profiles for select using (
  id = (select auth.uid())
  or public.is_admin()
  or (is_public and not is_banned and username is not null
      and not public.is_blocked_between((select auth.uid()), id))
);
create policy profiles_update_own on public.profiles for update
  using (id = (select auth.uid()) and not is_banned)
  with check (id = (select auth.uid()) and not is_banned);
-- no insert policy (trigger creates rows); no delete policy (account deletion runs server-side)

-- ---------- follows / blocks / reports ----------
create policy follows_select on public.follows for select using (
  (select auth.uid()) in (follower_id, following_id)
  or (public.profile_is_visible(follower_id) and public.profile_is_visible(following_id))
);
create policy follows_insert on public.follows for insert
  with check (follower_id = (select auth.uid()) and public.can_follow(following_id));
create policy follows_delete on public.follows for delete using (follower_id = (select auth.uid()));

create policy blocks_select on public.blocks for select using (blocker_id = (select auth.uid()));
create policy blocks_insert on public.blocks for insert with check (blocker_id = (select auth.uid()));
create policy blocks_delete on public.blocks for delete using (blocker_id = (select auth.uid()));

create policy reports_insert on public.reports for insert with check (
  reporter_id = (select auth.uid()) and status = 'open' and handled_by is null
  and public.is_active_member());
create policy reports_select on public.reports for select using (
  reporter_id = (select auth.uid()) or public.is_admin());

-- ---------- directory (public read; writes by service role / admin server actions) ----------
create policy categories_select on public.categories for select using (true);
create policy tools_select on public.tools for select using (status = 'published' or public.is_admin());

-- ---------- reviews / upvotes / bookmarks ----------
create policy reviews_select on public.reviews for select using (
  status = 'published' or user_id = (select auth.uid()) or public.is_admin());
create policy reviews_delete_own on public.reviews for delete using (user_id = (select auth.uid()));

create policy upvotes_select on public.upvotes for select using (user_id = (select auth.uid()));
create policy upvotes_insert on public.upvotes for insert with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.tools t where t.id = tool_id and t.status = 'published'));
create policy upvotes_delete on public.upvotes for delete using (user_id = (select auth.uid()));

create policy bookmarks_select on public.bookmarks for select using (user_id = (select auth.uid()));
create policy bookmarks_insert on public.bookmarks for insert with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.tools t where t.id = tool_id and t.status = 'published'));
create policy bookmarks_delete on public.bookmarks for delete using (user_id = (select auth.uid()));

-- ---------- collections ----------
create policy collections_select on public.collections for select using (
  owner_id = (select auth.uid()) or public.is_admin()
  or (is_public and public.profile_is_visible(owner_id)));
create policy collections_insert on public.collections for insert with check (owner_id = (select auth.uid()));
create policy collections_update on public.collections for update
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy collections_delete on public.collections for delete using (owner_id = (select auth.uid()));

-- the sub-select on collections is itself filtered by collections_select
create policy collection_items_select on public.collection_items for select using (
  exists (select 1 from public.collections c where c.id = collection_id));
create policy collection_items_insert on public.collection_items for insert with check (
  exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid()))
  and exists (select 1 from public.tools t where t.id = tool_id and t.status = 'published'));
create policy collection_items_update on public.collection_items for update
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())));
create policy collection_items_delete on public.collection_items for delete using (
  exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())));

-- ---------- submissions ----------
create policy submissions_insert on public.submissions for insert with check (
  user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null
  and ai_prefill is null and tool_id is null
  and public.is_active_member());
create policy submissions_select on public.submissions for select using (
  user_id = (select auth.uid()) or public.is_admin());

-- ---------- admin-read-only server tables ----------
create policy newsletter_admin_select on public.newsletter_subscribers for select using (public.is_admin());
create policy security_events_admin_select on public.security_events for select using (public.is_admin());

-- ---------- rewards ----------
create policy tool_visits_select on public.tool_visits for select using (user_id = (select auth.uid()));
create policy ledger_select on public.points_ledger for select using (
  user_id = (select auth.uid()) or public.is_admin());
create policy badges_select on public.badges for select using (true);
create policy user_badges_select on public.user_badges for select using (
  user_id = (select auth.uid()) or public.profile_is_visible(user_id));
create policy rewards_select on public.rewards_catalog for select using (is_active or public.is_admin());
create policy redemptions_select on public.redemptions for select using (
  user_id = (select auth.uid()) or public.is_admin());
create policy referrals_select on public.referrals for select using (
  (select auth.uid()) in (referrer_id, referred_id) or public.is_admin());
create policy featured_select on public.weekly_featured_creators for select using (
  public.profile_is_visible(user_id));

-- ---------- chat (guest sessions have user_id null: server-only) ----------
create policy chat_sessions_select on public.chat_sessions for select using (user_id = (select auth.uid()));
create policy chat_sessions_delete on public.chat_sessions for delete using (user_id = (select auth.uid()));
create policy chat_messages_select on public.chat_messages for select using (
  exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
-- usage_limits: RLS on, no policies => service role only
