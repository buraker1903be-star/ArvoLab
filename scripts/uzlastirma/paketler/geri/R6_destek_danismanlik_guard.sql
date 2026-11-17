-- ============================================================
-- R6 — P6_destek_danismanlik_guard paketinin GERİ DÖNÜŞÜ (RELEASE CLOSURE 06; Production'a UYGULANMADI)
-- Fonksiyonlar Production'da zaten vardı, yalnızca tetikleyiciler kalkar.
-- Tek işlem: hata olursa hiçbir şey değişmez. Tekrar çalıştırılabilir.
-- Sınandığı yer: scripts/uzlastirma/prova-geri.sh (paket + geri dönüş = paketten önceki şema özeti).
-- ============================================================
begin;
drop trigger if exists guard_consultancy_request_update_trigger on public.consultancy_requests;
drop trigger if exists guard_support_request_update_trigger on public.app_support_requests;
commit;
