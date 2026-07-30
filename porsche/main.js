/* ══════════════════════════════════════════════════════════
   911 GT3 RS — Landing / interactions
   ══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE  = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;

/* ─────────────── DATA ─────────────── */

const PERF_STATS = [
  { value:'518',   unit:'HP',      label:'Power Output',        desc:'Naturally aspirated flat-6 delivering relentless power to 9,000 RPM.' },
  { value:'3.0',   unit:'SEC',     label:'0–60 MPH',            desc:'Launch control catapults you to highway speed in a blink.' },
  { value:'184',   unit:'MPH',     label:'Top Speed',           desc:'Aerodynamic efficiency unlocks velocity without compromise.' },
  { value:'4.0L',  unit:'FLAT-6',  label:'Naturally Aspirated', desc:'No turbos. Pure induction, pure response, pure sound.' },
  { value:'860',   unit:'KG',      label:'Downforce at Vmax',   desc:'Active aero keeps the RS planted through every corner.' },
  { value:'1,435', unit:'KG',      label:'Curb Weight',         desc:'Carbon fiber and magnesium shave every unnecessary gram.' }
];

const GALLERY = [
  { id:'gal-front',    label:'Front View' },
  { id:'gal-side',     label:'Side Profile' },
  { id:'gal-rear',     label:'Rear View' },
  { id:'gal-interior', label:'Interior Cockpit' },
  { id:'gal-carbon',   label:'Carbon Fiber Details' },
  { id:'gal-wing',     label:'Rear Wing' }
];

const SPEC_ROWS = [
  { label:'Engine',            value:'4.0L Naturally Aspirated Flat-6' },
  { label:'Power',             value:'518 HP @ 8,500 RPM' },
  { label:'Torque',            value:'465 Nm @ 6,300 RPM' },
  { label:'0–60 mph',          value:'3.0 seconds' },
  { label:'Top Speed',         value:'184 mph' },
  { label:'Transmission',      value:'7-Speed PDK' },
  { label:'Drivetrain',        value:'Rear-Wheel Drive' },
  { label:'Curb Weight',       value:'1,435 kg' },
  { label:'Downforce (Vmax)',  value:'860 kg' }
];

const FEATURES = [
  { id:'feat-aero',       title:'Active Aerodynamics',      desc:'A hydraulically adjustable rear wing and front diffuser respond in real time, generating up to 860 kg of downforce at top speed.' },
  { id:'feat-carbon',     title:'Carbon Fiber Components',  desc:'Roof, hood, doors, and wing crafted from woven carbon fiber — engineered to remove mass exactly where it matters.' },
  { id:'feat-suspension', title:'Track-Focused Suspension', desc:'Double-wishbone front suspension borrowed from GT racing, with adaptive dampers tuned for millimetre precision.' },
  { id:'feat-steering',   title:'Precision Steering',       desc:'Rear-axle steering sharpens turn-in and stabilizes high-speed lane changes without sacrificing feedback.' },
  { id:'feat-wheels',     title:'Lightweight Wheels',       desc:'Forged center-lock wheels shed unsprung weight, transforming every input into immediate response.' },
  { id:'feat-interior',   title:'Race-Inspired Interior',   desc:'Full bucket seats, a stripped cabin, and a rev-counter-first display keep focus entirely on the drive.' }
];

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);

/* ─────────────── RENDER ─────────────── */

$('#stats').innerHTML = PERF_STATS.map((s, i) => `
  <article class="stat reveal" data-reveal="up" data-delay="${i * 70}">
    <div class="stat__num">
      <b data-count="${esc(s.value)}">0</b><i>${esc(s.unit)}</i>
    </div>
    <div class="stat__label">${esc(s.label)}</div>
    <div class="stat__desc">${esc(s.desc)}</div>
    <div class="stat__bar"></div>
  </article>`).join('');

