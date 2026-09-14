-- Literatür kaynaklarına yayın bilgileri: kaynakça girdileri eksiksiz olsun
-- (APA makale: Dergi, Cilt(Sayı), sayfalar; kitap: Yayınevi; bölüm: Kitap adı).
-- DOI ile Crossref'ten otomatik doldurulur. Tekrar çalıştırılabilir.

alter table public.literature_sources
  add column if not exists container_title text check (container_title is null or char_length(container_title) <= 500),
  add column if not exists volume text check (volume is null or char_length(volume) <= 40),
  add column if not exists issue text check (issue is null or char_length(issue) <= 40),
  add column if not exists pages text check (pages is null or char_length(pages) <= 40),
  add column if not exists publisher text check (publisher is null or char_length(publisher) <= 300);
