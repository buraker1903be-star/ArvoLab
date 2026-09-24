-- ============================================================
-- Deneme süresi hatırlatması gönderildi işareti.
--
-- Deneme süresi bugüne kadar SESSİZCE bitiyordu: kullanıcı bunu ancak
-- tezini kaydetmeye çalışıp "aboneliğiniz sona erdi" görünce öğreniyordu.
-- Üründen kopmak için en kötü an; uyarı bitişten önce gelmeli.
--
-- İşaret olmadan hatırlatma her gün yeniden giderdi. Sütun tabloda çünkü
-- kararı veren de bu tablo (bireysel aboneliğin yerel aynası,
-- 20260924100003) ve iki kayıt arasında tutarlılık aramak gerekmesin.
--
-- Tablo yalnızca service_role'a açık; cron da servis anahtarıyla çalışıyor,
-- yeni bir yetki gerekmiyor.
-- ============================================================

alter table public.individual_subscriptions
  add column if not exists deneme_hatirlatildi_at timestamptz;

comment on column public.individual_subscriptions.deneme_hatirlatildi_at is
  'Deneme bitiş hatırlatması gönderildiği an; bir kez gönderilir (app/api/cron/deneme-hatirlatma).';

/*
  Cron'un aradığı satırlar: denemesi süren, bitişi yaklaşan, henüz
  hatırlatılmamış. Kısmi indeks, tablo büyüdükçe taramayı dar tutuyor.
*/
create index if not exists individual_subscriptions_hatirlatma_idx
  on public.individual_subscriptions (trial_ends_at)
  where status = 'trialing' and deneme_hatirlatildi_at is null;

notify pgrst, 'reload schema';
