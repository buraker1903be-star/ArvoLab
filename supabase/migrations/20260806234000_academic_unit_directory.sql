-- ArvoLab academic institution directory
-- Run in Supabase SQL Editor or through the migration workflow.

create extension if not exists pgcrypto;

create table if not exists public.academic_units (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  parent_id uuid references public.academic_units(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 240),
  unit_type text not null check (
    unit_type in (
      'faculty',
      'institute',
      'school',
      'conservatory',
      'vocational_school',
      'department',
      'division',
      'program'
    )
  ),
  external_code text,
  source_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_units_parent_not_self check (parent_id is null or parent_id <> id)
);

create unique index if not exists academic_units_root_unique_idx
  on public.academic_units (university_id, unit_type, lower(name))
  where parent_id is null;

create unique index if not exists academic_units_child_unique_idx
  on public.academic_units (university_id, parent_id, unit_type, lower(name))
  where parent_id is not null;

create index if not exists academic_units_university_parent_idx
  on public.academic_units (university_id, parent_id, unit_type, name);

create index if not exists academic_units_active_lookup_idx
  on public.academic_units (university_id, parent_id, unit_type, name)
  where is_active = true;

create or replace function public.validate_academic_unit_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_university_id uuid;
  parent_type text;
begin
  if new.parent_id is null then
    if new.unit_type in ('department', 'division', 'program') then
      raise exception 'Department, division and program records require a parent unit.';
    end if;
    return new;
  end if;

  select university_id, unit_type
    into parent_university_id, parent_type
  from public.academic_units
  where id = new.parent_id;

  if parent_university_id is null then
    raise exception 'Parent academic unit does not exist.';
  end if;

  if parent_university_id <> new.university_id then
    raise exception 'Parent unit and child unit must belong to the same university.';
  end if;

  if new.unit_type in ('faculty', 'institute', 'school', 'conservatory', 'vocational_school') then
    raise exception 'Top-level academic units cannot have a parent.';
  end if;

  if parent_type in ('department', 'division', 'program') and new.unit_type <> 'program' then
    raise exception 'Only a program may be nested under a department, division or program.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_academic_unit_parent() from public;

drop trigger if exists validate_academic_unit_parent_trigger on public.academic_units;
create trigger validate_academic_unit_parent_trigger
  before insert or update of university_id, parent_id, unit_type
  on public.academic_units
  for each row execute function public.validate_academic_unit_parent();

create or replace function public.set_academic_unit_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_academic_unit_updated_at() from public;

drop trigger if exists set_academic_unit_updated_at_trigger on public.academic_units;
create trigger set_academic_unit_updated_at_trigger
  before update on public.academic_units
  for each row execute function public.set_academic_unit_updated_at();

alter table public.academic_units enable row level security;

grant select on public.universities to authenticated;
grant select on public.academic_units to authenticated;

drop policy if exists "Authenticated users can view universities" on public.universities;
create policy "Authenticated users can view universities"
  on public.universities
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can view active academic units" on public.academic_units;
create policy "Authenticated users can view active academic units"
  on public.academic_units
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "Academic managers can insert academic units" on public.academic_units;
create policy "Academic managers can insert academic units"
  on public.academic_units
  for insert
  to authenticated
  with check (
    public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Academic managers can update academic units" on public.academic_units;
create policy "Academic managers can update academic units"
  on public.academic_units
  for update
  to authenticated
  using (
    public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  )
  with check (
    public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Academic managers can delete academic units" on public.academic_units;
create policy "Academic managers can delete academic units"
  on public.academic_units
  for delete
  to authenticated
  using (
    public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  );

-- Example import pattern for a root unit:
-- insert into public.academic_units (university_id, name, unit_type)
-- select id, 'Eğitim Bilimleri Enstitüsü', 'institute'
-- from public.universities
-- where name = 'Ankara Üniversitesi'
-- on conflict do nothing;

-- Example import pattern for a child unit:
-- insert into public.academic_units (university_id, parent_id, name, unit_type)
-- select u.id, parent.id, 'Eğitim Yönetimi Ana Bilim Dalı', 'department'
-- from public.universities u
-- join public.academic_units parent
--   on parent.university_id = u.id
--  and parent.name = 'Eğitim Bilimleri Enstitüsü'
-- where u.name = 'Ankara Üniversitesi'
-- on conflict do nothing;
