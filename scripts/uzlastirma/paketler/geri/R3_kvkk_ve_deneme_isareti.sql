-- ============================================================
-- R3 — P3_kvkk_ve_deneme_isareti paketinin GERİ DÖNÜŞÜ (RELEASE CLOSURE 06; Production'a UYGULANMADI)
-- handle_new_user Production'daki 20260924100011 gövdesine döner (md5 Aşama 1'de eşlendi). SÜTUNLAR VARSAYILAN OLARAK KALIR: kvkk_onay_at uygulandıktan sonra yazılan KVKK onay zamanlarını taşır (yasal kayıt); düşürmek veri kaybıdır. Tam şema geri dönüşü yalnızca 'psql -v tam=1' ile (önce sütunun yedeğini alın).
-- Tek işlem: hata olursa hiçbir şey değişmez. Tekrar çalıştırılabilir.
-- Sınandığı yer: scripts/uzlastirma/prova-geri.sh (paket + geri dönüş = paketten önceki şema özeti).
-- ============================================================
begin;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  begin
    perform public.arvoos_uyeligini_bagla(new.id, new.email);
  exception when others then
    raise warning '[arvoos] üyelik bağlanamadı: %', sqlerrm;
  end;

  return new;
end;
$$;
\if :{?tam}
  -- VERİ KAYBI: KVKK onay zamanları ve deneme hatırlatma işaretleri silinir.
  drop index if exists public.individual_subscriptions_hatirlatma_idx;
  alter table public.individual_subscriptions drop column if exists deneme_hatirlatildi_at;
  alter table public.profiles drop column if exists kvkk_onay_at;
\endif
commit;
