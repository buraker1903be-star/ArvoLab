-- ============================================================
-- PROFİL KORUMASI: kvkk_onay_at SÜTUNU OLMAYAN VERİTABANINDA DA ÇALIŞIR
-- (29.10.2026).
--
-- 20261029140126 guard_profile_lifecycle'ı new.kvkk_onay_at'e doğrudan
-- başvurarak yazdı. Canlıda o sütun YOK (20260924100026 canlıya hiç
-- uygulanmamış); plpgsql sütunu çalışma anında çözdüğü için migration
-- hatasız geçti ama profiles'taki HER güncelleme şu hatayla düştü:
--   record "new" has no field "kvkk_onay_at"
-- Dil tercihi, ad soyad, silme talebi — kullanıcının profiline yazan her
-- şey. Testler PGlite'ta bütün migration'ları kurduğu için sütun orada
-- vardı ve hata görünmedi.
--
-- Düzeltme: iki sütun da (kvkk_onay_at, silme_talebi_at) jsonb üzerinden
-- okunur — silme_talebi_at da depodaki şema dökümünde yok, canlıda
-- olduğundan emin değiliz. Sütun varsa koruma aynen işler; yoksa iki taraf
-- da NULL'dır ve karşılaştırma geçer. Kurallar değişmedi.
-- ============================================================

create or replace function public.guard_profile_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_yeni_silme timestamptz := (to_jsonb(new) ->> 'silme_talebi_at')::timestamptz;
  v_eski_silme timestamptz := (to_jsonb(old) ->> 'silme_talebi_at')::timestamptz;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if (to_jsonb(new) -> 'kvkk_onay_at') is distinct from (to_jsonb(old) -> 'kvkk_onay_at') then
    raise exception 'KVKK onay kaydı değiştirilemez.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_yeni_silme is distinct from v_eski_silme
     and v_yeni_silme is not null then
    if new.id is distinct from auth.uid() then
      raise exception 'Hesap silme talebini yalnızca hesabın sahibi verebilir.'
        using errcode = 'insufficient_privilege';
    end if;
    if abs(extract(epoch from (v_yeni_silme - now()))) > 120 then
      raise exception 'Silme talebinin zamanı istemciden belirlenemez.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_lifecycle() from public, anon, authenticated;
