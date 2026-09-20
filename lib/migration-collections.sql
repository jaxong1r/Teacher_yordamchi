-- Migration: replace the flat monthly "payments" table with a proper
-- "collections" model, so klasskom can open a new money collection at any
-- time with a title, an amount, and a specific list of students it applies to.
-- Run this once in the SQL Editor on an existing project.

drop table if exists public.payments cascade;

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

alter table public.collections enable row level security;
alter table public.payments enable row level security;

create policy "klasskom reads collections in their class" on public.collections for select
  using (public.my_role() = 'klasskom' and class_id = public.my_class_id());
create policy "klasskom manages collections in their class" on public.collections for all
  using (public.my_role() = 'klasskom' and class_id = public.my_class_id())
  with check (public.my_role() = 'klasskom' and class_id = public.my_class_id());

create policy "klasskom reads payments in their class" on public.payments for select
  using (
    public.my_role() = 'klasskom'
    and exists (select 1 from public.collections c where c.id = collection_id and c.class_id = public.my_class_id())
  );
create policy "klasskom manages payments in their class" on public.payments for all
  using (
    public.my_role() = 'klasskom'
    and exists (select 1 from public.collections c where c.id = collection_id and c.class_id = public.my_class_id())
  )
  with check (
    public.my_role() = 'klasskom'
    and exists (select 1 from public.collections c where c.id = collection_id and c.class_id = public.my_class_id())
  );
