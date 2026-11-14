-- Aivoke 0004: helper functions, signup trigger, count-sync triggers, points core
-- All functions that bypass RLS are SECURITY DEFINER with an empty search_path.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' and not is_banned from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

-- Can the current viewer see this profile at all? (public, not banned, onboarded, not blocked either way)
create or replace function public.profile_is_visible(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = p and is_public and not is_banned and username is not null)
     and not public.is_blocked_between((select auth.uid()), p)
$$;

create or replace function public.can_follow(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
     and target <> (select auth.uid())
     and exists (select 1 from public.profiles where id = (select auth.uid()) and not is_banned and username is not null)
     and public.profile_is_visible(target)
$$;

-- Signed-in, onboarded, not banned (used by write policies so they need no column access on profiles)
create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = (select auth.uid()) and not is_banned and username is not null)
$$;

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.username_ok(lower(p_username))
     and not exists (select 1 from public.profiles
                     where username = lower(p_username) and id is distinct from (select auth.uid()))
$$;

-- Owner-only account fields that are not column-granted to clients
create or replace function public.my_account() returns table (
  id uuid, role text, locale text, notify_product boolean, notify_social boolean,
  show_on_leaderboard boolean, featured_opt_in boolean, referral_code text,
  referred_by uuid, last_active_date date, onboarded_at timestamptz, is_banned boolean,
  points integer, lifetime_points integer, level text, streak_days integer)
language sql stable security definer set search_path = '' as $$
  select p.id, p.role, p.locale, p.notify_product, p.notify_social, p.show_on_leaderboard,
         p.featured_opt_in, p.referral_code, p.referred_by, p.last_active_date, p.onboarded_at,
         p.is_banned, p.points, p.lifetime_points, p.level, p.streak_days
  from public.profiles p where p.id = (select auth.uid())
$$;

-- Levels from lifetime points (thresholds are tunable here in one place)
create or replace function public.level_for(lifetime integer) returns text
language sql immutable as $$
  select case when lifetime >= 2000 then 'Master'
              when lifetime >= 500  then 'Pro'
              when lifetime >= 100  then 'Builder'
              else 'Explorer' end
$$;

create or replace function public.generate_referral_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare c text;
begin
  loop
    c := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (select 1 from public.profiles where referral_code = c);
  end loop;
  return c;
end $$;

-- ---------- signup: auto-create profile (+ referral link) ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ref_code text; ref_id uuid;
begin
  ref_code := upper(nullif(trim(new.raw_user_meta_data->>'ref'), ''));
  if ref_code is not null then
    select id into ref_id from public.profiles where referral_code = ref_code and not is_banned;
  end if;

  insert into public.profiles (id, display_name, referral_code, referred_by)
  values (new.id,
          left(nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), ''), 50),
          public.generate_referral_code(),
          ref_id);

  if ref_id is not null and ref_id <> new.id then
    insert into public.referrals (referrer_id, referred_id) values (ref_id, new.id) on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- keep counts in sync ----------
create or replace function public.sync_follow_counts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
  else
    update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.following_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  end if;
  return null;
end $$;
create trigger follows_counts after insert or delete on public.follows
  for each row execute function public.sync_follow_counts();

create or replace function public.sync_upvote_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.tools set upvote_count = upvote_count + 1 where id = new.tool_id;
  else
    update public.tools set upvote_count = greatest(upvote_count - 1, 0) where id = old.tool_id;
  end if;
  return null;
end $$;
create trigger upvotes_counts after insert or delete on public.upvotes
  for each row execute function public.sync_upvote_count();

create or replace function public.sync_review_stats() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t uuid := coalesce(new.tool_id, old.tool_id);
begin
  update public.tools x set
    review_count = coalesce(s.n, 0),
    rating_avg = coalesce(round(s.a, 2), 0)
  from (select count(*) n, avg(rating) a from public.reviews where tool_id = t and status = 'published') s
  where x.id = t;
  return null;
end $$;
create trigger reviews_stats after insert or update or delete on public.reviews
  for each row execute function public.sync_review_stats();

-- Blocking removes follows in both directions
create or replace function public.on_block_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return null;
end $$;
create trigger blocks_cleanup after insert on public.blocks
  for each row execute function public.on_block_created();

-- ---------- points: the ONLY write path ----------
-- Ledger is append-only (cascade deletes from account deletion are the one exception).
create or replace function public.ledger_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'points_ledger is append-only';
end $$;
create trigger points_ledger_no_change before update or delete on public.points_ledger
  for each row execute function public.ledger_append_only();

-- Returns true if applied, false if the idempotency key was already used (or nothing to apply).
create or replace function public.award_points(
  p_user uuid, p_delta integer, p_reason text, p_ref text, p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare prof public.profiles%rowtype; applied integer; revoke_reason boolean; new_life integer; v_id bigint;
begin
  if p_delta = 0 then return false; end if;
  select * into prof from public.profiles where id = p_user for update;
  if not found then return false; end if;
  if prof.is_banned and p_delta > 0 then return false; end if;

  revoke_reason := p_reason in ('admin_revoke','fraud_revoke');
  applied := p_delta;
  if p_delta < 0 then
    if revoke_reason then
      applied := -least(-p_delta, prof.points);          -- revocations clamp at zero
      if applied = 0 then return false; end if;
    elsif prof.points + p_delta < 0 then
      raise exception 'insufficient_points' using errcode = 'P0001';
    end if;
  end if;

  insert into public.points_ledger (user_id, delta, reason, ref_id, idempotency_key)
  values (p_user, applied, p_reason, p_ref, p_key)
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then return false; end if;

  new_life := case when applied > 0 then prof.lifetime_points + applied
                   when revoke_reason then greatest(prof.lifetime_points + applied, 0)
                   else prof.lifetime_points end;
  update public.profiles
     set points = points + applied, lifetime_points = new_life, level = public.level_for(new_life)
   where id = p_user;
  return true;
end $$;

-- ---------- RAG: similarity search (called server-side only) ----------
create or replace function public.match_tools(
  query_embedding extensions.vector(768), match_count integer default 8, filter_category text default null)
returns table (id uuid, slug text, name text, tagline text, url text, category_slug text, tags text[], similarity float)
language sql stable security definer set search_path = '' as $$
  select t.id, t.slug, t.name, t.tagline, t.url, t.category_slug, t.tags,
         1 - (t.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.tools t
  where t.status = 'published' and t.embedding is not null
    and (filter_category is null or t.category_slug = filter_category)
  order by t.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20)
$$;

-- ---------- execute permissions ----------
revoke execute on function public.award_points(uuid, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.match_tools(extensions.vector, integer, text) from public, anon, authenticated;
revoke execute on function public.generate_referral_code() from public, anon, authenticated;
grant execute on function public.award_points(uuid, integer, text, text, text) to service_role;
grant execute on function public.match_tools(extensions.vector, integer, text) to service_role;

-- helpers used inside RLS policies must stay callable by clients
grant execute on function public.is_admin(), public.is_blocked_between(uuid, uuid),
  public.profile_is_visible(uuid), public.can_follow(uuid), public.is_active_member(), public.level_for(integer),
  public.links_valid(jsonb), public.username_ok(text) to anon, authenticated;
grant execute on function public.username_available(text), public.my_account() to authenticated;
