-- literature_sources(project_id, status) indeksi (Phase 2, 04.11.2026).
--
-- Neden: Tablonun tek indeksi owner_id üzerindeydi. Ana sayfa, Çalışmalarım,
-- Kaynaklar ve editörün kaynak pencereleri kaynakları project_id ile
-- (birim sayıları ayrıca status ile) süzüyor; indeks olmadığı için her sorgu
-- BÜTÜN platformun kaynaklarını tarıyordu ve okuma politikasındaki
-- gozetim_kapsami(...) sahibi olmayan her satırda çağrılıyordu. Maliyet
-- kullanıcının kendi kaynak sayısıyla değil, platformdaki toplam kaynak
-- sayısıyla büyüyordu.
--
-- Ölçüm (PGlite, 50.000 kaynak / 2.000 kullanıcı, RLS altında yetkili
-- kullanıcı, 15 çalıştırmanın medyanı): proje listesi 9,47 → 1,57 ms,
-- sayım 9,10 → 1,10 ms, durumlu sayım 11,15 → 1,00 ms; plan Seq Scan →
-- Index Scan.
--
-- Güvenlik etkisi: yok. İndeks hangi satırın görüneceğini değiştirmez;
-- RLS politikaları aynı kalır.
--
-- Kilit: düz CREATE INDEX yapım süresince tabloya yazmayı bekletir (okuma
-- serbest). Tablo boyutunda bu milisaniyeler düzeyinde.
--
-- Geri dönüş:
--   drop index if exists public.literature_sources_project_status_idx;

create index if not exists literature_sources_project_status_idx
  on public.literature_sources (project_id, status);
