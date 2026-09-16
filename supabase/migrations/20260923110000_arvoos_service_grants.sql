-- ArvoOS'un ArvoLab veritabanına erişimi.
--
-- ArvoOS iki iş için buraya bağlanıyor (kendi servis anahtarıyla):
--   1) Lisans yansıtma: organizations satırını günceller/oluşturur
--      (lib/arvolab.ts · pushArvolabLicense)
--   2) Üye listesi: profiles ve organizations okur
--      (lib/member-directory.ts · Platform → Tüm Üyeler)
--
-- Bu projede yeni tablolara service_role izinleri kendiliğinden düşmüyor —
-- bridge_health'te de aynısı oldu. RLS'i service_role atlıyor ama tablo
-- ayrıcalığı ayrı bir şey: o olmadan "permission denied for table X" alınıyor.
-- Nitekim Platform → Tüm Üyeler ekranı "ArvoLab veritabanına ulaşılamadı"
-- uyarısı veriyordu ve lisans yansıtma da sessizce başarısız olabilirdi.
--
-- Yalnızca gereken kadar: profiles okunur, organizations okunur ve yazılır.
-- Kullanıcı rollerine (anon, authenticated) hiçbir şey eklenmiyor.

grant select on public.profiles to service_role;
grant select, insert, update on public.organizations to service_role;
