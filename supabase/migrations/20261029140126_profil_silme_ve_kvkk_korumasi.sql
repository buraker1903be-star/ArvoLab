-- ============================================================
-- PROFİLDE SİLME TALEBİ VE KVKK ONAYI KORUMASI (29.10.2026).
--
-- RLS "kim yazabilir"i söyler, "neyi"yi söylemez: profiles'a UPDATE
-- yetkisi olan kullanıcı PostgREST'ten kendi satırının her sütununu
-- yazabiliyordu. prevent_self_role_escalation yalnızca role ve
-- organization_id'yi koruyor; iki sütun açıktaydı:
--
--   silme_talebi_at (20260925110522): oturum jetonu olan biri
--     {"silme_talebi_at":"2000-01-01"} yazınca bir sonraki cron turu
--     hesabı KALICI olarak siliyordu. 30 günlük bekleme, ele geçirilmiş
--     hesabı korumak için var (lib/hesap-silme.ts); e-postayı yazarak
--     onaylama adımı da (app/actions/hesap.ts) böylece atlanıyordu.
--   kvkk_onay_at (20260924100026): aydınlatma onayının kanıtı;
--     silinebiliyor ya da geriye tarihlenebiliyordu.
--
-- Kural: oturumla gelen güncellemede
--   * kvkk_onay_at değişmez (kayıtta handle_new_user yazar, INSERT);
--   * silme_talebi_at ya boşaltılır (vazgeçme), ya aynı kalır, ya da
--     ŞİMDİ ile doldurulur — yalnızca kişinin KENDİ satırında. Yönetici
--     rolündeki biri başkasının hesabı için silme başlatamaz.
--
-- Ayrı bir tetikleyici: rol korumasının gövdesine dokunmuyor (o gövde
-- köprü bayraklarıyla birlikte 20260924100011'de; kopyalanırsa sapar).
-- Çağıranın rolüne baktığı için security INVOKER (current_user).
-- ============================================================

create or replace function public.guard_profile_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.kvkk_onay_at is distinct from old.kvkk_onay_at then
    raise exception 'KVKK onay kaydı değiştirilemez.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.silme_talebi_at is distinct from old.silme_talebi_at
     and new.silme_talebi_at is not null then
    if new.id is distinct from auth.uid() then
      raise exception 'Hesap silme talebini yalnızca hesabın sahibi verebilir.'
        using errcode = 'insufficient_privilege';
    end if;
    if abs(extract(epoch from (new.silme_talebi_at - now()))) > 120 then
      raise exception 'Silme talebinin zamanı istemciden belirlenemez.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_lifecycle() from public, anon, authenticated;

drop trigger if exists guard_profile_lifecycle_trigger on public.profiles;
create trigger guard_profile_lifecycle_trigger
  before update on public.profiles
  for each row execute function public.guard_profile_lifecycle();
