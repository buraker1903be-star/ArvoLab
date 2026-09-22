-- ArvoOS üyeleri ArvoLab'a ilk girişte kendiliğinden bağlansın.
--
-- Sorun: ArvoLab lisansı olan bir kurumun (AkademikMerkez) personeli
-- ArvoLab'a girdiğinde profili organization_id = null ile açılıyordu. Kişi
-- ürünün içinde ama hiçbir kuruma bağlı değil: kurumun çalışmalarını
-- göremiyor, kurum da onu göremiyor. Bağlantıyı kurmanın tek yolu elle
-- SQL yazmaktı.
--
-- Çözüm HESAP AÇMAK DEĞİL, BAĞLAMAK. ArvoOS kurumun üye e-postalarını
-- buraya yazıyor (lib/arvolab.ts · pushArvolabMembers); kişi ArvoLab'a
-- kendi kaydolduğunda ya da giriş yaptığında e-postası bu listede
-- bulunuyorsa profili kuruma bağlanıyor.
--
-- Neden önceden hesap açmıyoruz: ArvoLab'ı hiç kullanmayacak kişiler için
-- hayalet hesaplar oluşur, kota gerçeği göstermez ve müşterinin personeline
-- istemedikleri bir davet e-postası gider. Bağlama yaklaşımında kayıt
-- yalnızca gerçekten giren kişi için oluşuyor.
--
-- Rol bilerek 'client' (profiles varsayılanı): en az yetkiyle başlamak,
-- yanlışlıkla geniş yetki vermekten güvenli. Kurum içindeki yükseltmeyi
-- ArvoLab yöneticisi yapar.

-- ---------------------------------------------------------------------------
-- 1) ArvoOS'un ittiği üye listesi
-- ---------------------------------------------------------------------------
-- Bu tablo bir DAVET listesi değil, bir EŞLEŞME listesi: e-posta burada
-- diye kimse ArvoLab'a giremez, yalnızca giren kişi doğru kuruma bağlanır.
create table if not exists public.arvoos_members (
  -- E-posta küçük harfe indirgenmiş tutuluyor; auth tarafında da öyle
  -- saklanıyor ve iki yerde iki ayrı yazım, eşleşmeyen bir satır demek.
  email text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  synced_at timestamptz not null default now()
);

create index if not exists arvoos_members_organization_idx
  on public.arvoos_members (organization_id);

alter table public.arvoos_members enable row level security;

-- Politika YOK: tabloya yalnızca service_role (ArvoOS köprüsü) ve security
-- definer fonksiyon erişiyor. RLS açık ve politikasız olduğu için anon ve
-- authenticated hiçbir satır göremez — kimin hangi kurumda çalıştığı
-- bilgisi müşterinin personel listesidir, ürün içinde okunmamalı.
revoke all on public.arvoos_members from anon, authenticated;
grant select, insert, update, delete on public.arvoos_members to service_role;

