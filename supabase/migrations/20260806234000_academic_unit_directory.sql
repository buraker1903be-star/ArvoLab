-- ArvoLab academic institution directory
-- Run in Supabase SQL Editor or through the migration workflow.
--
-- Faz 2 notu: Bu dosya canlı veritabanındaki gerçek yapıyla hizalandı
-- (parent_unit_id, Türkçe birim türleri, YÖK Atlas alanları). İlk sürüm
-- parent_id ve İngilizce türler kullanıyordu; canlı veritabanı elle bu yapıya
-- dönüştürülmüştü ve uygulama kodu (lib/yok-atlas-directory.ts,
-- app/actions/universities.ts) bu yapıyı bekliyor.

create extension if not exists pgcrypto;

create table if not exists public.academic_units (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  parent_unit_id uuid references public.academic_units(id) on delete cascade,
  name text not null,
  normalized_name text,
  unit_type text not null,
  education_level text,
  yok_unit_id text,
  is_active boolean not null default true,
  source_url text,
  source_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_units_unit_type_check check (
    unit_type in (
      'enstitu',
      'fakulte',
      'yuksekokul',
      'konservatuvar',
      'meslek_yuksekokulu',
      'bolum',
      'anabilim_dali',
      'anasanat_dali',
      'bilim_dali',
      'program',
      'merkez',
      'diger'
    )
  ),
  constraint academic_units_education_level_check check (
    education_level in ('onlisans', 'lisans', 'yuksek_lisans', 'doktora', 'sanatta_yeterlik', 'karma')
  ),
  -- YÖK Atlas senkronizasyonu bu kısıtı upsert hedefi olarak kullanır
  -- (onConflict: "university_id,parent_unit_id,unit_type,name").
  constraint academic_units_university_id_parent_unit_id_unit_type_name_key
    unique (university_id, parent_unit_id, unit_type, name)
);

create index if not exists academic_units_university_parent_idx
  on public.academic_units (university_id, parent_unit_id, unit_type, name);

create index if not exists academic_units_active_lookup_idx
  on public.academic_units (university_id, parent_unit_id, unit_type, name)
  where is_active = true;

-- Hiyerarşi kuralları:
--   * Kök birimler (enstitü, fakülte, yüksekokul, konservatuvar, MYO, merkez) üst birim alamaz.
--   * Bölüm, anabilim/anasanat/bilim dalı ve program bir üst birime bağlı olmalıdır.
--   * Üst birim aynı üniversiteye ait olmalıdır. "diger" her iki konumda da olabilir.
create or replace function public.validate_academic_unit_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_university_id uuid;
begin
  if new.parent_unit_id is null then
    if new.unit_type in ('bolum', 'anabilim_dali', 'anasanat_dali', 'bilim_dali', 'program') then
      raise exception 'Bölüm, anabilim dalı ve program kayıtları bir üst birime bağlı olmalıdır.';
    end if;
    return new;
  end if;

  if new.parent_unit_id = new.id then
    raise exception 'Bir birim kendisinin üst birimi olamaz.';
  end if;

  if new.unit_type in ('enstitu', 'fakulte', 'yuksekokul', 'konservatuvar', 'meslek_yuksekokulu', 'merkez') then
    raise exception 'Kök birimler (enstitü, fakülte, yüksekokul vb.) bir üst birime bağlanamaz.';
  end if;

  select university_id into parent_university_id
  from public.academic_units
  where id = new.parent_unit_id;

  if parent_university_id is null then
    raise exception 'Üst birim bulunamadı.';
  end if;

  if parent_university_id <> new.university_id then
    raise exception 'Üst birim ve alt birim aynı üniversiteye ait olmalıdır.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_academic_unit_parent() from public;

drop trigger if exists validate_academic_unit_parent_trigger on public.academic_units;
create trigger validate_academic_unit_parent_trigger
  before insert or update of university_id, parent_unit_id, unit_type
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

-- Örnek kök birim ekleme:
-- insert into public.academic_units (university_id, name, normalized_name, unit_type)
-- select id, 'Eğitim Bilimleri Enstitüsü', lower('Eğitim Bilimleri Enstitüsü'), 'enstitu'
-- from public.universities
-- where name = 'Ankara Üniversitesi'
-- on conflict do nothing;

-- Örnek alt birim ekleme:
-- insert into public.academic_units (university_id, parent_unit_id, name, normalized_name, unit_type)
-- select u.id, parent.id, 'Eğitim Yönetimi Anabilim Dalı', lower('Eğitim Yönetimi Anabilim Dalı'), 'anabilim_dali'
-- from public.universities u
-- join public.academic_units parent
--   on parent.university_id = u.id
--  and parent.name = 'Eğitim Bilimleri Enstitüsü'
-- where u.name = 'Ankara Üniversitesi'
-- on conflict do nothing;
