/* ==========================================================================
   Buildario — motion layer
   Vanilla JS, no dependencies. Every effect degrades to a static page.

   Deliberately a classic deferred script, not type="module". There is nothing
   to import, and a module is blocked by CORS when the page is opened straight
   off disk (file://) — which would silently kill every effect below.
   'use strict' keeps the module semantics we lost.
   ========================================================================== */
'use strict';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE_POINTER = matchMedia('(pointer: fine)').matches;

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Minimal rAF tween on a plain object — used for the elastic-ish releases. */
function tween(state, to, { duration = 450, ease = (t) => 1 - Math.pow(1 - t, 3), onUpdate }) {
  const keys = Object.keys(to);
  const from = {};
  keys.forEach((k) => { from[k] = state[k]; });
  let start = null;
  const step = (now) => {
    if (start === null) start = now;
    const p = Math.min(1, (now - start) / duration);
    const e = ease(p);
    keys.forEach((k) => { state[k] = from[k] + (to[k] - from[k]) * e; });
    onUpdate();
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ======================================================================
   1. LOADER
   ====================================================================== */

const loader = $('#loader');
setTimeout(() => loader && loader.classList.add('done'), 600);

/* ======================================================================
   2. HERO PARTICLES + FLOATING TOOLKIT PILLS
   Same deterministic values as the source design.
   ====================================================================== */

const particleHost = $('#particles');
if (particleHost && !REDUCED) {
  for (let i = 0; i < 14; i++) {
    const el = document.createElement('span');
    el.className = 'particle';
    el.style.left = ((i * 37) % 100) + '%';
    el.style.top = ((i * 53) % 100) + '%';
    const size = 3 + (i % 3) * 2;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.setProperty('--dur', (5 + (i % 4)) + 's');
    el.style.setProperty('--delay', ((i % 6) * 0.5) + 's');
    particleHost.appendChild(el);
  }
}

$$('#tech li').forEach((el, i) => {
  el.style.setProperty('--dur', (4 + (i % 3)) + 's');
  el.style.setProperty('--delay', ((i % 5) * 0.4) + 's');
});

/* ======================================================================
   3. SCROLL REVEALS
   ====================================================================== */

const revealTargets = $$('.reveal');

if (REDUCED || !('IntersectionObserver' in window)) {
  revealTargets.forEach((el) => el.classList.add('in'));
} else {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  revealTargets.forEach((el) => revealObserver.observe(el));
}

/* ======================================================================
   4. SCROLL-DRIVEN CHROME — nav state, progress bar, scroll-spy
   ====================================================================== */

const nav = $('#nav');
const scrollBar = $('#scrollBar');
const navLinks = $$('.nav-link');

const spyTargets = navLinks
  // the client-login link rides in the same list; `login/` is not a selector,
  // and handing it to querySelector throws and takes the whole script with it
  .filter((link) => (link.getAttribute('href') || '').startsWith('#'))
  .map((link) => ({ link, el: $(link.getAttribute('href')) }))
  .filter((t) => t.el);

let scrollQueued = false;
function onScrollFrame() {
  scrollQueued = false;
  const y = window.scrollY;
  const vh = window.innerHeight;

  nav.classList.toggle('scrolled', y > 40);

  const max = document.documentElement.scrollHeight - vh;
  scrollBar.style.width = (max > 0 ? Math.min(100, Math.max(0, (y / max) * 100)) : 0) + '%';

  let current = null;
  spyTargets.forEach((t) => {
    if (t.el.getBoundingClientRect().top <= vh * 0.4) current = t.link;
  });
  navLinks.forEach((l) => l.classList.toggle('active', l === current));
}

window.addEventListener('scroll', () => {
  if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScrollFrame); }
}, { passive: true });
onScrollFrame();

/* ======================================================================
   5. POINTER EFFECTS
   ====================================================================== */

const glow = $('#cursorGlow');
const cube = $('#cube');
const hero = $('.hero');

