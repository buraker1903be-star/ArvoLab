-- Verified root academic units for Istanbul University.
-- Official sources checked on 2026-08-17:
-- https://www.istanbul.edu.tr/tr/content/fakulteler
-- https://avesis.istanbul.edu.tr/unitreport/index

alter table public.academic_units enable row level security;

grant select on public.academic_units to authenticated;

drop policy if exists "Authenticated users can view active academic units"
  on public.academic_units;
create policy "Authenticated users can view active academic units"
  on public.academic_units
  for select
  to authenticated
  using (is_active = true);

with source_data(name, unit_type, source_url) as (
  values
    ('Açık ve Uzaktan Eğitim Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Bilgisayar ve Bilişim Teknolojileri Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Diş Hekimliği Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Eczacılık Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Edebiyat Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Fen Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Hasan Ali Yücel Eğitim Fakültesi', 'fakulte', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Hemşirelik Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Hukuk Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('İktisat Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('İlahiyat Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('İletişim Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('İstanbul Tıp Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('İşletme Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Mimarlık Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Siyasal Bilgiler Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Spor Bilimleri Fakültesi', 'fakulte', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Su Bilimleri Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Ulaştırma ve Lojistik Fakültesi', 'fakulte', 'https://www.istanbul.edu.tr/tr/content/fakulteler'),
    ('Atatürk İlkeleri ve İnkılap Tarihi Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Aziz Sancar Deneysel Tıp Araştırma Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Çocuk Sağlığı Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Deniz Bilimleri ve İşletmeciliği Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Fen Bilimleri Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Havacılık Psikolojisi Araştırmaları Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('İslam Tetkikleri Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('İşletme İktisadı Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Muhasebe Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Onkoloji Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Sağlık Bilimleri Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Sosyal Bilimler Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Türkiyat Araştırmaları Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Uluslararası Soykırım ve İnsanlığa Karşı İşlenen Suçlar Enstitüsü', 'enstitu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Devlet Konservatuvarı', 'konservatuvar', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Yabancı Diller Yüksekokulu', 'yuksekokul', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Adalet Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://avesis.istanbul.edu.tr/unitreport/index'),
    ('Güvenlik ve Koruma Bilimleri Meslek Yüksekokulu', 'meslek_yuksekokulu', 'https://avesis.istanbul.edu.tr/unitreport/index')
)
insert into public.academic_units (
  university_id,
  parent_unit_id,
  name,
  normalized_name,
  unit_type,
  is_active,
  source_url,
  source_checked_at
)
select
  u.id,
  null,
  s.name,
  lower(trim(s.name)),
  s.unit_type,
  true,
  s.source_url,
  now()
from source_data s
join public.universities u
  on lower(trim(u.name)) = lower('İstanbul Üniversitesi')
where not exists (
  select 1
  from public.academic_units existing
  where existing.university_id = u.id
    and existing.parent_unit_id is null
    and existing.unit_type = s.unit_type
    and lower(trim(existing.name)) = lower(trim(s.name))
);
