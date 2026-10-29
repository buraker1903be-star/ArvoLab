-- ============================================================
-- ÜYELİK BAĞLAMA BAĞLANAN KURUMU DÖNDÜRÜR (29.10.2026, performans).
--
-- lib/current-profile.ts kurumsuz her profilde arvoos_uyeligimi_bagla()
-- çağırıyor (20260924100011). Fonksiyon void döndürdüğü için uygulama
-- bağlanıp bağlanmadığını bilemiyor ve profili HER İSTEKTE yeniden
-- okuyordu: bireysel abonenin her panel isteğine ve her otomatik kayda
-- iki sıralı gidiş-dönüş (RPC + ikinci profil okuması) ekleniyordu.
--
-- Yeni fonksiyon aynı işi yapar ve sonrasında profilin kurumunu döndürür
-- (bağlanmadıysa NULL). Uygulama profili yalnızca kurum döndüğünde
-- yeniden okur — bu da nadiren, bir kez olur.
--
-- Dönüş tipini değiştirmek DROP gerektirdiği için eski fonksiyona
-- dokunulmuyor; ad farklı. Kural aynı: PARAMETRE ALMAZ, yalnızca
-- çağıranın kendi profilini bağlar (tests/db/guvenlik.test.mjs gerekçesi).
-- ============================================================

create or replace function public.arvoos_uyeligimi_bagla_kurum()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kurum uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  perform public.arvoos_uyeligimi_bagla();
  select p.organization_id into v_kurum from public.profiles p where p.id = auth.uid();
  return v_kurum;
end;
$$;

revoke all on function public.arvoos_uyeligimi_bagla_kurum() from public, anon, authenticated;
grant execute on function public.arvoos_uyeligimi_bagla_kurum() to authenticated;
