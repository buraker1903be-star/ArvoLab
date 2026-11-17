-- ============================================================
-- R7 — P7_akademik_birim_tetikleyicileri paketinin GERİ DÖNÜŞÜ (RELEASE CLOSURE 06; Production'a UYGULANMADI)
-- Ertelenebilir paketin dönüşü; veri değişmez.
-- Tek işlem: hata olursa hiçbir şey değişmez. Tekrar çalıştırılabilir.
-- Sınandığı yer: scripts/uzlastirma/prova-geri.sh (paket + geri dönüş = paketten önceki şema özeti).
-- ============================================================
begin;
drop trigger if exists validate_academic_unit_parent_trigger on public.academic_units;
drop trigger if exists set_academic_unit_updated_at_trigger on public.academic_units;
drop function if exists public.validate_academic_unit_parent();
drop function if exists public.set_academic_unit_updated_at();
commit;
