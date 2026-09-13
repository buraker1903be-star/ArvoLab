-- Verified root academic units: ODTÜ, Ankara Yıldırım Beyazıt University,
-- Ankara Social Sciences University.
-- Sources checked on 2026-08-06.

insert into public.academic_unit_import_staging
  (university_name, parent_name, unit_name, unit_type, source_url)
values
  -- Orta Doğu Teknik Üniversitesi
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Mimarlık Fakültesi', 'fakulte', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Fen Edebiyat Fakültesi', 'fakulte', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'İktisadi ve İdari Bilimler Fakültesi', 'fakulte', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Eğitim Fakültesi', 'fakulte', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Mühendislik Fakültesi', 'fakulte', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Uygulamalı Matematik Enstitüsü', 'enstitu', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Enformatik Enstitüsü', 'enstitu', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Deniz Bilimleri Enstitüsü', 'enstitu', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Fen Bilimleri Enstitüsü', 'enstitu', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Sosyal Bilimler Enstitüsü', 'enstitu', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Yabancı Diller Yüksekokulu', 'yuksekokul', 'https://www.metu.edu.tr/faculties-institutes-schools'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', null, 'Teknik Bilimler Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://www.metu.edu.tr/faculties-institutes-schools'),

  -- Ankara Yıldırım Beyazıt Üniversitesi
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Diş Hekimliği Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Eczacılık Fakültesi', 'fakulte', 'https://www.aybu.edu.tr/aybu/tr/sayfa/9625'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Havacılık ve Uzay Bilimleri Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Hukuk Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'İlahiyat Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'İletişim Fakültesi', 'fakulte', 'https://www.aybu.edu.tr/aybu/tr/sayfa/9625'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'İnsan ve Toplum Bilimleri Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'İşletme Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Mimarlık ve Güzel Sanatlar Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Mühendislik ve Doğa Bilimleri Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Sağlık Bilimleri Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Siyasal Bilgiler Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Spor Bilimleri Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Şereflikoçhisar Uygulamalı Bilimler Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Tıp Fakültesi', 'fakulte', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Yabancı Diller Yüksekokulu', 'yuksekokul', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Türk Musikisi Devlet Konservatuvarı', 'konservatuvar', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Teknik Bilimler Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Sağlık Hizmetleri Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Sosyal Bilimler Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Şereflikoçhisar Berat Cömertoğlu Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://aybu.edu.tr/adayogrenci/tr/sayfa/6180/Fak%C3%BClteler-ve-Y%C3%BCksekokullar'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Fen Bilimleri Enstitüsü', 'enstitu', 'https://aybu.edu.tr/fbe/tr'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Sosyal Bilimler Enstitüsü', 'enstitu', 'https://aybu.edu.tr/sbe/tr'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', null, 'Halk Sağlığı Enstitüsü', 'enstitu', 'https://aybu.edu.tr/hse/tr'),

  -- Ankara Sosyal Bilimler Üniversitesi
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'İlahiyat Fakültesi', 'fakulte', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Hukuk Fakültesi', 'fakulte', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Siyasal Bilgiler Fakültesi', 'fakulte', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Sosyal ve Beşeri Bilimler Fakültesi', 'fakulte', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Sanat ve Tasarım Fakültesi', 'fakulte', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Yabancı Diller Fakültesi', 'fakulte', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'İletişim Fakültesi', 'fakulte', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Bölge Araştırmaları Enstitüsü', 'enstitu', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'İslami Araştırmalar Enstitüsü', 'enstitu', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Sosyal Bilimler Enstitüsü', 'enstitu', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Sosyal Araştırmalar ve Yenilik Enstitüsü', 'enstitu', 'https://www.asbu.edu.tr/tr/akademik-birimler'),
  ('Ankara Sosyal Bilimler Üniversitesi', null, 'Yabancı Diller Yüksekokulu', 'yuksekokul', 'https://www.asbu.edu.tr/tr/akademik-birimler')
on conflict do nothing;

select * from public.import_academic_units();
