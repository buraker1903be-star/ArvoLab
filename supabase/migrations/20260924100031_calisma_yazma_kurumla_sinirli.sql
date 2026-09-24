-- ============================================================
-- PROJE: ArvoLab (zpfpocyajnxcketdjbxm)
--
-- Çalışmayı DEĞİŞTİRME ve SİLME de kurumla sınırlanıyor.
--
-- 20260924100028 okumaları kuruma bağladı ama academic_projects'in kendi
-- UPDATE ve DELETE politikaları çıplak has_role(...) ile kaldı. Sonuç
-- tuhaf ve tehlikeli bir asimetriydi: A kurumunun Kontrolörü B kurumunun
-- tezini GÖREMİYOR ama satırı biliyorsa DEĞİŞTİREBİLİYORDU; A kurumunun
-- Akademik Yöneticisi ise SİLEBİLİYORDU — silme project_manuscripts'e
-- cascade olduğu için tezin metniyle birlikte.
--
-- Uygulama katmanı bu yolu zaten kapatıyordu (updateProject önce RLS'li
-- bir okuma yapıyor ve başka kurumun çalışmasını bulamıyor), ama RLS asıl
-- güvenlik katmanıdır: PostgREST'e doğrudan gelen bir istek uygulamanın
-- kontrolünü hiç görmez.
--
-- Kurallar okuma politikasının aynısı; roller eskisi gibi kalıyor
-- (değiştirme: controller + academic_manager, silme: academic_manager).
-- İç ekip gozetim_kapsami'nin içinden geçiyor, ayrıca yazılmıyor.
-- ============================================================

drop policy if exists "Update own, assigned, or oversight-role projects" on public.academic_projects;
create policy "Update own, assigned, or oversight-role projects"
  on public.academic_projects
  for update
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.gozetim_kapsami(
         coalesce(organization_id, public.kullanici_kurumu(owner_id)),
         array['controller','academic_manager']::public.user_role[]
       )
  )
  /*
    WITH CHECK satırın YENİ hali için de aynı kuralı arıyor: kendi kurumunun
    çalışmasını başka bir kuruma taşıyıp orada yetki kazanmak ya da tersi
    mümkün olmasın.
  */
  with check (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.gozetim_kapsami(
         coalesce(organization_id, public.kullanici_kurumu(owner_id)),
         array['controller','academic_manager']::public.user_role[]
       )
  );

drop policy if exists "Owner or oversight-role can delete projects" on public.academic_projects;
create policy "Owner or oversight-role can delete projects"
  on public.academic_projects
  for delete
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.gozetim_kapsami(
         coalesce(organization_id, public.kullanici_kurumu(owner_id)),
         array['academic_manager']::public.user_role[]
       )
  );

notify pgrst, 'reload schema';
