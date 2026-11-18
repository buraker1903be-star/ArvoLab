-- ============================================================
-- P7_akademik_birim_tetikleyicileri  (RELEASE CLOSURE 06 hazırlık paketi — Production'a UYGULANMADI)
-- Amaç: ERTELENEBİLİR. academic_units için üst birim doğrulaması ve updated_at tetikleyicisi. Production'daki akademik dizin farklı bir soydan geliyor (bkz. rapor); mevcut satırlar doğrulamayı geçmeyebilir. Uygulamanın çalışma anı bu tetikleyicilere dayanmıyor.
-- ÖN KOŞUL (salt okunur): select count(*) from public.academic_units a where parent_unit_id is not null and not exists (select 1 from public.academic_units p where p.id=a.parent_unit_id and p.university_id=a.university_id);  -- 0 olmalı
-- DOĞRULAMA (uygulama sonrası): select tgname from pg_trigger where tgrelid='public.academic_units'::regclass;
-- DURDURMA: Ön koşul sorgusu 0 değilse UYGULAMA.
-- GERİ DÖNÜŞ: işlem tek transaction; hata olursa hiçbir şey kalmaz. Uygulandıktan
--   sonra geri almak için: scripts/uzlastirma/paketler/GERI_DONUS.md
-- Tekrar çalıştırılabilir (create or replace / if not exists / drop … if exists).
-- ============================================================
begin;
-- 20260806234000_academic_unit_directory.sql satır 62-125
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

-- Production'da bu fonksiyonlar service_role'e de kapalı (depo taklidi)

commit;
