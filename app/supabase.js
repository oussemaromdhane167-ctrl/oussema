/* ==========================================================================
   Buildario — Supabase client

   Loaded straight from a CDN as an ES module: the site has no build step and
   no node_modules, and adding one for a single dependency would cost more than
   it returns. `@2` tracks the latest v2 release; pin the exact version here if
   you ever want the bundle frozen.
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const config = window.BUILDARIO_SUPABASE || {};

export const isConfigured = Boolean(config.configured);

/* Built even when unconfigured so imports never explode at parse time; calls
   made against it fail, which the pages report as a setup message. */
export const supabase = createClient(
  config.url || 'https://unconfigured.supabase.co',
  config.anonKey || 'unconfigured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true   // password-reset and confirm links land here
    }
  }
);

/** Turns a PostgREST/GoTrue error into something a person can read. */
export function friendlyError(error) {
  if (!error) return '';
  const message = String(error.message || error);

  // Never leak setup instructions into a client's face. What went wrong here is
  // the studio's problem; all they need is another way to reach it.
  if (!isConfigured) {
    return 'The client area is temporarily unavailable. Email buildario.studio@gmail.com and I will sort it out.';
  }
  if (/failed to fetch|networkerror/i.test(message)) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password combination is not right.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Confirm your email address first — check your inbox for the link.';
  }
  if (/user already registered/i.test(message)) {
    return 'That email already has an account. Sign in instead.';
  }
  if (/password should be at least/i.test(message)) {
    return 'Password must be at least 8 characters.';
  }
  if (/row-level security|permission denied|42501/i.test(message)) {
    return 'You do not have access to that.';
  }
  return message;
}
