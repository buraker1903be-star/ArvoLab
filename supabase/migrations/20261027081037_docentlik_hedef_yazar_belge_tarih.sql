-- ============================================================
-- Doçentlik: hedef puanlar, ortak yazarlı yayın, belge ve tarih.
--
-- Ekran puanı topluyordu ama başvuru hazırlayan akademisyenin dört
-- sorusuna cevap vermiyordu:
--   1. "Ne kadar eksiğim var?" — hedef yoktu, yalnızca toplam vardı.
--   2. "Ortak yazarlı makalem tam puan mı?" — her yayın tam puan
--      sayılıyordu; çok yazarlı yayında puan paylaşılır.
--   3. "Hangi faaliyetin belgesi eksik?" — belge eklenemiyordu.
--   4. "Doktoradan sonra kaç puanım var?" — tarih yoktu.
--
-- SİSTEM ÜAK KURALI UYDURMAZ. Hedef puanları ve paylaşım katsayılarını
-- kriterler gibi Yönetici girer (genel liste iç ekipte, kurum listesi
-- kurum yöneticisinde — 20260924100032'deki kuralın aynısı). Katsayı
-- girilmemiş kriterde ortak yazarlık puanı DEĞİŞTİRMEZ: bilinmeyen bir
-- kuralı tahmin etmek, yanlış bir puanı doğru gibi göstermek olurdu.
-- ============================================================

-- ---------- 1) Ortak yazarlık: katsayılar kriterde ----------
alter table public.scoring_criteria
  add column if not exists baslica_yazar_katsayisi numeric
    check (baslica_yazar_katsayisi is null or (baslica_yazar_katsayisi > 0 and baslica_yazar_katsayisi <= 1)),
  add column if not exists diger_yazar_katsayisi numeric
    check (diger_yazar_katsayisi is null or (diger_yazar_katsayisi > 0 and diger_yazar_katsayisi <= 1));

comment on column public.scoring_criteria.baslica_yazar_katsayisi is
  'Çok yazarlı faaliyette başlıca yazarın puan katsayısı. NULL = paylaşım tanımsız, tam puan.';
comment on column public.scoring_criteria.diger_yazar_katsayisi is
  'Çok yazarlı faaliyette diğer yazarların puan katsayısı. NULL = paylaşım tanımsız, tam puan.';

-- ---------- 2) Faaliyet kaydı: yazar, katsayı, tarih, belge ----------
alter table public.academic_score_entries
  add column if not exists yazar_sayisi integer not null default 1 check (yazar_sayisi between 1 and 500),
  add column if not exists baslica_yazar boolean not null default true,
  /* Kayıt anındaki katsayı. Birim puan gibi korunuyor (lib/docentlik-puan.ts):
     kriterin katsayısı sonradan değişse de eski kaydın puanı kaymaz. */
  add column if not exists paylasim_katsayisi numeric not null default 1
    check (paylasim_katsayisi > 0 and paylasim_katsayisi <= 1),
  add column if not exists faaliyet_tarihi date,
  /* project-files/<sahip>/docentlik/… — yalnızca sahibinin klasörü. */
  add column if not exists belge_yolu text
    check (belge_yolu is null or belge_yolu like owner_id::text || '/docentlik/%');

-- ---------- 3) Doktora tarihi (kişi başına bir satır) ----------
create table if not exists public.docentlik_profili (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  doktora_tarihi date,
  updated_at timestamptz not null default now()
);

alter table public.docentlik_profili enable row level security;
revoke all on public.docentlik_profili from public, anon, authenticated;
grant select, insert, update on public.docentlik_profili to authenticated;

drop policy if exists "Doktora tarihini sahibi okur" on public.docentlik_profili;
create policy "Doktora tarihini sahibi okur"
  on public.docentlik_profili for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Doktora tarihini sahibi yazar" on public.docentlik_profili;
create policy "Doktora tarihini sahibi yazar"
  on public.docentlik_profili for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Doktora tarihini sahibi gunceller" on public.docentlik_profili;
create policy "Doktora tarihini sahibi gunceller"
  on public.docentlik_profili for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------- 4) Hedef puanlar ----------
/*
  grup NULL = toplam hedef; doluysa o kriter grubunun asgari puanı
  (kriterlerin category_group'u ile aynı ad). Kurum hedefi aynı gruptaki
  genel hedefin yerine geçer (ekranda; lib/docentlik-ozeti.ts).
*/
create table if not exists public.docentlik_hedefleri (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  grup text check (grup is null or char_length(btrim(grup)) between 1 and 120),
  asgari_puan numeric not null check (asgari_puan > 0 and asgari_puan <= 100000),
  notlar text check (notlar is null or char_length(notlar) <= 1000),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Aynı kapsamda aynı grup için tek hedef; NULL'lar eşit sayılıyor (genel liste, toplam hedef).
create unique index if not exists docentlik_hedefleri_kapsam_grup_key
  on public.docentlik_hedefleri (organization_id, grup) nulls not distinct;

alter table public.docentlik_hedefleri enable row level security;
revoke all on public.docentlik_hedefleri from public, anon, authenticated;
grant select, insert, update, delete on public.docentlik_hedefleri to authenticated;

drop policy if exists "Hedefleri kriterleri goren okur" on public.docentlik_hedefleri;
create policy "Hedefleri kriterleri goren okur"
  on public.docentlik_hedefleri for select to authenticated
  using (
    organization_id is null
    or organization_id = public.get_my_organization_id()
    or public.has_role(array['system_admin','founder']::public.user_role[])
  );

drop policy if exists "Kurumun hedeflerini yoneticisi ekler" on public.docentlik_hedefleri;
create policy "Kurumun hedeflerini yoneticisi ekler"
  on public.docentlik_hedefleri for insert to authenticated
  with check (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

drop policy if exists "Kurumun hedeflerini yoneticisi duzenler" on public.docentlik_hedefleri;
create policy "Kurumun hedeflerini yoneticisi duzenler"
  on public.docentlik_hedefleri for update to authenticated
  using (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]))
  with check (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

drop policy if exists "Kurumun hedeflerini yoneticisi siler" on public.docentlik_hedefleri;
create policy "Kurumun hedeflerini yoneticisi siler"
  on public.docentlik_hedefleri for delete to authenticated
  using (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

notify pgrst, 'reload schema';
