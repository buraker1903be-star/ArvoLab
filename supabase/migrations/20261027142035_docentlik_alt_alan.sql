-- ============================================================
-- Doçentlik: temel alanın altında ALT ALAN.
--
-- Güzel Sanatlar tablosu (27.10.2026) genel şartların ardından alt
-- alanlara ayrılmış ÖZEL şartlar taşıyor (Plastik sanatlar/Tasarım/
-- Sinema; Müzik içinde Kompozisyon, Yorumculuk…; Sahne sanatları).
-- Aday genel şartları ve YALNIZCA kendi alt alanının özel şartlarını
-- sağlar. Alt alan olmadan bütün alt alanların kriterleri listede
-- görünüyor, daha kötüsü başka bir alt alanın "en az 60 puan" şartı
-- adaya kendi eksiği gibi gösteriliyordu.
--
-- NULL alt alan = temel alanın tamamı (genel şartlar ve bugüne kadar
-- girilmiş her şey); kimsenin listesi değişmiyor.
-- ============================================================

alter table public.scoring_criteria
  add column if not exists alt_alan text check (alt_alan is null or char_length(btrim(alt_alan)) between 1 and 160);
alter table public.docentlik_hedefleri
  add column if not exists alt_alan text check (alt_alan is null or char_length(btrim(alt_alan)) between 1 and 160);
alter table public.docentlik_profili
  add column if not exists alt_alan text check (alt_alan is null or char_length(btrim(alt_alan)) between 1 and 160);

notify pgrst, 'reload schema';
