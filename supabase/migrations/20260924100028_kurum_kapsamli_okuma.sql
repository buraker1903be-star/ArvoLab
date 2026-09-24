-- ============================================================
-- Denetim rolleri artık YALNIZCA kendi kurumunu okuyor.
--
-- Bugüne kadar okuma politikalarında rol kontrolü kurumdan bağımsızdı:
--   has_role(array['controller','academic_manager','system_admin','founder'])
-- Yani A kurumundaki bir Kontrolör, B kurumunun bütün çalışmalarını,
-- metinlerini, yüklediği dosyaları, analizlerini ve asistan kayıtlarını
-- okuyabiliyordu. Yazma tarafı kurumla sınırlıydı
-- (guard_academic_project_insert: "kendi kurumunuzda"), okuma tarafı değil;
-- tablolar organization_id taşıdığı halde hiçbir okuma politikası ona
-- bakmıyordu.
--
-- Bireysel abonelerle birlikte bu bir sızıntıdan fazlası oluyor: kurumu
-- olmayan bir abonenin tezi, HERHANGİ bir müşteri kurumun kontrolörüne
-- açıktı. Depodaki ham dosyalar da öyle ("Users can read their own files"
-- politikasındaki çıplak has_role).
--
-- Yeni kural tek yerde: public.gozetim_kapsami(kurum, roller).
--   * İç ekip (system_admin, founder) her kurumu görür — ArvoLab'ın kendi
--     ekibi destek verebilmeli (AGENTS.md: iç ekip hiçbir koşulda
--     engellenmez).
--   * Diğer gözetim rolleri yalnızca KENDİ kurumunu görür.
--   * NULL kurum asla eşleşmez. Bireysel abonenin de, kurumsuz bir personelin
--     de organization_id'si NULL; ikisini eşit saymak bütün bireysel
--     aboneleri birbirine açardı. Bu yüzden "is not distinct from" değil,
--     açıkça "is not null and =".
--
-- Sahibi kendi satırını görmeye devam eder; hiçbir politikadan kullanıcının
-- KENDİ verisine erişim kaldırılmadı.
-- ============================================================

-- ---------- 1) Yardımcılar ----------

-- Satırda organization_id yoksa kurum sahibinin profilinden gelir.
create or replace function public.kullanici_kurumu(p_kullanici uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = p_kullanici
$$;

revoke all on function public.kullanici_kurumu(uuid) from public, anon, authenticated;
grant execute on function public.kullanici_kurumu(uuid) to anon, authenticated, service_role;

create or replace function public.gozetim_kapsami(p_kurum uuid, p_roller public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array['system_admin','founder']::public.user_role[])
      or (
        public.has_role(p_roller)
        -- NULL asla eşleşmez; gerekçe dosyanın başında.
        and p_kurum is not null
        and p_kurum = public.get_my_organization_id()
      )
$$;

revoke all on function public.gozetim_kapsami(uuid, public.user_role[]) from public, anon, authenticated;
grant execute on function public.gozetim_kapsami(uuid, public.user_role[]) to anon, authenticated, service_role;

-- ---------- 2) Çalışma görme/yazma ----------
--
-- academic_projects.organization_id boş olan eski satırlar var (kural
-- 20260924100001'le geldi). Bunları "kurumsuz" saymak, kurumun kendi
-- kontrolörünü eski çalışmalardan koparırdı; o yüzden satırın kurumu
-- yoksa SAHİBİNİN kurumu okunuyor. Bireysel abonede ikisi de NULL, sonuç
-- değişmiyor.
create or replace function public.can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.academic_projects p
    where p.id = p_project_id
      and (
        p.owner_id = auth.uid()
        or p.assignee_id = auth.uid()
        or public.gozetim_kapsami(
             coalesce(p.organization_id, public.kullanici_kurumu(p.owner_id)),
             array['controller','academic_manager']::public.user_role[]
           )
      )
  )
$$;

create or replace function public.can_write_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.academic_projects p
    where p.id = p_project_id
      and (
        p.owner_id = auth.uid()
        or p.assignee_id = auth.uid()
        or public.gozetim_kapsami(
             coalesce(p.organization_id, public.kullanici_kurumu(p.owner_id)),
             array['controller','academic_manager']::public.user_role[]
           )
      )
  )
$$;

-- ---------- 3) Okuma politikaları ----------

drop policy if exists "View own, assigned, or oversight-role projects" on public.academic_projects;
create policy "View own, assigned, or oversight-role projects"
  on public.academic_projects
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.gozetim_kapsami(
         coalesce(organization_id, public.kullanici_kurumu(owner_id)),
         array['controller','academic_manager']::public.user_role[]
       )
  );

drop policy if exists "Users can view their own score entries" on public.academic_score_entries;
create policy "Users can view their own score entries"
  on public.academic_score_entries
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or public.gozetim_kapsami(public.kullanici_kurumu(owner_id),
         array['controller','academic_manager']::public.user_role[])
  );

