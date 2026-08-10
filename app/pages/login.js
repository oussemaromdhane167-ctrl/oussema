/* ==========================================================================
   Buildario — login page

   Four states in one card: sign in, sign up, request a reset link, and set a
   new password after following that link.
   ========================================================================== */

import { $, $$, pending, setMessage } from '../ui.js';
import { isConfigured } from '../supabase.js';
import {
  signIn, signUp, sendPasswordReset, updatePassword,
  getSession, getProfile, onAuthChange, friendlyError
} from '../auth.js';

/* Someone who follows the link before the backend is live gets a plain
   explanation and a way to reach a human, not three forms that fail on submit. */
if (!isConfigured) {
  $$('#viewAuth form, #viewAuth .tabs, #viewForgot, #viewRecovery').forEach((el) => { el.hidden = true; });
  $('.auth-card').insertAdjacentHTML('afterbegin', `
    <h1>Client area opening soon.</h1>
    <p>Project timelines, files, and messages live here once your project starts.
       In the meantime, email
       <a href="mailto:buildario.studio@gmail.com">buildario.studio@gmail.com</a>
       and you will get me directly.</p>
    <a class="btn btn-primary" href="../">Back to the site</a>
  `);
}

const views = {
  auth: $('#viewAuth'),
  forgot: $('#viewForgot'),
  recovery: $('#viewRecovery')
};

function show(name) {
  Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
}

/* ---------------------------------------------------------------------------
   Where to land after a successful sign-in
   --------------------------------------------------------------------------- */

/** `next` comes from the URL, so it is attacker-controllable. Only same-site
    absolute paths are honoured — `//evil.example` and `https://…` are dropped,
    which is what turns this from an open redirect into a bookmark. */
function requestedNext() {
  const next = new URLSearchParams(location.search).get('next');
  if (next && /^\/(?![/\\])/.test(next)) return next;
  return null;
}

async function goToDashboard() {
  const next = requestedNext();
  if (next) { location.replace(next); return; }

  const profile = await getProfile({ refresh: true });
  location.replace(profile && profile.role === 'admin' ? '../admin/' : '../account/');
}

/* ---------------------------------------------------------------------------
   Recovery links
   --------------------------------------------------------------------------- */

const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
const queryParams = new URLSearchParams(location.search);
const arrivedForRecovery =
  hashParams.get('type') === 'recovery' || queryParams.get('type') === 'recovery';

if (arrivedForRecovery) show('recovery');

onAuthChange((event) => {
  if (event === 'PASSWORD_RECOVERY') show('recovery');
});

/* A live session on the login page means the user is already in — unless they
   are here to reset, in which case the session is the recovery one and must
   stay on this page until the new password is saved. */
if (!arrivedForRecovery) {
  getSession()
    .then((session) => { if (session) goToDashboard(); })
    .catch(() => { /* unconfigured or offline: the forms report it on submit */ });
}

/* ---------------------------------------------------------------------------
   Tabs
   --------------------------------------------------------------------------- */

const tabSignin = $('#tabSignin');
const tabSignup = $('#tabSignup');
const formSignin = $('#formSignin');
const formSignup = $('#formSignup');

function selectTab(which) {
  const signin = which === 'signin';
  tabSignin.setAttribute('aria-selected', String(signin));
  tabSignup.setAttribute('aria-selected', String(!signin));
  formSignin.hidden = !signin;
  formSignup.hidden = signin;
}

tabSignin.addEventListener('click', () => selectTab('signin'));
tabSignup.addEventListener('click', () => selectTab('signup'));

$('#linkForgot').addEventListener('click', () => {
  $('#forgotEmail').value = $('#signinEmail').value;
  show('forgot');
});
$('#linkBackToSignin').addEventListener('click', () => show('auth'));

/* ---------------------------------------------------------------------------
   Submits
   --------------------------------------------------------------------------- */

formSignin.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#signinSubmit');
  const msg = $('#signinMsg');
  setMessage(msg, '');
  pending(button, true, 'Signing in…');

  try {
    await signIn({
      email: $('#signinEmail').value,
      password: $('#signinPassword').value
    });
    await goToDashboard();
  } catch (error) {
    setMessage(msg, friendlyError(error));
    pending(button, false);
  }
});

formSignup.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#signupSubmit');
  const msg = $('#signupMsg');
  setMessage(msg, '');

  const password = $('#signupPassword').value;
  if (password.length < 8) {
    setMessage(msg, 'Password must be at least 8 characters.');
    return;
  }

  pending(button, true, 'Creating account…');

  try {
    const { needsConfirmation } = await signUp({
      email: $('#signupEmail').value,
      password,
      fullName: $('#signupName').value,
      company: $('#signupCompany').value,
      redirectTo: './'          // the confirmation link comes back to this page
    });

    if (needsConfirmation) {
      formSignup.reset();
      setMessage(msg, 'Account created. Check your inbox for the confirmation link, then sign in.', 'success');
      pending(button, false);
      return;
    }
    await goToDashboard();
  } catch (error) {
    setMessage(msg, friendlyError(error));
    pending(button, false);
  }
});

$('#formForgot').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#forgotSubmit');
  const msg = $('#forgotMsg');
  setMessage(msg, '');
  pending(button, true, 'Sending…');

  try {
    await sendPasswordReset({
      email: $('#forgotEmail').value,
      redirectTo: './?type=recovery'
    });
    // Deliberately the same wording whether or not the address exists: a
    // different message here would tell a stranger who has an account.
    setMessage(msg, 'If that address has an account, a reset link is on its way.', 'success');
  } catch (error) {
    setMessage(msg, friendlyError(error));
  } finally {
    pending(button, false);
  }
});

$('#formRecovery').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#recoverySubmit');
  const msg = $('#recoveryMsg');
  setMessage(msg, '');

  const password = $('#recoveryPassword').value;
  if (password.length < 8) {
    setMessage(msg, 'Password must be at least 8 characters.');
    return;
  }

  pending(button, true, 'Saving…');

  try {
    await updatePassword(password);
    setMessage(msg, 'Password updated. Taking you to your dashboard…', 'success');
    setTimeout(goToDashboard, 900);
  } catch (error) {
    setMessage(msg, friendlyError(error));
    pending(button, false);
  }
});
