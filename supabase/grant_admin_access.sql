do $$
declare
  target_email text := 'joseph@gmail.com';
  target_user_id uuid;
begin
  select auth_user.id
  into target_user_id
  from auth.users as auth_user
  where lower(auth_user.email) = lower(target_email);

  if target_user_id is null then
    raise exception 'No registered account was found for the requested administrator email.';
  end if;

  insert into public.admin_users (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;
end;
$$;
