create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

drop policy if exists "Admins can read their own grant" on public.admin_users;
create policy "Admins can read their own grant"
  on public.admin_users
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users as admin
    where admin.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_list_user_balances()
returns table (
  user_id uuid,
  currency_code text,
  money_in numeric,
  money_out numeric,
  total_balance numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  return query
  select
    profile.id,
    profile.currency_code,
    coalesce(sum(case
      when transaction.direction = 'money_in' then transaction.amount
      else 0
    end), 0),
    coalesce(sum(case
      when transaction.direction = 'money_out' then transaction.amount
      else 0
    end), 0),
    coalesce(sum(case
      when transaction.direction = 'money_in' then transaction.amount
      else -transaction.amount
    end), 0)
  from public.profiles as profile
  left join public.account_transactions as transaction
    on transaction.user_id = profile.id
    and transaction.currency_code = profile.currency_code
  group by profile.id, profile.currency_code;
end;
$$;

revoke all on function public.admin_list_user_balances() from public, anon, authenticated;
grant execute on function public.admin_list_user_balances() to authenticated;

alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

revoke update (is_suspended) on public.profiles from authenticated;

create or replace function public.reject_suspended_account_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.profiles as profile
    where profile.id = new.user_id
      and profile.is_suspended
  ) then
    raise exception 'This account is suspended. Contact support for assistance.';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_suspended_account_transaction() from public, anon, authenticated;

drop trigger if exists reject_suspended_account_transaction on public.account_transactions;
create trigger reject_suspended_account_transaction
  before insert on public.account_transactions
  for each row execute function public.reject_suspended_account_transaction();

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users and admins can read profiles" on public.profiles;
create policy "Users and admins can read profiles"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can update their own display name" on public.profiles;
create policy "Users can update their own display name"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id and not is_suspended)
  with check ((select auth.uid()) = id and not is_suspended);

alter table public.user_activity
  drop constraint if exists user_activity_event_type_check;

alter table public.user_activity
  add constraint user_activity_event_type_check
  check (event_type in (
    'account_created',
    'signed_in',
    'sign_out_requested',
    'deposit_preview',
    'transfer_preview',
    'account_suspended',
    'account_reactivated'
  ));

drop policy if exists "Users can read their own activity" on public.user_activity;
drop policy if exists "Users and admins can read activity" on public.user_activity;
create policy "Users and admins can read activity"
  on public.user_activity
  for select
  to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "Users can record their own activity" on public.user_activity;
drop policy if exists "Active users can record their own activity" on public.user_activity;
create policy "Active users can record their own activity"
  on public.user_activity
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.is_suspended
    )
  );

drop policy if exists "Users can mark their own activity as read" on public.user_activity;
drop policy if exists "Active users can mark their own activity as read" on public.user_activity;
create policy "Active users can mark their own activity as read"
  on public.user_activity
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.is_suspended
    )
  )
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.is_suspended
    )
  );

drop policy if exists "Users can read their own account transactions" on public.account_transactions;
drop policy if exists "Active users and admins can read account transactions" on public.account_transactions;
create policy "Active users and admins can read account transactions"
  on public.account_transactions
  for select
  to authenticated
  using (
    (select public.is_admin())
    or (
      (select auth.uid()) = user_id
      and not exists (
        select 1 from public.profiles as profile
        where profile.id = (select auth.uid()) and profile.is_suspended
      )
    )
  );

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('user_suspended', 'user_reactivated', 'user_deleted')),
  subject_user_id uuid,
  subject_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc, id desc);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;
grant select on table public.admin_audit_log to authenticated;

drop policy if exists "Admins can read admin audit history" on public.admin_audit_log;
create policy "Admins can read admin audit history"
  on public.admin_audit_log
  for select
  to authenticated
  using ((select public.is_admin()));

create or replace function public.admin_set_user_suspension(
  p_user_id uuid,
  p_suspended boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_email text;
begin
  if current_user_id is null or not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  if p_user_id is null or p_suspended is null then
    raise exception 'Choose a user and a suspension status.';
  end if;

  if p_user_id = current_user_id then
    raise exception 'You cannot suspend your own administrator account.';
  end if;

  if exists (
    select 1
    from public.admin_users as admin
    where admin.user_id = p_user_id
  ) then
    raise exception 'Administrator accounts cannot be suspended here.';
  end if;

  select profile.email
  into target_email
  from public.profiles as profile
  where profile.id = p_user_id
  for update;

  if not found then
    raise exception 'The selected user does not exist.';
  end if;

  update public.profiles
  set is_suspended = p_suspended
  where id = p_user_id;

  insert into public.admin_audit_log (actor_user_id, action, subject_user_id, subject_email)
  values (
    current_user_id,
    case when p_suspended then 'user_suspended' else 'user_reactivated' end,
    p_user_id,
    target_email
  );

  insert into public.user_activity (user_id, event_type, description)
  values (
    p_user_id,
    case when p_suspended then 'account_suspended' else 'account_reactivated' end,
    case when p_suspended
      then 'Your account access has been suspended. Contact support for assistance.'
      else 'Your account access has been restored.'
    end
  );
end;
$$;

create or replace function public.admin_delete_user(
  p_user_id uuid,
  p_confirmation_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_email text;
begin
  if current_user_id is null or not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  if p_user_id is null or p_confirmation_email is null then
    raise exception 'Select a user and confirm their email address.';
  end if;

  if p_user_id = current_user_id then
    raise exception 'You cannot delete your own administrator account.';
  end if;

  if exists (
    select 1
    from public.admin_users as admin
    where admin.user_id = p_user_id
  ) then
    raise exception 'Administrator accounts cannot be deleted here.';
  end if;

  select auth_user.email
  into target_email
  from auth.users as auth_user
  where auth_user.id = p_user_id
    and auth_user.email = p_confirmation_email;

  if target_email is null then
    raise exception 'The confirmation email does not match the selected user.';
  end if;

  insert into public.admin_audit_log (actor_user_id, action, subject_user_id, subject_email)
  values (current_user_id, 'user_deleted', p_user_id, target_email);

  delete from auth.users
  where id = p_user_id
    and email = target_email;

  if not found then
    raise exception 'The user could not be deleted.';
  end if;
end;
$$;

revoke all on function public.admin_set_user_suspension(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_delete_user(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_user_suspension(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid, text) to authenticated;

comment on table public.admin_users is
  'Administrator grants. Manage only through the trusted Supabase SQL Editor; never expose insert or update access to app users.';
comment on function public.admin_delete_user(uuid, text) is
  'Permanently deletes a non-admin auth user and cascades their profile, illustrative ledger and activity data. Requires exact email confirmation.';

notify pgrst, 'reload schema';
