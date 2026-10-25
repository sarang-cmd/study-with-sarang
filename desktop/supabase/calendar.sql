-- Study with Sarang: private calendar link (optional).
-- Run this once in your Supabase project (SQL Editor, New query, Run), then deploy the function:
--   supabase functions deploy calendar-feed --no-verify-jwt
-- Each signed-in user gets one row: a random token (the secret in their private link) and the calendar text the app
-- made for them. Row Level Security means a user can only read or change their own row. The public link works through
-- the function below, which hands out the calendar text for one exact token and nothing else. No service-role key is needed.

create table if not exists public.calendar_feeds (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  token      text        not null unique,
  ics        text        not null default '',
  updated_at timestamptz not null default now(),
  constraint calendar_feeds_token_shape check (token ~ '^[a-f0-9]{32,64}$'),
  constraint calendar_feeds_size check (length(ics) < 400000)
);

alter table public.calendar_feeds enable row level security;

drop policy if exists "calendar_feeds_select_own" on public.calendar_feeds;
drop policy if exists "calendar_feeds_insert_own" on public.calendar_feeds;
drop policy if exists "calendar_feeds_update_own" on public.calendar_feeds;
drop policy if exists "calendar_feeds_delete_own" on public.calendar_feeds;
create policy "calendar_feeds_select_own" on public.calendar_feeds for select to authenticated using (auth.uid() = user_id);
create policy "calendar_feeds_insert_own" on public.calendar_feeds for insert to authenticated with check (auth.uid() = user_id);
create policy "calendar_feeds_update_own" on public.calendar_feeds for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "calendar_feeds_delete_own" on public.calendar_feeds for delete to authenticated using (auth.uid() = user_id);

revoke all on public.calendar_feeds from anon;
grant select, insert, update, delete on public.calendar_feeds to authenticated;

-- The only thing the public link can do: return the calendar for one exact token.
create or replace function public.calendar_feed_get(p_token text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select ics from public.calendar_feeds where token = p_token limit 1
$$;
revoke all on function public.calendar_feed_get(text) from public;
grant execute on function public.calendar_feed_get(text) to anon, authenticated;
