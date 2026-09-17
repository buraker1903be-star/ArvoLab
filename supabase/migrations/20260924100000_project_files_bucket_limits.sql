-- project-files kovasına boyut ve tür sınırı.
--
-- SORUN
-- Kova hiçbir sınır verilmeden oluşturulmuştu (schema.sql):
--   insert into storage.buckets (id, name, public)
--   values ('project-files', 'project-files', false)
-- yani file_size_limit ve allowed_mime_types NULL.
--
-- Uygulamadaki tek kontrol istemcinin BİLDİRDİĞİ değerlere bakıyor ve dosya
-- o noktada zaten yüklenmiş oluyor:
--   app/actions/document-upload.ts → params.fileSize, params.mimeType
-- Üstelik oradaki yorum "20 MB — Supabase Storage tarafındaki gerçek sınır"
-- diyor; öyle bir sınır yoktu. Tarayıcıdan doğrudan depoya 500 MB'lık
-- rastgele içerik yüklenip "fileSize: 1" bildirilebiliyordu.
--
-- ÇÖZÜM
-- Sınır depoya konuyor: orası istemcinin beyanına değil gerçek dosyaya bakar
-- ve reddi yükleme anında yapar.
--
-- Sınır neye göre seçildi:
--   20 MB  → document-upload.ts'teki MAX_FILE_SIZE (.docx / .pdf)
--   türler → belge yüklemenin kabul ettikleri (.docx, .pdf) ve editörün
--            resim türleri (manuscript-editor.tsx: IMAGE_TYPES)
--
-- Kova hem yüklenen belgeleri hem editör resimlerini tutuyor, bu yüzden iki
-- kümenin birleşimi gerekiyor.

update storage.buckets
set file_size_limit = 20 * 1024 * 1024,
    allowed_mime_types = array[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/gif'
    ]
where id = 'project-files';
