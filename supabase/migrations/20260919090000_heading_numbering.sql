-- Otomatik başlık numaralandırma tercihi (belge başına). Numara metne yazılmaz;
-- editör, Word ve baskı çıktısı başlıkların önüne "1.", "1.1." ekler.
-- Mevcut belgeler etkilenmez (varsayılan kapalı). Sürüm geçmişi bu tercihi
-- project_manuscript_versions.settings (jsonb) içinde saklar; ek kolon gerekmez.
-- Tekrar çalıştırılabilir.
alter table public.project_manuscripts
  add column if not exists heading_numbering boolean not null default false;
