# Buildario backend

The site stays a static bundle on GitHub Pages. Supabase supplies the parts a
static host cannot: a database, authentication, file storage, and realtime.
There is no server of ours in between — the browser talks to Supabase directly
with the public anon key, and **row level security is the whole access model**.

```
index.html          contact form  ->  submit_lead()      (anonymous, write-only)
login/              sign in, sign up, password reset
account/            client dashboard: timeline, files, thread, settings
admin/              studio side: leads, projects, updates, files, threads
app/                config, Supabase client, auth, data access, shared UI
supabase/migrations one SQL file — schema, policies, storage, triggers
```

## Setup

**1. Create the project**

[supabase.com/dashboard](https://supabase.com/dashboard) → *New project*. Pick the
region closest to your clients. Save the database password somewhere safe.

**2. Run the migration**

SQL Editor → *New query* → paste all of
`supabase/migrations/20260809120000_init.sql` → **Run**. It is idempotent on
buckets but not on tables, so run it once against a fresh project.

With the CLI instead:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**3. Wire up the keys**

Project Settings → API. Copy *Project URL* and the ***anon* public** key into
[`app/config.js`](../app/config.js):

```js
window.BUILDARIO_SUPABASE = {
  url: 'https://abcdefgh.supabase.co',
  anonKey: 'eyJhbGciOi…'
};
```

The anon key belongs in the page — it identifies the project and nothing more.
**Never put the `service_role` key in this repo**; it bypasses every policy
below.

**4. Point auth at the site**

Authentication → URL Configuration:

- **Site URL**: `https://buildario.studio`
- **Redirect URLs**: `https://buildario.studio/login/**`, and
  `http://localhost:8000/login/**` while developing.

Leave *Confirm email* on. Supabase's built-in mailer is rate-limited and meant
for testing — before you send real clients through signup, add your own SMTP
under Authentication → Emails.

**5. Make yourself the admin**

Every new account starts as `client`. Sign up once at `/login/`, then in the SQL
Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

`/admin/` opens from then on. A client who edits their own row cannot grant
themselves that — a trigger rejects any role change not made by an admin.

**6. Deploy**

Commit and push. GitHub Pages serves the repo root at `buildario.studio`.

## Running locally

Modules and Supabase auth both need a real origin, so `file://` will not do:

```bash
python -m http.server 8000     # then open http://localhost:8000
```

The home page still works from disk — the contact form posts over plain
`fetch`, and falls back to a "not connected yet" note while `config.js` still
holds its placeholders.

## What the database enforces

| Table | Anonymous | Client | Admin |
|---|---|---|---|
| `leads` | insert via `submit_lead()` only | — | read, update, delete |
| `profiles` | — | read and edit own row, never the role | read and edit all |
| `projects` | — | read own | full |
| `project_updates` | — | read own project's | full |
| `messages` | — | read/send on own project, mark the other side's read | same, everywhere |
| `project_files` | — | read own project's, upload, delete own | full |
| storage `project-files` | — | read/write under `<project_id>/` they own | all |
| storage `avatars` | read | write under `<own uid>/` | same |

Notable details:

- **`submit_lead()`** is the only anonymous write. It runs as its owner, so the
  visitor never touches `leads` directly and cannot set `status`, `notes`, or
  `handled_by`. It validates the input and caps a single address at 3
  submissions an hour.
- **`is_admin()` and `can_access_project()`** are `SECURITY DEFINER`. A policy on
  `profiles` that read `profiles` through RLS would recurse forever; running as
  the owner breaks the cycle.
- **Storage keys carry the authorization.** Objects live at
  `<project_id>/<file>`, and the policies read that first segment back as a
  project id. Uploading anywhere else is rejected, not merely hidden.
- **Message bodies are immutable.** The update path exists so the recipient can
  stamp `read_at`; a trigger restores every other column.

## Changing the schema later

Add a new file under `supabase/migrations/` — never edit the one that has
already run. Name it with a timestamp prefix so the ordering is unambiguous
(`20260901090000_add_invoices.sql`).