drop policy if exists "Kendi asistan kayıtlarını görür" on public.ai_assistant_runs;
create policy "Kendi asistan kayıtlarını görür"
  on public.ai_assistant_runs
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.gozetim_kapsami(public.kullanici_kurumu(user_id),
         array['controller','academic_manager']::public.user_role[])
  );

drop policy if exists "Users can view their own ai feedback" on public.ai_feedback_requests;
create policy "Users can view their own ai feedback"
  on public.ai_feedback_requests
  for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    or public.gozetim_kapsami(public.kullanici_kurumu(requested_by),
         array['controller','academic_manager']::public.user_role[])
  );

drop policy if exists "Users can view their own citation checks" on public.citation_checks;
create policy "Users can view their own citation checks"
  on public.citation_checks
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or public.can_view_project(project_id)
    or public.gozetim_kapsami(public.kullanici_kurumu(created_by),
         array['controller','academic_manager']::public.user_role[])
  );

-- Danışmanlık talebi kullanıcının bilerek dışarı açtığı bir istektir, ama
-- muhatabı kendi kurumunun uzmanıdır. Kurumu olmayan bireysel abonenin
-- talebi iç ekibe (system_admin, founder) düşer.
drop policy if exists "View own, assigned, or expert-eligible requests" on public.consultancy_requests;
create policy "View own, assigned, or expert-eligible requests"
  on public.consultancy_requests
  for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    or assigned_expert_id = (select auth.uid())
    or public.gozetim_kapsami(public.kullanici_kurumu(requested_by),
         array['expert','controller','academic_manager']::public.user_role[])
  );

drop policy if exists "Owner or expert-eligible roles can update requests" on public.consultancy_requests;
create policy "Owner or expert-eligible roles can update requests"
  on public.consultancy_requests
  for update
  to authenticated
  using (
    requested_by = (select auth.uid())
    or assigned_expert_id = (select auth.uid())
    or public.gozetim_kapsami(public.kullanici_kurumu(requested_by),
         array['expert','controller','academic_manager']::public.user_role[])
  )
  with check (
    requested_by = (select auth.uid())
    or assigned_expert_id = (select auth.uid())
    or public.gozetim_kapsami(public.kullanici_kurumu(requested_by),
         array['expert','controller','academic_manager']::public.user_role[])
  );

drop policy if exists "Users can view their own document uploads" on public.document_uploads;
create policy "Users can view their own document uploads"
  on public.document_uploads
  for select
  to authenticated
  using (
    uploaded_by = (select auth.uid())
    or public.can_view_project(project_id)
    or public.gozetim_kapsami(public.kullanici_kurumu(uploaded_by),
         array['controller','academic_manager']::public.user_role[])
  );

drop policy if exists "Users can view their own literature sources" on public.literature_sources;
create policy "Users can view their own literature sources"
  on public.literature_sources
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or public.gozetim_kapsami(public.kullanici_kurumu(owner_id),
         array['controller','academic_manager']::public.user_role[])
  );

drop policy if exists "Users can view their own originality checks" on public.originality_checks;
create policy "Users can view their own originality checks"
  on public.originality_checks
  for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    or public.gozetim_kapsami(public.kullanici_kurumu(requested_by),
         array['controller','academic_manager']::public.user_role[])
  );

drop policy if exists "Kendi geri bildirimini görür" on public.product_feedback;
create policy "Kendi geri bildirimini görür"
  on public.product_feedback
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.gozetim_kapsami(coalesce(organization_id, public.kullanici_kurumu(user_id)),
         array['academic_manager']::public.user_role[])
  );

drop policy if exists "Users can view manuscripts they have project access to" on public.project_manuscripts;
create policy "Users can view manuscripts they have project access to"
  on public.project_manuscripts
  for select
  to authenticated
  using (public.can_view_project(project_id));

-- ---------- 4) Depo ----------
--
-- Çıplak has_role kaldırıldı: A kurumunun kontrolörü B kurumunun ham tez
-- dosyasını indirebiliyordu. Kullanıcı klasörü (project-files/<kullanıcı>/…)
-- artık sahibinin kurumuyla, çalışma klasörü can_view_project ile sınırlı.
drop policy if exists "Users can read their own files" on storage.objects;
create policy "Users can read their own files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      -- Klasör adı kullanıcı kimliğiyse sahibinin kurumu; çalışma kimliğiyse
      -- kullanici_kurumu NULL döner ve aşağıdaki can_view_project karar verir.
      or public.gozetim_kapsami(
           public.kullanici_kurumu(public.calisma_klasoru(name)),
           array['controller','academic_manager']::public.user_role[]
         )
      -- Çalışma klasörü: metni görebilen resmini de görür (resim kitaplığı
      -- listeyi tarayıcıdan çekiyor, imzayı sunucu servis anahtarıyla atıyor).
      or public.can_view_project(public.calisma_klasoru(name))
    )
  );

notify pgrst, 'reload schema';
