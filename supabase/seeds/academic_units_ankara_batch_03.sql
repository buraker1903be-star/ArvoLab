-- Verified root academic units: Ankara Hacı Bayram Veli University
-- and Ankara Music and Fine Arts University.
-- Official sources checked on 2026-08-06.

insert into public.academic_unit_import_staging
  (university_name, parent_name, unit_name, unit_type, source_url)
values
  -- Ankara Hacı Bayram Veli Üniversitesi
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Edebiyat Fakültesi', 'fakulte', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Finansal Bilimler Fakültesi', 'fakulte', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Güzel Sanatlar Fakültesi', 'fakulte', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Hukuk Fakültesi', 'fakulte', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'İktisadi ve İdari Bilimler Fakültesi', 'fakulte', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'İlahiyat Fakültesi', 'fakulte', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'İletişim Fakültesi', 'fakulte', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Polatlı Fen Edebiyat Fakültesi', 'fakulte', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Sanat ve Tasarım Fakültesi', 'fakulte', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Turizm Fakültesi', 'fakulte', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Lisansüstü Eğitim Enstitüsü', 'enstitu', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Tapu Kadastro Yüksekokulu', 'yuksekokul', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Yabancı Diller Yüksekokulu', 'yuksekokul', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Adalet Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Mutfak Sanatları Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Polatlı Sosyal Bilimler Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Polatlı Teknik Bilimler Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Türk Müziği Devlet Konservatuvarı', 'konservatuvar', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),

  -- Ankara Müzik ve Güzel Sanatlar Üniversitesi
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Müzik Bilimleri ve Teknolojileri Fakültesi', 'fakulte', 'https://www.mgu.edu.tr/mgu-fakulteler/'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Müzik ve Sahne Sanatları Fakültesi', 'fakulte', 'https://www.mgu.edu.tr/mgu-fakulteler/'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Müzik ve Güzel Sanatlar Eğitim Fakültesi', 'fakulte', 'https://www.mgu.edu.tr/mgu-fakulteler/'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Sanat ve Tasarım Fakültesi', 'fakulte', 'https://www.mgu.edu.tr/mgu-fakulteler/'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Müzik ve Güzel Sanatlar Enstitüsü', 'enstitu', 'https://www.mgu.edu.tr/muzik-ve-guzel-sanatlar-enstitusu/'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Müzik ve Güzel Sanatlar Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://www.mgu.edu.tr/mgu-fakulteler/')
on conflict do nothing;

select * from public.import_academic_units();
