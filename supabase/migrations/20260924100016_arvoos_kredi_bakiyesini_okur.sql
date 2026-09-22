-- ArvoOS kredi bakiyesini okuyabilsin.
--
-- Kiracı, kredisinin ne kadar kaldığını ArvoOS'un Ödeme sayfasında görüp
-- oradan satın alacak: para ArvoOS'ta ödeniyor, bakiye burada duruyor.
--
-- ArvoOS bakiyeyi ai_kredi_hesabi'ndan doğrudan da okuyabilirdi
-- (service_role'ün select yetkisi var) ama okuduğu sayı yanlış olurdu:
-- ay değiştiğinde aylik_kalan geçen ayın artığını gösteriyor, yenileme
-- ancak ilk çalışmada (ai_kredi_hesabini_hazirla) yapılıyor. O kuralı
-- ArvoOS'ta yeniden yazmak, aynı kuralın iki kopyası demekti; ikisi er
-- geç ayrışır ve müşteriye yanlış bakiye gösterilir.
--
-- Bu yüzden kural burada kalıyor, ArvoOS yalnızca sonucu okuyor.

/*
  YAZMIYOR. hazirla() çağrılsaydı bakiye "bakıldığı için" yenilenirdi:
  ekranı açmak defterde bir 'yenileme' satırı oluştururdu ve kredinin ne
  zaman yenilendiği sorusunun yanıtı bozulurdu. Yenileme, ilk gerçek
  kullanımda olmaya devam ediyor; burada yalnızca o an ne görüleceği
  hesaplanıyor.
*/
create or replace function public.arvoos_ai_kredi_durumu(p_organization_id uuid)
returns table (aylik_limit bigint, aylik_kalan bigint, ek_bakiye bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(o.ai_credit_limit, 0)::bigint,
    /*
      Hesap satırı yoksa ya da dönem geçmişse aylık hak tamdır: ikisi de
      "bu ay henüz hiç kullanılmadı" demek. hazirla() ile aynı kural.
    */
    case
      when h.organization_id is null
        or h.donem < date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date
      then coalesce(o.ai_credit_limit, 0)
      else h.aylik_kalan
    end::bigint,
    -- Satın alınan bakiye ay değişiminden etkilenmiyor: yanmıyor.
    coalesce(h.ek_bakiye, 0)::bigint
  from public.organizations o
  left join public.ai_kredi_hesabi h on h.organization_id = o.id
  where o.id = p_organization_id;
$$;

-- Yalnızca ArvoOS köprüsü. Kurumun kendi kullanıcısı bile çağıramaz:
-- başka bir kurumun kimliğini yazıp bakiyesini okuyabilirdi. Kullanıcı
-- kendi bakiyesini ai_kredi_durumum() ile görüyor (kimlik oturumdan).
revoke all on function public.arvoos_ai_kredi_durumu(uuid) from public, anon, authenticated;
grant execute on function public.arvoos_ai_kredi_durumu(uuid) to service_role;
