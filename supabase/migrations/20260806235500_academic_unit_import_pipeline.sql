-- Bulk import pipeline for verified academic unit data.
-- Load rows into public.academic_unit_import_staging, then call
-- select * from public.import_academic_units();

create table if not exists public.academic_unit_import_staging (
  id bigint generated always as identity primary key,
  university_name text not null,
  parent_name text,
  unit_name text not null,
  unit_type text not null,
  source_url text,
  external_code text,
  imported_at timestamptz,
  import_error text,
  created_at timestamptz not null default now(),
  check (
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
  )
);

create index if not exists academic_unit_import_staging_pending_idx
  on public.academic_unit_import_staging (imported_at, university_name, parent_name);

alter table public.academic_unit_import_staging enable row level security;

revoke all on public.academic_unit_import_staging from anon, authenticated;
grant select, insert, update, delete on public.academic_unit_import_staging
  to service_role;

grant usage, select on sequence public.academic_unit_import_staging_id_seq
  to service_role;

create or replace function public.import_academic_units()
returns table (
  staging_id bigint,
  status text,
  message text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  row_data record;
  resolved_university_id uuid;
  resolved_parent_id uuid;
  inserted_unit_id uuid;
begin
  for row_data in
    select *
    from public.academic_unit_import_staging
    where imported_at is null
    order by id
  loop
    begin
      resolved_university_id := null;
      resolved_parent_id := null;
      inserted_unit_id := null;

      select id
      into resolved_university_id
      from public.universities
      where lower(trim(name)) = lower(trim(row_data.university_name))
      limit 1;

      if resolved_university_id is null then
        raise exception 'University not found: %', row_data.university_name;
      end if;

      if nullif(trim(row_data.parent_name), '') is not null then
        select id
        into resolved_parent_id
        from public.academic_units
        where university_id = resolved_university_id
          and lower(trim(name)) = lower(trim(row_data.parent_name))
          and is_active = true
        order by case
          when unit_type in ('faculty', 'institute', 'school', 'conservatory', 'vocational_school') then 0
          else 1
        end,
        created_at
        limit 1;

        if resolved_parent_id is null then
          raise exception 'Parent unit not found: % / %', row_data.university_name, row_data.parent_name;
        end if;
      end if;

      select id
      into inserted_unit_id
      from public.academic_units
      where university_id = resolved_university_id
        and parent_id is not distinct from resolved_parent_id
        and unit_type = row_data.unit_type
        and lower(trim(name)) = lower(trim(row_data.unit_name))
      limit 1;

      if inserted_unit_id is null then
        insert into public.academic_units (
          university_id,
          parent_id,
          name,
          unit_type,
          source_url,
          external_code,
          is_active
        ) values (
          resolved_university_id,
          resolved_parent_id,
          trim(row_data.unit_name),
          row_data.unit_type,
          nullif(trim(row_data.source_url), ''),
          nullif(trim(row_data.external_code), ''),
          true
        )
        returning id into inserted_unit_id;
      else
        update public.academic_units
        set source_url = coalesce(nullif(trim(row_data.source_url), ''), source_url),
            external_code = coalesce(nullif(trim(row_data.external_code), ''), external_code),
            is_active = true
        where id = inserted_unit_id;
      end if;

      update public.academic_unit_import_staging
      set imported_at = now(), import_error = null
      where id = row_data.id;

      staging_id := row_data.id;
      status := 'imported';
      message := inserted_unit_id::text;
      return next;
    exception
      when others then
        update public.academic_unit_import_staging
        set import_error = sqlerrm
        where id = row_data.id;

        staging_id := row_data.id;
        status := 'error';
        message := sqlerrm;
        return next;
    end;
  end loop;
end;
$$;

revoke all on function public.import_academic_units() from public, anon, authenticated;
grant execute on function public.import_academic_units() to service_role;

comment on table public.academic_unit_import_staging is
  'Staging area for verified university faculty, institute, department and program data.';

comment on function public.import_academic_units() is
  'Imports pending staging rows idempotently into public.academic_units and records row-level errors.';
