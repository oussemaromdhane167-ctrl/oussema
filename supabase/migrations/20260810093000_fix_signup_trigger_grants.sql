-- ============================================================================
-- Fix: signup failed with "Database error saving new user"
--
-- GoTrue inserts into auth.users as `supabase_auth_admin`, which fires the
-- on_auth_user_created trigger. Current Supabase projects do not grant that
-- role USAGE on schema public, and a role cannot execute a function in a schema
-- it cannot see — SECURITY DEFINER decides what the function may do once it is
-- running, not whether the caller may reach it.
--
-- The trigger therefore raised, GoTrue rolled the transaction back, and every
-- signup came back as a 500 with the account never created.
-- ============================================================================

grant usage on schema public to supabase_auth_admin;

grant execute on function public.handle_new_user() to supabase_auth_admin;

-- The function is SECURITY DEFINER and owned by postgres, so it writes to
-- public.profiles with the owner's rights and needs no table grant of its own.
