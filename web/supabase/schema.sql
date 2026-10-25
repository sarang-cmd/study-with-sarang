-- Study with Sarang: optional cloud sync.
-- Run this once in your Supabase project (SQL Editor, New query, Run).
-- One row per signed-in user holds a JSON snapshot of the synced data. Row Level Security means a
-- user can only ever read or change their own row. No service-role key is needed by the app.

create table if not exists public.study_sync (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  rev        integer     not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.study_sync enable row level security;

drop policy if exists "study_sync_select_own" on public.study_sync;
drop policy if exists "study_sync_insert_own" on public.study_sync;
drop policy if exists "study_sync_update_own" on public.study_sync;
drop policy if exists "study_sync_delete_own" on public.study_sync;

create policy "study_sync_select_own" on public.study_sync for select to authenticated using (auth.uid() = user_id);
create policy "study_sync_insert_own" on public.study_sync for insert to authenticated with check (auth.uid() = user_id);
create policy "study_sync_update_own" on public.study_sync for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study_sync_delete_own" on public.study_sync for delete to authenticated using (auth.uid() = user_id);

-- Keep the snapshot small and well formed.
alter table public.study_sync drop constraint if exists study_sync_size;
alter table public.study_sync add constraint study_sync_size check (pg_column_size(data) < 2000000);

revoke all on public.study_sync from anon;
grant select, insert, update, delete on public.study_sync to authenticated;
