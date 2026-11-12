-- ============================================================
-- ÜRETİM UZLAŞTIRMASI — GERİ DÖNÜŞ (R1 ve R3)
--
-- Bu dosya bir migration DEĞİL ve supabase/migrations'a konmaz. Production'a
-- yalnızca bir geri dönüş kararından sonra, SQL Editor'de, adım adım koşulur.
--
-- Aşağıdaki "ESKİ GÖVDE"ler Production'ın 12.11.2026 tarihli kataloğundan
-- (pg_get_functiondef) birebir alındı; satır sonları (bazılarında CRLF)
-- korunmuştur ki geri dönüşten sonraki katalog özeti uzlaştırma öncesiyle
-- AYNI çıksın (scripts/uretim-provasi ile kanıtlandı). Gizli değer ya da
-- kullanıcı verisi içermez.
--
-- SIRA ÖNEMLİ: kod eski sürüme (bd90e5a) döndürülecekse ÖNCE R3 geri
-- alınır. Eski kayıt akışı şifreyi onaydan ÖNCE alıyor; onay tetikleyicisi
-- açık kalırsa o şifre onayda silinir ve kullanıcı kilitlenir.
-- ============================================================


-- ------------------------------------------------------------
-- R3 GERİ DÖNÜŞÜ (G1 kimlik migration'ları: 20261106184046,
-- 20261107113542, 20261107120542)
-- ------------------------------------------------------------
begin;

drop trigger if exists eposta_onayinda_sifreyi_temizle on auth.users;
drop trigger if exists eposta_onayinda_profili_kur on auth.users;
drop function if exists public.eposta_onayinda_sifreyi_temizle();
drop function if exists public.eposta_onayinda_profili_kur();
-- Kod bu fonksiyon yokken ilk şifre kapısını AÇIK bırakır (lib/ilk-sifre.ts).
drop function if exists public.ilk_sifre_gerekli();
drop function if exists public.sifre_durumum();

/*
  arvoos_uyeligini_bagla BİLEREK G1 sürümünde bırakılır: eski gövdeye dönmek
  onaysız bir kaydın kuruma (ve kurum lisansına) bağlanabildiği açığı geri
  getirir. Yine de tam geri dönüş istenirse eski gövde aşağıda, yorum içinde.
  G1 migration'ının onaysız hesapların kurum bağını söken veri güncellemesi
  geri alınamaz; Production'da uygulandığı anda etkileyeceği satır sayısı
  önceden sayılmalıdır (12.11.2026: 0).
*/
/* ESKİ GÖVDE — arvoos_uyeligini_bagla (Production, 12.11.2026):
CREATE OR REPLACE FUNCTION public.arvoos_uyeligini_bagla(p_user_id uuid, p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_organization_id uuid;
  v_ad text;
begin
  if p_email is null or btrim(p_email) = '' then
    return;
  end if;

  select m.organization_id, m.full_name
    into v_organization_id, v_ad
    from public.arvoos_members m
   where m.email = lower(btrim(p_email))
   limit 1;

  if v_organization_id is null then
    return;
  end if;

  /*
    prevent_self_role_escalation, auth.uid() doluyken organization_id
    değişimini system_admin/founder dışına kapatıyor. Bağlama bu kuralın
    dar bir istisnası; bayrak yalnızca burada açılıp hemen kapanıyor.
  */
  perform set_config('arvo.uyelik_baglama', '1', true);
  update public.profiles
     set organization_id = v_organization_id,
         full_name = coalesce(nullif(btrim(full_name), ''), nullif(btrim(v_ad), ''))
   where id = p_user_id
     and organization_id is null;
  perform set_config('arvo.uyelik_baglama', '', true);

  /*
    Ad, KURUMA BAĞLANMIŞ ama adı boş kalmış profillerde de dolduruluyor:
    bu migration'dan önce bağlanmış kişiler (bugün bağlananların hepsi)
    aksi halde e-postayla selamlanmaya devam ederdi. organization_id'ye
    dokunulmadığı için koruma tetiklenmiyor.
  */
  update public.profiles
     set full_name = nullif(btrim(v_ad), '')
   where id = p_user_id
     and organization_id = v_organization_id
     and coalesce(btrim(full_name), '') = ''
     and nullif(btrim(v_ad), '') is not null;
end;
$function$
;
*/

commit;


-- ------------------------------------------------------------
-- R1 GERİ DÖNÜŞÜ (20261112065413_uretim_uzlastirma)
-- ------------------------------------------------------------
begin;

drop trigger if exists guard_support_request_update_trigger on public.app_support_requests;
drop trigger if exists guard_consultancy_request_update_trigger on public.consultancy_requests;

alter table public.profiles alter column role set default 'employee';

-- ESKİ GÖVDE — handle_new_user (Production, 12.11.2026). kvkk_onay_at yazmaz.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ESKİ GÖVDE — best_guideline_for (Production, 12.11.2026). Eşitlik kırıcısız.
CREATE OR REPLACE FUNCTION public.best_guideline_for(p_university_id uuid, p_unit_id uuid, p_department_id uuid, p_organization_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select g.id
  from public.thesis_guidelines g
  where p_university_id is not null
    and g.university_id = p_university_id
    and g.is_active
    and g.approved_snapshot is not null
    and (
      g.organization_id is null
      or (p_organization_id is not null and g.organization_id = p_organization_id)
    )
    and (
      g.academic_unit_id is null
      or g.academic_unit_id = p_unit_id
      or g.academic_unit_id = p_department_id
    )
  order by
    -- Kurumun kendi kılavuzu ortak katalogdan önce gelir.
    case when g.organization_id is not null then 0 else 1 end,
    case
      when p_department_id is not null and g.academic_unit_id = p_department_id then 0
      when p_unit_id is not null and g.academic_unit_id = p_unit_id then 1
      else 2
    end,
    g.effective_from desc nulls last,
    g.approved_snapshot ->> 'approved_at' desc
  limit 1
$function$;

/*
  Sütunlar: YALNIZCA içleri boşsa kaldırılır. Uzlaştırmadan sonra yazılmış
  bir KVKK onay damgası ya da hatırlatma işareti varsa sütun yerinde kalır
  (veri kaybı yok; eski kod bu sütunları okumuyor değil — okuyor ve onları
  bekliyor, yani kalmaları zararsız).
*/
/*
  Sorgular DİNAMİK (execute): plpgsql statik bir sorguyu ilk çalıştırmada
  derler; sütun zaten kaldırılmışsa betiğin ikinci koşusu "column does not
  exist" ile düşüyordu (12.11.2026, P1 provasında yakalandı). Geri dönüş
  betiği yarıda kalmış bir denemeden sonra yeniden koşulabilmeli.
*/
do $$
declare
  v_dolu boolean;
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles' and column_name = 'kvkk_onay_at') then
    execute 'select exists (select 1 from public.profiles where kvkk_onay_at is not null)' into v_dolu;
    if not v_dolu then
      alter table public.profiles drop column kvkk_onay_at;
    else
      raise notice 'profiles.kvkk_onay_at dolu satır içeriyor; sütun korunuyor.';
    end if;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'individual_subscriptions' and column_name = 'deneme_hatirlatildi_at') then
    execute 'select exists (select 1 from public.individual_subscriptions where deneme_hatirlatildi_at is not null)' into v_dolu;
    if not v_dolu then
      drop index if exists public.individual_subscriptions_hatirlatma_idx;
      alter table public.individual_subscriptions drop column deneme_hatirlatildi_at;
    else
      raise notice 'individual_subscriptions.deneme_hatirlatildi_at dolu satır içeriyor; sütun korunuyor.';
    end if;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
