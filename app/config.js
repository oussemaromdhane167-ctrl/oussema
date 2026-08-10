/* ==========================================================================
   Buildario — backend configuration

   Fill these two values in after creating the Supabase project
   (Dashboard → Project Settings → API), then commit the file.

   The anon key is *designed* to ship in the page: it identifies the project and
   nothing else, and every table it can reach is gated by row level security.
   The service_role key is the opposite — it bypasses RLS entirely, so it must
   never appear in this file or anywhere else in this repo.

   A classic script, not a module, so both the plain contact form in main.js and
   the module-based dashboards can read the same values.
   ========================================================================== */
'use strict';

window.BUILDARIO_SUPABASE = {
  url: 'https://wlgyejhocdspxipbkteq.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZ3llamhvY2RzcHhpcGJrdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyOTk2NTAsImV4cCI6MjEwMTg3NTY1MH0.kC9Gii3Rk8EuT--QumMgeH0NZF1o1cAlEbronY8H35M'
};

/* A pasted URL often carries a trailing slash, which would build request paths
   with a doubled separator. */
window.BUILDARIO_SUPABASE.url = window.BUILDARIO_SUPABASE.url.replace(/\/+$/, '');

/** False while the placeholders are still in place, so the UI can say so
    instead of firing requests at a hostname that does not resolve. */
window.BUILDARIO_SUPABASE.configured =
  !window.BUILDARIO_SUPABASE.url.includes('YOUR-PROJECT-REF') &&
  !window.BUILDARIO_SUPABASE.anonKey.includes('YOUR-ANON-KEY');
