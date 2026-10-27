/* ==========================================================================
   رفتارهای مشترک: تم، هدر، فوتر، منوی موبایل، انیمیشن ورود
   نسخهٔ به‌روز: پشتیبانی از صفحات زیرپوشه (member/ و admin/) و جای دکمه‌های ورود/خروج
   ========================================================================== */
(function () {
  "use strict";

  var THEME_KEY = "nova-theme";
  var root = document.documentElement;

  // صفحات member/ و admin/ باید یک سطح بالاتر بروند
  var ROOT = /\/(member|admin)\//.test(window.location.pathname) ? "../" : "";

  /* ---------- ابزارهای کمکی ---------- */
  var FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  function toFa(value) {
    return String(value).replace(/[0-9]/g, function (d) { return FA_DIGITS[+d]; });
  }
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- تم ---------- */
  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      var label = theme === "light" ? "تغییر به تم تاریک" : "تغییر به تم روشن";
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);
    }
    window.dispatchEvent(new CustomEvent("nova:themechange", { detail: { theme: theme } }));
  }

  var stored = getStoredTheme();
  applyTheme(stored === "light" || stored === "dark" ? stored : systemTheme());

  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    var onSystemChange = function (e) {
      if (!getStoredTheme()) applyTheme(e.matches ? "light" : "dark");
    };
    if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }

  /* ---------- قالب هدر و فوتر ---------- */
  var NAV = [
    { href: "index.html", label: "خانه" },
    { href: "about.html", label: "درباره ما" },
    { href: "events.html", label: "رویدادها و رصدها" },
    { href: "news.html", label: "اخبار و مقالات" },
    { href: "gallery.html", label: "گالری آسمان" },
    { href: "videos.html", label: "ویدیوهای انجمن" },
    { href: "admins.html", label: "مدیران انجمن" }
  ];

  var LOGO_SVG =
    '<svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
    '<defs><radialGradient id="nova-core" cx="50%" cy="50%" r="50%">' +
    '<stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#ffb3ec"/>' +
    '<stop offset="70%" stop-color="#7b4dff"/><stop offset="100%" stop-color="#3a6bff" stop-opacity="0"/>' +
    '</radialGradient></defs>' +
    '<g stroke="url(#nova-core)" stroke-width="2" stroke-linecap="round" opacity=".9">' +
    '<line x1="32" y1="4" x2="32" y2="60"/><line x1="4" y1="32" x2="60" y2="32"/>' +
    '<line x1="12" y1="12" x2="52" y2="52"/><line x1="52" y1="12" x2="12" y2="52"/></g>' +
    '<circle cx="32" cy="32" r="16" fill="url(#nova-core)"/>' +
    '<circle cx="32" cy="32" r="6" fill="#ffffff"/>' +
    '</svg>';

  var THEME_ICONS =
    '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
    '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function currentPage() {
    var file = window.location.pathname.split("/").pop();
    return file === "" ? "index.html" : file;
  }

  function buildHeader() {
    var page = currentPage();
    var links = NAV.map(function (item) {
      var current = item.href === page ? ' aria-current="page"' : "";
      return '<li><a href="' + ROOT + item.href + '"' + current + ">" + item.label + "</a></li>";
    }).join("");

    return (
      '<header class="site-header" id="site-header">' +
      '<div class="container header-inner">' +
      '<a class="logo" href="' + ROOT + 'index.html" aria-label="صفحه اصلی انجمن نجوم NOVA">' + LOGO_SVG +
      '<span class="logo-text"><strong>NOVA</strong><small>انجمن نجوم و فناوری‌های فضایی</small></span></a>' +
      '<nav class="main-nav" id="main-nav" aria-label="ناوبری اصلی"><ul class="nav-list">' + links + "</ul></nav>" +
      '<div class="header-actions">' +
      '<a class="btn btn-sm btn-join" href="' + ROOT + 'about.html#membership">عضویت در انجمن</a>' +
      '<div class="auth-slot" id="auth-slot" aria-live="polite"></div>' +
      '<button type="button" class="theme-toggle" id="theme-toggle" aria-label="تغییر تم">' + THEME_ICONS + "</button>" +
      '<button type="button" class="menu-toggle" id="menu-toggle" aria-controls="main-nav" aria-expanded="false" aria-label="باز کردن منو">' +
      "<span></span><span></span><span></span></button>" +
      "</div></div></header>"
    );
  }

  function buildFooter() {
    var year = new Date().getFullYear();
    return (
      '<footer class="site-footer"><div class="container">' +
      '<div class="footer-grid">' +
      '<div><h4>انجمن نجوم NOVA</h4><p>جمعی از علاقه‌مندان به نجوم و فناوری‌های فضایی؛ برای یادگیری، رصد و کشف.</p>' +
      '<span class="placeholder-note">(متن نمونه، اطلاعات واقعی را جایگزین کنید)</span></div>' +
      '<div><h4>دسترسی سریع</h4><ul>' +
      '<li><a href="' + ROOT + 'events.html">رویدادها و رصدها</a></li>' +
      '<li><a href="' + ROOT + 'news.html">اخبار و مقالات</a></li>' +
      '<li><a href="' + ROOT + 'about.html#membership">عضویت</a></li></ul></div>' +
      '<div><h4>تماس با ما</h4><ul>' +
      '<li><a href="mailto:info@example.com">info@example.com</a></li>' +
      '<li><a href="tel:+980000000000">۰۰۰-۰۰۰۰۰۰۰۰ (نمونه)</a></li>' +
      "<li>شهر، استان — نشانی نمونه</li></ul></div>" +
      '<div><h4>شبکه‌های اجتماعی</h4><div class="socials">' +
      '<a href="#" aria-label="اینستاگرام"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg></a>' +
      '<a href="#" aria-label="یوتیوب"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/></svg></a>' +
      '<a href="#" aria-label="تلگرام"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/></svg></a>' +
      "</div></div>" +
      "</div>" +
      '<div class="footer-bottom">© ' + toFa(year) + " انجمن نجوم و فناوری‌های فضایی NOVA — تمام حقوق محفوظ است.</div>" +
      "</div></footer>"
    );
  }

  var headerMount = document.getElementById("site-header");
  if (headerMount) headerMount.outerHTML = buildHeader();
  else document.body.insertAdjacentHTML("afterbegin", buildHeader());

  var footerMount = document.getElementById("site-footer");
  if (footerMount) footerMount.outerHTML = buildFooter();
  else document.body.insertAdjacentHTML("beforeend", buildFooter());

  /* ---------- رفتارها ---------- */
  var themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ذخیره نشد؛ مهم نیست */ }
      applyTheme(next);
    });
  }

  var menuBtn = document.getElementById("menu-toggle");
  var mainNav = document.getElementById("main-nav");
  function setMenu(open) {
    if (!menuBtn || !mainNav) return;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "بستن منو" : "باز کردن منو");
    mainNav.classList.toggle("open", open);
  }
  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      setMenu(menuBtn.getAttribute("aria-expanded") !== "true");
    });
  }
  if (mainNav) {
    mainNav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });

  var header = document.getElementById("site-header");
  var onScroll = function () {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- ورود تدریجی با IntersectionObserver ---------- */
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealObserver = null;
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  }

  // بعد از رندر محتوای پویا، صفحه می‌تواند این تابع را صدا بزند
  function reveal(scope) {
    var nodes = (scope || document).querySelectorAll("[data-reveal], .reveal");
    nodes.forEach(function (el) {
      el.classList.add("reveal");
      if (reduceMotion || !revealObserver) {
        el.classList.add("is-visible");
      } else {
        revealObserver.observe(el);
      }
    });
  }

  reveal(document);

  /* ---------- API عمومی ---------- */
  window.Nova = {
    ROOT: ROOT,
    toFa: toFa,
    escapeHtml: escapeHtml,
    reveal: reveal,
    setTheme: applyTheme,
    isFuture: function (isoDate) {
      var today = new Date();
      var todayIso = today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");
      return isoDate >= todayIso;
    }
  };
})();
