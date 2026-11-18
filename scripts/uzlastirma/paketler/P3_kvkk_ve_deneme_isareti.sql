-- ============================================================
-- P3_kvkk_ve_deneme_isareti  (RELEASE CLOSURE 06 hazırlık paketi — Production'a UYGULANMADI)
-- Amaç: profiles.kvkk_onay_at ve individual_subscriptions.deneme_hatirlatildi_at sütunları; handle_new_user KVKK onay zamanını yazar. Uygulama (/api/hesabim/verilerim, deneme hatırlatma cron'u) bu sütunlara başvuruyor.
-- ÖN KOŞUL (salt okunur): select column_name from information_schema.columns where table_schema='public' and ((table_name='profiles' and column_name='kvkk_onay_at') or (table_name='individual_subscriptions' and column_name='deneme_hatirlatildi_at'));  -- boş
-- DOĞRULAMA (uygulama sonrası): aynı sorgu iki satır döner; select md5(regexp_replace(prosrc,'\s+','','g')) from pg_proc where proname='handle_new_user';  -- depo sürümü (960976d0…)
-- DURDURMA: Sütunlar oluşmazsa ya da handle_new_user derlenmezse dur. Not: sütunlar NULL eklenir, mevcut satırlara veri yazılmaz.
-- GERİ DÖNÜŞ: işlem tek transaction; hata olursa hiçbir şey kalmaz. Uygulandıktan
--   sonra geri almak için: scripts/uzlastirma/paketler/GERI_DONUS.md
-- Tekrar çalıştırılabilir (create or replace / if not exists / drop … if exists).
-- ============================================================
begin;
-- ===== 20260924100026_kvkk_onayi_kaydi.sql (birebir) =====
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
-- ===== 20260924100027_deneme_hatirlatma_isareti.sql (birebir) =====
-- ============================================================
-- Deneme süresi hatırlatması gönderildi işareti.
--
-- Deneme süresi bugüne kadar SESSİZCE bitiyordu: kullanıcı bunu ancak
-- tezini kaydetmeye çalışıp "aboneliğiniz sona erdi" görünce öğreniyordu.
-- Üründen kopmak için en kötü an; uyarı bitişten önce gelmeli.
--
-- İşaret olmadan hatırlatma her gün yeniden giderdi. Sütun tabloda çünkü
-- kararı veren de bu tablo (bireysel aboneliğin yerel aynası,
-- 20260924100003) ve iki kayıt arasında tutarlılık aramak gerekmesin.
--
-- Tablo yalnızca service_role'a açık; cron da servis anahtarıyla çalışıyor,
-- yeni bir yetki gerekmiyor.
-- ============================================================

alter table public.individual_subscriptions
  add column if not exists deneme_hatirlatildi_at timestamptz;

comment on column public.individual_subscriptions.deneme_hatirlatildi_at is
  'Deneme bitiş hatırlatması gönderildiği an; bir kez gönderilir (app/api/cron/deneme-hatirlatma).';

/*
  Cron'un aradığı satırlar: denemesi süren, bitişi yaklaşan, henüz
  hatırlatılmamış. Kısmi indeks, tablo büyüdükçe taramayı dar tutuyor.
*/
create index if not exists individual_subscriptions_hatirlatma_idx
  on public.individual_subscriptions (trial_ends_at)
  where status = 'trialing' and deneme_hatirlatildi_at is null;

notify pgrst, 'reload schema';

commit;
