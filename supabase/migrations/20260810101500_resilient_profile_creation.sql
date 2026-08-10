-- ============================================================================
-- Signup must not depend on the profile insert succeeding
--
-- The trigger ran inside GoTrue's own transaction, so any failure inside it
-- took the whole signup down with a 500 and left no account behind. That is
-- the wrong trade: a missing profile row is a small, repairable problem, while
-- a signup that cannot complete is a wall.
--
-- Two changes:
--   1. handle_new_user() no longer propagates. It logs the real SQLSTATE and
--      message as a warning (Dashboard → Logs → Postgres) and lets the signup
--      through.
--   2. A user may create their own profile row, so the app can heal the gap on
--      first sign-in. The policy pins the role to 'client'; only an admin can
--      move it from there, as before.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.profiles (id, email, full_name, company)
    values (
      new.id,
      new.email,
      nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
      nullif(btrim(coalesce(new.raw_user_meta_data ->> 'company', '')), '')
    )
    on conflict (id) do nothing;
  exception
    when others then
      -- surfaces in the Postgres logs; the app creates the row on first login
      raise warning 'handle_new_user could not create a profile for % — % / %',
        new.id, sqlstate, sqlerrm;
  end;

  return new;
end;
$$;

-- Self-heal path. `role = 'client'` in the check is what keeps this from being
-- a way to mint an admin: the row can only be created at the lowest privilege,
-- and profiles_guard_columns still rejects any later self-promotion.
create policy "a user may create their own profile row"
on public.profiles for insert to authenticated
with check (
  id = (select auth.uid())
  and role = 'client'
);

grant insert on public.profiles to authenticated;
