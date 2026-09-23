-- ============================================================
-- Denetim rolleri (Kontrolör, Akademik Yönetici, Sistem Yöneticisi, Kurucu)
-- başkasının çalışmasında yaptıkları düzeltmeleri KAYDEDEBİLSİN.
--
-- Bugüne kadar okuma ile yazma aynı yerde tarif edilmiyordu:
--   project_manuscripts SELECT  → sahip, atanan uzman VEYA denetim rolü
--   project_manuscripts INSERT  → yalnızca sahip ve atanan uzman
--   project_manuscripts UPDATE  → yalnızca sahip ve atanan uzman
-- academic_projects'te ise güncelleme kuralı denetim rollerini zaten
-- içeriyordu (schema.sql "Update own, assigned, or oversight-role projects"):
-- yani çalışmanın kendisi düzenlenebiliyor, METNİ düzenlenemiyordu.
--
-- Sonuç canlıda şuydu: Kurucu başkasının tezini editörde açıyor, yazıyor,
-- otomatik kayıt çalışıyor ve
--   * metin satırı varsa  → UPDATE hiçbir satıra değmiyor; uygulama bunu
--     "başka biri değiştirdi" (çakışma) sanıyor, kullanıcı "benim sürümüm"
--     deyince upsert RLS'e takılıyor → "Kaydedilirken bir hata oluştu",
--   * metin satırı yoksa → INSERT doğrudan RLS'e takılıyor → aynı hata.
-- Yazılan hiçbir şey kaydedilmiyordu, sebebi de hiçbir yerde görünmüyordu
-- (23.09.2026, bir personelin tezindeki düzeltmeler).
--
-- Kural bundan sonra tek yerde: can_write_project. Bir çalışmanın metnini
-- kim değiştirebilirse sürümünü, paylaşım bağlantısını ve resmini de o
-- değiştirir; okuyabilen (can_view_project) ile yazabilen artık aynı küme.
--
-- Bilerek genişleyen ikinci yer: manuscript_share_links (20260920090000)
-- de can_write_project kullanıyor, yani denetim rolleri paylaşım bağlantısı
-- açıp iptal edebilecek. Yeni bir sızıntı değil — metni zaten baştan sona
-- okuyabiliyorlar; bağlantı yalnızca aynı metni dışarıya taşımanın kayıtlı
-- yolu.
-- ============================================================

-- Rol kontrolü "exists"in İÇİNE alındı. Dışarıda olsaydı denetim rolü için
-- can_write_project OLMAYAN bir çalışmaya da "evet" derdi; aşağıdaki depo
-- politikası bu yüzden herhangi bir kullanıcı klasörünü çalışma klasörü
-- sanardı (klasör adı da uuid). Politikalarda kimlik her zaman gerçek bir
-- satırdan geldiği için mevcut davranış değişmiyor.
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
        or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
      )
  )
$$;

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
        or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
      )
  )
$$;

-- ---------- Metin ----------
-- Kural artık kopyalanmıyor: politikalar can_write_project'i çağırıyor.
-- Kopya olduğu için sapmıştı zaten.
drop policy if exists "Users can create manuscripts for their own projects" on public.project_manuscripts;
create policy "Users can create manuscripts for their own projects"
  on public.project_manuscripts
  for insert
  to authenticated
  with check (public.can_write_project(project_id));

drop policy if exists "Users can update manuscripts they have project access to" on public.project_manuscripts;
create policy "Users can update manuscripts they have project access to"
  on public.project_manuscripts
  for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

-- ---------- Editör resimleri ----------
-- Resimler bugüne kadar YÜKLEYENİN klasöründe duruyordu
-- (project-files/<kullanıcı>/editor-images/...) ve metni açan sayfalar
-- bağlantıyı yalnızca çalışmanın sahibi ile atanan uzmanın klasörü için
-- tazeliyordu (lib/manuscript-images.ts). Denetim rolü yazabilir hale
-- gelince bu sessiz bir kayba dönüşürdü: Kurucunun eklediği resim 2 saat
-- sonra öğrencinin ekranında, yazdırmada, paylaşımda ve Word çıktısında
-- kırık görünürdü.
--
-- Yeni resimler bu yüzden ÇALIŞMANIN klasörüne yükleniyor
-- (project-files/<çalışma>/editor-images/...): kimin yüklediğinden bağımsız
-- olarak çalışmaya bakan herkes görüyor. Eski yol da geçerli kalıyor; geçmiş
-- resimler yerinde duruyor.
create or replace function public.calisma_klasoru(p_name text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_ilk text := (storage.foldername(p_name))[1];
begin
  -- Klasör adı çalışma kimliği değilse (kullanıcı klasörü, başka yükleme
  -- yolu) uuid'e çevirmek hata verirdi; şeklini önce kontrol ediyoruz.
  if v_ilk is null or v_ilk !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_ilk::uuid;
end;
$$;

revoke all on function public.calisma_klasoru(text) from public, anon, authenticated;
grant execute on function public.calisma_klasoru(text) to anon, authenticated, service_role;

drop policy if exists "Users can upload to their own folder" on storage.objects;
create policy "Users can upload to their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.can_write_project(public.calisma_klasoru(name))
    )
    and (select public.subscription_open())
  );

drop policy if exists "Users can read their own files" on storage.objects;
create policy "Users can read their own files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
      -- Çalışma klasörü: metni görebilen resmini de görür (resim kitaplığı
      -- listeyi tarayıcıdan çekiyor, imzayı sunucu servis anahtarıyla atıyor).
      or public.can_view_project(public.calisma_klasoru(name))
    )
  );

drop policy if exists "Users can delete their own files" on storage.objects;
create policy "Users can delete their own files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.can_write_project(public.calisma_klasoru(name))
    )
  );

notify pgrst, 'reload schema';
