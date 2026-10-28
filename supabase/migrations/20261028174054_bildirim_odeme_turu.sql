-- Ödeme bildirimi türü (28.10.2026)
-- ------------------------------------------------------------
-- ArvoOS kartla ödeme ve otomatik yenilemenin sonucunu (ödeme alındı,
-- yenileme çekimi başarısız, kart süresi doluyor) bireysel abonenin panel
-- zilinde gösterebilmek için bu tabloya service role ile 'billing' türünde
-- satır yazıyor (bağlantı '/dashboard/abonelik'). Kısıt bu türü
-- tanımıyordu: ArvoOS'un her eklemesi check ihlaliyle düşerdi.
--
-- Önceki tanım 20260921090000_share_view_notifications.sql'de; izinli
-- türlerin HEPSİ korunuyor, yalnızca 'billing' ekleniyor. Kullanıcıların
-- bildirim yazma yetkisi yok (değişmedi): satırı yalnızca service role ve
-- veritabanı tetikleyicileri yazar.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('comment', 'assignment', 'status', 'approval', 'guideline_update', 'share_view', 'billing'));