$('#gallery').innerHTML = GALLERY.map((g, i) => `
  <figure class="gcard reveal tilt" data-reveal="scale" data-delay="${i * 70}"
          data-index="${i}" data-cursor="view" data-cursor-label="View">
    <div class="gcard__media">
      <div class="slot" data-slot="${esc(g.id)}" data-label="${esc(g.label)} — studio photo"></div>
    </div>
    <div class="gcard__veil"></div>
    <div class="gcard__frame"></div>
    <figcaption class="gcard__cap">
      <b>${esc(g.label)}</b><i>0${i + 1}</i>
    </figcaption>
  </figure>`).join('');

$('#specRows').innerHTML = SPEC_ROWS.map((r, i) => `
  <div class="spec-row reveal" data-reveal="right" data-delay="${i * 55}">
    <span class="spec-row__k">${esc(r.label)}</span>
    <span class="spec-row__v">${esc(r.value)}</span>
  </div>`).join('');

$('#features-list').innerHTML = FEATURES.map((f, i) => `
  <article class="feature ${i % 2 ? 'feature--flip' : ''}">
    <div class="feature__media reveal parallax" data-reveal="${i % 2 ? 'right' : 'left'}" data-speed="${i % 2 ? -0.05 : 0.05}">
      <span class="feature__idx">0${i + 1}</span>
      <div class="slot" data-slot="${esc(f.id)}" data-label="${esc(f.title)} detail shot"></div>
    </div>
    <div class="feature__body reveal" data-reveal="up" data-delay="120">
      <h3>${esc(f.title)}</h3>
      <p>${esc(f.desc)}</p>
      <div class="feature__rule"></div>
    </div>
  </article>`).join('');

/* ─────────────── IMAGE SLOTS ───────────────
   Placeholder art + drag-and-drop / click-to-browse fill.
   Filled images persist in localStorage under gt3rs:slot:<id>. */

const CAR_SVG = `
<svg class="slot__art" viewBox="0 0 200 74" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M8 54c0-8 6-11 14-12l19-2c9-9 20-15 38-17l43-1c19 1 33 6 43 15l20 4c8 1 12 4 12 10v5H8z"/>
  <circle cx="52" cy="57" r="13"/><circle cx="152" cy="57" r="13"/>
</svg>`;

const slotStore = {
  get(id){ try { return localStorage.getItem('gt3rs:slot:' + id); } catch { return null; } },
  set(id, v){ try { localStorage.setItem('gt3rs:slot:' + id, v); return true; } catch { return false; } }
};

// Shipped photo for each slot; a dropped file overrides it.
const slotAsset = id => 'assets/' + id + '.jpg';

function buildSlot(el){
  const id    = el.dataset.slot;
  const label = el.dataset.label || '';
  el.innerHTML = `
    ${CAR_SVG}
    <div class="slot__shine"></div>
    <div class="slot__hint">${esc(label)}<br><span style="color:rgba(255,255,255,.18)">Drop or Alt+click to replace</span></div>
    <div class="slot__drop">Release to place</div>`;

  fillSlot(el, slotStore.get(id) || slotAsset(id));

  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('is-drag'); });
  el.addEventListener('dragleave', () => el.classList.remove('is-drag'));
  el.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    el.classList.remove('is-drag');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) readInto(el, id, file);
  });

  el.addEventListener('click', e => {
    if (!e.altKey) return;            // Alt+click = replace, plain click stays free for lightbox
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => input.files[0] && readInto(el, id, input.files[0]);
    input.click();
  });
}

