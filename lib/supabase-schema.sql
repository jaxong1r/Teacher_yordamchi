-- Sinf Yordamchisi: to'liq Supabase sxemasi
-- Supabase loyihangizni yaratgach, SQL Editor'da shu faylni to'liq ishga tushiring.

create type public.app_role as enum ('teacher', 'klasskom');
create type public.attendance_status as enum ('present', 'absent', 'excused');

create table public.class_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default '9-B sinf',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  username text unique not null,
  role public.app_role not null,
  class_id uuid not null references public.class_settings(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.students (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.class_settings(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default now()
);

create table public.attendance (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  date date not null,
  status public.attendance_status not null,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(student_id, date)
);

create table public.duty_schedules (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  date date not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.collections (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.class_settings(id) on delete cascade,
  title text not null,
  expected_amount integer not null default 0 check (expected_amount >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.payments (
  id bigint generated always as identity primary key,
  collection_id bigint not null references public.collections(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  paid_amount integer not null default 0 check (paid_amount >= 0),
  updated_at timestamptz not null default now(),
  unique(collection_id, student_id)
);

-- ---------- Row Level Security ----------
-- NOTE ON DESIGN: every policy below uses a plain inline subquery against
-- `profiles` (scoped by `id = auth.uid()`), never a SECURITY DEFINER helper
-- function. An earlier version of this schema used `my_class_id()`/`my_role()`
-- SECURITY DEFINER functions to avoid re-querying `profiles` under RLS, but in
-- practice that privilege escalation was NOT reliably honored in this hosted
-- Supabase environment, which silently broke every policy that depended on it
-- (profile lookups, student inserts, etc). The inline-subquery approach below
-- works instead because it depends only on the one proven-reliable policy:
-- "a user can always read their own profile row" (id = auth.uid(), no
-- cross-row lookup needed) — every other policy composes on top of that.

alter table public.class_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.duty_schedules enable row level security;
alter table public.collections enable row level security;
alter table public.payments enable row level security;

-- class_settings: a user can see their own class
create policy "read own class" on public.class_settings for select
  using (id in (select class_id from public.profiles where id = auth.uid()));

-- profiles: a user can always read their own row, and every profile in their
-- class (teacher needs to see klasskom, and vice versa)
create policy "users can read own profile" on public.profiles for select
  using (id = auth.uid());
create policy "read profiles in my class" on public.profiles for select
  using (class_id in (select class_id from public.profiles where id = auth.uid()));
-- No insert/update/delete policy for normal users: accounts are only created/edited
-- through the server-side admin client (service_role key), which bypasses RLS.

-- students: both roles in the same class can read and manage the roster
create policy "read students in my class" on public.students for select
  using (class_id in (select class_id from public.profiles where id = auth.uid()));
create policy "manage students in my class" on public.students for all
  using (class_id in (select class_id from public.profiles where id = auth.uid()))
  with check (class_id in (select class_id from public.profiles where id = auth.uid()));

-- attendance: both roles can read and mark attendance for students in their class
create policy "read attendance in my class" on public.attendance for select
  using (exists (select 1 from public.students s where s.id = student_id and s.class_id in (select class_id from public.profiles where id = auth.uid())));
create policy "manage attendance in my class" on public.attendance for all
  using (exists (select 1 from public.students s where s.id = student_id and s.class_id in (select class_id from public.profiles where id = auth.uid())))
  with check (exists (select 1 from public.students s where s.id = student_id and s.class_id in (select class_id from public.profiles where id = auth.uid())));

-- duty_schedules: both roles can read and manage the roster for their class
create policy "read duties in my class" on public.duty_schedules for select
  using (exists (select 1 from public.students s where s.id = student_id and s.class_id in (select class_id from public.profiles where id = auth.uid())));
create policy "manage duties in my class" on public.duty_schedules for all
  using (exists (select 1 from public.students s where s.id = student_id and s.class_id in (select class_id from public.profiles where id = auth.uid())))
  with check (exists (select 1 from public.students s where s.id = student_id and s.class_id in (select class_id from public.profiles where id = auth.uid())));

-- collections + payments: KLASSKOM ONLY. A teacher's queries against these tables
-- return zero rows and are rejected at the database level, regardless of what
-- the app code does.
create policy "klasskom reads collections in their class" on public.collections for select
  using (
    (select role from public.profiles where id = auth.uid()) = 'klasskom'
    and class_id in (select class_id from public.profiles where id = auth.uid())
  );
create policy "klasskom manages collections in their class" on public.collections for all
  using (
    (select role from public.profiles where id = auth.uid()) = 'klasskom'
    and class_id in (select class_id from public.profiles where id = auth.uid())
  )
  with check (
    (select role from public.profiles where id = auth.uid()) = 'klasskom'
    and class_id in (select class_id from public.profiles where id = auth.uid())
  );

create policy "klasskom reads payments in their class" on public.payments for select
  using (
    (select role from public.profiles where id = auth.uid()) = 'klasskom'
    and exists (select 1 from public.collections c where c.id = collection_id and c.class_id in (select class_id from public.profiles where id = auth.uid()))
  );
create policy "klasskom manages payments in their class" on public.payments for all
  using (
    (select role from public.profiles where id = auth.uid()) = 'klasskom'
    and exists (select 1 from public.collections c where c.id = collection_id and c.class_id in (select class_id from public.profiles where id = auth.uid()))
  )
  with check (
    (select role from public.profiles where id = auth.uid()) = 'klasskom'
    and exists (select 1 from public.collections c where c.id = collection_id and c.class_id in (select class_id from public.profiles where id = auth.uid()))
  );

-- ---------- Optional: keep only the last ~31 days of attendance ----------
-- Run this manually once a month, or schedule it with the pg_cron extension
-- (Database -> Extensions -> pg_cron in the Supabase dashboard) if you want
-- old rows physically deleted rather than just hidden by the app's date filter.
-- select cron.schedule('cleanup-old-attendance', '0 3 * * *',
--   $$ delete from public.attendance where date < (current_date - interval '31 days'); $$
-- );

-- ---------- One-time bootstrap: create the class and the teacher account ----------
-- 1. Run this INSERT to create the class:
--    insert into public.class_settings (name) values ('9-B sinf') returning id;
-- 2. In Supabase Dashboard -> Authentication -> Users -> Add user, create the
--    teacher's login with email  <username>@sinf.local  and a password, with
--    "Auto Confirm User" checked.
-- 3. Copy the generated User UID, then run (replace the placeholders):
--    insert into public.profiles (id, first_name, last_name, username, role, class_id)
--    values ('<TEACHER_USER_UID>', 'Ism', 'Familiya', '<username>', 'teacher', '<CLASS_ID>');
-- After this, the teacher logs in at /login with that username/password and can
-- create the klasskom account directly from the app's "Klasskom" panel.
