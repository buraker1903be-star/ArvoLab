-- "Hak bildirilmedi" ile "hak yok" ayrı şeyler; okunan durum da ayırmalı.
--
-- 20260924100016 ai_credit_limit'i coalesce(…, 0) ile okuyordu. AkademikMerkez
-- üzerinde hemen görüldü: kurumun ArvoOS'taki hakkı 10.000, ArvoLab'daki
-- kopyası ise null (son yansıtma 16.09.2026, kredi alanı eklenmeden önce).
-- Fonksiyon "0 / 0 kredi" döndürdü, ArvoOS'un Ödeme sayfası da müşteriye
-- "hiç AI hakkınız yok" diyecekti — oysa doğrusu "henüz bildirilmedi".
--
-- Ayrım bu üründe zaten kurulu: kredi-karari.ts'te limit null iken kapı
-- AÇIK kalıyor (bilgisizlik engellemez), limit 0 iken NET bir "hak yok"
-- sayılıp kapanıyor. Okuma tarafı o ayrımı silmemeli.
--
-- Bundan sonra: aylik_limit null = bildirilmedi, 0 = hak yok.

create or replace function public.arvoos_ai_kredi_durumu(p_organization_id uuid)
returns table (aylik_limit bigint, aylik_kalan bigint, ek_bakiye bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.ai_credit_limit::bigint,
    case
      -- Bildirilmemiş hak sayıya çevrilmez; çağıran "bilinmiyor" görmeli.
      when o.ai_credit_limit is null then null
      /*
        Hesap satırı yoksa ya da dönem geçmişse aylık hak tamdır: ikisi de
        "bu ay henüz hiç kullanılmadı" demek. hazirla() ile aynı kural.
      */
      when h.organization_id is null
        or h.donem < date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date
      then o.ai_credit_limit
      else h.aylik_kalan
    end::bigint,
    -- Satın alınan bakiye ay değişiminden etkilenmiyor: yanmıyor. Bu sayı
    -- her zaman biliniyor (hesap yoksa gerçekten 0'dır), o yüzden coalesce.
    coalesce(h.ek_bakiye, 0)::bigint
  from public.organizations o
  left join public.ai_kredi_hesabi h on h.organization_id = o.id
  where o.id = p_organization_id;
$$;

-- create or replace yetkileri koruyor; yine de açıkça yazılıyor ki bu
-- dosyayı tek başına okuyan kimin çağırabildiğini görsün.
revoke all on function public.arvoos_ai_kredi_durumu(uuid) from public, anon, authenticated;
grant execute on function public.arvoos_ai_kredi_durumu(uuid) to service_role;
