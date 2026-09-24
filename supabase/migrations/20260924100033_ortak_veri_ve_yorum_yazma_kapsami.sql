-- ============================================================
-- PROJE: ArvoLab (zpfpocyajnxcketdjbxm)
--
-- Kalan çıplak has_role(...) YAZMA politikaları kapatılıyor.
--
-- 20260924100028 okumaları kuruma bağladı; 100031 çalışma yazmayı, 100032
-- puanlama kriterlerini kapattı. Denetimde üç yol daha açık çıktı. Hepsi
-- SÜZGEÇSİZ istekte görünüyor: "where ..." yazan bir istek SELECT
-- politikasını da işletir, süzgeçsiz istek yalnızca yazma politikasına
-- bakar. Sondada A kurumunun Akademik Yöneticisi tek istekle:
--   * veritabanındaki BÜTÜN müsvedde yorumlarını sildi,
--   * herhangi bir üniversitenin tez kılavuzunu değiştirdi ve sildi,
--   * YÖK akademik birim dizininin tamamını (38 satır) ezdi ve sildi.
--
-- ---------- 1) Müsvedde yorumları ----------
-- Roller aynı kalıyor; yalnızca yöneticinin KAPSAMI daraltılıyor.
-- can_view_project zaten kuruma bağlı (20260924100028) ve iç ekip
-- içinden geçiyor, o yüzden ayrı bir kural yazılmıyor.
--
-- ---------- 2) YÖK dizini (academic_units, universities) ----------
-- Bu tablolar ULUSAL referans verisi ve YÖK Atlas'tan otomatik
-- doldruluyor (lib/yok-atlas-directory.ts, lib/guideline-discovery.ts).
-- Yazma yolunun tamamı service_role ile gidiyor; service_role RLS'i
-- zaten atladığı için senkronizasyon bu değişiklikten ETKİLENMEZ.
-- Uygulamada kullanıcı oturumuyla yazan tek bir yer yok — hepsi okuma.
-- Bir müşteri kurumunun yöneticisinin ülkenin fakülte dizinini
-- düzenleyebilmesi için hiçbir sebep yoktu.
--
-- ---------- 3) Tez kılavuzları ----------
-- Kılavuzlar üniversiteye göre düzenlenmiş referans kayıtları; bir müşteri
-- kurumuna ait değiller, o yüzden OKUMA eskisi gibi herkese açık kalıyor.
-- Yazma, puanlama kriterlerindeki (20260924100032) kalıbın aynısı:
-- organization_id NULL = genel/kürasyonlu kayıt, yalnızca iç ekip
-- düzenler; bir kurum kendi eklediği kılavuzu düzenler.
--
-- MEVCUT SATIRLAR NULL KALIYOR. Eşleştirme mantığına (findMatchingGuideline,
-- calismaKilavuzu) hiç dokunulmuyor: okuma değişmediği için hiçbir
-- kullanıcının kılavuzu kaybolmuyor.
-- ============================================================

-- ---------- 1) Müsvedde yorumları ----------
drop policy if exists "Authors or managers delete comments" on public.manuscript_comments;
create policy "Authors or managers delete comments"
  on public.manuscript_comments
  for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or (
      public.can_view_project(project_id)
      and public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
    )
  );

-- ---------- 2) YÖK dizini ----------
drop policy if exists "Academic managers can insert academic units" on public.academic_units;
create policy "Akademik birimleri yalnizca ic ekip ekler"
  on public.academic_units
  for insert
  to authenticated
  with check (public.has_role(array['system_admin','founder']::public.user_role[]));

drop policy if exists "Academic managers can update academic units" on public.academic_units;
create policy "Akademik birimleri yalnizca ic ekip duzenler"
  on public.academic_units
  for update
  to authenticated
  using (public.has_role(array['system_admin','founder']::public.user_role[]))
  with check (public.has_role(array['system_admin','founder']::public.user_role[]));

drop policy if exists "Academic managers can delete academic units" on public.academic_units;
create policy "Akademik birimleri yalnizca ic ekip siler"
  on public.academic_units
  for delete
  to authenticated
  using (public.has_role(array['system_admin','founder']::public.user_role[]));

drop policy if exists "Academic managers and above can add universities" on public.universities;
create policy "Universiteleri yalnizca ic ekip ekler"
  on public.universities
  for insert
  to authenticated
  with check (public.has_role(array['system_admin','founder']::public.user_role[]));

-- ---------- 3) Tez kılavuzları ----------
alter table public.thesis_guidelines
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

comment on column public.thesis_guidelines.organization_id is
  'NULL = genel/kürasyonlu kayıt; yalnızca iç ekip düzenler. Doluysa o kurumun kendi eklediği kılavuz. Okuma herkese açık.';

create index if not exists thesis_guidelines_organization_idx
  on public.thesis_guidelines(organization_id);

drop policy if exists "Academic managers and above can create guidelines" on public.thesis_guidelines;
create policy "Kilavuzu kurumun yoneticisi ekler"
  on public.thesis_guidelines
  for insert
  to authenticated
  with check (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

drop policy if exists "Academic managers and above can update guidelines" on public.thesis_guidelines;
create policy "Kilavuzu kurumun yoneticisi duzenler"
  on public.thesis_guidelines
  for update
  to authenticated
  using (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]))
  with check (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

drop policy if exists "Academic managers and above can delete guidelines" on public.thesis_guidelines;
create policy "Kilavuzu kurumun yoneticisi siler"
  on public.thesis_guidelines
  for delete
  to authenticated
  using (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

notify pgrst, 'reload schema';
