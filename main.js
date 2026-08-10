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

/* The client area only exists once the database is reachable. Until then both
   entrances stay hidden rather than leading to a sign-in that cannot work. */
const config = window.BUILDARIO_SUPABASE || {};
if (config.configured) {
  const loginLink = $('#clientLogin');
  const loginAlt = $('#clientLoginAlt');
  if (loginLink) loginLink.hidden = false;
  if (loginAlt) loginAlt.hidden = false;
}

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

  /** Composes the brief as an email the visitor sends from their own client.
      It is the fallback for every path where the database cannot take the
      submission — unconfigured, offline, or refused — so the form is never a
      dead end that loses what someone just typed. */
  const mailtoBrief = (payload) => {
    const body = [
      'Name: ' + payload.p_name,
      'Email: ' + payload.p_email,
      payload.p_company ? 'Company: ' + payload.p_company : '',
      payload.p_budget ? 'Budget: ' + payload.p_budget : '',
      '',
      payload.p_message
    ].filter(Boolean).join('\n');

    return 'mailto:' + STUDIO_EMAIL +
      '?subject=' + encodeURIComponent('New brief — ' + payload.p_name) +
      '&body=' + encodeURIComponent(body);
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
      window.location.href = mailtoBrief(payload);
      briefForm.reset();
      say('Opening your email app with the brief filled in — press send and it lands in my inbox.', 'success');
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
    } catch (error) {
      // A refusal from submit_lead is written for the visitor — show it. A
      // network failure is not their problem to read about, so hand the brief
      // to their mail client instead of losing it.
      if (/failed to fetch|networkerror/i.test(error.message)) {
        window.location.href = mailtoBrief(payload);
        say('The server did not answer, so your email app is opening with the brief instead — press send.', 'info');
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
