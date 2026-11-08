create table if not exists public.user_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'account_created',
      'signed_in',
      'sign_out_requested',
      'deposit_preview',
      'transfer_preview'
    )
  ),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists user_activity_user_created_idx
  on public.user_activity (user_id, created_at desc, id desc);

alter table public.user_activity enable row level security;

revoke all on table public.user_activity from anon, authenticated;
grant select on table public.user_activity to authenticated;
grant insert (user_id, event_type, description) on table public.user_activity to authenticated;
grant update (read_at) on table public.user_activity to authenticated;

drop policy if exists "Users can read their own activity" on public.user_activity;
create policy "Users can read their own activity"
  on public.user_activity
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can record their own activity" on public.user_activity;
create policy "Users can record their own activity"
  on public.user_activity
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can mark their own activity as read" on public.user_activity;
create policy "Users can mark their own activity as read"
  on public.user_activity
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into public.user_activity (user_id, event_type, description, created_at)
select
  auth_user.id,
  'account_created',
  'Your Cairn profile was created.',
  coalesce(auth_user.created_at, now())
from auth.users as auth_user
where not exists (
  select 1
  from public.user_activity as activity
  where activity.user_id = auth_user.id
    and activity.event_type = 'account_created'
);

create or replace function public.record_new_user_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_activity (user_id, event_type, description, created_at)
  values (
    new.id,
    'account_created',
    'Your Cairn profile was created.',
    coalesce(new.created_at, now())
  );
  return new;
end;
$$;

revoke all on function public.record_new_user_activity() from public, anon, authenticated;

drop trigger if exists on_auth_user_activity_created on auth.users;
create trigger on_auth_user_activity_created
  after insert on auth.users
  for each row execute function public.record_new_user_activity();
