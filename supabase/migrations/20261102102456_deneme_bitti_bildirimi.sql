-- ============================================================
-- DENEME BİTTİ BİLDİRİMİ İŞARETİ (02.11.2026, kurum sahibinin isteği:
-- self-servis kayıt, 3 günlük deneme; son gün ve bitişte e-posta ve
-- panel bildirimi).
--
-- Bitişten ÖNCEKİ hatırlatmanın işareti deneme_hatirlatildi_at
-- (20260924100027). Bitişin kendisi ayrı bir olay: kullanıcıya erişiminin
-- durduğunu ve ödeme yapınca kaldığı yerden devam edeceğini söyler. İki
-- olay tek işaretle tutulsaydı, hatırlatma gitmiş kişiye bitiş bildirimi
-- hiç gitmezdi.
--
-- İşaret gönderimden SONRA yazılır (app/api/cron/deneme-hatirlatma):
-- gönderilemeyen bildirim bir sonraki turda yeniden denenir.
-- Tablo yalnızca service_role'a açık; yeni yetki gerekmiyor.
-- ============================================================

alter table public.individual_subscriptions
  add column if not exists deneme_bitti_bildirildi_at timestamptz;

comment on column public.individual_subscriptions.deneme_bitti_bildirildi_at is
  'Deneme bitti bildirimi (e-posta + panel) gönderildiği an; bir kez gönderilir (app/api/cron/deneme-hatirlatma).';

create index if not exists individual_subscriptions_deneme_bitti_idx
  on public.individual_subscriptions (trial_ends_at)
  where status = 'trialing' and deneme_bitti_bildirildi_at is null;

notify pgrst, 'reload schema';
