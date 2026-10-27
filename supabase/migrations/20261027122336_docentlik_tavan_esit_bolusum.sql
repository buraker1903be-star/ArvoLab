-- ============================================================
-- Doçentlik: eşit bölüşüm, grup tavanı, doktora sonrası asgari.
--
-- İlk gerçek ÜAK tablosu (Eğitim Bilimleri, 27.10.2026) modelin
-- karşılayamadığı üç kural taşıyordu:
--   1. "Çok yazarlı yayınlarda puan yazarlar arasında EŞİT olarak
--      bölünür" — başlıca/diğer katsayısı bunu ifade edemiyordu, ortak
--      yazarlı her yayın tam puan sayılırdı.
--   2. "Bu maddeden en fazla 20 puan alınabilir" — neredeyse her
--      maddede tavan var; toplam bunları hiç uygulamıyor, puanı
--      şişirerek gösteriyordu.
--   3. "En az 90 puanın doktora sonrası çalışmalardan" — asgari
--      şartın bir kısmı yalnızca doktora sonrası faaliyetlere bakıyor.
-- ============================================================

alter table public.scoring_criteria
  add column if not exists esit_bolusum boolean not null default false;

comment on column public.scoring_criteria.esit_bolusum is
  'Çok yazarlı faaliyette puan yazar sayısına eşit bölünür (1/n). Katsayılardan önce gelir.';

/*
  Hedef satırı artık bir grubun SINIRLARI: asgari, azami ya da ikisi.
  doktora_sonrasi = asgari yalnızca doktora sonrası faaliyetlerle sağlanır.
  Aynı grup için iki satır olabilir (biri bütün faaliyetler, biri doktora
  sonrası), benzersiz dizin buna göre.
*/
alter table public.docentlik_hedefleri alter column asgari_puan drop not null;
alter table public.docentlik_hedefleri drop constraint if exists docentlik_hedefleri_asgari_puan_check;
alter table public.docentlik_hedefleri
  add constraint docentlik_hedefleri_asgari_puan_check
  check (asgari_puan is null or (asgari_puan > 0 and asgari_puan <= 100000));
alter table public.docentlik_hedefleri
  add column if not exists azami_puan numeric check (azami_puan is null or (azami_puan > 0 and azami_puan <= 100000)),
  add column if not exists doktora_sonrasi boolean not null default false;
alter table public.docentlik_hedefleri drop constraint if exists docentlik_hedefleri_sinir_var;
alter table public.docentlik_hedefleri
  add constraint docentlik_hedefleri_sinir_var check (asgari_puan is not null or azami_puan is not null);

drop index if exists public.docentlik_hedefleri_kapsam_grup_key;
create unique index docentlik_hedefleri_kapsam_grup_key
  on public.docentlik_hedefleri (organization_id, temel_alan, grup, doktora_sonrasi) nulls not distinct;

notify pgrst, 'reload schema';
