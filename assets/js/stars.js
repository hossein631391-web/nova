/* ==========================================================================
   پس‌زمینه ستاره‌ها — بوم ثابت پشت همه محتوا، مشترک بین همه صفحات
   ثابت‌های قابل تغییر در بالای فایل قرار دارند.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- ثابت‌های قابل تنظیم ---------- */
  var CONFIG = {
    DENSITY_DESKTOP: 7000,   // هر چند پیکسل مربع یک ستاره (کوچک‌تر = ستاره بیشتر)
    DENSITY_MOBILE: 14000,   // روی موبایل ستاره کمتر تا سبک بماند
    MAX_STARS: 260,
    MAX_STARS_MOBILE: 110,
    ATTRACT_RADIUS: 170,     // شعاع جذب موس/انگشت (پیکسل)
    ATTRACT_STRENGTH: 0.55,  // شدت جذب (0 تا 1)
    EASE: 0.06,              // نرمی حرکت به سمت هدف (کمتر = نرم‌تر)
    BASE_SPEED: 0.12,        // سرعت حرکت آرام ستاره‌ها
    TWINKLE_SPEED: 0.012,    // سرعت چشمک‌زدن
    MAX_DPR: 2               // حداکثر تراکم پیکسل برای کارایی بهتر
  };

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var IS_TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  var canvas = document.createElement("canvas");
  canvas.id = "stars-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext("2d");
  var stars = [];
  var width = 0, height = 0, dpr = 1;
  var pointer = { x: 0, y: 0, active: false };
  var rafId = null;
  var running = false;
  var palette = { rgb: "255,255,255", glow: "167,123,255", alpha: 1 };

  /* ---------- رنگ‌ها بر اساس تم ---------- */
  function readPalette() {
    var isLight = document.documentElement.getAttribute("data-theme") === "light";
    palette = isLight
      ? { rgb: "60,80,170", glow: "120,80,230", alpha: 0.55 }
      : { rgb: "255,255,255", glow: "167,123,255", alpha: 1 };
  }

  function starCount() {
    var area = width * height;
    var isMobile = width < 760 || IS_TOUCH;
    var density = isMobile ? CONFIG.DENSITY_MOBILE : CONFIG.DENSITY_DESKTOP;
    var max = isMobile ? CONFIG.MAX_STARS_MOBILE : CONFIG.MAX_STARS;
    return Math.min(max, Math.floor(area / density));
  }

  function makeStar() {
    var r = Math.random() * 1.4 + 0.3;
    return {
      bx: Math.random() * width,      // موقعیت پایه (ثابت + حرکت آرام)
      by: Math.random() * height,
      ox: 0,                          // جابه‌جایی فعلی به‌سمت نشانگر
      oy: 0,
      r: r,
      vx: (Math.random() - 0.5) * CONFIG.BASE_SPEED,
      vy: (Math.random() - 0.5) * CONFIG.BASE_SPEED,
      phase: Math.random() * Math.PI * 2,
      tw: CONFIG.TWINKLE_SPEED * (0.5 + Math.random()),
      tint: Math.random() < 0.25 ? "accent" : "plain"
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_DPR);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var n = starCount();
    stars = [];
    for (var i = 0; i < n; i++) stars.push(makeStar());

    if (REDUCED) drawFrame(0); // حالت ثابت
  }

  /* ---------- جذب نرم به نشانگر ---------- */
  function updateStar(s, t) {
    // حرکت آرام پایه
    s.bx += s.vx;
    s.by += s.vy;
    if (s.bx < -10) s.bx = width + 10;
    if (s.bx > width + 10) s.bx = -10;
    if (s.by < -10) s.by = height + 10;
    if (s.by > height + 10) s.by = -10;

    // هدف جابه‌جایی: اگر نشانگر فعال و نزدیک است، به‌سمت آن برو؛ وگرنه به صفر
    var tx = 0, ty = 0;
    if (pointer.active && !REDUCED) {
      var dx = pointer.x - s.bx;
      var dy = pointer.y - s.by;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < CONFIG.ATTRACT_RADIUS && d > 0.5) {
        // افت نیرو بر حسب فاصله (نزدیک‌تر = قوی‌تر)
        var falloff = 1 - d / CONFIG.ATTRACT_RADIUS;
        var force = CONFIG.ATTRACT_STRENGTH * falloff * falloff;
        tx = dx * force;
        ty = dy * force;
      }
    }
    // حرکت نرم به سمت هدف؛ وقتی نشانگر دور شود، به‌تدریج به موقعیت اولیه برمی‌گردد
    s.ox += (tx - s.ox) * CONFIG.EASE;
    s.oy += (ty - s.oy) * CONFIG.EASE;
    return t;
  }

  function drawFrame(t) {
    ctx.clearRect(0, 0, width, height);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      updateStar(s, t);
      var x = s.bx + s.ox;
      var y = s.by + s.oy;

      var alpha = 0.75;
      if (!REDUCED) {
        alpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.tw + s.phase));
      }
      alpha *= palette.alpha;

      var color = s.tint === "accent" ? palette.glow : palette.rgb;
      ctx.beginPath();
      ctx.fillStyle = "rgba(" + color + "," + alpha.toFixed(3) + ")";
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();

      // درخشش کوچک برای ستاره‌های بزرگ‌تر
      if (s.r > 1.1) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + color + "," + (alpha * 0.15).toFixed(3) + ")";
        ctx.arc(x, y, s.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function loop(now) {
    if (!running) return;
    drawFrame(now * 0.06);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (REDUCED || running || document.hidden) return;
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* ---------- ورودی موس و لمس ---------- */
  function setPointer(x, y) {
    pointer.x = x;
    pointer.y = y;
    pointer.active = true;
  }

  window.addEventListener("pointermove", function (e) {
    setPointer(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener("pointerdown", function (e) {
    setPointer(e.clientX, e.clientY);
  }, { passive: true });

  // لمس: با رها کردن انگشت، جذب آرام کنار می‌رود
  window.addEventListener("pointerup", function () {
    if (IS_TOUCH) pointer.active = false;
  });
  window.addEventListener("pointercancel", function () { pointer.active = false; });

  // وقتی موس از پنجره خارج شود
  document.addEventListener("mouseleave", function () { pointer.active = false; });
  window.addEventListener("blur", function () { pointer.active = false; });

  /* ---------- توقف وقتی تب پنهان است ---------- */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  /* ---------- تغییر تم ---------- */
  window.addEventListener("nova:themechange", function () {
    readPalette();
    if (REDUCED) drawFrame(0);
  });

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  readPalette();
  resize();
  start();
})();
