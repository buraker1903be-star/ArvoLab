-- ============================================================
-- PROJE: ArvoLab (zpfpocyajnxcketdjbxm)
--
-- Kılavuz EŞLEŞTİRMESİ kurumu gözetiyor.
--
-- 20260924100033 kılavuzlara organization_id ekledi: NULL = ortak katalog,
-- dolu = kurumun kendi eklediği kılavuz. Ama eşleştirmeyi yapan
-- best_guideline_for yalnızca university_id'ye bakıyordu. Sonuç, o
-- migration'ın kendi açtığı bir sızıntıydı:
--
--   A kurumu "Ankara Üniversitesi" için kendi kılavuzunu ekler; aynı
--   üniversitede okuyan B kurumunun öğrencisinin tezine ve bireysel
--   abonenin tezine DE uygulanırdı. Atıf sistemi, zorunlu bölümler, sayfa
--   sınırı ve editör sayfa ayarları başka bir kurumun kararıyla değişirdi
--   — üstelik sessizce, çünkü bağı veritabanı kuruyor.
--
-- Kural: bir teze YA kendi kurumunun kılavuzu YA DA ortak katalogdaki
-- kılavuz uygulanır; başka bir kurumunki asla.
--
-- ÖNCELİK kurumun kendi kılavuzunda. Bir kurum kendi kılavuzunu yüklediyse
-- bunu bilerek yapmıştır; ortak katalogdaki daha dar kapsamlı (bölüm
-- düzeyinde) bir kayıt bile onun önüne geçmemeli.
--
-- NULL kurum (bireysel abone) hiçbir kurumla eşleşmez: yalnızca ortak
-- katalog uygulanır. İki NULL'ı eşit saymak bütün bireysel aboneleri
-- herhangi bir müşteri kurumun kurallarına bağlardı.
-- ============================================================

create or replace function public.best_guideline_for(
  p_university_id uuid,
  p_unit_id uuid,
  p_department_id uuid,
  p_organization_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.thesis_guidelines g
  where p_university_id is not null
    and g.university_id = p_university_id
    and g.is_active
    and g.approved_snapshot is not null
    and (
      g.organization_id is null
      or (p_organization_id is not null and g.organization_id = p_organization_id)
    )
    and (
      g.academic_unit_id is null
      or g.academic_unit_id = p_unit_id
      or g.academic_unit_id = p_department_id
    )
  order by
    -- Kurumun kendi kılavuzu ortak katalogdan önce gelir.
    case when g.organization_id is not null then 0 else 1 end,
    case
      when p_department_id is not null and g.academic_unit_id = p_department_id then 0
      when p_unit_id is not null and g.academic_unit_id = p_unit_id then 1
      else 2
    end,
    g.effective_from desc nulls last,
    g.approved_snapshot ->> 'approved_at' desc
  limit 1
$$;

/*
  authenticated'a AÇILMIYOR. Fonksiyonu yalnızca tetikleyici çağırıyor ve
  tetikleyici security definer olduğu için içeriden çağırdığı fonksiyon
  sahibinin yetkisiyle çalışır. Eski üç argümanlı sürüm bir dönem
  authenticated'a açıktı ve 20260924100001 sertleştirmesinde kapatıldı;
  yeni imzada aynı hatayı tekrarlamamak için burada da kapalı
  (tests/db/guvenlik.test.mjs listeyi sabitliyor).
*/
revoke all on function public.best_guideline_for(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.best_guideline_for(uuid, uuid, uuid, uuid) to service_role;

-- Tetikleyici yeni imzayı kullanıyor; gövdenin gerisi 20260915090000'deki gibi.
create or replace function public.sync_academic_project_guideline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resync boolean := coalesce(current_setting('arvolab.guideline_resync', true), '') = 'on';
  v_guideline uuid;
  v_citation text;
begin
  if tg_op = 'UPDATE'
     and not v_resync
     and new.university_id is not distinct from old.university_id
     and new.academic_unit_id is not distinct from old.academic_unit_id
     and new.department_id is not distinct from old.department_id
     and new.organization_id is not distinct from old.organization_id
     and new.project_type is not distinct from old.project_type then
    new.guideline_id := old.guideline_id;
    return new;
  end if;

  if new.project_type <> 'thesis' then
    new.guideline_id := null;
    return new;
  end if;

  if new.university_id is null then
    if tg_op = 'INSERT' or not v_resync then
      new.guideline_id := null;
    end if;
    return new;
  end if;

  v_guideline := public.best_guideline_for(
    new.university_id, new.academic_unit_id, new.department_id, new.organization_id);
  new.guideline_id := v_guideline;
  if v_guideline is not null then
    select coalesce(approved_snapshot ->> 'citation_style', citation_style)
    into v_citation
    from public.thesis_guidelines
    where id = v_guideline;
    if v_citation is not null then
      new.citation_style := v_citation;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_academic_project_guideline() from public;

-- Eski üç argümanlı sürüm kaldırılıyor: duran bir kopya, kurumu gözetmeyen
-- eşleştirmenin geri gelme yoludur.
drop function if exists public.best_guideline_for(uuid, uuid, uuid);

-- Mevcut bağlar yeni kuralla yeniden kurulsun (bugün uygulanan kılavuz yok;
-- migration ileride ya da başka bir kurulumda uygulanırsa gerekli).
select set_config('arvolab.guideline_resync', 'on', false);
update public.academic_projects set updated_at = updated_at where project_type = 'thesis';
select set_config('arvolab.guideline_resync', 'off', false);

notify pgrst, 'reload schema';
