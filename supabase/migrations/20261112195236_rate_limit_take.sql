-- ============================================================
-- Hız sınırı: atomik TOPLU rezervasyon (Phase 5.0 / T3, 12.11.2026).
--
-- public.rate_limit_hit (20260924100002) her çağrıda BİR birim sayar ve
-- yalnızca evet/hayır döner. Toplu DOI içe aktarma (doiIleEkle, çağrı
-- başına en çok 50 DOI) tekli DOI sorgusuyla AYNI saatlik bütçeyi
-- (kullanıcı başına 120) paylaşacak; bunun için:
--   - N birimlik isteği TEK ifadede ve atomik olarak karşılamak
--     (DOI başına ayrı çağrı 50 gidiş-dönüş demekti ve paket olarak
--     atomik değildi),
--   - en çok KALAN hak kadar vermek (kısmi işlem; fazlası "ertelendi"),
--   - kalan hakkı ve pencerenin yenileneceği anı döndürmek (kullanıcıya
--     "kalan 25 için hakkınız 14:32'de yenilenir" diyebilmek)
-- gerekiyor.
--
-- AYNI TABLO, AYNI ANAHTAR, AYNI PENCERE KURALI: auth_rate_limits'teki
-- satır rate_limit_hit ile ortak. Pencere süresi dolmuşsa ikisi de aynı
-- biçimde sıfırlar (window_start < now() - p_window). rate_limit_hit
-- reddedilen denemeyi de saydığı için sayaç sınırı aşmış olabilir; bu
-- işlev o durumda 0 verir, sayacı küçültmez.
--
-- ATOMİKLİK: ilk ifade "insert … on conflict do update" satırı kilitler;
-- kilit işlem sonuna kadar sürer. Aynı anahtara gelen eşzamanlı çağrı
-- kendi upsert'ünde bekler ve sırası gelince güncel satırı okur. Böylece
-- verilen toplam hiçbir koşulda sınırı aşmaz (tests/db ve
-- scripts/eszamanli-hiz-siniri.sh).
--
-- Tablo ve mevcut işlevler DEĞİŞMİYOR; şifre sıfırlama ve öteki sınırlar
-- etkilenmez. Yalnızca service_role çağırabilir.
-- ============================================================

create or replace function public.rate_limit_take(
  p_key text,
  p_limit integer,
  p_window interval,
  p_requested integer
)
returns table (granted integer, remaining integer, resets_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
declare
  v_limit integer := greatest(1, coalesce(p_limit, 1));
  -- Negatif istek sayacı geri almaz (iade yok); üst sınır kötüye kullanıma karşı.
  v_requested integer := greatest(0, least(coalesce(p_requested, 0), 10000));
  v_count integer;
  v_start timestamptz;
  v_granted integer;
begin
  insert into public.auth_rate_limits as l (key, window_start, count)
  values (p_key, now(), 0)
  on conflict (key) do update
    set window_start = case when l.window_start < now() - p_window then now() else l.window_start end,
        count = case when l.window_start < now() - p_window then 0 else l.count end
  returning l.count, l.window_start into v_count, v_start;

  v_granted := greatest(0, least(v_requested, v_limit - v_count));

  if v_granted > 0 then
    update public.auth_rate_limits
      set count = count + v_granted
      where key = p_key
      returning count into v_count;
  end if;

  granted := v_granted;
  remaining := greatest(0, v_limit - v_count);
  resets_at := v_start + p_window;
  return next;
end;
$$;

revoke all on function public.rate_limit_take(text, integer, interval, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_take(text, integer, interval, integer) to service_role;