function readInto(el, id, file){
  if (!/^image\//.test(file.type)) return;
  const fr = new FileReader();
  fr.onload = () => { fillSlot(el, fr.result); slotStore.set(id, fr.result); };
  fr.readAsDataURL(file);
}

function fillSlot(el, src){
  let img = el.querySelector('.slot__img');
  if (!img){
    img = document.createElement('img');
    img.className = 'slot__img';
    img.alt = el.dataset.label || '';
    img.loading = el.dataset.slot === 'hero-car' ? 'eager' : 'lazy';
    img.decoding = 'async';
    el.appendChild(img);
  }
  img.onload  = () => el.classList.add('is-filled', 'is-loaded');
  img.onerror = () => { el.classList.remove('is-filled', 'is-loaded'); img.remove(); };
  img.src = src;
}

$$('.slot').forEach(buildSlot);

/* ─────────────── SPLIT TEXT ─────────────── */

$$('[data-split]').forEach(node => {
  const words = node.textContent.trim().split(/\s+/);
  node.textContent = '';
  const line = document.createElement('span');
  line.className = 'split-line';
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'split-word';
    s.textContent = w;
    s.style.transitionDelay = (i * 55) + 'ms';
    line.appendChild(s);
    if (i < words.length - 1) line.appendChild(document.createTextNode(' '));
  });
  node.appendChild(line);
  node.classList.add('split-host');
});

/* ─────────────── COUNTERS ─────────────── */

function runCounter(el){
  if (el.dataset.done) return;
  el.dataset.done = '1';
  const raw = el.dataset.count;
  const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (!isFinite(num)) { el.textContent = raw; return; }

  const suffix   = raw.replace(/^[0-9.,]+/, '');
  const decimals = (raw.split('.')[1] || '').replace(/[^0-9]/g, '').length;
  const grouped  = raw.includes(',');

  if (REDUCED) { el.textContent = raw; return; }

  const dur = 1500, t0 = performance.now();
  const tick = now => {
    const p = clamp((now - t0) / dur, 0, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    let v = (num * eased).toFixed(decimals);
    if (grouped) v = Number(v).toLocaleString('en-US');
    el.textContent = v + suffix;
    if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
  };
  requestAnimationFrame(tick);
}

/* ─────────────── REVEAL OBSERVER ─────────────── */

const revealIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const d = parseInt(el.dataset.delay || 0, 10);
    setTimeout(() => {
      el.classList.add('is-in');
      el.closest('.feature')?.classList.add('is-in');
      $$('[data-count]', el).forEach(runCounter);
      if (el.matches('[data-count]')) runCounter(el);
    }, REDUCED ? 0 : d);
    revealIO.unobserve(el);
  });
}, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

$$('.reveal, .split-host, [data-count]').forEach(el => revealIO.observe(el));

/* ─────────────── PRELOADER ─────────────── */

(() => {
  const pre  = $('#preloader');
  const fill = $('#preloaderFill');
  const num  = $('#preloaderNum');
  let p = 0, done = false;

  const finish = () => {
    if (done) return; done = true;
    p = 100; fill.style.width = '100%'; num.textContent = '100';
    setTimeout(() => {
      pre.classList.add('is-done');
      document.body.classList.remove('is-locked');
      $$('#hero .reveal, #hero .split-host').forEach(el => el.classList.add('is-in'));
      $$('#hero [data-count]').forEach(runCounter);
    }, 420);
  };

  document.body.classList.add('is-locked');
  const step = () => {
    if (done) return;
    p = Math.min(97, p + Math.random() * 13);
    fill.style.width = p + '%';
    num.textContent = Math.round(p);
    if (p < 97) setTimeout(step, 90 + Math.random() * 130);
  };
  step();

  window.addEventListener('load', () => setTimeout(finish, 350));
  setTimeout(finish, 4200);   // hard ceiling — never trap the page
})();

/* ─────────────── CURSOR ─────────────── */

if (!COARSE && !REDUCED){
  const dot   = $('#cursorDot');
  const ring  = $('#cursorRing');
  const label = $('#cursorLabel');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;

  addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
  }, { passive:true });

  addEventListener('mouseleave', () => document.body.classList.add('cursor-hidden'));
  addEventListener('mouseenter', () => document.body.classList.remove('cursor-hidden'));

  (function loop(){
    rx = lerp(rx, mx, 0.16); ry = lerp(ry, my, 0.16);
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  })();

  const HOVER = 'a,button,input,.gcard,.stat,[data-cursor]';
  document.addEventListener('mouseover', e => {
    const t = e.target.closest(HOVER);
    document.body.classList.remove('cursor-link', 'cursor-view');
    if (!t) return;
    const mode = t.dataset.cursor || 'link';
    document.body.classList.add(mode === 'view' ? 'cursor-view' : 'cursor-link');
    label.textContent = t.dataset.cursorLabel || 'View';
  });
}

