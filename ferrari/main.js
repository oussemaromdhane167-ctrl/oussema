/* ══════════════════════════════════════════════════════════════════════════
   Ferrari — motion. anime.js v4 (UMD global `anime`), loaded from
   assets/vendor/anime.umd.min.js.

   The page's motion language is the press: plates arrive out of register and
   gather onto the sheet, figures are exposed rather than faded, numbers are
   counted up like a proof being checked. print-plates.js owns the photograph
   separations and the pointer lean; everything here drives the --reg
   registration factor, the reveals, and the page chrome.
   ══════════════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // The .js class is what hides everything the motion is about to reveal.
  // If the library never arrived, drop the class and let the page print flat.
  if (!window.anime) {
    document.documentElement.classList.remove('js');
    const loader = document.getElementById('loader');
    if (loader) loader.setAttribute('hidden', '');
    return;
  }

  const {
    animate, createTimeline, stagger, utils, onScroll,
    svg: animeSvg, spring, scrambleText, splitText,
  } = window.anime;

  const root = document.documentElement;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ── number formatting ─────────────────────────────────────────────────
     A .cmyk-num carries the same string four times (the paper union plus
     three plates); a plain .value carries it once. One writer for both. */
  const writeValue = (el, text) => {
    const spans = el.querySelectorAll('.paper, .plate');
    if (spans.length) spans.forEach((s) => { s.textContent = text; });
    else el.textContent = text;
  };

  const formatValue = (el, n) => {
    if (el.dataset.clock) {
      const total = Math.round(n);
      return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
    }
    const decimals = Number(el.dataset.decimals || 0);
    let out = n.toFixed(decimals);
    if (el.dataset.group) out = Number(out).toLocaleString('en-US');
    return out + (el.dataset.suffix || '');
  };

  const countUp = (el) => {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    const target = Number(el.dataset.count);
    if (REDUCED) { writeValue(el, formatValue(el, target)); return; }
    const proxy = { v: 0 };
    animate(proxy, {
      v: target,
      duration: 1600,
      ease: 'out(4)',
      onUpdate: () => writeValue(el, formatValue(el, proxy.v)),
      onComplete: () => writeValue(el, formatValue(el, target)),
    });
  };

  /* ── reveal choreography ───────────────────────────────────────────────
     One IntersectionObserver hands each element to the animation its
     data-anim names. Everything below runs once, on first exposure. */
  const REVEALS = {
    up:    { y: [22, 0], opacity: [0, 1], duration: 760, ease: 'out(3)' },
    card:  { y: [40, 0], opacity: [0, 1], scale: [0.985, 1], duration: 900, ease: 'out(4)' },
    tag:   { y: [12, 0], opacity: [0, 1], scale: [0.9, 1], duration: 620, ease: spring({ stiffness: 140, damping: 12 }) },
    year:  { x: [-14, 0], opacity: [0, 1], duration: 700, ease: 'out(3)' },
    fig:   { opacity: [0, 1], duration: 600, ease: 'out(2)' },
  };

  const revealGroups = new Map(); // element -> siblings sharing a stagger
  const reveal = (el) => {
    const kind = el.dataset.anim;
    const spec = REVEALS[kind];
    if (!spec) { utils.set(el, { opacity: 1 }); return; }
    if (REDUCED) { utils.set(el, { opacity: 1, y: 0, x: 0, scale: 1 }); return; }
    const group = revealGroups.get(el) || [el];
    const index = group.indexOf(el);
    animate(el, Object.assign({}, spec, { delay: Math.max(0, index) * 70 }));
  };

  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      reveal(e.target);
      obs.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

  const registerReveals = (scope = document) => {
    // group siblings so a row of cards ripples rather than landing together.
    // The masthead and the hero are choreographed by the intro timeline
    // instead, so they stay out of the observer's hands.
    $('[data-anim]', scope).filter((el) => !el.closest('.hero, .masthead')).forEach((el) => {
      const siblings = Array.from(el.parentElement.children)
        .filter((n) => n.dataset && n.dataset.anim === el.dataset.anim);
      revealGroups.set(el, siblings);
      revealObserver.observe(el);
    });
  };

  const countObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countUp(e.target);
      obs.unobserve(e.target);
    });
  }, { threshold: 0.5 });

  /* ── the kickers set themselves on the stone ───────────────────────────
     Small uppercase labels decode into place — the compositor picking type. */
  const scrambleObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      obs.unobserve(e.target);
      animate(e.target, {
        innerHTML: scrambleText({
          chars: 'uppercase',
          override: '',
          duration: 620,
          settleDuration: 200,
          perturbation: 0.2,
        }),
      });
    });
  }, { threshold: 0.6 });

  /* ── hero ──────────────────────────────────────────────────────────────
     The plates start wide of register and gather; the photograph is exposed
     from the top of the frame rather than faded in. */
  const heroIntro = () => {
    const lines = $('.hero .line');
    const frame = document.querySelector('.hero__figure');
    const figure = document.querySelector('.hero__figure .print');
    const foot = $('.hero__foot [data-anim]');
    const navItems = $('[data-anim="nav"]');

    if (REDUCED) {
      utils.set([...lines, ...foot, ...navItems, frame], { opacity: 1 });
      root.style.setProperty('--reg', '1');
      return;
    }

    utils.set(frame, { opacity: 1 });
    root.style.setProperty('--reg', '7');
    utils.set(lines, { opacity: 0, y: 46 });
    utils.set(navItems, { opacity: 0, y: -10 });
    utils.set(foot, { opacity: 0, y: 20 });
    if (figure) utils.set(figure, { clipPath: 'inset(0% 0% 100% 0%)' });

    // LEAD holds the sheet back until the press overlay has lifted. The
    // intro runs on its own clock rather than off the loader's completion,
    // so a slow or failed loader can never strand the page at opacity 0.
    const LEAD = 1400;
    const press = { reg: 7 };
    const tl = createTimeline({ defaults: { ease: 'out(3)' } });

    tl.add(press, {
      reg: 1,
      duration: 2000,
      ease: 'out(4)',
      onUpdate: () => root.style.setProperty('--reg', press.reg.toFixed(3)),
    }, LEAD);

    tl.add(navItems, {
      opacity: [0, 1], y: [-10, 0], duration: 620, delay: stagger(45),
    }, LEAD + 100);

    tl.add(lines, {
      opacity: [0, 1],
      y: [46, 0],
      duration: 1100,
      ease: 'out(5)',
      delay: stagger(120),
    }, LEAD + 220);

    if (figure) {
      tl.add(figure, {
        clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'],
        duration: 1200,
        ease: 'inOutQuart',
      }, LEAD + 620);
    }

    tl.add(foot, {
      opacity: [0, 1], y: [20, 0], duration: 800, delay: stagger(90),
    }, LEAD + 1150);

    return tl;
  };

  /* ── the loader: the press comes up to speed ───────────────────────────── */
  const runLoader = () => {
    const loader = document.getElementById('loader');
    const bar = document.getElementById('loader-bar');
    const pct = document.getElementById('loader-pct');
    const mark = document.getElementById('loader-mark');
    if (!loader) return;

    const finish = () => loader.setAttribute('hidden', '');

    if (REDUCED) { finish(); return; }

    const progress = { v: 0 };
    const markPress = { reg: 5 };
    createTimeline()
      .add(progress, {
        v: 100,
        duration: 1500,
        ease: 'inOut(2)',
        onUpdate: () => {
          utils.set(bar, { right: (100 - progress.v) + '%' });
          pct.textContent = String(Math.round(progress.v)).padStart(3, '0');
        },
      }, 0)
      .add(markPress, {
        reg: 1,
        duration: 1400,
        ease: 'out(4)',
        onUpdate: () => mark.style.setProperty('--reg', markPress.reg.toFixed(3)),
      }, 0)
      .add(loader, {
        opacity: [1, 0],
        duration: 620,
        ease: 'inOut(2)',
        onComplete: finish,
      }, '+=140');
  };

  /* ── the running strip ─────────────────────────────────────────────────── */
  const runStrip = () => {
    const track = document.getElementById('strip-track');
    if (!track || REDUCED) return;
    animate(track, {
      x: ['0%', '-50%'],
      duration: 26000,
      ease: 'linear',
      loop: true,
    });
  };

  /* ── parallax: the sheet drifts under the frame ────────────────────────── */
  const runParallax = () => {
    if (REDUCED) return;
    $('[data-parallax]').forEach((frame) => {
      const img = frame.querySelector('img');
      if (!img) return;
      const depth = Number(frame.dataset.parallax) || 0.1;
      const shift = Math.round(depth * 100); // percent of the frame height
      utils.set(img, { scale: 1 + depth * 1.6 });
      const drift = animate(img, {
        y: [shift + '%', -shift + '%'],
        ease: 'linear',
        autoplay: false,
      });
      onScroll({ target: frame, sync: 0.4 }).link(drift);
    });
  };

  /* ── the rev counter ───────────────────────────────────────────────────── */
  const runTach = () => {
    const tach = document.getElementById('tach');
    if (!tach) return;
    const needle = document.getElementById('tach-needle');
    const readout = document.getElementById('tach-readout');
    const arc = document.getElementById('tach-arc');
    const red = document.getElementById('tach-red');
    const ticks = $('.tach-ticks line');

    const paint = (rpm) => { readout.textContent = Math.round(rpm).toLocaleString('en-US'); };

    if (REDUCED) {
      needle.setAttribute('transform', 'rotate(170 200 190)');
      paint(8500);
      return;
    }

    utils.set(ticks, { opacity: 0 });
    const rev = { rpm: 0 };

    const once = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        obs.unobserve(e.target);

        const tl = createTimeline();

        // the dial is drawn before the needle moves
        const [drawArc] = animeSvg.createDrawable(arc);
        const [drawRed] = animeSvg.createDrawable(red);
        tl.add(drawArc, { draw: ['0 0', '0 1'], duration: 900, ease: 'inOut(2)' }, 0)
          .add(ticks, { opacity: [0, 0.85], duration: 260 }, stagger(45, { start: 300 }))
          .add(drawRed, { draw: ['0 0', '0 1'], duration: 420, ease: 'out(2)' }, 700)
          .add(rev, {
            rpm: [0, 8500],
            duration: 1500,
            ease: 'out(4)',
            onUpdate: () => {
              paint(rev.rpm);
              needle.setAttribute('transform', `rotate(${(rev.rpm / 9000) * 180} 200 190)`);
            },
          }, 500)
          .add(rev, {
            rpm: 1100,
            duration: 1100,
            ease: spring({ stiffness: 60, damping: 14 }),
            onUpdate: () => {
              paint(rev.rpm);
              needle.setAttribute('transform', `rotate(${(rev.rpm / 9000) * 180} 200 190)`);
            },
          }, '+=180');
      });
    }, { threshold: 0.4 });

    once.observe(tach);
  };

  /* ── page chrome ───────────────────────────────────────────────────────── */
  const runMasthead = () => {
    const masthead = document.getElementById('masthead');
    const onScrollTop = () => masthead.classList.toggle('is-stuck', window.scrollY > 12);
    addEventListener('scroll', onScrollTop, { passive: true });
    onScrollTop();

    // the current section owns its link
    const links = $('.nav-link');
    const byHash = new Map(links.map((a) => [a.getAttribute('href'), a]));
    const sections = links
      .map((a) => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);

    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.remove('is-active'));
        const link = byHash.get('#' + e.target.id);
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));
  };

  const runDrawer = () => {
    const drawer = document.getElementById('drawer');
    const toggle = document.getElementById('nav-toggle');
    const close = document.getElementById('drawer-close');
    if (!drawer || !toggle) return;
    const links = $('a', drawer);

    const open = () => {
      drawer.hidden = false;
      drawer.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      if (REDUCED) return;
      animate(drawer, { opacity: [0, 1], duration: 300, ease: 'out(2)' });
      animate(links, {
        opacity: [0, 1], y: [26, 0], duration: 620, ease: 'out(4)', delay: stagger(60),
      });
    };
    const shut = () => {
      toggle.setAttribute('aria-expanded', 'false');
      const done = () => { drawer.classList.remove('is-open'); drawer.hidden = true; };
      if (REDUCED) { done(); return; }
      animate(drawer, { opacity: [1, 0], duration: 260, ease: 'in(2)', onComplete: done });
    };

    toggle.addEventListener('click', open);
    close.addEventListener('click', shut);
    links.forEach((a) => a.addEventListener('click', shut));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) shut(); });
  };

  /* ── magnetic buttons: the hand pulls the plate a few millimetres ──────── */
  const runMagnets = () => {
    if (!FINE_POINTER || REDUCED) return;
    $('.magnetic').forEach((el) => {
      const release = spring({ stiffness: 120, damping: 14 });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        animate(el, {
          x: (e.clientX - (r.left + r.width / 2)) * 0.28,
          y: (e.clientY - (r.top + r.height / 2)) * 0.4,
          duration: 320,
          ease: 'out(3)',
        });
      });
      el.addEventListener('pointerleave', () => animate(el, { x: 0, y: 0, ease: release }));
    });
  };

  /* ── smooth anchors, including the buttons that behave like links ─────── */
  const runAnchors = () => {
    $('[data-scroll-to]').forEach((el) => {
      el.addEventListener('click', () => {
        const target = document.querySelector(el.dataset.scrollTo);
        if (target) target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
      });
    });
  };

  /* ── the sign-up answers in the voice of the workshop ─────────────────── */
  const runSignup = () => {
    const form = document.getElementById('signup');
    const note = document.getElementById('signup-note');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email');
      const ok = /.+@.+\..+/.test(email.value);
      note.textContent = ok
        ? 'Filed. The workshop writes on the first Monday of the month.'
        : 'That address will not reach Maranello — check it and try again.';
      if (REDUCED) return;
      animate(note, { opacity: [0, 1], y: [6, 0], duration: 480, ease: 'out(3)' });
      if (ok) animate(form, { scale: [1, 0.985, 1], duration: 420, ease: 'inOut(2)' });
    });
  };

  /* ── the press rules draw themselves outward from the registration mark ── */
  const runRules = () => {
    const rules = $('[data-rule]');
    if (!rules.length) return;
    if (REDUCED) {
      rules.forEach((rule) => utils.set($('*', rule), { opacity: 1, scaleX: 1 }));
      return;
    }
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        o.unobserve(e.target);
        const rule = e.target;
        createTimeline()
          .add($('.press-rule__mark', rule), {
            opacity: [0, 1], rotate: [-90, 0], scale: [0.4, 1],
            duration: 700, ease: 'out(4)',
          }, 0)
          .add($('.press-rule__bar', rule), {
            opacity: [0, 1], scaleX: [0, 1], duration: 520, ease: 'out(3)', delay: stagger(60),
          }, 120)
          .add($('.press-rule__line', rule), {
            scaleX: [0, 1], duration: 900, ease: 'inOut(3)',
          }, 200);
      });
    }, { threshold: 0.9 });
    rules.forEach((rule) => obs.observe(rule));
  };

  /* ── the emblem field ──────────────────────────────────────────────────
     Shop badges adrift over the hero sheet: each one carries its own drift,
     bounces off the frame, and shies away from the cursor — the closer the
     hand, the harder the shove, and the faster the badge spins as it goes. */
  const runEmblems = () => {
    const host = document.getElementById('emblems');
    const tpl = document.getElementById('emblem-tpl');
    if (!host || !tpl) return;

    const COUNT = 18;
    const REPEL = 150;      // px — the radius the hand clears
    const PUSH = 0.42;      // px/frame² at the centre of that radius
    const MAX_SPEED = 2.4;  // px/frame

    let box = host.getBoundingClientRect();
    const badges = [];

    for (let i = 0; i < COUNT; i++) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const size = utils.random(15, 34);
      const alpha = utils.random(45, 90) / 100;
      node.style.width = size + 'px';
      node.style.height = (size * 1.2) + 'px';
      node.style.opacity = REDUCED ? String(alpha) : '0';
      host.appendChild(node);
      badges.push({
        el: node, alpha,
        w: size, h: size * 1.2,
        x: utils.random(0, Math.max(1, box.width - size)),
        y: utils.random(0, Math.max(1, box.height - size * 1.2)),
        vx: utils.random(-45, 45, 2) / 100,
        vy: utils.random(-45, 45, 2) / 100,
        rot: utils.random(-25, 25),
        vr: utils.random(-30, 30, 2) / 100,
        scale: REDUCED ? 1 : 0.2,
      });
    }

    // paint owns the transform outright, so the entrance animates the badge
    // OBJECTS (scale) and the elements' opacity only — nothing else writes
    // to style.transform, and the two never fight over it
    const paint = (b) => {
      b.el.style.transform =
        `translate(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px) rotate(${b.rot.toFixed(2)}deg) scale(${b.scale.toFixed(3)})`;
    };
    badges.forEach(paint);

    if (!REDUCED) {
      animate(badges, {
        scale: 1,
        duration: 900,
        ease: spring({ stiffness: 90, damping: 12 }),
        delay: stagger(45, { start: 1500, from: 'random' }),
      });
      animate(badges.map((b) => b.el), {
        opacity: (el, i) => badges[i].alpha,
        duration: 700,
        ease: 'out(2)',
        delay: stagger(45, { start: 1500, from: 'random' }),
      });
    }

    if (REDUCED) return;

    let px = -9999, py = -9999; // pointer, in host coordinates
    addEventListener('pointermove', (e) => {
      px = e.clientX - box.left;
      py = e.clientY - box.top;
    }, { passive: true });
    addEventListener('pointerleave', () => { px = -9999; py = -9999; });

    const remeasure = () => { box = host.getBoundingClientRect(); };
    addEventListener('resize', remeasure, { passive: true });
    addEventListener('scroll', remeasure, { passive: true });

    let last = performance.now();
    const tick = (now) => {
      // dt in 60fps-frames, clamped so a backgrounded tab cannot fling them
      const dt = utils.clamp((now - last) / 16.667, 0, 3);
      last = now;

      for (const b of badges) {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const dx = cx - px;
        const dy = cy - py;
        const dist = Math.hypot(dx, dy);
        if (dist < REPEL && dist > 0.001) {
          const force = (1 - dist / REPEL) * PUSH;
          b.vx += (dx / dist) * force * dt;
          b.vy += (dy / dist) * force * dt;
          b.vr += (dx > 0 ? 1 : -1) * force * 1.6 * dt;
        }

        b.vx *= 0.992;
        b.vy *= 0.992;
        b.vr *= 0.985;

        const speed = Math.hypot(b.vx, b.vy);
        if (speed > MAX_SPEED) { b.vx = (b.vx / speed) * MAX_SPEED; b.vy = (b.vy / speed) * MAX_SPEED; }
        // and never let one come to a full stop — the field keeps drifting
        if (speed < 0.06) { b.vx += utils.random(-4, 4, 2) / 100; b.vy += utils.random(-4, 4, 2) / 100; }

        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += b.vr * dt;

        const maxX = box.width - b.w;
        const maxY = box.height - b.h;
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
        else if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx); }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
        else if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy); }

        paint(b);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ── the lede sets itself word by word ────────────────────────────────── */
  const runLede = () => {
    const lede = document.querySelector('.hero__lede');
    if (!lede || REDUCED) return;
    const split = splitText(lede, { words: { wrap: 'clip' }, chars: false, accessible: true });
    split.addEffect((self) => self.words.length && animate(self.words, {
      y: ['110%', '0%'],
      opacity: [0, 1],
      duration: 900,
      ease: 'out(4)',
      delay: stagger(14, { start: 2500 }),
    }));
  };

  /* ── boot ──────────────────────────────────────────────────────────────── */
  const boot = () => {
    // the sheet first: whatever else fails, the hero must arrive
    heroIntro();
    runLoader();
    // …and the overlay lifts on a timer of its own even if nothing below runs
    setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader) loader.setAttribute('hidden', '');
    }, 4000);

    registerReveals();
    $('[data-count]').forEach((el) => countObserver.observe(el));
    $('.kicker').forEach((el) => { if (!REDUCED) scrambleObserver.observe(el); });
    runMasthead();
    runDrawer();
    runAnchors();
    runMagnets();
    runSignup();
    runStrip();
    runParallax();
    runTach();
    runLede();
    runRules();
    runEmblems();
  };

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
  else boot();
})();
