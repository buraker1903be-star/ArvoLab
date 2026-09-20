-- Kılavuz kaynakları için koşullu istek doğrulayıcıları
-- ------------------------------------------------------------
-- Gece çalışan tarama her tur aynı dosyaları BAŞTAN indiriyor, sonra
-- SHA-256 özetini karşılaştırıp "değişmemiş" diyor. Gazi'nin kılavuzu 8 MB;
-- kayıt sayısı arttıkça her gece onlarca megabaytlık indirme, hiçbir şey
-- değişmemiş olsa bile tekrarlanacak. Bu hem üniversitelerin sunucularına
-- gereksiz yük, hem gece turunun zaman bütçesinde boşa harcanan süre.
--
-- HTTP'nin bunun için standart yolu var: sunucunun verdiği ETag ve
-- Last-Modified saklanır, sonraki istekte If-None-Match / If-Modified-Since
-- ile gönderilir. Dosya değişmemişse sunucu gövdesiz 304 döner.
--
-- Doğrulayıcılar metin olarak saklanıyor: ETag tırnaklı ve W/ önekli
-- olabiliyor, Last-Modified ise HTTP tarih biçiminde. İkisi de sunucudan
-- geldiği gibi geri gönderilmeli, yorumlanmamalı.
--
-- Tekrar çalıştırılabilir.

alter table public.thesis_guidelines
  add column if not exists source_etag text,
  add column if not exists source_last_modified text;

comment on column public.thesis_guidelines.source_etag is
  'Sunucunun verdiği ETag; koşullu istekte If-None-Match olarak aynen geri gönderilir.';
comment on column public.thesis_guidelines.source_last_modified is
  'Sunucunun verdiği Last-Modified; koşullu istekte If-Modified-Since olarak aynen geri gönderilir.';
