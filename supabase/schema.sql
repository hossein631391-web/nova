-- =====================================================================
-- انجمن نجوم NOVA — پایگاه داده، توابع کمکی، تریگرها و سیاست‌های RLS
-- این فایل را کامل در Supabase > SQL Editor اجرا کنید.
-- اجرای دوباره هم بی‌خطر است (از IF NOT EXISTS و DROP ... IF EXISTS استفاده شده).
-- =====================================================================


-- ---------- ۱) جدول‌ها ----------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  phone       text,
  role        text not null default 'member'
              check (role in ('member', 'active', 'admin')),
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'disabled')),
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(btrim(title)) > 0),
  description  text,
  due_date     date,
  priority     text not null default 'medium'
               check (priority in ('low', 'medium', 'high')),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.task_assignments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'new'
              check (status in ('new', 'in_progress', 'done')),
  updated_at  timestamptz not null default now(),
  unique (task_id, user_id)
);

create table if not exists public.task_notes (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.task_assignments(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  body           text not null check (length(btrim(body)) > 0),
  created_at     timestamptz not null default now()
);


-- ---------- ۲) ایندکس‌ها ----------

create index if not exists idx_profiles_role_status on public.profiles (role, status);
create index if not exists idx_profiles_created_at  on public.profiles (created_at desc);
create index if not exists idx_tasks_due_date       on public.tasks (due_date);
create index if not exists idx_tasks_created_by     on public.tasks (created_by);
create index if not exists idx_assignments_user     on public.task_assignments (user_id);
create index if not exists idx_assignments_task     on public.task_assignments (task_id);
create index if not exists idx_notes_assignment     on public.task_notes (assignment_id);


-- ---------- ۳) توابع کمکی نقش ----------
-- SECURITY DEFINER باعث می‌شود بررسی نقش داخل RLS به جدول profiles بازگشت بی‌نهایت نزند.

create or replace function public.is_approved()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved' and p.role = 'admin'
  );
$$;

create or replace function public.is_active_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved' and p.role in ('active', 'admin')
  );
$$;


-- ---------- ۴) ساخت خودکار پروفایل هنگام ثبت‌نام ----------
-- هر کاربر جدید با نقش «عضو» و وضعیت «در انتظار» ساخته می‌شود.
-- مقادیر نقش و وضعیت از متادیتای ورودی خوانده نمی‌شوند، پس کاربر نمی‌تواند خودش را مدیر کند.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, status)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    left(nullif(new.raw_user_meta_data ->> 'phone', ''), 20),
    'member',
    'pending'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------- ۵) محافظت از نقش و وضعیت (لایهٔ دوم دفاع) ----------
-- حتی اگر کسی سیاست یا ستون را اشتباه باز کند، این تریگر تغییر نقش/وضعیت توسط غیرمدیر را می‌بندد.

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql set search_path = public
as $$
begin
  -- auth.uid() در SQL Editor و در کارهای سرور خالی است؛ آن‌جا بررسی نمی‌شود.
  -- کاربر احراز هویت‌شده همیشه uid دارد و برای او بررسی انجام می‌شود.
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.id is distinct from old.id then
      raise exception 'اجازهٔ تغییر نقش یا وضعیت عضویت را ندارید';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- به‌روزرسانی خودکار زمان تغییر وضعیت تخصیص
create or replace function public.touch_assignment()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_assignment on public.task_assignments;
create trigger trg_touch_assignment
  before update on public.task_assignments
  for each row execute function public.touch_assignment();


-- ---------- ۶) محدودیت ستونی (Column-level privileges) ----------
-- عضو فقط می‌تواند نام و شماره تماس خودش را تغییر دهد.
-- عضو فعال فقط می‌تواند ستون status تخصیص خودش را تغییر دهد.

revoke all on public.profiles, public.tasks, public.task_assignments, public.task_notes from anon;

revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

revoke update on public.task_assignments from authenticated;
grant update (status) on public.task_assignments to authenticated;


-- ---------- ۷) توابع مدیریتی (RPC) ----------
-- تغییر وضعیت و نقش فقط از طریق این توابع انجام می‌شود و هر کدام خودشان مدیر بودن را بررسی می‌کنند.

