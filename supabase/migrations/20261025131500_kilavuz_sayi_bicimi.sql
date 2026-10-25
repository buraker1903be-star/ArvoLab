-- ============================================================
-- Sayı biçimi kılavuzdan geliyor: ondalık ayırıcı ve baştaki sıfır.
--
-- NEDEN: istatistik çıktısının tipografisi koda SABİTLENMİŞTİ
-- (lib/stats-interpreter.ts). İki kural APA'ya göre yazılıydı —
-- baştaki sıfır siliniyor ("0,021" → ".021") ve ondalık ayırıcı
-- noktaya çevriliyordu. Oysa bu kurallar ÜNİVERSİTEDEN ÜNİVERSİTEYE
-- DEĞİŞİYOR: Türkiye'deki tez kılavuzlarının çoğu ondalık ayırıcı
-- olarak virgül ve baştaki sıfırı zorunlu tutuyor.
--
-- Bedeli somut: kılavuzu "0,021" diyen bir öğrenci araçtan ".021"
-- alıyor, üstelik araç bunu doğru biçim diye sunuyordu. Atıf sistemi
-- (citation_style) zaten kılavuzdan geliyordu; sayı biçimi aynı yolu
-- izlemeliydi.
--
-- NULL BİLEREK SERBEST. Kılavuz bu kuralı söylemiyorsa uydurmuyoruz;
-- kod atıf sisteminin kendi geleneğine düşüyor (APA → nokta, baştaki
-- sıfır yok). "Bilmiyorum" demek, yanlış bilmekten iyidir —
-- lib/atif-sistemi.ts'teki aynı ilke. Varsayılan bir değer yazmak,
-- hiç incelenmemiş bir kılavuzu "incelendi ve nokta diyor" gibi
-- gösterirdi.
--
-- academic_projects'e EKLENMİYOR: kural çalışmanın değil kılavuzun
-- özelliği. İki yerde tutulsaydı hangisinin kazandığı belirsiz olurdu.
-- ============================================================

alter table public.thesis_guidelines
  add column if not exists number_decimal_separator text,
  add column if not exists number_leading_zero boolean;

-- Kısıt ADIYLA düşürülüp yeniden kuruluyor: tekrar çalıştırıldığında
-- "already exists" vermesin (bu depoda migration'lar elle uygulanıyor).
alter table public.thesis_guidelines
  drop constraint if exists thesis_guidelines_number_decimal_separator_check;

alter table public.thesis_guidelines
  add constraint thesis_guidelines_number_decimal_separator_check
  check (number_decimal_separator is null
         or number_decimal_separator in ('comma', 'period'));

comment on column public.thesis_guidelines.number_decimal_separator is
  'Ondalık ayırıcı: comma (0,021) | period (0.021). NULL = kılavuz söylemiyor, atıf sisteminin geleneği uygulanır.';

comment on column public.thesis_guidelines.number_leading_zero is
  'Birden küçük değerlerde baştaki sıfır yazılır mı (0,021 ↔ ,021). NULL = kılavuz söylemiyor, atıf sisteminin geleneği uygulanır.';

-- ------------------------------------------------------------
-- ONAYLI SÜRÜM DE TAŞISIN.
--
-- Onaylanan kılavuz `approved_snapshot` jsonb'sine kopyalanıyor ve
-- öğrencinin editörü ORADAN okuyor (20260915090000_guideline_sync).
-- Yeni alanlar yalnızca sütunda kalsaydı, kılavuz onaylandıktan sonra
-- değiştirilen bir kural öğrencinin çalışmasına SESSİZCE sızardı —
-- oysa anlık görüntünün varlık sebebi tam olarak bunu engellemek.
--
-- Mevcut onaylı satırlarda alanlar NULL olarak ekleniyor; bu doğru,
-- çünkü o kılavuzlar bu kural için hiç incelenmedi.
-- ------------------------------------------------------------
update public.thesis_guidelines
set approved_snapshot = approved_snapshot
  || jsonb_build_object(
       'number_decimal_separator', to_jsonb(number_decimal_separator),
       'number_leading_zero', to_jsonb(number_leading_zero)
     )
where approved_snapshot is not null
  and not (approved_snapshot ? 'number_decimal_separator');
