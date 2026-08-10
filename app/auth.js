/* ==========================================================================
   Buildario — authentication

   Supabase Auth holds the session in localStorage and refreshes it in the
   background; nothing here stores a token itself. The role check is read from
   public.profiles rather than trusted from the client, and it is only ever a
   UI hint — the database re-checks it in every policy.
   ========================================================================== */

import { supabase, friendlyError } from './supabase.js';

let cachedProfile = null;

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getUser() {
  const session = await getSession();
  return session ? session.user : null;
}

/** The signed-in user's profile row. Cached for the life of the page: it is
    read on nearly every render and changes only when the user edits it. */
export async function getProfile({ refresh = false } = {}) {
  if (cachedProfile && !refresh) return cachedProfile;

  const user = await getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  cachedProfile = data;
  return data;
}

export function clearProfileCache() {
  cachedProfile = null;
}

export async function signUp({ email, password, fullName, company, redirectTo }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      // handle_new_user() reads these when it creates the profile row
      data: { full_name: (fullName || '').trim(), company: (company || '').trim() },
      emailRedirectTo: absolute(redirectTo)
    }
  });
  if (error) throw error;

  // No session on the response means the project has email confirmation on and
  // the account is not usable until the link is clicked.
  return { user: data.user, needsConfirmation: !data.session };
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  if (error) throw error;
  clearProfileCache();
  return data.session;
}

export async function signOut() {
  clearProfileCache();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function sendPasswordReset({ email, redirectTo }) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: absolute(redirectTo) }
  );
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function updateProfile(patch) {
  const user = await getUser();
  if (!user) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  cachedProfile = data;
  return data;
}

/**
 * Page guard. Sends anonymous visitors to the login page with a `next` param so
 * they land back where they were aiming, and non-admins away from admin pages.
 * Paths are passed in relative because the site is also openable from a
 * subdirectory, where a leading slash would point outside the deploy.
 */
export async function requireAuth({ loginUrl = '../login/', admin = false, homeUrl = '../' } = {}) {
  const session = await getSession();

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`${loginUrl}?next=${next}`);
    return null;
  }

  const profile = await getProfile();

  if (admin && (!profile || profile.role !== 'admin')) {
    location.replace(homeUrl);
    return null;
  }

  return { session, user: session.user, profile };
}

/** Signs the user out of this tab when the session ends in another one. */
export function onAuthChange(handler) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') clearProfileCache();
    handler(event, session);
  });
  return () => data.subscription.unsubscribe();
}

function absolute(url) {
  if (!url) return undefined;
  return new URL(url, location.href).href;
}

export { friendlyError };
