create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  country_code text not null default '',
  country_name text not null default '',
  currency_code text not null default '',
  currency_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text not null default '',
  add column if not exists display_name text not null default '',
  add column if not exists country_code text not null default '',
  add column if not exists country_name text not null default '',
  add column if not exists currency_code text not null default '',
  add column if not exists currency_name text not null default '';

update public.profiles as profile
set
  email = coalesce(auth_user.email, ''),
  display_name = coalesce(nullif(profile.display_name, ''), auth_user.raw_user_meta_data ->> 'display_name', ''),
  country_code = coalesce(nullif(profile.country_code, ''), auth_user.raw_user_meta_data ->> 'country_code', ''),
  country_name = coalesce(nullif(profile.country_name, ''), auth_user.raw_user_meta_data ->> 'country_name', ''),
  currency_code = coalesce(nullif(profile.currency_code, ''), auth_user.raw_user_meta_data ->> 'currency_code', ''),
  currency_name = coalesce(nullif(profile.currency_name, ''), auth_user.raw_user_meta_data ->> 'currency_name', '')
from auth.users as auth_user
where auth_user.id = profile.id;

insert into public.profiles (
  id,
  email,
  display_name,
  country_code,
  country_name,
  currency_code,
  currency_name
)
select
  auth_user.id,
  coalesce(auth_user.email, ''),
  coalesce(auth_user.raw_user_meta_data ->> 'display_name', ''),
  coalesce(auth_user.raw_user_meta_data ->> 'country_code', ''),
  coalesce(auth_user.raw_user_meta_data ->> 'country_name', ''),
  coalesce(auth_user.raw_user_meta_data ->> 'currency_code', ''),
  coalesce(auth_user.raw_user_meta_data ->> 'currency_name', '')
from auth.users as auth_user
on conflict (id) do nothing;

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    country_code,
    country_name,
    currency_code,
    currency_name
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.raw_user_meta_data ->> 'country_code', ''),
    coalesce(new.raw_user_meta_data ->> 'country_name', ''),
    coalesce(new.raw_user_meta_data ->> 'currency_code', ''),
    coalesce(new.raw_user_meta_data ->> 'currency_name', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    country_code = excluded.country_code,
    country_name = excluded.country_name,
    currency_code = excluded.currency_code,
    currency_name = excluded.currency_name;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();
