-- ============================================================
-- Kaynağın BASIM YERİ (02.11.2026).
--
-- Türk tez kılavuzlarının klasik yöntemi (dipnot) ve Chicago, Harvard
-- kitap künyesinde basım yerini istiyor: "Çetiner, Ertuğrul. Konaklama
-- Yönetim Muhasebesi, Güney Grafik, Ankara, 1989." (DEÜ SBE). Alan yoktu;
-- künye yeri uydurmasın diye hiç yazmıyordu ve öğrenci her künyeye elle
-- ekliyordu. Tablonun RLS'i değişmiyor: sütun satırın sahibine ait.
-- ============================================================

alter table public.literature_sources
  add column if not exists publication_place text
    check (publication_place is null or char_length(publication_place) <= 200);

notify pgrst, 'reload schema';
