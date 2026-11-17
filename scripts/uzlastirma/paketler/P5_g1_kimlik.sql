-- ============================================================
-- P5_g1_kimlik  (RELEASE CLOSURE 06 hazırlık paketi — Production'a UYGULANMADI)
-- Amaç: G1: e-posta onayında şifre temizleme ve profil kurma tetikleyicileri (auth.users), arvoos_uyeligini_bagla'nın onaya bağlı sürümü, ilk şifre kapısı (ilk_sifre_gerekli). VERİ ADIMI: onaysız hesapların kurum bağı sökülür (17.11.2026 ölçümü: etkilenecek satır 0).
-- ÖN KOŞUL (salt okunur, UYGULAMA PENCERESİNDE YENİDEN ÖLÇÜLÜR — 17.11.2026'daki 0 kalıcı varsayım DEĞİL):
--   select count(*) from auth.users where email_confirmed_at is null;  -- onaysız hesap
--   select p.id from public.profiles p join auth.users u on u.id=p.id where u.email_confirmed_at is null and p.organization_id is not null;
--     -- veri adımının sökeceği kurum bağları: KİMLİK LİSTESİ uygulamadan hemen önce kaydedilir (geri dönüşün tek yolu).
--     -- 0 değilse: listeyi kaydet, kurum yöneticisiyle doğrula, P5'i o pencerede yeniden değerlendir.
--   GoTrue OTP süresi 3600 sn doğrulanmış olmalı (UNVERIFIED; panel: Authentication → Providers → Email).
-- DOĞRULAMA (uygulama sonrası): select tgname from pg_trigger where tgrelid='auth.users'::regclass and tgname like 'eposta_onayinda_%';  -- 2 satır; select proname from pg_proc where proname='ilk_sifre_gerekli';  -- 1 satır; ardından PostgREST şema önbelleği yenilenmeli (paketin notify satırı) ve uygulamada ilk şifre kapısı sınanmalı
-- DURDURMA: auth.users'a tetikleyici eklenemezse (yetki) ya da veri adımı beklenenden fazla satır etkilerse işlemi geri al ve dur.
-- GERİ DÖNÜŞ: işlem tek transaction; hata olursa hiçbir şey kalmaz. Uygulandıktan
--   sonra geri almak için: scripts/uzlastirma/paketler/GERI_DONUS.md
-- Tekrar çalıştırılabilir (create or replace / if not exists / drop … if exists).
-- ============================================================
begin;
-- ===== 20261106184046_eposta_onayi_kimlik_sabitleme.sql (birebir) =====
/*
  G1 — HESAP ÖN-ELE GEÇİRMEYE KARŞI KİMLİK SABİTLEME (06.11.2026)

  Neden: bir e-posta adresini bilen herkes o adresle ONAYSIZ bir hesap açıp
  şifre koyabiliyordu (ArvoLab /kayit, ya da doğrudan Supabase /auth/v1/signup).
  Adresin gerçek sahibi daha sonra e-postasını doğruladığında —kendi /kayit
  bağlantısıyla ya da ArvoOS'un "ArvoLab'a geç" magic link'iyle— hesap
  onaylanıyor ve ÖNCEDEN konmuş şifre geçerli kalıyordu. Test projesinde
  (GoTrue v2.197.0) üç yoldan da doğrulandı. Ayrıca profil, e-posta
  onaylanmadan ArvoOS üyelik listesindeki kuruma bağlanıyordu.

  Kural (değişmez): e-posta kontrolü kanıtlanmadan önce konmuş hiçbir şifre
  ve hiçbir kurum bağı, kanıttan sonra geçerli olamaz.

  Neden VERİTABANINDA: hesap üç ayrı kapıdan doğabiliyor (ArvoLab sunucu
  eylemi, ArvoOS'un yönetici çağrıları, herkese açık /auth/v1/signup) ve
  onay iki ayrı GoTrue yolundan geçiyor (signup doğrulaması, magic link /
  recovery doğrulaması). Uygulama katmanındaki bir düzeltme yalnızca kendi
  kapısını korur; doğrudan /signup'ı ve ArvoOS yolunu kapatmaz (Test'te
  ayrıca gösterildi). Onay anı ise her yolda aynı satır güncellemesi:
  auth.users.email_confirmed_at NULL → dolu. Kural orada uygulanıyor.

  GoTrue PR #2887 (30.10.2026) aynı fikri yalnızca magic link/recovery
  doğrulamasında uyguluyor; signup doğrulamasında uygulamıyor ve Test'teki
  sürümde (v2.197.0) yok. Bu tetikleyici sürümden bağımsız.
*/

/*
  1) Onay anında, onaydan ÖNCE konmuş şifre silinir.

  Meşru kullanıcı etkilenmez: kayıt artık şifreyi onaydan SONRA alıyor
  (app/actions/auth.ts signUp: hesap tahmin edilemez rastgele bir şifreyle
  açılır, doğrulama bağlantısı şifre belirleme sayfasına gider). Davet
  akışı zaten böyle (davetli şifreyi bağlantıdan sonra belirliyor).
  Onaylı hesapta (email_confirmed_at zaten dolu) hiçbir şey değişmez: e-posta
  değişikliği, şifre sıfırlama, yönetici güncellemesi bu dala girmez.
  NULL, GoTrue'nun "şifresi yok" saydığı değer (PR #2887 de NULL yazıyor);
  şifreyle giriş bu hesapta invalid_credentials döner.
*/
create or replace function public.eposta_onayinda_sifreyi_temizle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    new.encrypted_password := null;
  end if;
  return new;
end;
$$;

revoke all on function public.eposta_onayinda_sifreyi_temizle() from public, anon, authenticated;

drop trigger if exists eposta_onayinda_sifreyi_temizle on auth.users;
create trigger eposta_onayinda_sifreyi_temizle
  before update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.eposta_onayinda_sifreyi_temizle();

/*
  2) Kurum bağı yalnızca e-postası onaylı hesaba.

  arvoos_uyeligini_bagla üç yerden çağrılıyor: handle_new_user (hesap
  INSERT'i), arvoos_uyeligimi_bagla (oturumlu her istek) ve aşağıdaki onay
  tetikleyicisi. Denetim fonksiyonun içinde: hangi kapıdan gelinirse
  gelinsin onaysız hesap kuruma bağlanmaz. ArvoOS'un açtığı hesap
  (createUser email_confirm: true) INSERT anında onaylı olduğu için ilk
  girişte bağlanmaya devam eder. Gövdenin geri kalanı 20260924100015 ile
  aynı.
*/
create or replace function public.arvoos_uyeligini_bagla(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_ad text;
begin
  if p_email is null or btrim(p_email) = '' then
    return;
  end if;

  -- G1: e-posta sahipliği kanıtlanmadan kurum bağı (ve kurum lisansı) yok.
  if not exists (
    select 1 from auth.users u
     where u.id = p_user_id
       and u.email_confirmed_at is not null
  ) then
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

  update public.profiles
     set full_name = nullif(btrim(v_ad), '')
   where id = p_user_id
     and organization_id = v_organization_id
     and coalesce(btrim(full_name), '') = ''
     and nullif(btrim(v_ad), '') is not null;
end;
$$;

revoke all on function public.arvoos_uyeligini_bagla(uuid, text) from public, anon, authenticated;

/*
  3) Onay anında: profil adı ve kurum bağı.

  Onaysız dönemde profil adını kim yazdıysa (adresi bilen herhangi biri)
  o ad kalıyordu ve kurumun üye listesinde gerçek kişinin yerine
  görünüyordu. Onay anında ad yeniden kurulur: önce ArvoOS'un bildiği ad
  (kurumun kaydı), yoksa doğrulanan bağlantıyı üreten son kayıt isteğinin
  adı. Sonra kurum bağı — artık onaylı olduğu için kurulur.
  Hata onayı DÜŞÜRMEZ (yalnızca uyarı): kişi e-postasını kanıtladı, girişini
  bir yan işlem engellememeli.
*/
create or replace function public.eposta_onayinda_profili_kur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ad text;
begin
  begin
    select nullif(btrim(m.full_name), '')
      into v_ad
      from public.arvoos_members m
     where m.email = lower(btrim(new.email))
     limit 1;
    v_ad := coalesce(v_ad, nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''));
    if v_ad is not null then
      update public.profiles set full_name = v_ad where id = new.id and full_name is distinct from v_ad;
    end if;

    perform public.arvoos_uyeligini_bagla(new.id, new.email);
  exception when others then
    raise warning '[g1] onay sonrası profil kurulamadı: %', sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.eposta_onayinda_profili_kur() from public, anon, authenticated;

drop trigger if exists eposta_onayinda_profili_kur on auth.users;
create trigger eposta_onayinda_profili_kur
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.eposta_onayinda_profili_kur();

/*
  4) Mevcut ONAYSIZ hesapların kurum bağı sökülür.

  Bu migration'dan önce açılmış onaysız hesaplar INSERT anında kuruma
  bağlanmıştı; bunlar ya terk edilmiş kayıtlar ya da başkasının adresiyle
  açılmış hesaplar. Bağ, onay anında (3) yeniden ve doğru kişiyle kurulur.
  Onaylı hiçbir hesaba dokunulmaz. Bayrak: prevent_self_role_escalation
  istisnası (aynı dar kapı).
*/
select set_config('arvo.uyelik_baglama', '1', true);
update public.profiles p
   set organization_id = null
  from auth.users u
 where u.id = p.id
   and u.email_confirmed_at is null
   and p.organization_id is not null;
select set_config('arvo.uyelik_baglama', '', true);
-- ===== 20261107120542_ilk_sifre_gerekli.sql (birebir) =====
/*
  G1 İLK ŞİFRE KAPISI: "bu oturumun şifre belirlemesi gerekiyor mu?" (07.11.2026)

  20261107113542 yalnızca "şifre var mı" diyordu; kapı da AMR'ye bakıp ArvoOS
  magic link oturumunu (bilerek şifresiz) ayırmaya çalışıyordu. Test'te
  görüldü: token_hash ile yapılan HER doğrulama (kayıt, davet, kurtarma,
  magic link) oturuma aynı AMR'yi yazıyor ("otp"), yani AMR kayıt
  kullanıcısıyla ArvoOS üyesini ayıramıyor — şifresiz kayıt kullanıcısı
  kapıdan geçiyordu. Ayrım artık veride: şifre yok VE e-posta ArvoOS'un
  ittiği üye listesinde değil → şifre belirlemeli. ArvoOS üyesi ArvoOS
  üzerinden magic link ile giriyor; ondan şifre istenmez.

  PARAMETRE ALMIYOR: yalnızca çağıranın kendi hesabı; yalnızca evet/hayır
  döner (şifre, özet ya da üye listesi sızmaz).
*/
create or replace function public.ilk_sifre_gerekli()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.encrypted_password, '') = ''
     and not exists (
       select 1 from public.arvoos_members m
        where m.email = lower(btrim(u.email))
     )
    from auth.users u
   where u.id = auth.uid();
$$;

revoke all on function public.ilk_sifre_gerekli() from public, anon, authenticated;
grant execute on function public.ilk_sifre_gerekli() to authenticated;

-- Yerini aldı; çağıranı kalmadı (açık bir fonksiyonu boşta bırakmayalım).
drop function if exists public.sifre_durumum();

commit;
