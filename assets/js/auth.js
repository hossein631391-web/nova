/* ==========================================================================
   احراز هویت با Supabase: اتصال، وضعیت کاربر، محافظ صفحات، دکمه‌های هدر
   کنترل واقعی دسترسی با RLS در پایگاه داده است؛ این فایل فقط تجربهٔ کاربری را بهتر می‌کند.
   ========================================================================== */
(function () {
  "use strict";

  var cfg = window.NOVA_CONFIG || {};
  var CONFIGURED = !!cfg.SUPABASE_URL && !!cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf("YOUR-") === -1 &&
    cfg.SUPABASE_ANON_KEY.indexOf("YOUR-") === -1;

  var IN_PANEL = /\/(member|admin)\//.test(window.location.pathname);
  var ROOT = IN_PANEL ? "../" : "";
  var client = null;

  function url(path) { return ROOT + path; }

  function getClient() {
    if (client) return client;
    if (!CONFIGURED) throw new Error("NOT_CONFIGURED");
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("SDK_MISSING");
    }
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  async function getUser() {
    var res = await getClient().auth.getSession();
    return res.data && res.data.session ? res.data.session.user : null;
  }

  // برای کاربر «در انتظار» یا «غیرفعال»، RLS ردیف را برنمی‌گرداند و profile برابر null است.
  async function getState() {
    var user = await getUser();
    if (!user) return { user: null, profile: null };
    var res = await getClient().from("profiles").select("*").eq("id", user.id).maybeSingle();
    return { user: user, profile: res.data || null };
  }

  // سطح دسترسی: member (هر عضو تأییدشده) | active (عضو فعال یا مدیر) | admin
  function allowed(profile, level) {
    if (!profile || profile.status !== "approved") return false;
    if (level === "member") return true;
    if (level === "active") return profile.role === "active" || profile.role === "admin";
    if (level === "admin") return profile.role === "admin";
    return false;
  }

  // فقط مسیرهای همین سایت (جلوگیری از هدایت به دامنهٔ دیگر)
  function safeNext(next) {
    if (!next) return null;
    try {
      var u = new URL(next, window.location.href);
      if (u.origin !== window.location.origin) return null;
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return null;
    }
  }

  // در صفحات پنل فراخوانی شود. اگر دسترسی نبود، کاربر هدایت می‌شود و null برمی‌گردد.
  async function guard(level) {
    var main = document.getElementById("main");
    if (!CONFIGURED) {
      if (window.NovaPanel) NovaPanel.toast("اتصال به Supabase تنظیم نشده است؛ فایل assets/js/config.js را کامل کنید.", "error");
      return null;
    }
    var state = await getState();
    if (!state.user) {
      window.location.replace(url("login.html") + "?next=" + encodeURIComponent(window.location.pathname + window.location.search));
      return null;
    }
    if (!state.profile) {
      window.location.replace(url("access-denied.html") + "?reason=pending");
      return null;
    }
    if (!allowed(state.profile, level)) {
      window.location.replace(url("access-denied.html") + "?reason=role");
      return null;
    }
    if (main) main.classList.remove("panel-loading");
    return state;
  }

  // ورود با ایمیل و رمز. اگر پروفایل تأییدشده نباشد، خروج می‌کند و خطا می‌دهد.
  async function signIn(email, password) {
    var c = getClient();
    var res = await c.auth.signInWithPassword({ email: email, password: password });
    if (res.error) throw res.error;
    var state = await getState();
    if (!state.profile) {
      await c.auth.signOut();
      throw new Error("NOT_APPROVED");
    }
    return state;
  }

  // target = null یعنی بدون هدایت (مثلاً هنگام خطای ورود)
  async function signOut(target) {
    try { await getClient().auth.signOut(); } catch (e) { /* ignore */ }
    if (target === null) return;
    window.location.href = url(target || "index.html");
  }

  /* ---------- دکمه‌های هدر: ورود یا نام کاربر + خروج ---------- */
  async function renderHeader() {
    var slot = document.getElementById("auth-slot");
    if (!slot) return;
    if (!CONFIGURED) {
      slot.innerHTML = '<span class="auth-note">اتصال تنظیم نشده</span>';
      return;
    }
    var state = { user: null, profile: null };
    try { state = await getState(); } catch (e) { /* ignore */ }

    if (!state.user) {
      slot.innerHTML = '<a class="btn btn-ghost btn-sm" href="' + url("login.html") + '">ورود</a>';
      return;
    }
    var name = state.profile ? (state.profile.full_name || "عضو انجمن") : "در انتظار تأیید";
    var home = state.profile && state.profile.role === "admin" ? "admin/index.html" : "member/index.html";
    slot.innerHTML =
      '<a class="user-chip" href="' + url(home) + '" title="' + NovaPanel.esc(name) + '">' + NovaPanel.esc(name) + "</a>" +
      '<button type="button" class="btn btn-ghost btn-sm" id="logout-btn">خروج</button>';
    document.getElementById("logout-btn").addEventListener("click", function () { signOut(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderHeader();
    if (CONFIGURED) {
      try {
        getClient().auth.onAuthStateChange(function (event) {
          if (event === "SIGNED_IN" || event === "SIGNED_OUT") renderHeader();
        });
      } catch (e) { /* ignore */ }
    }
  });

  window.NovaAuth = {
    ROOT: ROOT,
    url: url,
    configured: CONFIGURED,
    client: getClient,
    getState: getState,
    allowed: allowed,
    guard: guard,
    signIn: signIn,
    signOut: signOut,
    safeNext: safeNext
  };
})();
