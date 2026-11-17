-- ============================================================
-- P8_profil_rol_varsayilani  (RELEASE CLOSURE 06 hazırlık paketi — Production'a UYGULANMADI)
-- Amaç: KARAR GEREKLİ. profiles.role varsayılanı Production'da 'employee', depoda 'client'. Production'daki handle_new_user rol yazmıyor; yeni hesaplar varsayılanı alıyor (17.11: 4 profilin 2'si employee). Mevcut satırların rolü bu paketle DEĞİŞMEZ.
-- ÖN KOŞUL (salt okunur): select column_default from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role';  -- 'employee'::user_role
-- DOĞRULAMA (uygulama sonrası): aynı sorgu 'client'::user_role döner.
-- DURDURMA: —
-- GERİ DÖNÜŞ: işlem tek transaction; hata olursa hiçbir şey kalmaz. Uygulandıktan
--   sonra geri almak için: scripts/uzlastirma/paketler/GERI_DONUS.md
-- Tekrar çalıştırılabilir (create or replace / if not exists / drop … if exists).
-- ============================================================
begin;
alter table public.profiles alter column role set default 'client';

commit;
