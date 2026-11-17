-- ============================================================
-- R8 — P8_profil_rol_varsayilani paketinin GERİ DÖNÜŞÜ (RELEASE CLOSURE 06; Production'a UYGULANMADI)
-- Yalnızca varsayılan döner; arada açılmış hesapların rolü DEĞİŞMEZ.
-- Tek işlem: hata olursa hiçbir şey değişmez. Tekrar çalıştırılabilir.
-- Sınandığı yer: scripts/uzlastirma/prova-geri.sh (paket + geri dönüş = paketten önceki şema özeti).
-- ============================================================
begin;
alter table public.profiles alter column role set default 'employee';
commit;
