-- Verified root academic units: Ankara Hacı Bayram Veli University
-- and Ankara Music and Fine Arts University.
-- Official sources checked on 2026-08-06.

insert into public.academic_unit_import_staging
  (university_name, parent_name, unit_name, unit_type, source_url)
values
  -- Ankara Hacı Bayram Veli Üniversitesi
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Edebiyat Fakültesi', 'faculty', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Finansal Bilimler Fakültesi', 'faculty', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Güzel Sanatlar Fakültesi', 'faculty', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Hukuk Fakültesi', 'faculty', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'İktisadi ve İdari Bilimler Fakültesi', 'faculty', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'İlahiyat Fakültesi', 'faculty', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'İletişim Fakültesi', 'faculty', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Polatlı Fen Edebiyat Fakültesi', 'faculty', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Sanat ve Tasarım Fakültesi', 'faculty', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Turizm Fakültesi', 'faculty', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Lisansüstü Eğitim Enstitüsü', 'institute', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Tapu Kadastro Yüksekokulu', 'school', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Yabancı Diller Yüksekokulu', 'school', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Adalet Meslek Yüksekokulu', 'vocational_school', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Mutfak Sanatları Meslek Yüksekokulu', 'vocational_school', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Polatlı Sosyal Bilimler Meslek Yüksekokulu', 'vocational_school', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Polatlı Teknik Bilimler Meslek Yüksekokulu', 'vocational_school', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),
  ('Ankara Hacı Bayram Veli Üniversitesi', null, 'Türk Müziği Devlet Konservatuvarı', 'conservatory', 'https://hacibayram.edu.tr/web/akademik-birimler?tab=fakulteler'),

  -- Ankara Müzik ve Güzel Sanatlar Üniversitesi
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Müzik Bilimleri ve Teknolojileri Fakültesi', 'faculty', 'https://www.mgu.edu.tr/mgu-fakulteler/'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Müzik ve Sahne Sanatları Fakültesi', 'faculty', 'https://www.mgu.edu.tr/mgu-fakulteler/'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Müzik ve Güzel Sanatlar Eğitim Fakültesi', 'faculty', 'https://www.mgu.edu.tr/mgu-fakulteler/'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Sanat ve Tasarım Fakültesi', 'faculty', 'https://www.mgu.edu.tr/mgu-fakulteler/'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Müzik ve Güzel Sanatlar Enstitüsü', 'institute', 'https://www.mgu.edu.tr/muzik-ve-guzel-sanatlar-enstitusu/'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', null, 'Müzik ve Güzel Sanatlar Meslek Yüksekokulu', 'vocational_school', 'https://www.mgu.edu.tr/mgu-fakulteler/')
on conflict do nothing;

select * from public.import_academic_units();
