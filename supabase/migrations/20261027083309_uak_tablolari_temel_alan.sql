-- ============================================================
-- ÜAK tabloları: PDF'ten kurum kriterleri, temel alana göre.
--
-- ÜAK'ın bir veri arayüzü yok; doçentlik başvuru şartları her başvuru
-- dönemi (mart, ekim) için temel alan başına PDF olarak yayımlanıyor.
-- Yönetici o PDF'i yüklüyor, asistan tabloyu ÖNERİ olarak okuyor
-- (önerideki her sayı PDF'te geçmek zorunda; lib/ai/uak-tablosu.ts),
-- yönetici onaylayınca kriterler ve hedefler KENDİ KURUMUNA yazılıyor.
--
-- Şartlar temel alana göre değişiyor (hukukta TR Dizin, sağlıkta Q1–Q3…),
-- bu yüzden kriter ve hedefe temel alan, akademisyene de kendi temel
-- alanı ekleniyor. NULL temel alan = bütün alanlar (bugüne kadar girilmiş
-- her şey böyle kalıyor, kimsenin listesi boşalmıyor).
-- ============================================================

-- ---------- 1) Temel alan ----------
alter table public.scoring_criteria
  add column if not exists temel_alan text check (temel_alan is null or char_length(btrim(temel_alan)) between 1 and 120);
alter table public.docentlik_hedefleri
  add column if not exists temel_alan text check (temel_alan is null or char_length(btrim(temel_alan)) between 1 and 120);
alter table public.docentlik_profili
  add column if not exists temel_alan text check (temel_alan is null or char_length(btrim(temel_alan)) between 1 and 120);

/* Her temel alanın kendi "A1"i var: kod artık kurum + alan içinde benzersiz. */
drop index if exists public.scoring_criteria_kurum_kod_key;
create unique index scoring_criteria_kurum_kod_key
  on public.scoring_criteria (organization_id, temel_alan, code) nulls not distinct;

drop index if exists public.docentlik_hedefleri_kapsam_grup_key;
create unique index docentlik_hedefleri_kapsam_grup_key
  on public.docentlik_hedefleri (organization_id, temel_alan, grup) nulls not distinct;

-- ---------- 2) Asistan kaydına yeni yetenek ----------
alter table public.ai_assistant_runs drop constraint if exists ai_assistant_runs_capability_check;
alter table public.ai_assistant_runs
  add constraint ai_assistant_runs_capability_check
  check (capability in ('analiz', 'kaynakca', 'literatur', 'belge', 'kanit', 'makale', 'uak'));

-- ---------- 3) Yüklenen ÜAK tabloları ----------
/*
  Kurum + temel alan başına TEK satır: yeni dönemin PDF'i eskisinin yerine
  geçer (eski dosya silinir). Eski kriterler ise yeni öneri onaylanana kadar
  yürürlükte kalır: yükleme ile onay arasında akademisyenler kriterlerden
  kopmasın.
*/
create table if not exists public.uak_tablolari (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  temel_alan text not null check (char_length(btrim(temel_alan)) between 1 and 120),
  donem text not null check (char_length(btrim(donem)) between 1 and 40),
  depo_yolu text not null check (char_length(depo_yolu) <= 500),
  dosya_adi text check (dosya_adi is null or char_length(dosya_adi) <= 300),
  durum text not null default 'yuklendi' check (durum in ('yuklendi', 'oneri_hazir', 'onaylandi')),
  oneri jsonb,
  ai_kaydi uuid references public.ai_assistant_runs(id) on delete set null,
  yukleyen uuid default auth.uid() references auth.users(id) on delete set null,
  yuklendi_at timestamptz not null default now(),
  onaylayan uuid references auth.users(id) on delete set null,
  onaylandi_at timestamptz,
  unique (organization_id, temel_alan)
);

alter table public.uak_tablolari enable row level security;
revoke all on public.uak_tablolari from public, anon, authenticated;
grant select, insert, update, delete on public.uak_tablolari to authenticated;

/* Yönetimi kriterlerle aynı kişiler yapar: kurumun Yöneticisi ve iç ekip. */
drop policy if exists "UAK tablolarini kurum yoneticisi okur" on public.uak_tablolari;
create policy "UAK tablolarini kurum yoneticisi okur"
  on public.uak_tablolari for select to authenticated
  using (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

drop policy if exists "UAK tablosunu kurum yoneticisi ekler" on public.uak_tablolari;
create policy "UAK tablosunu kurum yoneticisi ekler"
  on public.uak_tablolari for insert to authenticated
  with check (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

drop policy if exists "UAK tablosunu kurum yoneticisi gunceller" on public.uak_tablolari;
create policy "UAK tablosunu kurum yoneticisi gunceller"
  on public.uak_tablolari for update to authenticated
  using (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]))
  with check (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

drop policy if exists "UAK tablosunu kurum yoneticisi siler" on public.uak_tablolari;
create policy "UAK tablosunu kurum yoneticisi siler"
  on public.uak_tablolari for delete to authenticated
  using (public.gozetim_kapsami(organization_id, array['academic_manager']::public.user_role[]));

notify pgrst, 'reload schema';
