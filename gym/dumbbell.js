/* ============================================================
   FORGE — RotatingDumbbell
   Decorative 3D hero element. Plain Three.js (r150 UMD global),
   matching the project's vanilla IIFE convention.

   Contract:
     var rig = RotatingDumbbell.create(containerEl, options);
     rig.destroy();

   The model spins about its own bar axis at a constant, linear
   rate driven by elapsed clock time — never by scroll position.
   ============================================================ */
(function (global) {
  'use strict';

  var THREE = global.THREE;

  // r150 ships colour management off by default, which makes sRGB hex
  // colours render as if they were linear — reds wash out to pink.
  if (THREE && THREE.ColorManagement && 'enabled' in THREE.ColorManagement) {
    THREE.ColorManagement.enabled = true;
  }

  /* Tunables -------------------------------------------------------- */
  var DEFAULTS = {
    revolutionSeconds: 10,   // 8–12s per full revolution
    exposure: 0.95,
    cameraZ: 10.6,
    fov: 32
  };

  var RED = 0xff2d2d;          // brand accent, used for lighting

  // Model palette: rubber-coated red plates, chrome hardware, roundel faces.
  var RUBBER_HEX = '#d41f26';
  var WHITE_HEX  = '#f2f2f0';
  var BLUE_HEX   = '#1b3d8f';
  var RUBBER     = 0xd41f26;
  var CHROME     = 0xe8e8ed;

  /* ---------------------------------------------------------------- */
  /* Procedural textures — keeps the build dependency-free            */
  /* ---------------------------------------------------------------- */

  /**
   * Cross-hatch knurling for the grip. Used as a bump map so the
   * handle reads as machined steel rather than a smooth tube.
   */
  function makeKnurlTexture() {
    var size = 256;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');

    ctx.fillStyle = '#7a7a7a';
    ctx.fillRect(0, 0, size, size);

    ctx.lineWidth = 2;
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? '#ffffff' : '#1a1a1a';
      ctx.save();
      ctx.translate(pass === 0 ? 0 : 3, 0);
      for (var i = -size; i < size * 2; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + size, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i, size);
        ctx.lineTo(i + size, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 3);
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Tiny equirect "studio" gradient with two soft strip lights.
   * Run through PMREM it gives the metal believable soft reflections
   * without shipping an HDR file.
   */
  function makeStudioEnvironment(renderer) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    var ctx = c.getContext('2d');

    var base = ctx.createLinearGradient(0, 0, 0, 256);
    base.addColorStop(0.00, '#2b2f36');   // cool ceiling bounce
    base.addColorStop(0.48, '#141518');
    base.addColorStop(1.00, '#050505');   // dark floor
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 256);

    // key strip light
    var strip = ctx.createRadialGradient(150, 70, 6, 150, 70, 130);
    strip.addColorStop(0, '#ffffff');
    strip.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = strip;
    ctx.fillRect(0, 0, 512, 256);

    // brand-red kicker behind the subject
    var kick = ctx.createRadialGradient(400, 150, 4, 400, 150, 110);
    kick.addColorStop(0, 'rgba(255,45,45,0.55)');
    kick.addColorStop(1, 'rgba(255,45,45,0)');
    ctx.fillStyle = kick;
    ctx.fillRect(0, 0, 512, 256);

    var tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;

    var pmrem = new THREE.PMREMGenerator(renderer);
    var envRT = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    tex.dispose();

    return envRT; // caller owns disposal
  }

  /**
   * Concentric roundel for the outer plate faces: red field, white and red
   * rings, blue centre, white star. Drawn rather than loaded so there is no
   * image dependency and it stays crisp at any plate size.
   */
  function makeRoundelTexture() {
    var S = 512;
    var c = document.createElement('canvas');
    c.width = c.height = S;
    var ctx = c.getContext('2d');
    var mid = S / 2;

    function disc(radius, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(mid, mid, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function star(cx, cy, outer, inner, points, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (var i = 0; i < points * 2; i++) {
        var r = (i % 2 === 0) ? outer : inner;
        var a = (Math.PI / points) * i - Math.PI / 2;
        var x = cx + Math.cos(a) * r;
        var y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }

    disc(mid, RUBBER_HEX);
    disc(210, WHITE_HEX);
    disc(170, RUBBER_HEX);
    disc(130, WHITE_HEX);
    disc(94,  BLUE_HEX);
    star(mid, mid, 74, 31, 5, WHITE_HEX);

    var tex = new THREE.CanvasTexture(c);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }

  /* ---------------------------------------------------------------- */
  /* Model                                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Lathe profile for a rubber-coated plate: broad flat face, then a fat
   * rounded rim. The generous fillet is what sells "rubber" over "iron".
   */
  function plateGeometry(radius, thickness, hubRadius) {
    var h = thickness / 2;
    var pts = [
      new THREE.Vector2(hubRadius, -h),
      new THREE.Vector2(radius - 0.15, -h),
      new THREE.Vector2(radius - 0.04, -h + 0.08),
      new THREE.Vector2(radius, -h + 0.22),
      new THREE.Vector2(radius, h - 0.22),
      new THREE.Vector2(radius - 0.04, h - 0.08),
      new THREE.Vector2(radius - 0.15, h),
      new THREE.Vector2(hubRadius, h)
    ];
    var g = new THREE.LatheGeometry(pts, 64);
    g.computeVertexNormals();
    return g;
  }

  /**
   * Builds the dumbbell along +Y, then the caller lays it on its side.
   * Returns { group, disposables }.
   */
  function buildDumbbell(env, castShadows) {
    var group = new THREE.Group();
    var disposables = [];

    function track(x) { disposables.push(x); return x; }

    /* -- materials -- */
    var knurl = track(makeKnurlTexture());
    var roundel = track(makeRoundelTexture());

    // Polished chrome for every piece of hardware: full metalness, low
    // roughness so the studio env map reads as a mirror highlight.
    var chrome = track(new THREE.MeshStandardMaterial({
      color: CHROME,
      metalness: 1.0,
      roughness: 0.14,
      envMap: env,
      envMapIntensity: 1.0
    }));

    // Rubber coating: non-metal, high roughness, faint env pickup only.
    var plateMat = track(new THREE.MeshStandardMaterial({
      color: RUBBER,
      metalness: 0.0,
      roughness: 0.72,
      envMap: env,
      envMapIntensity: 0.45
    }));

    // Knurled grip — chrome, but rougher where the diamond pattern bites.
    var gripMat = track(new THREE.MeshStandardMaterial({
      color: CHROME,
      metalness: 1.0,
      roughness: 0.34,
      envMap: env,
      envMapIntensity: 0.85,
      bumpMap: knurl,
      bumpScale: 0.016
    }));

    // Printed roundel on the outer plate faces.
    var faceMat = track(new THREE.MeshStandardMaterial({
      map: roundel,
      metalness: 0.0,
      roughness: 0.62,
      envMap: env,
      envMapIntensity: 0.4
    }));

    function add(geo, mat, y) {
      track(geo);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = y || 0;
      mesh.castShadow = castShadows;
      mesh.receiveShadow = castShadows;
      group.add(mesh);
      return mesh;
    }

    /* -- chrome bar -- */
    var BAR_R = 0.16;
    add(new THREE.CylinderGeometry(BAR_R, BAR_R, 3.20, 40, 1, true), chrome, 0);

    /* -- knurled grip (slightly proud of the bar) -- */
    add(new THREE.CylinderGeometry(BAR_R + 0.02, BAR_R + 0.02, 1.70, 48, 1, true), gripMat, 0);

    /* -- ridged chrome collars flanking the grip -- */
    [1, -1].forEach(function (dir) {
      [0.90, 0.98, 1.06].forEach(function (y) {
        add(new THREE.TorusGeometry(BAR_R + 0.045, 0.030, 12, 44), chrome, dir * y)
          .rotation.x = Math.PI / 2;
      });
    });

    /* -- plates and end hardware, mirrored on both ends -- */
    var PLATE_R = 1.16;
    var PLATE_T = 0.86;
    var PLATE_Y = 1.52;                      // plate centre
    var FACE_Y = PLATE_Y + PLATE_T / 2;      // outer flat face

    [1, -1].forEach(function (dir) {
      // chrome sleeve bridging collars to plate hub
      add(new THREE.CylinderGeometry(0.24, 0.24, 0.70, 36), chrome, dir * 1.09);

      // rubber-coated plate
      add(plateGeometry(PLATE_R, PLATE_T, 0.22), plateMat, dir * PLATE_Y);

      // roundel printed on the outer face, lifted a hair off it to avoid
      // z-fighting with the lathe cap underneath
      var face = new THREE.Mesh(track(new THREE.CircleGeometry(0.97, 64)), faceMat);
      face.position.y = dir * (FACE_Y + 0.004);
      face.rotation.x = dir === 1 ? -Math.PI / 2 : Math.PI / 2;
      face.castShadow = castShadows;
      group.add(face);
    });

    return { group: group, disposables: disposables };
  }

  /* ---------------------------------------------------------------- */
  /* Rig                                                               */
  /* ---------------------------------------------------------------- */

  function create(container, options) {
    if (!container || !THREE || !global.WebGLRenderingContext) return null;

    var opts = Object.assign({}, DEFAULTS, options || {});
    var reduced = global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Perf budget: shadows and MSAA are the two expensive knobs, so they
    // only turn on where there is headroom.
    var coarse = global.matchMedia('(pointer: coarse)').matches;
    var lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4;
    var castShadows = !lowPower;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,               // transparent canvas, blends with the page
        antialias: !lowPower,
        powerPreference: 'high-performance'
      });
    } catch (err) {
      return null; // no WebGL — page degrades to the CSS-only hero
    }

    renderer.setClearAlpha(0);
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.exposure;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else renderer.outputEncoding = THREE.sRGBEncoding;

    if (castShadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(opts.fov, 1, 0.1, 100);
    camera.position.set(0, 0.35, opts.cameraZ);
    camera.lookAt(0, 0, 0);

    var envRT = makeStudioEnvironment(renderer);
    scene.environment = envRT.texture;

    /* ---- lighting: key / fill / rim / ambient ---- */
    var ambient = new THREE.AmbientLight(0xffffff, 0.12);
    var hemi = new THREE.HemisphereLight(0x5a6472, 0x050505, 0.35);

    var key = new THREE.DirectionalLight(0xfff4ec, 1.85);
    key.position.set(4.5, 6.0, 5.0);
    if (castShadows) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 22;
      key.shadow.camera.left = -4.5;
      key.shadow.camera.right = 4.5;
      key.shadow.camera.top = 4.5;
      key.shadow.camera.bottom = -4.5;
      key.shadow.bias = -0.0012;
      key.shadow.radius = 3;
    }

    var fill = new THREE.DirectionalLight(0x9fb6d6, 0.55);
    fill.position.set(-6.0, 0.8, 3.5);

    // Cool rim: a red kicker would vanish into the red plates, so the edge
    // separation comes from the opposite side of the colour wheel.
    var rim = new THREE.DirectionalLight(0xafc6ff, 1.45);
    rim.position.set(-3.5, 2.5, -6.0);

    scene.add(ambient, hemi, key, fill, rim);

    /* ---- model ---- */
    var built = buildDumbbell(envRT.texture, castShadows);

    // spinner owns the animated axis; root owns the static presentation
    // tilt, so the two concerns never fight each other.
    var spinner = new THREE.Group();
    built.group.rotation.z = Math.PI / 2;   // lay the bar along X
    spinner.add(built.group);

    // Leaning the root tips the spin axis off vertical, so the turntable
    // reads as a three-quarter view rather than a flat carousel.
    var root = new THREE.Group();
    // The Y term is a start-phase offset only — it opens on a three-quarter
    // view rather than dead side-on. The spin itself owns Y from here.
    root.rotation.set(0.18, 0.7, 0.22);
    root.add(spinner);
    scene.add(root);

    /* ---- soft contact shadow catcher ---- */
    var shadowPlane = null;
    var shadowMat = null;
    if (castShadows) {
      shadowMat = new THREE.ShadowMaterial({ opacity: 0.2 });
      shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), shadowMat);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = -3.1;
      shadowPlane.receiveShadow = true;
      scene.add(shadowPlane);
    }

    /* ---- sizing ---- */
    function resize() {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();

    var ro = null;
    if (global.ResizeObserver) {
      ro = new ResizeObserver(resize);
      ro.observe(container);
    } else {
      global.addEventListener('resize', resize);
    }

    /* ---- animation loop ---- */
    var speed = (Math.PI * 2) / opts.revolutionSeconds;  // rad/s, linear
    var t0 = performance.now();
    var rafId = 0;
    var running = false;
    var destroyed = false;

    function frame() {
      if (destroyed) return;
      rafId = requestAnimationFrame(frame);

      // Turntable spin: the model revolves about the upright axis, not
      // about the bar. Angle comes from absolute wall-clock time, never
      // from an accumulator or from scroll position, so dropped frames
      // and paused stretches cannot drift the phase or the speed.
      spinner.rotation.y = ((performance.now() - t0) / 1000) * speed;
      renderer.render(scene, camera);
    }

    function start() {
      if (running || destroyed || reduced) return;
      running = true;
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafId);
    }

    if (reduced) {
      // Static, correctly-lit pose instead of motion.
      spinner.rotation.y = 0.6;
      renderer.render(scene, camera);
    } else {
      start();
    }

    /* ---- visibility gating (pure perf; never affects the phase) ---- */
    function onVisibility() {
      if (document.hidden) stop();
      else if (isOnScreen()) start();
    }

    // The canvas lives inside the hero, so once the hero has scrolled
    // well clear there is nothing left to draw.
    function isOnScreen() {
      return (global.scrollY || global.pageYOffset) < global.innerHeight * 1.6;
    }

    var scrollTicking = false;
    function onScroll() {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(function () {
        scrollTicking = false;
        if (document.hidden) return;
        if (isOnScreen()) start(); else stop();
      });
    }

    document.addEventListener('visibilitychange', onVisibility);
    global.addEventListener('scroll', onScroll, { passive: true });

    /* ---- teardown ---- */
    function destroy() {
      destroyed = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      global.removeEventListener('scroll', onScroll);
      if (ro) ro.disconnect(); else global.removeEventListener('resize', resize);

      built.disposables.forEach(function (d) { if (d && d.dispose) d.dispose(); });
      if (shadowPlane) { shadowPlane.geometry.dispose(); shadowMat.dispose(); }
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }

    return { destroy: destroy, start: start, stop: stop, scene: scene };
  }

  global.RotatingDumbbell = { create: create };
})(window);
