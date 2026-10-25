-- Flow Cloud: a tiny per-person daily counter. Run once in the Supabase SQL editor.
-- The table is private. Only the flow-assist edge function (service role) can touch it.
create table if not exists public.flow_usage (
  who   text not null,          -- "d:<device id>", "i:<hashed address>" or "g" for the global counter
  day   date not null,
  count integer not null default 0,
  primary key (who, day)
);
alter table public.flow_usage enable row level security;  -- no policies: nobody but the service role

-- Adds one use and says whether it was allowed. Atomic, so two quick requests cannot both slip under the limit.
create or replace function public.flow_hit(p_who text, p_limit integer)
returns table (allowed boolean, used integer)
language plpgsql security definer set search_path = public as $$
declare current_count integer;
begin
  insert into public.flow_usage (who, day, count) values (p_who, (now() at time zone 'utc')::date, 0)
  on conflict (who, day) do nothing;
  update public.flow_usage set count = count + 1
   where who = p_who and day = (now() at time zone 'utc')::date and count < p_limit
  returning count into current_count;
  if current_count is null then
    select count into current_count from public.flow_usage where who = p_who and day = (now() at time zone 'utc')::date;
    return query select false, current_count;
    return;
  end if;
  return query select true, current_count;
end $$;

revoke all on function public.flow_hit(text, integer) from public, anon, authenticated;
grant execute on function public.flow_hit(text, integer) to service_role;

-- Optional tidy-up of old rows (run now and then, or schedule with pg_cron).
-- delete from public.flow_usage where day < (now() at time zone 'utc')::date - 7;
