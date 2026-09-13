-- Verified root academic units: Bilkent University, Başkent University,
-- and TOBB University of Economics and Technology.
-- Official sources checked on 2026-08-06.

insert into public.academic_unit_import_staging
  (university_name, parent_name, unit_name, unit_type, source_url)
values
  -- Bilkent Üniversitesi
  ('Bilkent Üniversitesi', null, 'Eğitim Fakültesi', 'fakulte', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Fen Fakültesi', 'fakulte', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Güzel Sanatlar, Tasarım ve Mimarlık Fakültesi', 'fakulte', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'İktisadi, İdari ve Sosyal Bilimler Fakültesi', 'fakulte', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'İnsani Bilimler ve Edebiyat Fakültesi', 'fakulte', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'İşletme Fakültesi', 'fakulte', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Hukuk Fakültesi', 'fakulte', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Mühendislik Fakültesi', 'fakulte', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Müzik ve Sahne Sanatları Fakültesi', 'fakulte', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),
  ('Bilkent Üniversitesi', null, 'Uygulamalı Bilimler Fakültesi', 'fakulte', 'https://w3.bilkent.edu.tr/www/akademik/fakulte-ve-bolumler/'),

  -- Başkent Üniversitesi
  ('Başkent Üniversitesi', null, 'Diş Hekimliği Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Eczacılık Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Eğitim Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Fen-Edebiyat Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Güzel Sanatlar Tasarım ve Mimarlık Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Hukuk Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'İktisadi ve İdari Bilimler Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'İletişim Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Mühendislik Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Sağlık Bilimleri Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Ticari Bilimler Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Tıp Fakültesi', 'fakulte', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Avrupa Birliği ve Uluslararası İlişkiler Enstitüsü', 'enstitu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Eğitim Bilimleri Enstitüsü', 'enstitu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Fen Bilimleri Enstitüsü', 'enstitu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Gıda Tarım ve Hayvancılığı Geliştirme Enstitüsü', 'enstitu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Sağlık Bilimleri Enstitüsü', 'enstitu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Sosyal Bilimler Enstitüsü', 'enstitu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Transplantasyon ve Gen Bilimi Enstitüsü', 'enstitu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Yanık, Yangın ve Doğal Afetler Enstitüsü', 'enstitu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Yabancı Diller Yüksekokulu', 'yuksekokul', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Adana Sağlık Hizmetleri Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Anadolu Organize Sanayi Bölgesi Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Kahramankazan Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Konya Sağlık Hizmetleri Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Sağlık Hizmetleri Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Sosyal Bilimler Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Teknik Bilimler Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),
  ('Başkent Üniversitesi', null, 'Devlet Konservatuvarı', 'konservatuvar', 'https://www.baskent.edu.tr/tr/akademik/akademik/'),

  -- TOBB Ekonomi ve Teknoloji Üniversitesi
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Mühendislik Fakültesi', 'fakulte', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Tıp Fakültesi', 'fakulte', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'İktisadi ve İdari Bilimler Fakültesi', 'fakulte', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Hukuk Fakültesi', 'fakulte', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Mimarlık ve Tasarım Fakültesi', 'fakulte', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Fen Edebiyat Fakültesi', 'fakulte', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Fen Bilimleri Enstitüsü', 'enstitu', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Sosyal Bilimler Enstitüsü', 'enstitu', 'https://www.etu.edu.tr/tr/akademik'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', null, 'Sağlık Bilimleri Enstitüsü', 'enstitu', 'https://www.etu.edu.tr/tr/akademik')
on conflict do nothing;

select * from public.import_academic_units();
