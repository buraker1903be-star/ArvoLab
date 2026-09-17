-- Paylaşım bağlantısı akışının service_role izinleri.
--
-- SORUN
-- Paylaşım sayfası (app/share/[token]/page.tsx) createAdminClient() ile,
-- yani SERVICE_ROLE ile çalışıyor — çalışması gereken de bu: bağlantıyı
-- açan kişi giriş yapmış değil, dolayısıyla authenticated izinleri onu
-- kapsamıyor.
--
-- Ama tablolara yalnızca authenticated izni verilmişti:
--   manuscript_share_links → 20260920090000: yalnızca authenticated
--   academic_projects      → schema.sql: yalnızca authenticated
--   project_manuscripts    → schema.sql: yalnızca authenticated
--   notifications          → 20260918090000: yalnızca authenticated
--
-- Bu projede izinler yeni tablolara OTOMATİK geçmiyor; aynı eksik iki kez
-- daha yaşandı (20260923100000 ve 20260923110000 bunun için yazılmıştı).
--
-- Sonuç: her geçerli paylaşım bağlantısı "permission denied" alıyor. Hata
-- da okunmuyordu (bkz. aynı dosyadaki üç sorgu), bu yüzden kullanıcı
-- "Bağlantı geçersiz, süresi dolmuş ya da iptal edilmiş" görüyordu.
-- Özellik uçtan uca ölüydü ve nedeni hiçbir yerde görünmüyordu.
--
-- SIRA: bu dosyadan önce 20260920090000 ve 20260921090000 çalışmış olmalı
-- (tablolar yoksa buradaki grant'lar hata verir).
--
-- Not: service_role RLS'i atlar. Buradaki erişim kapısı politika değil,
-- paylaşım belirtecinin kendisi: 32 bayt rastgele, veritabanında yalnızca
-- SHA-256 özeti duruyor, süre ve iptal sayfada denetleniyor.

grant select on public.manuscript_share_links to service_role;
-- Görüntüleme sayacı ve son görüntülenme zamanı (lib/share-views.ts).
grant update (view_count, last_viewed_at) on public.manuscript_share_links to service_role;

grant select on public.academic_projects to service_role;
grant select on public.project_manuscripts to service_role;

-- Sahibine "çalışmanız görüntülendi" bildirimi (lib/share-views.ts).
grant select, insert on public.notifications to service_role;

-- ---------------------------------------------------------------
-- Görüntüleme sayacı
-- ---------------------------------------------------------------
-- Sayaç uygulamada "oku, 1 ekle, yaz" ile artırılıyordu: aynı anda iki kişi
-- bağlantıyı açtığında bir görüntüleme kayboluyordu. Ayrıca "ilk
-- görüntüleme" tespiti ayrı bir koşullu güncellemeyle yapılıyordu.
--
-- Tek atomik artırma ikisini birden çözüyor: dönen değer 1 ise bu ilk
-- görüntülemedir, dolayısıyla bildirim tam olarak bir kez gider.
create or replace function public.bump_share_view(
  p_link_id uuid,
  p_viewed_at timestamptz
)
returns integer
language sql
volatile
security definer
set search_path to ''
as $function$
  update public.manuscript_share_links
  set view_count = coalesce(view_count, 0) + 1,
      last_viewed_at = p_viewed_at
  where id = p_link_id
  returning view_count;
$function$;

revoke all on function public.bump_share_view(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.bump_share_view(uuid, timestamptz) to service_role;
