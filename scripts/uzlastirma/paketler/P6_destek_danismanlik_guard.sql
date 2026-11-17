-- ============================================================
-- P6_destek_danismanlik_guard  (RELEASE CLOSURE 06 hazırlık paketi — Production'a UYGULANMADI)
-- Amaç: Destek ve danışmanlık taleplerinin GÜNCELLEME guard tetikleyicileri. Fonksiyonlar Production'da var ve depo sürümüyle anlamca aynı; yalnızca tetikleyiciler eksik.
-- ÖN KOŞUL (salt okunur): select tgname from pg_trigger where tgname in ('guard_consultancy_request_update_trigger','guard_support_request_update_trigger');  -- boş
-- DOĞRULAMA (uygulama sonrası): aynı sorgu iki satır döner.
-- DURDURMA: Tetikleyiciler oluşmazsa dur.
-- GERİ DÖNÜŞ: işlem tek transaction; hata olursa hiçbir şey kalmaz. Uygulandıktan
--   sonra geri almak için: scripts/uzlastirma/paketler/GERI_DONUS.md
-- Tekrar çalıştırılabilir (create or replace / if not exists / drop … if exists).
-- ============================================================
begin;
-- 20260913120000_phase1_role_guards.sql satır 101-104
drop trigger if exists guard_consultancy_request_update_trigger on public.consultancy_requests;
create trigger guard_consultancy_request_update_trigger
  before update on public.consultancy_requests
  for each row execute function public.guard_consultancy_request_update();
-- 20260913120000_phase1_role_guards.sql satır 129-132
drop trigger if exists guard_support_request_update_trigger on public.app_support_requests;
create trigger guard_support_request_update_trigger
  before update on public.app_support_requests
  for each row execute function public.guard_support_request_update();

commit;