-- ---------------------------------------------------------------------------
-- 2) Bağlama
-- ---------------------------------------------------------------------------
-- Profili kuruma bağlar. Zaten bir kuruma bağlıysa DOKUNMAZ: kişi elle
-- başka bir kuruma alınmış olabilir ve bu liste onu geri almamalı.
create or replace function public.arvoos_uyeligini_bagla(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if p_email is null or btrim(p_email) = '' then
    return;
  end if;

  select m.organization_id
    into v_organization_id
    from public.arvoos_members m
   where m.email = lower(btrim(p_email))
   limit 1;

  if v_organization_id is null then
    return;
  end if;

  /*
    prevent_self_role_escalation, auth.uid() doluyken organization_id
    değişimini system_admin/founder dışına kapatıyor — doğru bir kural:
    aksi halde herkes PostgREST'ten kendini istediği kuruma yazardı.
    Bağlama bu kuralın istisnası ve istisna DAR tutuluyor: işlem boyunca
    yaşayan bir bayrak, yalnızca bu fonksiyonun içinde açılıp hemen
    kapanıyor. Korumayı "null'dan doluya geçişe izin ver" diye gevşetmek,
    tam da kapattığı deliği geri açardı.
  */
  perform set_config('arvo.uyelik_baglama', '1', true);
  update public.profiles
     set organization_id = v_organization_id
   where id = p_user_id
     and organization_id is null;
  perform set_config('arvo.uyelik_baglama', '', true);
end;
$$;

/*
  Korumaya DAR bir istisna.

  Gövdenin geri kalanı 20260924100001'deki sertleştirilmiş haliyle birebir
  aynı — "kimse kendi rolünü değiştiremez" ve "Kurucu rolünü yalnızca
  Kurucu verir" kuralları dahil. Bu fonksiyonu eski gövdesiyle yeniden
  yazmak o iki kuralı sessizce geri alırdı; tests/db/guvenlik.test.mjs
  tam bu yüzden var ve bu migration yazılırken de yakaladı.

  İstisna yalnızca: bağlama bayrağı açıkken VE rol değişmiyorken.
*/
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Bayrağı yalnızca arvoos_uyeligini_bagla açıyor ve işlem bitince
  -- kendiliğinden kayboluyor (set_config ... true = işlem yerel).
  -- Rol değişimine dokunmuyor: yalnızca kurumsuz profili kuruma bağlar.
  if current_setting('arvo.uyelik_baglama', true) = '1'
     and new.role is not distinct from old.role
     and old.organization_id is null then
    return new;
  end if;

  if (new.role is distinct from old.role or new.organization_id is distinct from old.organization_id)
     and not public.has_role(array['system_admin','founder']::public.user_role[]) then
    raise exception 'Rol veya kurum değişikliği için yetkiniz yok.' using errcode = '42501';
  end if;

  if new.role is distinct from old.role and new.id = auth.uid() then
    raise exception 'Kendi rolünüzü değiştiremezsiniz; başka bir yöneticiden isteyin.' using errcode = '42501';
  end if;

  -- Kurucu rolü (verilmesi, alınması ya da Kurucunun kurumunun değişmesi) yalnızca Kurucuda.
  if (new.role is distinct from old.role or new.organization_id is distinct from old.organization_id)
     and (new.role = 'founder' or old.role = 'founder')
     and not public.has_role(array['founder']::public.user_role[]) then
    raise exception 'Kurucu rolünü yalnızca bir Kurucu atayabilir veya kaldırabilir.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.arvoos_uyeligini_bagla(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Yeni kayıtta kendiliğinden
-- ---------------------------------------------------------------------------
-- handle_new_user profili açıyor; hemen ardından bağlama denemesi.
-- Tetikleyici içinde çalıştığı için hata akışı düşürmemeli: bağlanamazsa
-- kişi ArvoLab'a yine girebilmeli, yalnızca kurumsuz kalır.
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

-- ---------------------------------------------------------------------------
-- 4) Zaten kayıtlı olanlar için
-- ---------------------------------------------------------------------------
-- Tetikleyici yalnızca YENİ kayıtta çalışıyor. ArvoLab'a listeden önce
-- kaydolmuş kişiler (bugün var olanların hepsi) kurumsuz kalırdı; giriş
-- yapan kullanıcı kendi profilini bir kez bağlayabilsin.
--
-- Kendi kimliğiyle ve kendi e-postasıyla çalışıyor: parametre almıyor, yani
-- başkasının profilini bağlamak için çağrılamaz.
create or replace function public.arvoos_uyeligimi_bagla()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    return;
  end if;

  select u.email into v_email from auth.users u where u.id = auth.uid();
  perform public.arvoos_uyeligini_bagla(auth.uid(), v_email);
end;
$$;

revoke all on function public.arvoos_uyeligimi_bagla() from public, anon;
grant execute on function public.arvoos_uyeligimi_bagla() to authenticated;
