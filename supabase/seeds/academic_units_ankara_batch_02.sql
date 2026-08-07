-- Verified root academic units: ODTÜ, Ankara Yıldırım Beyazıt University,
-- Ankara Social Sciences University.
-- Sources checked on 2026-08-06.

insert into public.academic_unit_import_staging
  (university_name, parent_name, unit_name, unit_type, source_url)
values
  -- Orta Doğu Teknik Üniversitesi
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Mimarlık Fakültesi', 'faculty', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Fen Edebiyat Fakültesi', 'faculty', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'İktisadi ve İdari Bilimler Fakültesi', 'faculty', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Eğitim Fakültesi', 'faculty', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Mühendislik Fakültesi', 'faculty', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Uygulamalı Matematik Enstitüsü', 'institute', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Enformatik Enstitüsü', 'institute', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Deniz Bilimleri Enstitüsü', 'institute', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Fen Bilimleri Enstitüsü', 'institute', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Sosyal Bilimler Enstitüsü', 'institute', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Yabancı Diller Yüksekokulu', 'school', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Teknik Bilimler Meslek Yüksekokulu', 'vocational_school', 'https://www.metu.edu.tr/faculties-institutes-schools'),

  -- Ankara Yıldırım Beyazıt Üniversitesi
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Diş Hekimliği Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Eczacılık Fakültesi', 'faculty', 'https://www.aybu.edu.tr/aybu/tr/sayfa/9625'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Havacılık ve Uzay Bilimleri Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Hukuk Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'İlahiyat Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'İletişim Fakültesi', 'faculty', 'https://www.aybu.edu.tr/aybu/tr/sayfa/9625'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'İnsan ve Toplum Bilimleri Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'İşletme Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Mimarlık ve Güzel Sanatlar Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Mühendislik ve Doğa Bilimleri Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Sağlık Bilimleri Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Siyasal Bilgiler Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Spor Bilimleri Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Şereflikoçhisar Uygulamalı Bilimler Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Tıp Fakültesi', 'faculty', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Yabancı Diller Yüksekokulu', 'school', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Türk Musikisi Devlet Konservatuvarı', 'conservatory', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Teknik Bilimler Meslek Yüksekokulu', 'vocational_school', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Sağlık Hizmetleri Meslek Yüksekokulu', 'vocational_school', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Sosyal Bilimler Meslek Yüksekokulu', 'vocational_school', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Şereflikoçhisar Berat Cömertoğlu Meslek Yüksekokulu', 'vocational_school', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Fen Bilimleri Enstitüsü', 'institute', 'https://aybu.edu.tr/fbe/tr'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Sosyal Bilimler Enstitüsü', 'institute', 'https://aybu.edu.tr/sbe/tr'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Halk Sağlığı Enstitüsü', 'institute', 'https://aybu.edu.tr/hse/tr'),

  -- Ankara Sosyal Bilimler Üniversitesi
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'İlahiyat Fakültesi', 'faculty', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Hukuk Fakültesi', 'faculty', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Siyasal Bilgiler Fakültesi', 'faculty', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Sosyal ve Beşeri Bilimler Fakültesi', 'faculty', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Sanat ve Tasarım Fakültesi', 'faculty', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Yabancı Diller Fakültesi', 'faculty', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'İletişim Fakültesi', 'faculty', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Bölge Araştırmaları Enstitüsü', 'institute', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'İslami Araştırmalar Enstitüsü', 'institute', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Sosyal Bilimler Enstitüsü', 'institute', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Sosyal Araştırmalar ve Yenilik Enstitüsü', 'institute', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Yabancı Diller Yüksekokulu', 'school', 'https://www.asbu.edu.tr/tr/akademik-birimler')
on conflict do nothing;

select * from public.import_academic_units();
