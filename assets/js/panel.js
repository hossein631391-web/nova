/* ==========================================================================
   ابزارهای مشترک پنل‌ها: پیام، پنجرهٔ تأیید، برچسب‌ها، قالب‌بندی
   ========================================================================== */
(function () {
  "use strict";

  var PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
  var ARABIC = "٠١٢٣٤٥٦٧٨٩";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function toFa(v) {
    return String(v).replace(/[0-9]/g, function (d) { return PERSIAN.charAt(+d); });
  }

  // ارقام فارسی/عربی را به لاتین تبدیل می‌کند (برای اعتبارسنجی و جستجوی شماره)
  function normalizeDigits(v) {
    return String(v == null ? "" : v).replace(/[۰-۹٠-٩]/g, function (d) {
      var i = PERSIAN.indexOf(d);
      if (i < 0) i = ARABIC.indexOf(d);
      return String(i);
    });
  }

  function fmtDate(value) {
    if (!value) return "—";
    var d = new Date(String(value).length === 10 ? value + "T00:00:00" : value);
    if (isNaN(d.getTime())) return String(value);
    try {
      return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(d);
    } catch (e) {
      return d.toLocaleDateString("fa-IR");
    }
  }

  function fmtDateTime(value) {
    if (!value) return "—";
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    try {
      return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      }).format(d);
    } catch (e) {
      return d.toLocaleString("fa-IR");
    }
  }

  /* ---------- برچسب‌ها ---------- */
  var LABELS = {
    status: { pending: "در انتظار تأیید", approved: "تأییدشده", disabled: "غیرفعال" },
    role: { member: "عضو", active: "عضو فعال", admin: "مدیر" },
    priority: { low: "کم", medium: "متوسط", high: "زیاد" },
    taskStatus: { "new": "جدید", in_progress: "در حال انجام", done: "انجام‌شده" }
  };

  function badge(text, cls) {
    return '<span class="badge ' + (cls || "") + '">' + esc(text) + "</span>";
  }
  function statusBadge(s) {
    var cls = { pending: "badge-wait", approved: "badge-ok", disabled: "badge-off" }[s];
    return badge(LABELS.status[s] || s, cls);
  }
  function roleBadge(r) {
    var cls = { member: "badge-muted", active: "badge-active", admin: "badge-admin" }[r];
    return badge(LABELS.role[r] || r, cls);
  }
  function priorityBadge(p) {
    var cls = { low: "badge-muted", medium: "badge-wait", high: "badge-off" }[p];
    return badge(LABELS.priority[p] || p, cls);
  }
  function taskStatusBadge(s) {
    var cls = { "new": "badge-muted", in_progress: "badge-active", done: "badge-ok" }[s];
    return badge(LABELS.taskStatus[s] || s, cls);
  }

  /* ---------- پیام کوتاه (Toast) ---------- */
  var toastStack = null;
  function toast(message, type) {
    if (!toastStack) {
      toastStack = document.createElement("div");
      toastStack.className = "toast-stack";
      toastStack.setAttribute("role", "status");
      toastStack.setAttribute("aria-live", "polite");
      document.body.appendChild(toastStack);
    }
    var el = document.createElement("div");
    el.className = "toast toast-" + (type || "info");
    el.textContent = message;
    toastStack.appendChild(el);
    setTimeout(function () {
      el.classList.add("hide");
      setTimeout(function () { el.remove(); }, 400);
    }, 4200);
  }

  /* ---------- پنجرهٔ تأیید ----------
     برمی‌گرداند Promise<boolean>. برای عملیات حساس danger=true بدهید. */
  function confirmDialog(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var wrap = document.createElement("div");
      wrap.className = "modal-backdrop";
      wrap.innerHTML =
        '<div class="modal card" role="dialog" aria-modal="true" aria-labelledby="modal-msg">' +
        '<p id="modal-msg" class="modal-msg"></p>' +
        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="cancel">انصراف</button>' +
        '<button type="button" class="btn btn-sm' + (opts.danger ? " btn-danger" : "") + '" data-act="ok">' +
        esc(opts.confirmText || "تأیید") + "</button>" +
        "</div></div>";
      wrap.querySelector("#modal-msg").textContent = message;

      function finish(value) {
        document.removeEventListener("keydown", onKey);
        wrap.remove();
        resolve(value);
      }
      function onKey(e) { if (e.key === "Escape") finish(false); }

      wrap.addEventListener("click", function (e) {
        var act = e.target.getAttribute && e.target.getAttribute("data-act");
        if (act === "ok") finish(true);
        else if (act === "cancel" || e.target === wrap) finish(false);
      });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(wrap);
      wrap.querySelector('[data-act="ok"]').focus();
    });
  }

  /* ---------- نمایش پیام داخل صفحه ---------- */
  function setAlert(el, type, msg) {
    if (!el) return;
    if (!msg) {
      el.className = "alert hidden";
      el.textContent = "";
      return;
    }
    el.className = "alert alert-" + type;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.textContent = msg;
  }

  /* ---------- ترجمهٔ خطاها به فارسی ---------- */
  function errorMessage(err) {
    var msg = (err && err.message) || "";
    if (msg === "NOT_APPROVED") return "حساب شما هنوز توسط مدیر تأیید نشده است.";
    if (msg === "NOT_CONFIGURED") return "اتصال به سرور تنظیم نشده است.";
    if (msg === "SDK_MISSING") return "کتابخانهٔ اتصال به سرور بارگذاری نشد؛ اینترنت را بررسی کنید.";
    if (/Invalid login credentials/i.test(msg)) return "ایمیل یا رمز عبور اشتباه است.";
    if (/Email not confirmed/i.test(msg)) return "ایمیل شما هنوز تأیید نشده است؛ لینک تأیید را در ایمیل خود بررسی کنید.";
    if (/already registered|already been registered/i.test(msg)) return "این ایمیل قبلاً ثبت شده است.";
    if (/at least \d+ characters|should be at least/i.test(msg)) return "رمز عبور حداقل باید ۸ کاراکتر باشد.";
    if (/rate limit|too many|over_email_send_rate/i.test(msg)) return "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.";
    if (/row-level security|permission denied/i.test(msg)) return "دسترسی لازم برای این کار را ندارید.";
    if (/[؀-ۿ]/.test(msg)) return msg; // پیام‌های فارسی از خود پایگاه داده
    console.error(err);
    return "مشکلی پیش آمد؛ دوباره تلاش کنید.";
  }

  window.NovaPanel = {
    esc: esc,
    toFa: toFa,
    normalizeDigits: normalizeDigits,
    fmtDate: fmtDate,
    fmtDateTime: fmtDateTime,
    labels: LABELS,
    badge: badge,
    statusBadge: statusBadge,
    roleBadge: roleBadge,
    priorityBadge: priorityBadge,
    taskStatusBadge: taskStatusBadge,
    toast: toast,
    confirmDialog: confirmDialog,
    setAlert: setAlert,
    errorMessage: errorMessage
  };
})();
