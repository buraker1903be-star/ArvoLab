-- ============================================================
-- R1 — P1_rate_limit_take paketinin GERİ DÖNÜŞÜ (RELEASE CLOSURE 06; Production'a UYGULANMADI)
-- Uygulama kodu DOI kotası için bu fonksiyonu çağırıyor ve sayaç yoksa KAPALI kalır (fail-closed): geri alınırsa DOI ile kaynak ekleme ve toplu içe aktarma reddedilir. Kodla birlikte geri alın.
-- Tek işlem: hata olursa hiçbir şey değişmez. Tekrar çalıştırılabilir.
-- Sınandığı yer: scripts/uzlastirma/prova-geri.sh (paket + geri dönüş = paketten önceki şema özeti).
-- ============================================================
begin;
drop function if exists public.rate_limit_take(text, integer, interval, integer);
-- Satırlar auth_rate_limits'te ortak; rate_limit_hit de aynı tabloyu kullanıyor, tabloya dokunulmaz.
commit;
