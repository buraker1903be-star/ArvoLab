-- ============================================================
-- SÖZLEŞME ONAYINA KONUM (29.10.2026, kurum sahibinin isteği: "IP, cihaz
-- ve konum bilgisi hukuki geçerlilik bakımından önemli").
--
-- Onay kaydı (20261029153742) IP ve cihazı tutuyordu, konumu tutmuyordu.
-- Barındırıcının (Vercel) IP adresinden çıkardığı yaklaşık konum ekleniyor:
-- ülke, bölge, şehir, enlem/boylam, saat dilimi. Sunucu isteğin
-- başlıklarından okuyor (lib/sozlesme/konum.ts); istemci yazamıyor.
--
-- Tarayıcıdan GPS konumu İSTENMİYOR: izin penceresi reddedilebilir (onay
-- kapısı kilitlenirdi) ve kesin konum KVKK bakımından amaçla ölçülü
-- olmayan bir veri. ArvoOS'taki kayıtla aynı alanlar (ArvoOS 20261029162437).
--
-- Değişmezlik tetikleyicisi satırın tamamını karşılaştırdığı için yeni
-- sütunlar da otomatik olarak korunuyor; eski satırlarda boş kalıyorlar.
-- ============================================================

alter table public.sozlesme_onaylari
  add column if not exists ulke text check (ulke is null or char_length(ulke) <= 10),
  add column if not exists bolge text check (bolge is null or char_length(bolge) <= 100),
  add column if not exists sehir text check (sehir is null or char_length(sehir) <= 120),
  add column if not exists enlem numeric check (enlem is null or enlem between -90 and 90),
  add column if not exists boylam numeric check (boylam is null or boylam between -180 and 180),
  add column if not exists saat_dilimi text check (saat_dilimi is null or char_length(saat_dilimi) <= 60);

notify pgrst, 'reload schema';
