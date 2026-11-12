-- ============================================================
-- ÜRETİM UZLAŞTIRMASI (R1) — 12.11.2026
--
-- Neden: Production (zpfpocyajnxcketdjbxm) şeması SQL Editor'den elle
-- kuruldu; migration geçmişinde yalnızca Ağustos'tan 12 kayıt var ve
-- hiçbiri bu deponun sürüm adlarıyla eşleşmiyor. 12.11.2026'da iki
-- projenin kataloğu salt okunur karşılaştırıldı (fonksiyon gövdeleri,
-- tetikleyiciler, politikalar, sütunlar, kısıtlar, dizinler, yetkiler).
-- 107 migration'ın 77'sinin etkisi Production'da birebir var; aşağıdakiler
-- EKSİK ya da ESKİ kaldı ve kod onlara dayanıyor:
--
--   1. profiles.kvkk_onay_at yok (20260924100026 uygulanmamış). KVKK veri
--      indirme (/api/hesabim/verilerim) bu sütunu seçtiği için Production'da
--      düşüyor; kayıttaki onay profile hiç yazılmıyor (handle_new_user eski).
--   2. individual_subscriptions.deneme_hatirlatildi_at yok (20260924100027).
--      Deneme hatırlatma cron'u her koşuda bu sütunu süzdüğü için düşüyor.
--   3. guard_support_request_update ve guard_consultancy_request_update
--      fonksiyonları VAR ama tetikleyicileri bağlı değil (20260913120000):
--      kullanıcı kendi destek talebinin durumunu/yanıt notunu, uzman
--      talebinin durumunu ve atanan uzmanı API'den yazabiliyor.
--   4. best_guideline_for eşitlikte kararlı değil (20260926131150).
--   5. profiles.role varsayılanı Production'da 'employee', depoda 'client'.
--      Ürün kararı (12.11.2026): yeni kullanıcı 'client' açılır; personel
--      yetkisi yalnızca yetkili yöneticinin işlemiyle verilir. 'employee'
--      abonelik kapısından geçen bir rol (AGENTS.md) — kendi kaydolan
--      herkesi personel saymak kapıyı fiilen açıyordu. MEVCUT profillerin
--      rolüne DOKUNULMAZ; yalnızca varsayılan değişir.
--
-- Bilinçli olarak YAPILMAYANLAR:
--   * Eski hesapların kvkk_onay_at'i geriye doldurulmaz (ürün kararı):
--     kanıtı olmayan onay kaydı, verilmemiş bir onayı kayda geçirmek olur.
--   * Yetkiler genişletilmez. Production'ın tablo, sütun ve fonksiyon
--     yetkileri Supabase varsayılanından DARDIR ve korunur. Bu dosya yeni
--     fonksiyon ya da tablo yaratmaz; create or replace mevcut yetkiyi
--     korur, eklenen sütun tablonun mevcut yetkisini kullanır. Yeni bir
--     nesne gerektiğinde Production'ın varsayılan yetkisi (yalnızca
--     postgres) ona hiçbir rol vermez — yetkiyi açıkça yazın.
--   * Akademik dizin hattı (academic_programs, data_sources, farklı staging
--     sütunları, 17 bin birim) Production'a özgü ve gerçek veri; buraya
--     girmez.
--   * G1 kimlik migration'ları (20261106184046, 20261107113542,
--     20261107120542) ayrı adımdır (R3): auth.users tetikleyicisi YENİ kod
--     canlıdayken ve onaysız hesap sayısı 0 iken uygulanır.
--
-- İdempotent: Test'te (her şey zaten uygulanmış) ve Production'da iki kez
-- koşmak aynı sonucu verir. Geri dönüş: docs/uretim-duzeltmeleri/
-- uretim-uzlastirma-geri-donus.sql (Production'daki eski gövdeler orada).
-- ============================================================

-- 1) Eksik sütunlar. NULL'lanabilir ve varsayılansız: yalnızca katalog
--    değişir, tablo yeniden yazılmaz.
alter table public.profiles
  add column if not exists kvkk_onay_at timestamptz;

comment on column public.profiles.kvkk_onay_at is
  'Kayıt sırasında aydınlatma metninin onaylandığı an; kendi kaydolan kullanıcılarda dolu.';

alter table public.individual_subscriptions
  add column if not exists deneme_hatirlatildi_at timestamptz;

comment on column public.individual_subscriptions.deneme_hatirlatildi_at is
  'Deneme bitiş hatırlatması gönderildiği an; bir kez gönderilir (app/api/cron/deneme-hatirlatma).';

create index if not exists individual_subscriptions_hatirlatma_idx
  on public.individual_subscriptions (trial_ends_at)
  where status = 'trialing' and deneme_hatirlatildi_at is null;

-- 2) Yeni kullanıcının rolü 'client' (ürün kararı). Mevcut satırlar aynen kalır.
alter table public.profiles
  alter column role set default 'client';

-- 3) Profil satırını açan tetikleyici onay damgasını da taşısın.
--    Gövde 20260924100026'nın (Test'teki canlı gövde) BİREBİR aynısı;
--    ArvoOS bağlamasını içeren en son sürüm. Rol yazılmıyor: varsayılan
--    (2) uygulanıyor.
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

-- 4) Bağlı olmayan iki koruma tetikleyicisi. Fonksiyonlar Production'da
--    zaten var (gövdeleri Test'tekiyle mantıkça aynı); yalnızca bağlanıyor.
drop trigger if exists guard_support_request_update_trigger on public.app_support_requests;
create trigger guard_support_request_update_trigger
  before update on public.app_support_requests
  for each row execute function public.guard_support_request_update();

drop trigger if exists guard_consultancy_request_update_trigger on public.consultancy_requests;
create trigger guard_consultancy_request_update_trigger
  before update on public.consultancy_requests
  for each row execute function public.guard_consultancy_request_update();

-- 5) Kılavuz seçiminde eşitlik kırıcıları (20260926131150'nin gövdesi).
create or replace function public.best_guideline_for(
  p_university_id uuid,
  p_unit_id uuid,
  p_department_id uuid,
  p_organization_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
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
    g.approved_snapshot ->> 'approved_at' desc,
    -- Buradan sonrası KARARLILIK için: toplu onayda approved_at eşitlenir.
    g.created_at desc,
    g.id
  limit 1
$$;

-- 6) Son durum denetimi: beklenen hâl yoksa işlem geri alınır (yarım
--    uzlaştırma bırakmamak için). Production'da SQL Editor tek işlemde koşar.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'kvkk_onay_at') then
    raise exception 'uzlaştırma: profiles.kvkk_onay_at yok';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'individual_subscriptions' and column_name = 'deneme_hatirlatildi_at') then
    raise exception 'uzlaştırma: individual_subscriptions.deneme_hatirlatildi_at yok';
  end if;
  -- Biçimden bağımsız: arama yoluna göre 'client'::user_role ya da 'client'::public.user_role yazılır.
  if coalesce((select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'), '') !~ '^''client''::' then
    raise exception 'uzlaştırma: profiles.role varsayılanı client değil';
  end if;
  if (select count(*) from pg_trigger
       where tgname in ('guard_support_request_update_trigger', 'guard_consultancy_request_update_trigger')
         and not tgisinternal) <> 2 then
    raise exception 'uzlaştırma: koruma tetikleyicileri eksik';
  end if;
end;
$$;

notify pgrst, 'reload schema';