if (FINE_POINTER && !REDUCED) {
  /* --- 5a. cursor glow + hero cube tilt --- */
  let cubeTilted = false;

  window.addEventListener('pointermove', (e) => {
    if (glow) {
      glow.style.opacity = '1';
      glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }

    if (!cube || !hero) return;
    const rect = hero.getBoundingClientRect();
    const inHero = e.clientY >= rect.top && e.clientY <= rect.bottom;

    if (inHero) {
      const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -20 - 18;
      const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 30;
      cube.style.animation = 'none';
      cube.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      cubeTilted = true;
    } else if (cubeTilted) {
      // hand the cube back to its idle spin once the pointer leaves the hero
      cube.style.animation = '';
      cube.style.transform = '';
      cubeTilted = false;
    }
  }, { passive: true });

  /* --- 5b. magnetic buttons --- */
  $$('.magnetic').forEach((el) => {
    const pull = { x: 0, y: 0 };
    const write = () => { el.style.translate = `${pull.x.toFixed(2)}px ${pull.y.toFixed(2)}px`; };

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      pull.x = (e.clientX - r.left - r.width / 2) * 0.25;
      pull.y = (e.clientY - r.top - r.height / 2) * 0.25;
      write();
    }, { passive: true });

    el.addEventListener('pointerleave', () => {
      tween(pull, { x: 0, y: 0 }, { duration: 420, onUpdate: write });
    });
  });

  /* --- 5c. project card tilt --- */
  $$('.tilt').forEach((card) => {
    // .reveal owns an 0.8s transform transition for the entrance lift; swap it
    // for a short one on enter so the tilt tracks the pointer instead of lagging
    card.addEventListener('pointerenter', () => {
      card.style.transition = 'transform 0.15s ease, box-shadow 0.4s ease';
    });

    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform =
        `perspective(1000px) rotateX(${(-y * 4).toFixed(2)}deg) ` +
        `rotateY(${(x * 4).toFixed(2)}deg) translateY(-4px)`;
    }, { passive: true });

    card.addEventListener('pointerleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
  });
}

/* ======================================================================
   6. FAQ ACCORDION
   ====================================================================== */

/** Pin max-height to the panel's measured height so no answer can be clipped. */
function sizePanel(panel) {
  if (panel) panel.style.setProperty('--max-h', panel.scrollHeight + 'px');
}

const faqButtons = $$('.faq-q');

faqButtons.forEach((btn) => {
  const panel = document.getElementById(btn.getAttribute('aria-controls'));

  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';

    // single-open accordion, matching the source design
    faqButtons.forEach((other) => {
      if (other === btn) return;
      other.setAttribute('aria-expanded', 'false');
      const p = document.getElementById(other.getAttribute('aria-controls'));
      p && p.classList.remove('open');
    });

    if (!open) sizePanel(panel);   // remeasure — fonts or width may have changed
    btn.setAttribute('aria-expanded', String(!open));
    panel && panel.classList.toggle('open', !open);
  });
});

// keep an open panel correct when its text reflows at a new width
window.addEventListener('resize', () => {
  const openBtn = faqButtons.find((b) => b.getAttribute('aria-expanded') === 'true');
  if (openBtn) sizePanel(document.getElementById(openBtn.getAttribute('aria-controls')));
}, { passive: true });

/* ======================================================================
   7. MOBILE NAV DRAWER
   ====================================================================== */

const navToggle = $('#navToggle');
const navPanel = $('#navLinks');
const navScrim = $('#navScrim');

if (navToggle && navPanel && navScrim) {
  let lastFocus = null;

  const setDrawer = (open) => {
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    navPanel.classList.toggle('open', open);
    navScrim.classList.toggle('on', open);
    document.body.classList.toggle('nav-open', open);

    if (open) {
      lastFocus = document.activeElement;
      navScrim.hidden = false;
      // first link, once the panel is focusable
      requestAnimationFrame(() => {
        const first = navPanel.querySelector('.nav-link');
        first && first.focus();
      });
    } else {
      // keep the scrim in the DOM through its fade, then remove it from the tree
      setTimeout(() => { if (!navPanel.classList.contains('open')) navScrim.hidden = true; }, 300);
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    }
  };

  navToggle.addEventListener('click', () => {
    setDrawer(navToggle.getAttribute('aria-expanded') !== 'true');
  });

  navScrim.addEventListener('click', () => setDrawer(false));

  // any link closes it — they are all same-page anchors
  navPanel.addEventListener('click', (e) => {
    if (e.target.closest('a')) setDrawer(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
      setDrawer(false);
    }
  });

  // trap Tab inside the drawer while it is open
  navPanel.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !navPanel.classList.contains('open')) return;
    const items = Array.from(navPanel.querySelectorAll('a'));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); navToggle.focus(); }
  });

  // leaving the drawer breakpoint must not strand the page in the open state
  const wide = matchMedia('(min-width: 901px)');
  wide.addEventListener('change', (e) => { if (e.matches) setDrawer(false); });
}

