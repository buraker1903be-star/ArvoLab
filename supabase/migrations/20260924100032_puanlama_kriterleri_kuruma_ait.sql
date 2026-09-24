-- ============================================================
-- PROJE: ArvoLab (zpfpocyajnxcketdjbxm)
--
-- Puanlama kriterleri KURUMA ait olabiliyor.
--
-- Doçentlik ekranı kullanıcıya "kurumunuzun girdiği güncel puanlama
-- kriterleri" diyor ve puanları güncel tutmanın Akademik Yönetici'nin
-- sorumluluğu olduğunu yazıyor. Tablo ise tekti ve politikası çıplak
-- has_role(...) ile yazılmıştı: HERHANGİ bir kurumun Akademik Yöneticisi,
-- bütün kurumların ve bütün bireysel abonelerin puan değerlerini
-- değiştirebiliyordu. Ürünün verdiği söz ile veritabanının yaptığı iş
-- birbirini tutmuyordu.
--
-- MEVCUT SATIRLARA DOKUNULMUYOR: organization_id NULL kalıyor, yani
-- "genel" liste. Bunları bir kuruma devretmek, o kriterlere bakan diğer
-- kurumların ve bireysel abonelerin listesini bir gecede boşaltırdı —
-- veriyi gizlemek, düzenlemeyi kısıtlamaktan çok daha ağır bir bedel.
--
-- DEĞİŞEN DAVRANIŞ: genel satırları bundan sonra yalnızca iç ekip
-- (system_admin, founder) düzenleyebilir. Bir kurumun yöneticisi kendi
-- kurumunun kriterlerini ekler ve düzenler; genel listeyi okur ama
-- değiştiremez.
--
-- Yazma kuralı gozetim_kapsami'nin kendisi (20260924100028): iç ekip her
-- yerde, academic_manager yalnızca kendi kurumunda. NULL kurum hiçbir
-- kurumla eşleşmediği için genel satırlar kendiliğinden iç ekibe kalıyor.
-- ============================================================

alter table public.scoring_criteria
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

comment on column public.scoring_criteria.organization_id is
  'NULL = genel liste (herkes okur, yalnızca iç ekip düzenler). Doluysa yalnızca o kurum okur ve düzenler.';

create index if not exists scoring_criteria_organization_idx
  on public.scoring_criteria(organization_id);

/*
  Kod artık kurum içinde benzersiz: iki kurum aynı "A1" kodunu kendi
  listesinde kullanabilmeli. NULLS NOT DISTINCT olmadan genel listede
  aynı kod iki kez açılabilirdi (Postgres NULL'ları farklı sayar).
*/
alter table public.scoring_criteria drop constraint if exists scoring_criteria_code_key;
drop index if exists public.scoring_criteria_kurum_kod_key;
create unique index scoring_criteria_kurum_kod_key
  on public.scoring_criteria (organization_id, code) nulls not distinct;

-- ---------- Okuma ----------
drop policy if exists "All authenticated users can view scoring criteria" on public.scoring_criteria;
create policy "All authenticated users can view scoring criteria"
  on public.scoring_criteria
  for select
  to authenticated
  using (
    -- Genel liste herkese açık.
    organization_id is null
    -- Kendi kurumunun listesi: ROLE BAKILMAZ, öğrenci de kendi kriterlerini görmeli.
    or organization_id = public.get_my_organization_id()
    -- İç ekip her kurumu görür (gozetim_kapsami'nin ilk dalıyla aynı kural).
    or public.has_role(array['system_admin','founder']::public.user_role[])
  );

-- ---------- Yazma ----------
-- "for all" tek politika hem okumayı hem yazmayı kapsıyordu; ayrıldı ki
-- okuma herkese açık kalsın, yazma kuruma bağlansın.
drop policy if exists "Academic managers and above can manage scoring criteria" on public.scoring_criteria;

create policy "Kurumun kriterlerini yoneticisi ekler"
  on public.scoring_criteria
  for insert
  to authenticated
  with check (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

create policy "Kurumun kriterlerini yoneticisi duzenler"
  on public.scoring_criteria
  for update
  to authenticated
  using (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]))
  -- Satırın YENİ hali de sınanıyor: kriter başka bir kuruma taşınamasın.
  with check (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

create policy "Kurumun kriterlerini yoneticisi siler"
  on public.scoring_criteria
  for delete
  to authenticated
  using (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

notify pgrst, 'reload schema';
