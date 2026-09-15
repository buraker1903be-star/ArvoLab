-- Paylaşım bağlantısı ilk kez açıldığında bağlantıyı oluşturana panel içi bildirim
-- ------------------------------------------------------------
-- Bildirimi paylaşım sayfası sunucuda (service role) yazar; burada yalnızca yeni bildirim
-- türüne izin verilir. Kullanıcıların bildirim yazma yetkisi yoktur (değişmedi).
-- Tekrar çalıştırılabilir.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('comment', 'assignment', 'status', 'approval', 'guideline_update', 'share_view'));
