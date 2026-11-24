-- PROFİLDE AD, SOYAD VE TELEFON (24.11.2026)
--
-- Ayarlar penceresi adı ve soyadı AYRI alanlarda soruyor. Bugüne kadar tek
-- bir `full_name` vardı ve her yerde (gezinme, hesap menüsü, danışman
-- paylaşımı, kapak sayfası) o okunuyor.
--
-- MEVCUT ADLAR BÖLÜNMÜYOR. Backfill YOK, bilerek: "Ayşe Nur Demir Kaya"yı
-- son kelimeden bölmek bir kısmında yanlış sonuç verir ve yanlış bölünmüş
-- ad kalıcı olur. Sütunlar NULL başlıyor; NULL demek "bu kişi adını henüz
-- iki alana ayırmadı" demek. Ekran o durumda full_name'den bir ÖNERİ
-- gösteriyor (lib/profil-adi.ts) ama öneri kendiliğinden kaydedilmiyor:
-- kullanıcı Ad/Soyad alanlarına dokunmadıkça sütunlar NULL kalıyor.
--
-- full_name KALDIRILMADI ve görünen ad olmayı sürdürüyor: ad/soyad
-- yazıldığında uygulama ikisini birleştirip full_name'i de güncelliyor,
-- böylece öteki ekranların hiçbirinin değişmesi gerekmiyor.
--
-- Telefon İSTEĞE BAĞLI bir profil bilgisi: ne girişte ne faturada
-- kullanılıyor. Ülke koduyla birlikte tek metin olarak saklanıyor
-- ("+90 532 000 00 00"): parçalı saklamak, ülkeden ülkeye değişen alan
-- kodu uzunluklarını veritabanına taşırdı.
alter table public.profiles add column if not exists ad text;
alter table public.profiles add column if not exists soyad text;
alter table public.profiles add column if not exists telefon text;

-- Sınırlar veritabanında da: sunucu eylemi kırpıyor, ama profiles'a
-- doğrudan (PostgREST) yazan bir istek sınırsız metin bırakabilirdi.
alter table public.profiles drop constraint if exists profiles_ad_uzunluk;
alter table public.profiles add constraint profiles_ad_uzunluk
  check (ad is null or char_length(ad) between 1 and 80);
alter table public.profiles drop constraint if exists profiles_soyad_uzunluk;
alter table public.profiles add constraint profiles_soyad_uzunluk
  check (soyad is null or char_length(soyad) between 1 and 80);
-- Telefon biçimi: artı, rakamlar ve ayırıcılar. Numaranın GERÇEKLİĞİ
-- doğrulanmıyor (ülke başına kural tutmak başka bir iş); yalnızca alanın
-- serbest metin olmadığı güvence altında.
alter table public.profiles drop constraint if exists profiles_telefon_bicim;
alter table public.profiles add constraint profiles_telefon_bicim
  check (telefon is null or telefon ~ '^\+[0-9]{1,4}[0-9 ()-]{4,20}$');

comment on column public.profiles.ad is
  'Ad. NULL ise kişi adını iki alana ayırmadı; full_name görünen ad kalır.';
comment on column public.profiles.soyad is
  'Soyad. NULL ise kişi adını iki alana ayırmadı; full_name görünen ad kalır.';
comment on column public.profiles.telefon is
  'İsteğe bağlı iletişim telefonu, ülke koduyla tek metin. Girişte kullanılmaz.';
