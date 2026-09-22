-- Kurum personelinin adı da ArvoOS'tan geliyor.
--
-- Sorun: ArvoLab'a giren personelin profilinde ad yoktu ve panel
-- "Hoş geldiniz, uzman@akademikmerkez.com" yazıyordu. Ad, ArvoLab'ın
-- kendi kayıt formundan geliyor; ArvoOS üzerinden bağlanan kişi o formu
-- hiç doldurmuyor.
--
-- Ad zaten ArvoOS'ta var (profiles.full_name) ve üye listesiyle birlikte
-- buraya yazılıyor. Bağlama sırasında profile de işleniyor.

alter table public.arvoos_members
  add column if not exists full_name text;

comment on column public.arvoos_members.full_name is
  'ArvoOS''taki adı; bağlanırken profiles.full_name boşsa oradan doldurulur.';

/*
  Bağlama artık adı da yazıyor — ama YALNIZCA profil adı boşsa.

  Kişi ArvoLab'da adını değiştirmişse ArvoOS'un kopyası onu ezmemeli:
  ikisi ayrı ürün ve kişi kendi adını hangisinde düzelttiyse orada
  kalmalı. "Her girişte üzerine yaz" deseydik, ArvoLab'da yapılan
  düzeltme bir sonraki girişte sessizce geri alınırdı.
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
