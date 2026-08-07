-- Verified root academic units: Bilkent University, Başkent University,
-- and TOBB University of Economics and Technology.
-- Official sources checked on 2026-08-06.

insert into public.academic_unit_import_staging
  (university_name, parent_name, unit_name, unit_type, source_url)
values
  -- Bilkent Üniversitesi
  ('Bilkent Üniversitesi', null, 'Eğitim Fakültesi', 'faculty', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Fen Fakültesi', 'faculty', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Güzel Sanatlar, Tasarım ve Mimarlık Fakültesi', 'faculty', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'İktisadi, İdari ve Sosyal Bilimler Fakültesi', 'faculty', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'İnsani Bilimler ve Edebiyat Fakültesi', 'faculty', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'İşletme Fakültesi', 'faculty', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Hukuk Fakültesi', 'faculty', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Mühendislik Fakültesi', 'faculty', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Müzik ve Sahne Sanatları Fakültesi', 'faculty', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Uygulamalı Bilimler Fakültesi', 'faculty', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),

  -- Başkent Üniversitesi
  ('Başkent Üniversitesi', null, 'Diş Hekimliği Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Eczacılık Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Eğitim Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Fen-Edebiyat Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Güzel Sanatlar Tasarım ve Mimarlık Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Hukuk Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'İktisadi ve İdari Bilimler Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'İletişim Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Mühendislik Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Sağlık Bilimleri Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Ticari Bilimler Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Tıp Fakültesi', 'faculty', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Avrupa Birliği ve Uluslararası İlişkiler Enstitüsü', 'institute', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Eğitim Bilimleri Enstitüsü', 'institute', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Fen Bilimleri Enstitüsü', 'institute', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Gıda Tarım ve Hayvancılığı Geliştirme Enstitüsü', 'institute', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Sağlık Bilimleri Enstitüsü', 'institute', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Sosyal Bilimler Enstitüsü', 'institute', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Transplantasyon ve Gen Bilimi Enstitüsü', 'institute', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Yanık, Yangın ve Doğal Afetler Enstitüsü', 'institute', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Yabancı Diller Yüksekokulu', 'school', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Adana Sağlık Hizmetleri Meslek Yüksekokulu', 'vocational_school', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Anadolu Organize Sanayi Bölgesi Meslek Yüksekokulu', 'vocational_school', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Kahramankazan Meslek Yüksekokulu', 'vocational_school', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Konya Sağlık Hizmetleri Meslek Yüksekokulu', 'vocational_school', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Sağlık Hizmetleri Meslek Yüksekokulu', 'vocational_school', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Sosyal Bilimler Meslek Yüksekokulu', 'vocational_school', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Teknik Bilimler Meslek Yüksekokulu', 'vocational_school', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Devlet Konservatuvarı', 'conservatory', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),

  -- TOBB Ekonomi ve Teknoloji Üniversitesi
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Mühendislik Fakültesi', 'faculty', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Tıp Fakültesi', 'faculty', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'İktisadi ve İdari Bilimler Fakültesi', 'faculty', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Hukuk Fakültesi', 'faculty', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Mimarlık ve Tasarım Fakültesi', 'faculty', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Fen Edebiyat Fakültesi', 'faculty', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Fen Bilimleri Enstitüsü', 'institute', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Sosyal Bilimler Enstitüsü', 'institute', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Sağlık Bilimleri Enstitüsü', 'institute', 'https://www.etu.edu.tr/tr/akademik')
on conflict do nothing;

select * from public.import_academic_units();
