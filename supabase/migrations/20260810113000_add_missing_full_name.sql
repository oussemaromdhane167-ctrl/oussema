-- ============================================================================
-- Restore profiles.full_name
--
-- The column is in the initial migration but is absent from the live database,
-- so it was lost somewhere between the file and the SQL editor. Everything
-- downstream assumed it: handle_new_user() writes to it, which is what raised
-- inside GoTrue's transaction and surfaced as "Database error saving new user",
-- and both dashboards read it to greet the signed-in user.
--
-- Verified against the live project first — every other table and column in the
-- schema is present, so this is the whole of the drift.
-- ============================================================================

alter table public.profiles
  add column if not exists full_name text;

-- Matches the constraint the initial migration declares. Wrapped because
-- ADD CONSTRAINT has no IF NOT EXISTS, and this file should stay re-runnable.
do $$
begin
  alter table public.profiles
    add constraint profiles_full_name_check check (char_length(full_name) <= 120);
exception
  when duplicate_object then null;
end;
$$;
