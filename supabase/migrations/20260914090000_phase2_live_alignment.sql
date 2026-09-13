-- Faz 2 — Canlı veritabanı hizalaması
--
-- Canlıda çalıştırılması güvenlidir (tekrar çalıştırılabilir). Şunları yapar:
--   1) İlk yöneticinin SQL Editor'den atanabilmesi: prevent_self_role_escalation
--      tetikleyicisi auth.uid() boşken (SQL Editor / service role) artık engellemez.
--      Önceden README'deki "update profiles set role = 'founder'" adımı reddediliyordu.
--   2) Eski birim içe aktarma hattını (staging + import_academic_units) canlı
--      academic_units yapısına uyarlar: Türkçe birim türleri ve parent_unit_id.
--      Önceki fonksiyon parent_id ve İngilizce türler kullandığı için canlıda
--      çalışamazdı.

-- ------------------------------------------------------------
-- 1) Rol yükseltme tetikleyicisi
-- ------------------------------------------------------------
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (new.role is distinct from old.role or new.organization_id is distinct from old.organization_id)
     and not public.has_role(array['system_admin','founder']::public.user_role[]) then
    raise exception 'Rol veya kurum değişikliği için yetkiniz yok.';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2) Birim içe aktarma hattı
-- ------------------------------------------------------------
do $$
declare
  existing record;
begin
  if to_regclass('public.academic_unit_import_staging') is null then
    return;
  end if;

  for existing in
    select conname from pg_constraint
    where conrelid = 'public.academic_unit_import_staging'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%unit_type%'
  loop
    execute format('alter table public.academic_unit_import_staging drop constraint %I', existing.conname);
  end loop;

  update public.academic_unit_import_staging
  set unit_type = case unit_type
    when 'faculty' then 'fakulte'
    when 'institute' then 'enstitu'
    when 'school' then 'yuksekokul'
    when 'conservatory' then 'konservatuvar'
    when 'vocational_school' then 'meslek_yuksekokulu'
    when 'department' then 'bolum'
    when 'division' then 'anabilim_dali'
    else unit_type
  end
  where unit_type in ('faculty', 'institute', 'school', 'conservatory', 'vocational_school', 'department', 'division');

  alter table public.academic_unit_import_staging
    add constraint academic_unit_import_staging_unit_type_check check (
      unit_type in (
        'enstitu', 'fakulte', 'yuksekokul', 'konservatuvar', 'meslek_yuksekokulu',
        'bolum', 'anabilim_dali', 'anasanat_dali', 'bilim_dali', 'program', 'merkez', 'diger'
      )
    );
end;
$$;

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
          when unit_type in ('enstitu', 'fakulte', 'yuksekokul', 'konservatuvar', 'meslek_yuksekokulu', 'merkez') then 0
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
        and parent_unit_id is not distinct from resolved_parent_id
        and unit_type = row_data.unit_type
        and lower(trim(name)) = lower(trim(row_data.unit_name))
      limit 1;

      if inserted_unit_id is null then
        insert into public.academic_units (
          university_id,
          parent_unit_id,
          name,
          normalized_name,
          unit_type,
          source_url,
          source_checked_at,
          yok_unit_id,
          is_active
        ) values (
          resolved_university_id,
          resolved_parent_id,
          trim(row_data.unit_name),
          lower(trim(row_data.unit_name)),
          row_data.unit_type,
          nullif(trim(row_data.source_url), ''),
          now(),
          nullif(trim(row_data.external_code), ''),
          true
        )
        returning id into inserted_unit_id;
      else
        update public.academic_units
        set source_url = coalesce(nullif(trim(row_data.source_url), ''), source_url),
            yok_unit_id = coalesce(nullif(trim(row_data.external_code), ''), yok_unit_id),
            source_checked_at = now(),
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
