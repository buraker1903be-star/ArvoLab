-- bridge_health'e sunucu erişimi.
--
-- Tablo oluşturulduğunda service_role'e yalnızca REFERENCES, TRIGGER ve
-- TRUNCATE düşmüş; SELECT, INSERT ve UPDATE yok. Sonuç: ArvoLab sağlık
-- kaydını yazamıyor, ArvoOS da okuyamıyor — tablo pratikte kimseye kapalı.
--
-- Varsayılan ayrıcalıklara güvenip açıkça izin vermemiştim. Bir saat
-- kaybettiren kusur buydu; artık izinler açıkça veriliyor.
--
-- anon ve authenticated'a kapalı kalıyor: bu tablo yalnızca sunucular
-- arasında kullanılıyor, kullanıcıya gösterilecek bir şey değil.

grant select, insert, update on public.bridge_health to service_role;
revoke all on public.bridge_health from anon, authenticated;
