/*
  KILAVUZ VE KAYNAKÇA KONTROLÜ GEÇMİŞİ (26.10.2026, kurum sahibinin
  isteği: "son kontrol sonucunu kaldırma, geçmiş işlem gözüksün").

  Kontrolün sonucu bugüne kadar yalnızca tarayıcının belleğindeydi:
  sayfa yenilenince ya da ertesi gün editör açılınca kayboluyordu.
  Öğrenci düzelttiklerini önceki kontrolle karşılaştıramıyor, danışmanı
  "kontrolü çalıştırdın mı" sorusunun cevabını göremiyordu.

  Her çalıştırma bir satır. İÇERİK DEĞİŞMEZ: güncelleme yetkisi ve
  politikası yok — geçmiş bir kontrolün sonucunu sonradan değiştirmek,
  geçmişi tutmanın anlamını kaldırır. Silme de yok; çalışma silinince
  geçmişi de gider (on delete cascade).

  Okuma çalışmayı görebilenle sınırlı (can_view_project: sahibi,
  atanan, kendi kurumundaki gözetim rolleri). Yazma metni yazabilende
  (can_write_project) ve yalnızca kendi adına.
*/
create table if not exists public.yazim_kontrolleri (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.academic_projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Liste için özet; ayrıntı sonuc ve yapi içinde.
  hata integer not null default 0 check (hata >= 0),
  uyari integer not null default 0 check (uyari >= 0),
  eksik_bolum integer not null default 0 check (eksik_bolum >= 0),
  kelime integer not null default 0 check (kelime >= 0),
  -- Sunucunun ürettiği kılavuz/kaynakça sonucu (app/actions/manuscript.ts, ManuscriptCheckResult)
  sonuc jsonb not null,
  -- O anki yapı ve bütünlük sorunları (lib/structure-check.ts)
  yapi jsonb not null default '[]'::jsonb check (jsonb_typeof(yapi) = 'array')
);

create index if not exists yazim_kontrolleri_proje_tarih_idx
  on public.yazim_kontrolleri(project_id, created_at desc);

alter table public.yazim_kontrolleri enable row level security;

-- Önce her şey alınıyor: Supabase yeni tabloya authenticated için
-- TRUNCATE/TRIGGER/REFERENCES dahil her yetkiyi kendiliğinden veriyor
-- (tests/db/guvenlik.test.mjs). Yalnızca okuma ve ekleme geri veriliyor.
revoke all on public.yazim_kontrolleri from public, anon, authenticated;
grant select, insert on public.yazim_kontrolleri to authenticated;

drop policy if exists "Calismayi goren kontrol gecmisini okur" on public.yazim_kontrolleri;
create policy "Calismayi goren kontrol gecmisini okur"
  on public.yazim_kontrolleri
  for select
  to authenticated
  using (public.can_view_project(project_id));

drop policy if exists "Metni yazabilen kontrolu kaydeder" on public.yazim_kontrolleri;
create policy "Metni yazabilen kontrolu kaydeder"
  on public.yazim_kontrolleri
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and public.can_write_project(project_id));
