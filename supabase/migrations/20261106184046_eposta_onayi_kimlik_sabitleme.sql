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
