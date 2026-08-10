-- ============================================================================
-- Buildario — initial backend schema
--
-- The site is a static bundle on GitHub Pages, so there is no server of ours
-- between the browser and the database: every query below is issued straight
-- from the page with the public anon key. That makes row level security the
-- whole security model, not a nicety — every table here is RLS-enabled and
-- denies by default, and the only write anonymous visitors can perform is the
-- contact form, funnelled through one SECURITY DEFINER function so they cannot
-- choose which columns they set.
--
-- Run once against a fresh project (SQL editor, or `supabase db push`).
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. TYPES
-- ============================================================================

create type public.user_role as enum ('client', 'admin');

create type public.lead_status as enum ('new', 'contacted', 'qualified', 'won', 'lost');

create type public.project_status as enum (
  'discovery', 'design', 'build', 'review', 'launched', 'archived'
);

-- ============================================================================
-- 2. PROFILES
-- Mirror of auth.users that is safe to join against and to expose to the
-- client. auth.users itself is never readable from the browser.
-- ============================================================================

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text check (char_length(full_name) <= 120),
  company    text check (char_length(company) <= 160),
  avatar_url text,
  role       public.user_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing user record. One row per auth.users row, created by trigger.';

-- Reading a role through a policy that is itself on public.profiles would
-- recurse forever. SECURITY DEFINER runs as the owner (postgres), which is not
-- subject to RLS, so this breaks the cycle. search_path is pinned to nothing so
-- a caller cannot shadow `public` with their own schema.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A signup is an insert on auth.users, which the browser triggers directly;
-- the profile has to appear in the same breath or the first dashboard load
-- finds nothing. full_name/company ride along in the signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, company)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'company', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- The profiles update policy has to let a user edit their own row, and a row is
-- all-or-nothing in Postgres — there is no column-level `with check`. Without
-- this guard any client could hand themselves `role = 'admin'` with a one-line
-- update. Runs for admins and for maintenance done as postgres/service_role,
-- where auth.uid() is null.
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'only an admin can change a profile role' using errcode = '42501';
  end if;

  new.id         := old.id;          -- the link to auth.users is never reassigned
  new.email      := old.email;       -- email of record lives in auth.users
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger profiles_guard_columns
before update on public.profiles
for each row execute function public.guard_profile_columns();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Deliberately not "any authenticated user can read any profile": a client has
-- no reason to enumerate other clients. Message threads label the other side
-- from the sender id alone, so no cross-profile read is needed.
create policy "profiles are readable by their owner and by admins"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_admin());

create policy "profiles are editable by their owner and by admins"
on public.profiles for update to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

-- No insert policy: rows arrive only through handle_new_user(). No delete
-- policy: deleting the auth user cascades, which is the supported path.

-- ============================================================================
-- 3. LEADS — contact form submissions
-- ============================================================================

create table public.leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 120),
  email      text not null check (
                char_length(email) <= 254
                and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
             ),
  company    text check (char_length(company) <= 160),
  budget     text check (char_length(budget) <= 60),
  message    text not null check (char_length(message) between 10 and 4000),
  source     text not null default 'website' check (char_length(source) <= 60),
  status     public.lead_status not null default 'new',
  notes      text check (char_length(notes) <= 8000),
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index leads_created_at_idx on public.leads (created_at desc);
create index leads_status_idx on public.leads (status);

alter table public.leads enable row level security;

create policy "leads are readable by admins"
on public.leads for select to authenticated
using (public.is_admin());

create policy "leads are editable by admins"
on public.leads for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "leads are deletable by admins"
on public.leads for delete to authenticated
using (public.is_admin());