/* ======================================================================
   8. BRIEF FORM

   Posts straight to Supabase over PostgREST rather than through the JS SDK:
   this file is a classic script that also has to run from file://, and the one
   call it makes is a single RPC. The function it targets, submit_lead, is the
   only write the anon key is allowed anywhere in the database.
   ====================================================================== */

const STUDIO_EMAIL = 'buildario.studio@gmail.com';

/* The client area only exists once the database is reachable — and `configured`
   alone cannot tell us that. It only says the placeholders in config.js were
   replaced, which stays true after a project is paused, deleted, or renamed;
   the keys keep their shape long after they stop addressing anything, so gating
   on it alone can advertise a Client Login backed by nothing.
   So ask the server. GoTrue's /health answers in one small round trip, cached
   per session so this costs one request per visit. It is key-gated like the rest
   of the API, so the anon key has to ride along — without it the probe draws a
   401 and fails closed against a project that is perfectly alive. Any genuine
   failure — DNS, offline, 5xx, timeout — leaves both entrances hidden, because
   a sign-in that cannot sign anyone in is worse than no link at all. */
const config = window.BUILDARIO_SUPABASE || {};

const revealClientArea = () => {
  const loginLink = $('#clientLogin');
  const loginAlt = $('#clientLoginAlt');
  if (loginLink) loginLink.hidden = false;
  if (loginAlt) loginAlt.hidden = false;
};

const BACKEND_PROBE_KEY = 'buildario:backend-live';

const backendIsLive = async () => {
  if (!config.configured) return false;

  try {
    if (sessionStorage.getItem(BACKEND_PROBE_KEY) === 'yes') return true;
  } catch { /* private mode — just probe again */ }

  // Don't let a hanging request hold the link back indefinitely.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 4000);

  try {
    const res = await fetch(config.url + '/auth/v1/health', {
      headers: { apikey: config.anonKey },
      signal: abort.signal
    });
    if (!res.ok) return false;
    try { sessionStorage.setItem(BACKEND_PROBE_KEY, 'yes'); } catch { /* not essential */ }
    return true;
  } catch {
    return false;               // fail closed
  } finally {
    clearTimeout(timer);
  }
};

backendIsLive().then((live) => { if (live) revealClientArea(); });

const briefForm = $('#briefForm');

