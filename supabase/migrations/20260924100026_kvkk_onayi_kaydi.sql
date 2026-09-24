-- ============================================================
-- Aydınlatma metni onayının kaydı.
--
-- ArvoLab kendi kayıt formunu açıyor; bireysel kullanıcı hesabını kendisi
-- oluşturuyor. Onayı ALMAK yetmez, GÖSTEREBİLMEK gerekir: "onayladı mı"
-- sorusuna bir tarihle cevap veremiyorsak onay yok sayılır.
--
-- Zaman damgası auth.users.raw_user_meta_data'dan geliyor (kayıt anında
-- yazılıyor) ve profil satırına kopyalanıyor. İki yerde durması bilinçli:
-- meta veri kullanıcının kendi kaydında, profil ise sorgulanabilir yerde.
--
-- Mevcut kullanıcılar boş kalıyor. Onları geriye dönük "onayladı" saymak,
-- vermedikleri bir onayı kayda geçirmek olurdu.
-- ============================================================

alter table public.profiles
  add column if not exists kvkk_onay_at timestamptz;

comment on column public.profiles.kvkk_onay_at is
  'Kayıt sırasında aydınlatma metninin onaylandığı an; kendi kaydolan kullanıcılarda dolu.';

/*
  Profil satırını açan tetikleyici onay damgasını da taşısın.

  DİKKAT: gövde schema.sql'deki ilk sürüm DEĞİL, 20260924100011'deki güncel
  sürüm esas alınıyor. Onu atlayıp eski gövdeyi yazmak ArvoOS üyeliğinin
  ilk girişte bağlanmasını sessizce kaldırıyordu — bu migration'ı ilk
  yazdığımda tam olarak bu oldu ve tests/db/arvoos-uyelik.test.mjs yakaladı.
  Fonksiyonu bir daha değiştiren, EN SON sürümün üstüne yazmalı.
*/
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, kvkk_onay_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    -- Geçersiz ya da eksik damga null kalır; uydurma tarih yazmaktansa boş.
    case
      when (new.raw_user_meta_data ->> 'kvkk_onay_at') ~ '^\d{4}-\d{2}-\d{2}T'
      then (new.raw_user_meta_data ->> 'kvkk_onay_at')::timestamptz
      else null
    end
  )
  on conflict (id) do nothing;

  -- 20260924100011: e-postası ArvoOS listesindeyse profil kuruma bağlanır.
  begin
    perform public.arvoos_uyeligini_bagla(new.id, new.email);
  exception when others then
    raise warning '[arvoos] üyelik bağlanamadı: %', sqlerrm;
  end;

  return new;
end;
$$;

notify pgrst, 'reload schema';
