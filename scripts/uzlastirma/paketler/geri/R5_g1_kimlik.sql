-- ============================================================
-- R5 — P5_g1_kimlik paketinin GERİ DÖNÜŞÜ (RELEASE CLOSURE 06; Production'a UYGULANMADI)
-- auth.users tetikleyicileri ve G1 fonksiyonları kalkar, arvoos_uyeligini_bagla Production'daki 20260924100015 gövdesine döner. VERİ ADIMI GERİ ALINMAZ: P5'in onaysız hesaplardan kaldırdığı kurum bağları (17.11'de 0 satır) yalnızca uygulamadan önce ön koşul sorgusuyla kaydedilen listeden elle geri konabilir. Yeni kod ilk_sifre_gerekli'yi çağırıyor: KOD GERİ ALINMADAN bu dönüş yapılmamalı.
-- Tek işlem: hata olursa hiçbir şey değişmez. Tekrar çalıştırılabilir.
-- Sınandığı yer: scripts/uzlastirma/prova-geri.sh (paket + geri dönüş = paketten önceki şema özeti).
-- ============================================================
begin;
drop trigger if exists eposta_onayinda_sifreyi_temizle on auth.users;
drop trigger if exists eposta_onayinda_profili_kur on auth.users;
drop function if exists public.eposta_onayinda_sifreyi_temizle();
drop function if exists public.eposta_onayinda_profili_kur();
drop function if exists public.ilk_sifre_gerekli();
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
$$;
revoke all on function public.arvoos_uyeligini_bagla(uuid, text) from public, anon, authenticated;
commit;