create or replace function public.admin_set_status(target uuid, new_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'دسترسی مدیریت ندارید';
  end if;
  if new_status not in ('pending', 'approved', 'disabled') then
    raise exception 'وضعیت نامعتبر است';
  end if;
  if target = auth.uid() and new_status <> 'approved' then
    raise exception 'نمی‌توانید حساب خودتان را غیرفعال کنید';
  end if;
  update public.profiles set status = new_status where id = target;
  if not found then
    raise exception 'عضو مورد نظر پیدا نشد';
  end if;
end;
$$;

create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
begin
  if not public.is_admin() then
    raise exception 'دسترسی مدیریت ندارید';
  end if;
  if new_role not in ('member', 'active') then
    raise exception 'فقط نقش عضو یا عضو فعال قابل تنظیم است';
  end if;
  select p.role into v_role from public.profiles p where p.id = target;
  if v_role is null then
    raise exception 'عضو مورد نظر پیدا نشد';
  end if;
  if v_role = 'admin' then
    raise exception 'نقش مدیر فقط به‌صورت دستی در پایگاه داده تغییر می‌کند';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

create or replace function public.admin_dashboard_stats()
returns json
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'دسترسی مدیریت ندارید';
  end if;
  return json_build_object(
    'total_members',  (select count(*) from public.profiles),
    'pending',        (select count(*) from public.profiles where status = 'pending'),
    'active_members', (select count(*) from public.profiles where role = 'active' and status = 'approved'),
    'open_tasks',     (select count(distinct task_id) from public.task_assignments where status <> 'done')
  );
end;
$$;

-- دسترسی اجرا: فقط کاربران احراز هویت‌شده
revoke execute on function public.is_approved()                     from public, anon;
revoke execute on function public.is_admin()                        from public, anon;
revoke execute on function public.is_active_member()                from public, anon;
revoke execute on function public.admin_set_status(uuid, text)      from public, anon;
revoke execute on function public.admin_set_role(uuid, text)        from public, anon;
revoke execute on function public.admin_dashboard_stats()           from public, anon;

grant execute on function public.is_approved()                      to authenticated;
grant execute on function public.is_admin()                         to authenticated;
grant execute on function public.is_active_member()                 to authenticated;
grant execute on function public.admin_set_status(uuid, text)       to authenticated;
grant execute on function public.admin_set_role(uuid, text)         to authenticated;
grant execute on function public.admin_dashboard_stats()            to authenticated;


-- ---------- ۸) فعال‌سازی RLS ----------

alter table public.profiles         enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_notes       enable row level security;


-- ---------- ۹) سیاست‌ها: profiles ----------
-- کاربر «در انتظار» یا «غیرفعال» هیچ ردیفی را نمی‌بیند (حتی پروفایل خودش).

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid() and public.is_approved());

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select to authenticated
  using (public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid() and public.is_approved())
  with check (id = auth.uid() and public.is_approved());


-- ---------- ۱۰) سیاست‌ها: tasks ----------

drop policy if exists "tasks_admin_all" on public.tasks;
create policy "tasks_admin_all" on public.tasks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "tasks_member_select" on public.tasks;
create policy "tasks_member_select" on public.tasks
  for select to authenticated
  using (
    public.is_active_member()
    and exists (
      select 1 from public.task_assignments a
      where a.task_id = tasks.id and a.user_id = auth.uid()
    )
  );


-- ---------- ۱۱) سیاست‌ها: task_assignments ----------

drop policy if exists "assignments_admin_all" on public.task_assignments;
create policy "assignments_admin_all" on public.task_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "assignments_member_select" on public.task_assignments;
create policy "assignments_member_select" on public.task_assignments
  for select to authenticated
  using (user_id = auth.uid() and public.is_active_member());

drop policy if exists "assignments_member_update" on public.task_assignments;
create policy "assignments_member_update" on public.task_assignments
  for update to authenticated
  using (user_id = auth.uid() and public.is_active_member())
  with check (user_id = auth.uid() and public.is_active_member());


-- ---------- ۱۲) سیاست‌ها: task_notes ----------

drop policy if exists "notes_admin_all" on public.task_notes;
create policy "notes_admin_all" on public.task_notes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "notes_member_select" on public.task_notes;
create policy "notes_member_select" on public.task_notes
  for select to authenticated
  using (
    public.is_active_member()
    and exists (
      select 1 from public.task_assignments a
      where a.id = task_notes.assignment_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "notes_member_insert" on public.task_notes;
create policy "notes_member_insert" on public.task_notes
  for insert to authenticated
  with check (
    public.is_active_member()
    and user_id = auth.uid()
    and exists (
      select 1 from public.task_assignments a
      where a.id = task_notes.assignment_id and a.user_id = auth.uid()
    )
  );


-- =====================================================================
-- ساخت اولین مدیر (فقط یک بار، به‌صورت دستی)
-- ۱. در Supabase از Authentication > Users > Add user یک کاربر با ایمیل و رمز بسازید
--    (یا از صفحهٔ ثبت‌نام ثبت کنید).
-- ۲. سپس این دستور را اجرا کنید و ایمیل را جایگزین کنید:
--
--    update public.profiles
--    set role = 'admin', status = 'approved'
--    where id = (select id from auth.users where email = 'admin@example.com');
--
-- نقش مدیر از هیچ فرم یا صفحه‌ای قابل تنظیم نیست؛ این تنها راه است.
-- =====================================================================
