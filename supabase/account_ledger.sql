create table if not exists public.account_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  direction text not null check (direction in ('money_in', 'money_out')),
  account_name text not null check (account_name in ('Everyday account', 'Savings space')),
  amount numeric(20, 6) not null check (amount > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  transfer_method text not null,
  destination text not null,
  created_at timestamptz not null default now()
);

create index if not exists account_transactions_user_created_idx
  on public.account_transactions (user_id, created_at desc, id desc);

alter table public.account_transactions enable row level security;

revoke all on table public.account_transactions from anon, authenticated;
grant select on table public.account_transactions to authenticated;

drop policy if exists "Users can read their own account transactions" on public.account_transactions;
create policy "Users can read their own account transactions"
  on public.account_transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.record_account_transaction(
  p_direction text,
  p_account_name text,
  p_amount numeric,
  p_currency_code text,
  p_transfer_method text,
  p_destination text
)
returns table (
  id bigint,
  direction text,
  account_name text,
  amount numeric,
  currency_code text,
  transfer_method text,
  destination text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  account_currency text;
  available_balance numeric;
begin
  if current_user_id is null then
    raise exception 'Sign in to record an account activity.';
  end if;

  if p_direction is null or p_direction not in ('money_in', 'money_out') then
    raise exception 'Choose a valid money-in or money-out action.';
  end if;

  if p_account_name is null or p_account_name not in ('Everyday account', 'Savings space') then
    raise exception 'Choose a valid account.';
  end if;

  if p_amount is null
    or p_amount::text in ('NaN', 'Infinity', '-Infinity')
    or p_amount <= 0
    or p_amount > 10000000 then
    raise exception 'Enter an amount greater than zero and no more than 10,000,000.';
  end if;

  if p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'Choose a valid currency.';
  end if;

  select profile.currency_code
  into account_currency
  from public.profiles as profile
  where profile.id = current_user_id;

  if account_currency is null or account_currency <> p_currency_code then
    raise exception 'The transaction currency must match your profile currency.';
  end if;

  if p_transfer_method is null or p_transfer_method not in (
    'Cash deposit',
    'Local transfer',
    'Cash App',
    'PayPal',
    'USDT',
    'Wise',
    'Venmo',
    'Other'
  ) then
    raise exception 'Choose a supported transfer method.';
  end if;

  if p_destination is null or pg_catalog.length(pg_catalog.btrim(p_destination)) = 0
    or pg_catalog.length(p_destination) > 100 then
    raise exception 'Enter a destination with 1 to 100 characters.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':' || p_account_name, 0)
  );

  if p_direction = 'money_out' then
    select coalesce(
      sum(case when ledger_entry.direction = 'money_in' then ledger_entry.amount else -ledger_entry.amount end),
      0
    )
    into available_balance
    from public.account_transactions as ledger_entry
    where ledger_entry.user_id = current_user_id
      and ledger_entry.account_name = p_account_name
      and ledger_entry.currency_code = p_currency_code;

    if p_amount > available_balance then
      raise exception 'The amount exceeds the available balance in this account.';
    end if;
  end if;

  return query
  insert into public.account_transactions as ledger_entry (
    user_id,
    direction,
    account_name,
    amount,
    currency_code,
    transfer_method,
    destination
  )
  values (
    current_user_id,
    p_direction,
    p_account_name,
    p_amount,
    p_currency_code,
    p_transfer_method,
    pg_catalog.btrim(p_destination)
  )
  returning
    ledger_entry.id,
    ledger_entry.direction,
    ledger_entry.account_name,
    ledger_entry.amount,
    ledger_entry.currency_code,
    ledger_entry.transfer_method,
    ledger_entry.destination,
    ledger_entry.created_at;

  insert into public.user_activity (user_id, event_type, description)
  values (
    current_user_id,
    case when p_direction = 'money_in' then 'deposit_preview' else 'transfer_preview' end,
    'Illustrative ' || p_direction || ' of ' || p_amount::text || ' ' || p_currency_code
      || ' for ' || pg_catalog.btrim(p_destination) || ' via ' || p_transfer_method
      || '. No real funds moved.'
  );
end;
$$;

revoke all on function public.record_account_transaction(text, text, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_account_transaction(text, text, numeric, text, text, text)
  to authenticated;
