-- ============================================================
-- ABONELİK AYNASI ArvoOS'UN ERİŞİM KARARINI TAŞIR (29.10.2026).
--
-- Uygulamanın kapısı (lib/access.ts) ArvoOS'un `access` kararına bakıyor;
-- veritabanının kapısı (subscription_open, 20260924100003) ise aynadaki
-- HAM durum ve tarihlere. İkisi ayrıştığı iki yerde kullanıcı açık bir
-- panel görüp her kayıtta "Aboneliğiniz sona erdi" alıyordu:
--
--   1) Kuruma bağlanmış bireysel abone: ArvoOS durumu kurumun lisansından
--      veriyor ve `past_due` ile süresi geçmiş `active`'e de erişim
--      tanıyor (ArvoOS lib/kurum-lisansi-erisim.ts). Ayna yalnızca ham
--      durumu yazdığı için veritabanı bunları kapalı sayıyordu.
--   2) ArvoOS'a ulaşılamazken dönemi biten abone: ArvoOS kartından
--      yenilemeyi çekmiş olabilir ama ayna tazelenemediği için eski
--      dönem sonu duruyor, veritabanı kapanıyordu. Uygulama kapısı
--      AGENTS.md gereği açık kalıyor ("kapıyı yalnızca net bir hayır
--      kapatır"); veritabanı geçici bir arızayla kullanıcıyı dışarıda
--      bırakıyordu.
--
-- Çözüm:
--   * Aynaya `erisim` yazılır (lib/subscription.ts mirrorSubscription).
--     Son yedi gün içinde yazılmışsa karar odur — açık da kapalı da.
--   * Eski ya da kararsız aynada eski kural geçerli, bir istisnayla:
--     dönem/deneme bitmiş ama ayna o tarihten ÖNCE yazılmışsa yenilemeyi
--     bilmiyoruz demektir; bitişten sonraki yedi gün boyunca açık. Net
--     bir "hayır" (iptal, süresi geçmiş durumun bitişten SONRA
--     bildirilmesi) eskisi gibi kapatır.
-- ============================================================

alter table public.individual_subscriptions
  add column if not exists erisim boolean;

comment on column public.individual_subscriptions.erisim is
  'ArvoOS''un erişim kararı (ensure yanıtındaki access). NULL: bu sütundan önce yazılmış ayna.';

create or replace function public.subscription_open()
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_role public.user_role;
  v_org uuid;
  v_status text;
  v_trial timestamptz;
  v_period timestamptz;
  v_synced timestamptz;
  v_erisim boolean;
  v_bitis timestamptz;
begin
  -- Servis anahtarı, SQL Editor ve cron: kapı yok.
  if auth.uid() is null then
    return true;
  end if;

  select role, organization_id into v_role, v_org from public.profiles where id = auth.uid();
  if v_role is null then
    return true; -- profil okunamadı: bilgisizlik kapatmaz
  end if;
  if v_role in ('system_admin', 'founder') then
    return true;
  end if;

  if v_org is not null then
    select license_status, current_period_end, synced_at
      into v_status, v_period, v_synced
      from public.organizations where id = v_org;
    if v_status is null or v_synced is null then
      return true; -- ArvoOS bu kurumu hiç bildirmedi
    end if;
    return v_status in ('active', 'trialing') and (v_period is null or v_period > now());
  end if;

  select status, trial_ends_at, current_period_end, synced_at, erisim
    into v_status, v_trial, v_period, v_synced, v_erisim
    from public.individual_subscriptions where user_id = auth.uid();
  if v_status is null then
    return true; -- ayna yok: ArvoOS'a hiç sorulmamış
  end if;

  -- Taze karar: ArvoOS'un kendisi ne dediyse o.
  if v_erisim is not null and v_synced > now() - interval '7 days' then
    return v_erisim;
  end if;

  if v_status in ('trialing', 'active') then
    v_bitis := case when v_status = 'trialing' then v_trial else v_period end;
    if v_bitis is null or v_bitis > now() then
      return true;
    end if;
    -- Bitişten önce yazılmış ayna yenilemeyi bilemez: bitişten sonra yedi gün açık.
    return v_synced < v_bitis and now() < v_bitis + interval '7 days';
  end if;
  return false;
end;
$$;

revoke all on function public.subscription_open() from public, anon, authenticated;
-- RLS politikası çağıranın yetkisiyle çalışır; tetikleyiciler için yetki aranmaz.
grant execute on function public.subscription_open() to anon, authenticated, service_role;