/* ─────────────── MAGNETIC BUTTONS ─────────────── */

if (!COARSE && !REDUCED){
  $$('.magnetic').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.28;
      const y = (e.clientY - r.top - r.height / 2) * 0.42;
      el.style.transform = `translate(${x}px,${y}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

/* ─────────────── 3D TILT ─────────────── */

if (!COARSE && !REDUCED){
  $$('.tilt').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width  - 0.5;
      const py = (e.clientY - r.top)  / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${-py * 7}deg) rotateY(${px * 9}deg) translateZ(6px)`;
      el.style.transition = 'transform .1s linear, border-color .4s, box-shadow .4s';
    });
    el.addEventListener('mouseleave', () => {
      el.style.transition = 'transform .7s cubic-bezier(.22,1,.36,1), border-color .4s, box-shadow .4s';
      el.style.transform = '';
    });
  });

  // radial glow follows the pointer inside stat cards
  $$('.stat').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top)  + 'px');
    });
  });
}

/* ─────────────── HERO POINTER PARALLAX ─────────────── */

if (!COARSE && !REDUCED){
  const hero  = $('#hero');
  const stage = $('#heroStage');
  const glow  = $('#heroGlow');
  let tx = 0, ty = 0, cx = 0, cy = 0, gx = 0, gy = 0, tgx = 0, tgy = 0;

  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    tx  = ((e.clientX - r.left) / r.width  - 0.5);
    ty  = ((e.clientY - r.top)  / r.height - 0.5);
    tgx = e.clientX - r.left; tgy = e.clientY - r.top;
  }, { passive:true });

  hero.addEventListener('mouseleave', () => { tx = 0; ty = 0; });

  (function loop(){
    cx = lerp(cx, tx, 0.07); cy = lerp(cy, ty, 0.07);
    gx = lerp(gx, tgx, 0.12); gy = lerp(gy, tgy, 0.12);
    stage.style.transform =
      `translateY(calc(-50% + ${-cy * 22}px)) translateX(${-cx * 30}px) ` +
      `perspective(1200px) rotateY(${-cx * 6}deg) rotateX(${cy * 4}deg)`;
    glow.style.transform = `translate(${gx}px,${gy}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  })();
}

/* ─────────────── SCROLL: nav, progress, parallax ─────────────── */

const nav        = $('#siteNav');
const progress   = $('#scrollProgress');
const navLinks   = $$('.nav-link');
const indicator  = $('#navIndicator');
const ctaBg      = $('.cta__bg');
const parallaxEls = $$('.parallax');
const sections   = ['hero','performance','gallery','specs','features','contact']
  .map(id => document.getElementById(id)).filter(Boolean);

let lastY = 0, ticking = false;

function moveIndicator(link){
  if (!link || !indicator) return;
  indicator.style.width = link.offsetWidth + 'px';
  indicator.style.transform = `translateX(${link.offsetLeft}px)`;
  indicator.classList.add('is-on');
}

function onScroll(){
  const y   = window.scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = clamp(y / (max || 1), 0, 1) * 100 + '%';

  nav.classList.toggle('is-scrolled', y > 40);
  nav.classList.toggle('is-hidden', y > lastY && y > 480 && !$('#mobileMenu').classList.contains('is-open'));
  lastY = y;

  // scrollspy
  let active = sections[0];
  sections.forEach(s => { if (s.getBoundingClientRect().top <= innerHeight * 0.38) active = s; });
  navLinks.forEach(l => {
    const on = l.getAttribute('href') === '#' + active.id;
    l.classList.toggle('is-active', on);
    if (on) moveIndicator(l);
  });

  if (!REDUCED){
    // hero stage drift + CTA background drift
    if (ctaBg){
      const r = ctaBg.parentElement.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0){
        ctaBg.style.transform = `translateY(${(r.top - innerHeight / 2) * -0.06}px) scale(1.12)`;
      }
    }
    parallaxEls.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top > innerHeight || r.bottom < 0) return;
      const off = (r.top + r.height / 2 - innerHeight / 2) * (parseFloat(el.dataset.speed) || 0.05);
      el.style.setProperty('--py', off.toFixed(1) + 'px');
      const inner = el.querySelector('.slot');
      if (inner) inner.style.transform = `translateY(${(-off).toFixed(1)}px) scale(1.08)`;
    });
  }
  ticking = false;
}

addEventListener('scroll', () => {
  if (!ticking){ ticking = true; requestAnimationFrame(onScroll); }
}, { passive:true });
addEventListener('resize', () => {
  const on = $('.nav-link.is-active'); if (on) moveIndicator(on);
});
onScroll();
setTimeout(() => moveIndicator($('.nav-link.is-active')), 300);

/* ─────────────── SMOOTH ANCHORS ─────────────── */

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id === '#') return;
  const target = document.querySelector(id);
  if (!target) return;
  e.preventDefault();
  closeMenu();
  const top = target.getBoundingClientRect().top + window.scrollY - (id === '#hero' ? 0 : 70);
  window.scrollTo({ top, behavior: REDUCED ? 'auto' : 'smooth' });
});

/* ─────────────── MOBILE MENU ─────────────── */

const burger = $('#navBurger');
const menu   = $('#mobileMenu');
function closeMenu(){
  burger.classList.remove('is-open');
  menu.classList.remove('is-open');
  burger.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('is-locked');
}
burger.addEventListener('click', () => {
  const open = !menu.classList.contains('is-open');
  burger.classList.toggle('is-open', open);
  menu.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('is-locked', open);
});

/* ─────────────── LIGHTBOX ─────────────── */

(() => {
  const box     = $('#lightbox');
  const stage   = $('#lightboxStage');
  const caption = $('#lightboxCaption');
  let index = 0;

  function paint(){
    const g = GALLERY[index];
    stage.innerHTML = '';
    const img = document.createElement('img');
    img.src = slotStore.get(g.id) || slotAsset(g.id);
    img.alt = g.label;
    img.className = 'lightbox__img';
    stage.appendChild(img);
    caption.textContent = `${g.label} — ${String(index + 1).padStart(2, '0')} / ${String(GALLERY.length).padStart(2, '0')}`;
  }

  function open(i){
    index = (i + GALLERY.length) % GALLERY.length;
    paint();
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
  }
  function close(){
    box.classList.remove('is-open');
    box.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
  }
  const go = d => { index = (index + d + GALLERY.length) % GALLERY.length; paint(); };

  $('#gallery').addEventListener('click', e => {
    const card = e.target.closest('.gcard');
    if (card && !e.altKey) open(parseInt(card.dataset.index, 10));
  });
  $('#lightboxClose').addEventListener('click', close);
  $('#lightboxPrev').addEventListener('click', () => go(-1));
  $('#lightboxNext').addEventListener('click', () => go(1));
  box.addEventListener('click', e => { if (e.target === box) close(); });
  addEventListener('keydown', e => {
    if (!box.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });
})();

/* ─────────────── SUBSCRIBE ─────────────── */

$('#subscribe').addEventListener('submit', e => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const msg   = $('#subscribeMsg');
  const ok    = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value.trim());
  msg.textContent = ok ? 'Welcome aboard. Check your inbox.' : 'Enter a valid email address.';
  msg.style.color = ok ? '#4ade80' : 'var(--accent)';
  msg.classList.add('is-on');
  if (ok) input.value = '';
  setTimeout(() => msg.classList.remove('is-on'), 3600);
});

/* ─────────────── PAGE-WIDE DROP GUARD ─────────────── */

['dragover', 'drop'].forEach(t =>
  document.addEventListener(t, e => { if (!e.target.closest('.slot')) e.preventDefault(); }));

})();
