-- ============================================================
-- P9_yetim_profil_silme_yetkisi  (RELEASE CLOSURE 06 hazırlık paketi — Production'a UYGULANMADI)
-- Amaç: hesap silme cron'unun YETİM profil dalı (auth kaydı yok, profil kalmış) için gereken TEK yetki.
--   Production'da service_role'ün profiles üzerinde DELETE yetkisi yok; olağan silme yolu (GoTrue deleteUser
--   + FK kaskadı) bu yetkiye ihtiyaç duymaz, yalnızca yetim dal duyar. Yerel provada (Production yetkileri):
--   yetkisiz → yanıt ertelenen=1, yetimSilinemedi=1 (düzeltilmiş kod), profil kalır; yetkili → silinen=1, profil gider.
--   Başka hiçbir tablo/yetki genişletilmez (toplu genişletme YOK).
-- ÖN KOŞUL (salt okunur): select has_table_privilege('service_role','public.profiles','DELETE');  -- false
-- DOĞRULAMA: aynı sorgu true; select has_table_privilege('authenticated','public.profiles','DELETE');  -- DEĞİŞMEDİ (false)
-- DURDURMA: authenticated/anon yetkisi değişirse dur.
-- GERİ DÖNÜŞ: paketler/geri/R9_yetim_profil_silme_yetkisi.sql
-- Tekrar çalıştırılabilir (grant idempotent).
-- ============================================================
begin;
grant delete on public.profiles to service_role;
commit;