-- Note the absence of an insert policy. A direct insert grant would let a
-- visitor set `status`, `notes`, or `handled_by` on the way in; the form calls
-- submit_lead() instead, which decides those itself.
create or replace function public.submit_lead(
  p_name    text,
  p_email   text,
  p_message text,
  p_company text default null,
  p_budget  text default null,
  p_source  text default 'website'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_recent integer;
begin
  p_name    := btrim(coalesce(p_name, ''));
  p_email   := lower(btrim(coalesce(p_email, '')));
  p_message := btrim(coalesce(p_message, ''));
  p_company := nullif(btrim(coalesce(p_company, '')), '');
  p_budget  := nullif(btrim(coalesce(p_budget, '')), '');
  p_source  := coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'website');

  if char_length(p_name) < 2 then
    raise exception 'Please enter your name.' using errcode = 'P0001';
  end if;

  if p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;

  if char_length(p_message) < 10 then
    raise exception 'Please describe your project in a little more detail.' using errcode = 'P0001';
  end if;

  -- Crude but effective throttle. There is no server in front of this endpoint
  -- and the anon key is public, so without a cap one script can fill the table.
  -- Per-address, not global: a real burst of interest must not lock people out.
  select count(*) into v_recent
  from public.leads l
  where l.email = p_email
    and l.created_at > now() - interval '1 hour';

  if v_recent >= 3 then
    raise exception 'You have already sent a few messages — I will reply to those first.'
      using errcode = 'P0001';
  end if;

  insert into public.leads (name, email, company, budget, message, source)
  values (p_name, p_email, p_company, p_budget, left(p_message, 4000), left(p_source, 60))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_lead(text, text, text, text, text, text) from public;
grant execute on function public.submit_lead(text, text, text, text, text, text)
  to anon, authenticated;

-- ============================================================================
-- 4. PROJECTS
-- ============================================================================

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles (id) on delete cascade,
  lead_id       uuid references public.leads (id) on delete set null,
  title         text not null check (char_length(title) between 2 and 160),
  summary       text check (char_length(summary) <= 4000),
  status        public.project_status not null default 'discovery',
  progress      smallint not null default 0 check (progress between 0 and 100),
  budget_cents  bigint check (budget_cents >= 0),
  currency      char(3) not null default 'USD',
  started_on    date,
  target_launch date,
  live_url      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index projects_client_idx on public.projects (client_id, created_at desc);
create index projects_status_idx on public.projects (status);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- Every child table (updates, messages, files, storage objects) answers the
-- same question — "may this user touch this project?" — so it lives in one
-- SECURITY DEFINER function rather than being restated six times.
create or replace function public.can_access_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects pr
    where pr.id = p_project
      and (pr.client_id = (select auth.uid()) or public.is_admin())
  );
$$;

alter table public.projects enable row level security;

create policy "projects are readable by their client and by admins"
on public.projects for select to authenticated
using (client_id = (select auth.uid()) or public.is_admin());

-- Clients read their project but never author one: scope, status and price are
-- agreed off-platform and entered by the studio.
create policy "projects are writable by admins"
on public.projects for insert to authenticated
with check (public.is_admin());

create policy "projects are updatable by admins"
on public.projects for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "projects are deletable by admins"
on public.projects for delete to authenticated
using (public.is_admin());

-- ============================================================================
-- 5. PROJECT UPDATES — the client-facing timeline
-- ============================================================================

create table public.project_updates (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  title      text not null check (char_length(title) between 2 and 160),
  body       text check (char_length(body) <= 8000),
  progress   smallint check (progress between 0 and 100),
  created_at timestamptz not null default now()
);

create index project_updates_project_idx on public.project_updates (project_id, created_at desc);

alter table public.project_updates enable row level security;

create policy "updates are readable by the project's client and by admins"
on public.project_updates for select to authenticated
using (public.can_access_project(project_id));

create policy "updates are written by admins"
on public.project_updates for insert to authenticated
with check (public.is_admin() and author_id = (select auth.uid()));

create policy "updates are edited by admins"
on public.project_updates for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "updates are deleted by admins"
on public.project_updates for delete to authenticated
using (public.is_admin());

-- Keeping projects.progress in step with the newest update means the dashboard
-- reads one number instead of recomputing the timeline on every render.
create or replace function public.sync_project_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.progress is not null then
    update public.projects
       set progress = new.progress
     where id = new.project_id;
  end if;
  return new;
end;
$$;

create trigger project_updates_sync_progress
after insert or update of progress on public.project_updates
for each row execute function public.sync_project_progress();

-- ============================================================================
-- 6. MESSAGES — one thread per project
-- ============================================================================

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index messages_project_idx on public.messages (project_id, created_at);
create index messages_unread_idx on public.messages (project_id) where read_at is null;

alter table public.messages enable row level security;

