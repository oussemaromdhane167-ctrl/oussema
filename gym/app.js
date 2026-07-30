/* ============================================================
   FORGE — interaction + motion layer
   ============================================================ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------ DATA ------------------------------ */
  var PROGRAMS = [
    { tag: 'Muscle & Power', name: 'Strength Training',  desc: 'Progressive overload programming with barbell, dumbbell, and machine circuits.' },
    { tag: 'Physique',       name: 'Bodybuilding',       desc: 'Hypertrophy-focused splits with posing and nutrition guidance.' },
    { tag: 'Athleticism',    name: 'Functional Fitness', desc: 'Multi-plane movement work for real-world strength and mobility.' },
    { tag: 'Metabolic',      name: 'HIIT',               desc: 'High-intensity interval circuits engineered to torch and build.' },
    { tag: 'Endurance',      name: 'Cardio',             desc: 'Rowers, sleds, and track sessions to build engine and stamina.' },
    { tag: '1-on-1',         name: 'Personal Training',  desc: 'Fully customized coaching built around your goals and schedule.' }
  ];

  var TRAINERS = [
    { name: 'Marcus Reid',     specialty: 'Strength & Conditioning',   years: 12, certs: 'CSCS, USAW Level 2, FMS Certified' },
    { name: 'Elena Vasquez',   specialty: 'Bodybuilding & Physique',   years: 9,  certs: 'NASM-CPT, IFBB Pro Card, Precision Nutrition' },
    { name: 'Jordan Blake',    specialty: 'Functional Fitness',        years: 8,  certs: 'CF-L3, ACE-CPT, Mobility Specialist' },
    { name: 'Sofia Marchetti', specialty: 'HIIT & Metabolic Training', years: 6,  certs: 'ACSM-CPT, TRX Certified, Nutrition Coach' }
  ];

  var STORIES = [
    { name: 'David Chen',   quote: 'This place rebuilt my body and my discipline. Twelve weeks in, I barely recognize the old me.', stat1: '-34lb', stat1Label: 'Body Fat',   stat2: '+58%', stat2Label: 'Strength',  stat3: '12wk', stat3Label: 'Timeline', timeframe: 'Member since 2024' },
    { name: 'Priya Anand',  quote: 'The coaching is relentless in the best way. I hit lifts I never thought were possible.',        stat1: '+82lb', stat1Label: 'Deadlift',   stat2: '-21lb', stat2Label: 'Weight',   stat3: '16wk', stat3Label: 'Timeline', timeframe: 'Member since 2023' },
    { name: 'Marcus Doyle', quote: 'Elite membership gave me a team, not just a gym. The results followed fast.',                   stat1: '-40lb', stat1Label: 'Total Loss', stat2: '+3x',  stat2Label: 'Endurance', stat3: '20wk', stat3Label: 'Timeline', timeframe: 'Member since 2024' }
  ];

  var GALLERY = [
    { label: 'Free weight floor',    h: 280 },
    { label: 'Turf & sled zone',     h: 200 },
    { label: 'Recovery suite',       h: 240 },
    { label: 'Group class studio',   h: 320 },
    { label: 'Cardio deck',          h: 210 },
    { label: 'Locker rooms',         h: 260 },
    { label: 'Personal training bay',h: 230 },
    { label: 'Main entrance',        h: 290 }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ----------------------------- RENDER ----------------------------- */
  $('#programsGrid').innerHTML = PROGRAMS.map(function (p) {
    return '<article class="program">' +
             '<div class="program__img"></div>' +
             '<div class="program__scrim"></div>' +
             '<div class="program__body">' +
               '<span class="program__tag">' + esc(p.tag) + '</span>' +
               '<h3 class="program__name">' + esc(p.name) + '</h3>' +
               '<p class="program__desc">' + esc(p.desc) + '</p>' +
             '</div>' +
           '</article>';
  }).join('');

  $('#trainersGrid').innerHTML = TRAINERS.map(function (t) {
    return '<article class="trainer" tabindex="0">' +
             '<div class="trainer__img photo">[ portrait — ' + esc(t.name) + ' ]</div>' +
             '<div class="trainer__scrim"></div>' +
             '<div class="trainer__base">' +
               '<h3 class="trainer__name">' + esc(t.name) + '</h3>' +
               '<p class="trainer__spec">' + esc(t.specialty) + '</p>' +
               '<p class="trainer__years">' + esc(t.years) + ' yrs experience</p>' +
             '</div>' +
             '<div class="trainer__over">' +
               '<h3 class="trainer__name">' + esc(t.name) + '</h3>' +
               '<p class="trainer__spec">' + esc(t.specialty) + '</p>' +
               '<p class="trainer__label">Certifications</p>' +
               '<p class="trainer__certs">' + esc(t.certs) + '</p>' +
             '</div>' +
           '</article>';
  }).join('');

  $('#storiesGrid').innerHTML = STORIES.map(function (s) {
    return '<article class="story">' +
             '<div class="story__img photo">[ before / after — ' + esc(s.name) + ' ]</div>' +
             '<p class="story__quote">"' + esc(s.quote) + '"</p>' +
             '<div class="story__stats">' +
               '<div class="story__stat"><span>' + esc(s.stat1) + '</span><p>' + esc(s.stat1Label) + '</p></div>' +
               '<div class="story__stat"><span>' + esc(s.stat2) + '</span><p>' + esc(s.stat2Label) + '</p></div>' +
               '<div class="story__stat"><span>' + esc(s.stat3) + '</span><p>' + esc(s.stat3Label) + '</p></div>' +
             '</div>' +
             '<div class="story__foot">' +
               '<p class="story__name">' + esc(s.name) + '</p>' +
               '<p class="story__since">' + esc(s.timeframe) + '</p>' +
             '</div>' +
           '</article>';
  }).join('');

  $('#galleryGrid').innerHTML = GALLERY.map(function (g, i) {
    return '<button class="tile" type="button" data-index="' + i + '" aria-label="Open ' + esc(g.label) + '">' +
             '<div class="tile__img photo" style="height:' + g.h + 'px">[ ' + esc(g.label) + ' ]</div>' +
             '<span class="tile__caption">' + esc(g.label) + '</span>' +
           '</button>';
  }).join('');

  /* ------------------------ SCROLL REVEAL / COUNTERS ------------------------ */
  /* One deterministic sweep drives both, run from the rAF-throttled scroll
     handler below. Chosen over IntersectionObserver because the sweep is
     synchronous and self-checking: entries are dropped once fired, so the
     per-scroll cost decays to zero and nothing can be left un-revealed by a
     missed callback. */

  var pending = [];

  // section headings and standalone reveals
  $$('.reveal').forEach(function (el) {
    pending.push({ el: el, margin: 40, fire: function () { el.classList.add('is-in'); } });
  });

  // grids whose children cascade in
  $$('.stagger').forEach(function (group) {
    var kids = Array.prototype.slice.call(group.children);
    kids.forEach(function (kid, i) { kid.style.transitionDelay = (i * 90) + 'ms'; });
    pending.push({
      el: group,
      margin: 60,
      fire: function () { kids.forEach(function (kid) { kid.classList.add('is-in'); }); }
    });
  });

  // stat counters
  $$('[data-count]').forEach(function (el) {
    var target = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || '';

    pending.push({
      el: el,
      margin: 0,
      fire: function () {
        if (reduced) { el.textContent = target + suffix; return; }
        var start = performance.now();
        var dur = 1600;
        (function tick(now) {
          var t = Math.min((now - start) / dur, 1);
          el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        })(start);
      }
    });
  });

  function sweepReveals() {
    if (!pending.length) return;
    var vh = window.innerHeight;
    pending = pending.filter(function (item) {
      // still below the fold — keep watching
      if (item.el.getBoundingClientRect().top > vh - item.margin) return true;
      // in view, or jumped straight past it — either way it must be shown
      item.fire();
      return false;
    });
  }

  /* ------------------------- SCROLL-DRIVEN FX ------------------------- */
  var nav = $('#nav');
  var heroParallax = $('#heroParallax');
  var progressBar = $('#progressBar');
  var navLinkEls = $$('.nav__links a');
  var sections = ['hero', 'programs', 'membership', 'trainers', 'stories', 'gallery', 'footer']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  var ticking = false;

  function onScrollFrame() {
    var y = window.scrollY || window.pageYOffset;

    sweepReveals();
    nav.classList.toggle('is-scrolled', y > 60);

    if (heroParallax && !reduced && y < window.innerHeight * 1.2) {
      heroParallax.style.transform = 'translateY(' + (y * 0.25) + 'px)';
    }

    var max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';

    var current = null;
    sections.forEach(function (sec) {
      if (sec.getBoundingClientRect().top <= 140) current = sec.id;
    });
    navLinkEls.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
    });

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScrollFrame);
  }, { passive: true });

  onScrollFrame();
  window.addEventListener('resize', sweepReveals);
  // fonts/images settling can shift layout — re-check once everything is in
  window.addEventListener('load', sweepReveals);

  /* ---------------------------- SMOOTH NAV ---------------------------- */
  function scrollToId(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
  }

  $$('[data-nav]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) !== '#') return;
      e.preventDefault();
      scrollToId(href.slice(1));
      closeMenu();
    });
  });

  /* ---------------------------- MOBILE MENU ---------------------------- */
  var burger = $('#burger');
  var links = $('#navLinks');

  function closeMenu() {
    links.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }

  burger.addEventListener('click', function () {
    var open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });

  /* ------------------------------ LIGHTBOX ------------------------------ */
  var lightbox = $('#lightbox');
  var lightboxLabel = $('#lightboxLabel');
  var lastFocused = null;

  function openLightbox(i) {
    lastFocused = document.activeElement;
    lightboxLabel.textContent = '[ ' + GALLERY[i].label + ' — full view ]';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#lightboxClose').focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  $('#galleryGrid').addEventListener('click', function (e) {
    var tile = e.target.closest('.tile');
    if (tile) openLightbox(parseInt(tile.dataset.index, 10));
  });

  $('#lightboxClose').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!lightbox.hidden) closeLightbox(); closeMenu(); }
  });

  /* ---------------------- MAGNETIC BUTTONS + CURSOR ---------------------- */
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  if (finePointer && !reduced) {
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.22;
        var y = (e.clientY - r.top - r.height / 2) * 0.32;
        el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });

    var glow = $('#cursorGlow');
    var gx = 0, gy = 0, tx = 0, ty = 0;
    document.body.classList.add('has-cursor');
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() {
      gx += (tx - gx) * 0.09;
      gy += (ty - gy) * 0.09;
      glow.style.transform = 'translate(' + gx + 'px,' + gy + 'px)';
      requestAnimationFrame(loop);
    })();

    /* 3D tilt on feature cards */
    $$('[data-tilt]').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(900px) rotateX(' + (-py * 7) + 'deg) rotateY(' + (px * 7) + 'deg) translateY(-8px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  /* --------------------------- 3D HERO ELEMENT --------------------------- */
  /* Mounted only where the CSS actually shows it, and torn down when the
     viewport drops below that breakpoint so no GPU work is wasted. */
  (function mountDumbbell() {
    var host = $('#dumbbell3d');
    if (!host || !window.RotatingDumbbell) return;

    var supported = window.matchMedia('(min-width: 721px)');
    var rig = null;

    function sync() {
      if (supported.matches && !rig) {
        rig = window.RotatingDumbbell.create(host, { revolutionSeconds: 10 });
      } else if (!supported.matches && rig) {
        rig.destroy();
        rig = null;
      }
    }

    sync();
    if (supported.addEventListener) supported.addEventListener('change', sync);
    else supported.addListener(sync);
  })();

  /* ----------------------------- NEWSLETTER ----------------------------- */
  var form = $('#newsletter');
  var msg = $('#newsletterMsg');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = $('#email').value.trim();
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    msg.textContent = ok ? 'You are in. Watch your inbox.' : 'Enter a valid email address.';
    msg.classList.toggle('is-ok', ok);
    if (ok) form.reset();
  });
})();