if (briefForm) {
  const briefMsg = $('#briefMsg');
  const briefSubmit = $('#briefSubmit');
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  const say = (text, kind) => {
    briefMsg.textContent = text;
    briefMsg.className = 'form-msg form-msg-' + kind;
    briefMsg.hidden = !text;
  };

  /* The budget select carries both a TND and a USD group; the region select
     narrows it to one. Runs once on load as well, so the default region starts
     out consistent rather than showing both until the first change. With JS
     off, neither group is ever disabled and the field stays fully usable. */
  const briefRegion = $('#briefRegion');
  const briefBudget = $('#briefBudget');

  if (briefRegion && briefBudget) {
    const budgetGroups = $$('optgroup[data-region]', briefBudget);

    const applyRegion = () => {
      budgetGroups.forEach((group) => {
        const wanted = group.dataset.region === briefRegion.value;
        // Disabled as well as hidden: a hidden optgroup is still reachable by
        // keyboard in some browsers, which would let a TND figure be picked
        // on an international brief.
        group.hidden = !wanted;
        group.disabled = !wanted;
      });

      // Switching region after choosing a figure would otherwise submit the
      // old currency. Fall back to "Not sure yet" rather than guessing.
      const picked = briefBudget.selectedOptions[0];
      if (picked && picked.parentElement.disabled) briefBudget.value = '';
    };

    briefRegion.addEventListener('change', applyRegion);
    applyRegion();
  }

  /** The message body, as plain text — both the mail draft and the clipboard
      copy are built from this. */
  const briefText = (payload) => [
    'Name: ' + payload.p_name,
    'Email: ' + payload.p_email,
    payload.p_company ? 'Company: ' + payload.p_company : '',
    payload.p_budget ? 'Budget: ' + payload.p_budget : '',
    '',
    payload.p_message
  ].filter(Boolean).join('\n');

  /**
   * Hands the brief to the visitor's own mail client, for every path where the
   * database cannot take it — unconfigured, offline, or unreachable.
   *
   * `mailto:` is a request, not a send. It opens a draft the visitor still has
   * to send themselves, and on a machine with no mail handler registered —
   * anyone living in webmail — it does nothing visible at all. So this never
   * claims the message went anywhere, never clears the form, and always offers
   * the address and a copy button for when nothing opened.
   */
  const handOffToMail = (payload, lead) => {
    const draft = briefText(payload);

    // Tracked separately from a real submission: this path means the brief did
    // NOT reach the database, and a visitor on webmail may never send the draft
    // at all. If this event starts outnumbering Brief Submitted, the backend is
    // the thing to fix — not the funnel.
    window.plausible('Brief Fell Back To Mail');

    window.location.href = 'mailto:' + STUDIO_EMAIL +
      '?subject=' + encodeURIComponent('New brief — ' + payload.p_name) +
      '&body=' + encodeURIComponent(draft);

    // Static markup only. Nothing the visitor typed is interpolated here — it
    // travels through the clipboard as text instead.
    briefMsg.innerHTML = lead +
      ' Your mail app should open with the brief in it — <strong>press send there</strong>. ' +
      'Nothing opened? Copy the brief and mail it to ' +
      '<a href="mailto:' + STUDIO_EMAIL + '">' + STUDIO_EMAIL + '</a>.' +
      '<button type="button" class="btn btn-outline" id="briefCopy" style="margin-top:14px">Copy the brief</button>';
    briefMsg.className = 'form-msg form-msg-info';
    briefMsg.hidden = false;

    const copyButton = $('#briefCopy');
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(draft);
        copyButton.textContent = 'Copied';
      } catch (_) {
        // clipboard API needs a secure context and a permission; fall back to
        // the old selection trick, which needs neither
        const scratch = document.createElement('textarea');
        scratch.value = draft;
        scratch.setAttribute('readonly', '');
        scratch.style.position = 'fixed';
        scratch.style.opacity = '0';
        document.body.appendChild(scratch);
        scratch.select();
        const copied = document.execCommand('copy');
        scratch.remove();
        copyButton.textContent = copied ? 'Copied' : 'Press Ctrl+C after selecting your message';
      }
    });
  };

  briefForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    say('', 'info');

    // honeypot: report success, write nothing
    if ($('#briefWebsite').value.trim()) {
      briefForm.reset();
      say('Thanks — your brief is in. I reply to everything within a day or two.', 'success');
      return;
    }

    const payload = {
      p_name: $('#briefName').value.trim(),
      p_email: $('#briefEmail').value.trim(),
      p_message: $('#briefMessage').value.trim(),
      p_company: $('#briefCompany').value.trim() || null,
      p_budget: $('#briefBudget').value || null,
      p_source: 'website'
    };

    if (payload.p_name.length < 2)        return say('Please enter your name.', 'error');
    if (!EMAIL_RE.test(payload.p_email))  return say('Please enter a valid email address.', 'error');
    if (payload.p_message.length < 10)    return say('Please describe your project in a little more detail.', 'error');

    if (!config.configured) {
      handOffToMail(payload, 'Nearly there.');
      return;
    }

    const label = briefSubmit.innerHTML;
    briefSubmit.disabled = true;
    briefSubmit.textContent = 'Sending…';

    try {
      const response = await fetch(config.url + '/rest/v1/rpc/submit_lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.anonKey,
          Authorization: 'Bearer ' + config.anonKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        // submit_lead raises with a message written for a human; surface it
        let detail = '';
        try { detail = (await response.json()).message || ''; } catch (_) { /* non-JSON error body */ }
        throw new Error(detail || 'Something went wrong sending that. Try again in a moment.');
      }

      briefForm.reset();
      say('Thanks — your brief is in. I reply to everything within a day or two.', 'success');

      // The one number the growth plan is actually judged on. Region and budget
      // ride along as properties so the two markets can be read apart; no name,
      // email or message is ever sent to analytics.
      window.plausible('Brief Submitted', {
        props: {
          region: briefRegion ? briefRegion.value : 'unknown',
          budget: payload.p_budget || 'unspecified'
        }
      });
    } catch (error) {
      // A refusal from submit_lead is written for the visitor — show it. A
      // network failure is not their problem to read about, so hand the brief
      // to their mail client instead of losing it.
      if (/failed to fetch|networkerror/i.test(error.message)) {
        handOffToMail(payload, 'The server did not answer.');
      } else {
        say(error.message, 'error');
      }
    } finally {
      briefSubmit.disabled = false;
      briefSubmit.innerHTML = label;
    }
  });
}

/* Tells the failsafe watchdog in index.html that the motion layer booted. If
   this line is never reached, the watchdog drops the `js` class and the page
   renders fully visible with the loader gone. */
window.__buildarioReady = true;