create policy "messages are readable by the project's client and by admins"
on public.messages for select to authenticated
using (public.can_access_project(project_id));

create policy "messages are sent by the project's client and by admins"
on public.messages for insert to authenticated
with check (
  public.can_access_project(project_id)
  and sender_id = (select auth.uid())
);

-- Update exists so the reader can stamp read_at. The sender is excluded so
-- nobody can mark their own message read, and guard_message_columns() below
-- keeps the body itself immutable.
create policy "messages are marked read by the other side"
on public.messages for update to authenticated
using (public.can_access_project(project_id) and sender_id <> (select auth.uid()))
with check (public.can_access_project(project_id) and sender_id <> (select auth.uid()));

create policy "messages are deleted by their sender or an admin"
on public.messages for delete to authenticated
using (sender_id = (select auth.uid()) or public.is_admin());

create or replace function public.guard_message_columns()
returns trigger
language plpgsql
as $$
begin
  new.id         := old.id;
  new.project_id := old.project_id;
  new.sender_id  := old.sender_id;
  new.body       := old.body;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger messages_guard_columns
before update on public.messages
for each row execute function public.guard_message_columns();

-- ============================================================================
-- 7. FILES
-- Bytes live in storage; this table is the listing the dashboard renders, so a
-- file browser does not need a signed URL per row just to draw the list.
-- ============================================================================

create table public.project_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  path        text not null unique,
  name        text not null check (char_length(name) between 1 and 255),
  size_bytes  bigint check (size_bytes >= 0),
  mime_type   text,
  created_at  timestamptz not null default now()
);

create index project_files_project_idx on public.project_files (project_id, created_at desc);

alter table public.project_files enable row level security;

create policy "files are readable by the project's client and by admins"
on public.project_files for select to authenticated
using (public.can_access_project(project_id));

create policy "files are recorded by the project's client and by admins"
on public.project_files for insert to authenticated
with check (
  public.can_access_project(project_id)
  and uploaded_by = (select auth.uid())
);

create policy "files are removed by their uploader or an admin"
on public.project_files for delete to authenticated
using (uploaded_by = (select auth.uid()) or public.is_admin());

-- ============================================================================
-- 8. STORAGE
-- Object keys are `<project_id>/<filename>`, so access is decided by reading
-- the first path segment back as a project id.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 26214400)          -- 25 MB
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,                        -- 2 MB
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- A bare `(storage.foldername(name))[1]::uuid` throws on any object whose first
-- segment is not a uuid, and a policy that throws is a policy that breaks every
-- unrelated listing. Return null instead and let the comparison fail quietly.
create or replace function public.storage_project_id(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(p_name))[1] ~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[1])::uuid
  end;
$$;

create policy "project files are readable by the project's client and by admins"
on storage.objects for select to authenticated
using (
  bucket_id = 'project-files'
  and public.can_access_project(public.storage_project_id(name))
);

create policy "project files are uploaded by the project's client and by admins"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-files'
  and public.can_access_project(public.storage_project_id(name))
);

create policy "project files are replaced by the project's client and by admins"
on storage.objects for update to authenticated
using (
  bucket_id = 'project-files'
  and public.can_access_project(public.storage_project_id(name))
)
with check (
  bucket_id = 'project-files'
  and public.can_access_project(public.storage_project_id(name))
);

create policy "project files are deleted by their owner or an admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-files'
  and public.can_access_project(public.storage_project_id(name))
  and (owner = (select auth.uid()) or public.is_admin())
);

-- Avatars: world-readable bucket, but each user writes only inside `<uid>/`.
create policy "avatars are readable by anyone"
on storage.objects for select to public
using (bucket_id = 'avatars');

create policy "avatars are written by their owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars are replaced by their owner"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars are deleted by their owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- ============================================================================
-- 9. GRANTS
-- RLS filters rows, but a role still needs the table privilege to reach them.
-- Granted narrowly: `anon` gets nothing at all, since the only anonymous write
-- is submit_lead() and it runs as its owner.
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_updates to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, delete on public.project_files to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_project(uuid) to authenticated;

-- ============================================================================
-- 10. REALTIME
-- Lets the dashboard subscribe to its thread instead of polling.
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;   -- self-hosted without the default publication
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.project_updates;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
