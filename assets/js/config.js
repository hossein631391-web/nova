/* ==========================================================================
   تنظیمات Supabase
   ─────────────────────────────────────────────────────────────
   راهنمای جایگزینی مقادیر:
   1. وارد https://supabase.com شوید و یک پروژه تازه بسازید.
   2. از منوی Project Settings > API این دو مقدار را کپی کنید:
      • Project URL  → مقدار SUPABASE_URL
        نمونه: "https://abcdefghijklmnop.supabase.co"
      • anon / public key → مقدار SUPABASE_ANON_KEY
        نمونه: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."  (رشتهٔ بسیار بلند)
   3. کلید anon عمومی است و قرار گرفتن آن در مرورگر مشکلی ندارد.
      هرگز کلید service_role را در این فایل یا هیچ فایل عمومی دیگری قرار ندهید.
   4. امنیت واقعی با Row Level Security در supabase/schema.sql اعمال می‌شود،
      نه با این فایل. کلید anon فقط به اندازهٔ سیاست‌های RLS دسترسی می‌دهد.
   5. پس از تغییر این فایل، صفحه را با Ctrl+F5 بارگذاری مجدد کنید.
   ========================================================================== */
window.NOVA_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY"
};
