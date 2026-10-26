-- BİREYSEL ABONENİN AI KREDİSİ (26.10.2026, kurum sahibinin kararı:
-- "aylık hak + ek paket", aylık 1.000 kredi, paketler kurumla aynı).
--
-- Kredi bugüne kadar YALNIZCA kuruma bağlıydı (20260924100013–17):
-- bakiye, aylık yenileme ve satın alma kurum satırında. Kurumu olmayan
-- bireysel abonenin hesabı yoktu; ai_kredi_dus onu "kurumu yok" diye
-- atlıyor, asistan yalnızca saatlik hakla sınırlanıyordu. Ek kredi
-- satabilmek için önce bir hak tanımlanmalıydı.
--
-- Model kurumdakinin AYNISI, kişiye bağlı:
--   aylik_kalan — her ay başında ai_bireysel_aylik_hak() ile yenilenir,
--                 kullanılmayan yanar.
--   ek_bakiye   — satın alınan kredi; YANMAZ.
-- Tüketim önce aylık haktan, sonra bakiyeden düşer.
--
-- KİM BİREYSEL: kurumu olmayan (organization_id null) ve rolü 'client'
-- olan kullanıcı. Kurumsuz personel (iç ekip, uzman) eskisi gibi
-- sınırsız: onlar müşteri değil.
--
-- Satın alma ArvoOS'ta (PayTR); ödeme onaylanınca ArvoOS
-- ai_bireysel_kredi_yukle'yi çağırıyor. Kurumdaki ai_kredi_yukle ile
-- aynı tekilleştirme: aynı ödeme kimliği ikinci kez kredi eklemez.

-- ---------------------------------------------------------------------------
-- Aylık hak: tek yerde
-- ---------------------------------------------------------------------------
/*
  Sabit bir fonksiyonda, tabloda değil: tek sayı ve nadiren değişiyor;
  değişikliği bir migration'la yapmak ne zaman ve neden değiştiğinin
  izini de bırakıyor. Kurumda bu sayı ArvoOS'tan geliyor (paket);
  bireysel abonenin paketi yok, hak abonelikle birlikte geliyor.
*/
create or replace function public.ai_bireysel_aylik_hak()
returns bigint
language sql
immutable
set search_path = ''
as $$ select 1000::bigint $$;

revoke all on function public.ai_bireysel_aylik_hak() from public, anon, authenticated;

-- Kullanıcı bireysel abone mi (kurumsuz müşteri)?
create or replace function public.ai_bireysel_mi(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.organization_id is null and p.role = 'client'
      from public.profiles p where p.id = p_user_id
  ), false)
$$;

revoke all on function public.ai_bireysel_mi(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hesap ve defter
-- ---------------------------------------------------------------------------
create table if not exists public.ai_bireysel_kredi_hesabi (
  user_id uuid primary key references auth.users(id) on delete cascade,
  donem date not null default date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date,
  aylik_kalan bigint not null default 0 check (aylik_kalan >= 0),
  ek_bakiye bigint not null default 0 check (ek_bakiye >= 0),
  updated_at timestamptz not null default now()
);

/* Defter: her hareketin izi. Kullanıcı itiraz ettiğinde gösterebileceğimiz
   tek şey bu; Abonelik sayfası da son hareketleri buradan gösteriyor. */
create table if not exists public.ai_bireysel_kredi_hareketleri (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tur text not null check (tur in ('yukleme', 'tuketim', 'yenileme')),
  kredi bigint not null,
  kaynak text,
  created_at timestamptz not null default now()
);

create unique index if not exists ai_bireysel_kredi_hareketleri_kaynak_idx
  on public.ai_bireysel_kredi_hareketleri (tur, kaynak) where kaynak is not null;
create index if not exists ai_bireysel_kredi_hareketleri_kisi_idx
  on public.ai_bireysel_kredi_hareketleri (user_id, created_at desc);

alter table public.ai_bireysel_kredi_hesabi enable row level security;
alter table public.ai_bireysel_kredi_hareketleri enable row level security;

/*
  Politika YOK (kurumdakiyle aynı gerekçe): bakiyeyi yalnızca tetikleyici
  ve ArvoOS köprüsü değiştirir. Kullanıcı kendi durumunu
  ai_kredi_durumum() ve ai_bireysel_kredi_hareketlerim() ile okur.
*/
revoke all on public.ai_bireysel_kredi_hesabi from anon, authenticated;
revoke all on public.ai_bireysel_kredi_hareketleri from anon, authenticated;
grant select, insert, update on public.ai_bireysel_kredi_hesabi to service_role;
grant select, insert on public.ai_bireysel_kredi_hareketleri to service_role;

-- ---------------------------------------------------------------------------
-- Hesabı hazırla: yoksa aç, ay değiştiyse aylık hakkı yenile
-- ---------------------------------------------------------------------------
create or replace function public.ai_bireysel_hesabini_hazirla(p_user_id uuid)
returns public.ai_bireysel_kredi_hesabi
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bu_ay date := date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date;
  v_hak bigint := public.ai_bireysel_aylik_hak();
  v_hesap public.ai_bireysel_kredi_hesabi;
begin
  insert into public.ai_bireysel_kredi_hesabi (user_id, donem, aylik_kalan)
  values (p_user_id, v_bu_ay, v_hak)
  on conflict (user_id) do nothing;

  select * into v_hesap from public.ai_bireysel_kredi_hesabi where user_id = p_user_id;

  -- Ay değiştiyse aylık hak yenilenir; kullanılmayan kısım YANAR.
  if v_hesap.donem < v_bu_ay then
    update public.ai_bireysel_kredi_hesabi
       set donem = v_bu_ay, aylik_kalan = v_hak, updated_at = now()
     where user_id = p_user_id
    returning * into v_hesap;

    insert into public.ai_bireysel_kredi_hareketleri (user_id, tur, kredi, kaynak)
    values (p_user_id, 'yenileme', v_hak, p_user_id::text || ':' || to_char(v_bu_ay, 'YYYY-MM'));
  end if;

  return v_hesap;
end;
$$;

revoke all on function public.ai_bireysel_hesabini_hazirla(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tüketim: tetikleyici bireysel aboneyi de düşüyor
-- ---------------------------------------------------------------------------
/*
  Kurum dalı 20260924100014'tekinin AYNISI. Eskiden kurumu olmayan
  kullanıcıda fonksiyon hemen dönüyordu; şimdi bireysel aboneyse kendi
  hesabından düşüyor. Akışı yine düşürmüyor: bakiye yazılamazsa çalışma
  kaydedilir, uyarı log'a gider.
*/
create or replace function public.ai_kredi_dus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_kredi bigint;
  v_hesap public.ai_kredi_hesabi;
  v_kisi public.ai_bireysel_kredi_hesabi;
  v_aylik bigint;
  v_ek bigint;
begin
  if new.status <> 'completed' then
    return new;
  end if;

  -- Başlanan dilim tam sayılır: 1 karakterlik çalışmanın da maliyeti var.
  v_kredi := ceil((coalesce(new.prompt_chars, 0) + coalesce(new.output_chars, 0))::numeric / 1000);
  if v_kredi <= 0 then
    return new;
  end if;

  select p.organization_id into v_org from public.profiles p where p.id = new.user_id;

  if v_org is null then
    -- Kurumsuz personel (iç ekip, uzman) sınırsız; yalnızca bireysel abone düşer.
    if not public.ai_bireysel_mi(new.user_id) then
      return new;
    end if;
    begin
      v_kisi := public.ai_bireysel_hesabini_hazirla(new.user_id);
      v_aylik := least(v_kisi.aylik_kalan, v_kredi);
      v_ek := least(v_kisi.ek_bakiye, v_kredi - v_aylik);
      update public.ai_bireysel_kredi_hesabi
         set aylik_kalan = aylik_kalan - v_aylik,
             ek_bakiye = ek_bakiye - v_ek,
             updated_at = now()
       where user_id = new.user_id;
      insert into public.ai_bireysel_kredi_hareketleri (user_id, tur, kredi, kaynak)
      values (new.user_id, 'tuketim', v_kredi, new.id::text);
    exception when others then
      raise warning '[ai] bireysel kredi düşülemedi (%): %', new.user_id, sqlerrm;
    end;
    return new;
  end if;

  begin
    v_hesap := public.ai_kredi_hesabini_hazirla(v_org);

    -- Önce aylık hak, sonra satın alınan bakiye.
    v_aylik := least(v_hesap.aylik_kalan, v_kredi);
    v_ek := least(v_hesap.ek_bakiye, v_kredi - v_aylik);

    update public.ai_kredi_hesabi
       set aylik_kalan = aylik_kalan - v_aylik,
           ek_bakiye = ek_bakiye - v_ek,
           updated_at = now()
     where organization_id = v_org;

    insert into public.ai_kredi_hareketleri (organization_id, tur, kredi, kaynak)
    values (v_org, 'tuketim', v_kredi, new.id::text);
  exception when others then
    raise warning '[ai] kredi düşülemedi (%): %', v_org, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.ai_kredi_dus() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Durum: bireysel abone kendi hesabını görür
-- ---------------------------------------------------------------------------
/*
  DROP + CREATE: dönüş tipine "bireysel" sütunu ekleniyor (kapı
  mesajları ve Abonelik sayfası "kurumunuzun" mu "sizin" mi diyeceğini
  bundan biliyor). Yetki de bu yüzden yeniden veriliyor.

  Kurum dalı 20260924100014'teki tanımın aynısı.
*/
drop function if exists public.ai_kredi_durumum();

create function public.ai_kredi_durumum()
returns table (
  kullanilan_karakter bigint,
  limit_kredi bigint,
  aylik_kalan bigint,
  ek_bakiye bigint,
  bildirildi boolean,
  ic_ekip boolean,
  bireysel boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_rol public.user_role;
  v_ay_basi timestamptz;
  v_hesap public.ai_kredi_hesabi;
  v_kisi public.ai_bireysel_kredi_hesabi;
  v_bu_ay date := date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date;
begin
  select p.organization_id, p.role into v_org, v_rol
    from public.profiles p where p.id = auth.uid();

  v_ay_basi := date_trunc('month', (now() at time zone 'Europe/Istanbul')) at time zone 'Europe/Istanbul';

  if v_org is null and v_rol = 'client' then
    select * into v_kisi from public.ai_bireysel_kredi_hesabi where user_id = auth.uid();
    return query
    select
      coalesce((
        select sum(coalesce(r.prompt_chars, 0) + coalesce(r.output_chars, 0))
          from public.ai_assistant_runs r
         where r.user_id = auth.uid()
           and r.status = 'completed'
           and r.created_at >= v_ay_basi
      ), 0)::bigint,
      public.ai_bireysel_aylik_hak(),
      /* Hesap yoksa ya da dönemi eskiyse aylık hak DOLU: hesap ilk
         çalışmada açılıyor (fonksiyon stable, burada yazılamaz). */
      case
        when v_kisi.user_id is null or v_kisi.donem < v_bu_ay then public.ai_bireysel_aylik_hak()
        else v_kisi.aylik_kalan
      end,
      coalesce(v_kisi.ek_bakiye, 0),
      true,
      false,
      true;
    return;
  end if;

  select * into v_hesap from public.ai_kredi_hesabi where organization_id = v_org;

  return query
  select
    coalesce((
      select sum(coalesce(r.prompt_chars, 0) + coalesce(r.output_chars, 0))
        from public.ai_assistant_runs r
        join public.profiles p2 on p2.id = r.user_id
       where p2.organization_id = v_org
         and r.status = 'completed'
         and r.created_at >= v_ay_basi
    ), 0)::bigint,
    (select o.ai_credit_limit from public.organizations o where o.id = v_org),
    case
      when v_hesap.organization_id is null or v_hesap.donem < v_bu_ay
        then (select coalesce(o.ai_credit_limit, 0) from public.organizations o where o.id = v_org)
      else v_hesap.aylik_kalan
    end,
    coalesce(v_hesap.ek_bakiye, 0),
    (select o.synced_at is not null from public.organizations o where o.id = v_org),
    coalesce(v_rol in ('system_admin', 'founder'), false),
    false;
end;
$$;

revoke all on function public.ai_kredi_durumum() from public, anon;
grant execute on function public.ai_kredi_durumum() to authenticated;

-- ---------------------------------------------------------------------------
-- Son hareketler (Abonelik sayfası)
-- ---------------------------------------------------------------------------
/*
  PARAMETRE ALMIYOR: yalnızca çağıranın KENDİ defteri. Kullanıcı kimliği
  parametre alsaydı herkes başkasının satın almalarını okuyabilirdi.
  Son 20 hareket; sayfa bundan sayı çıkarmıyor, yalnızca listeliyor.
*/
create or replace function public.ai_bireysel_kredi_hareketlerim()
returns table (tur text, kredi bigint, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select h.tur, h.kredi, h.created_at
    from public.ai_bireysel_kredi_hareketleri h
   where h.user_id = auth.uid()
   order by h.created_at desc
   limit 20
$$;

revoke all on function public.ai_bireysel_kredi_hareketlerim() from public, anon;
grant execute on function public.ai_bireysel_kredi_hareketlerim() to authenticated;

-- ---------------------------------------------------------------------------
-- Yükleme: ArvoOS ödemeyi onaylayınca çağırıyor
-- ---------------------------------------------------------------------------
/*
  p_kaynak ödemenin kimliği (PayTR merchant_oid): aynı ödeme ikinci kez
  kredi eklemez — PayTR bildirimi tekrarlayabiliyor ve ArvoOS yüklenemeyen
  siparişleri yeniden deniyor (lib/ai-kredi-yukleme.ts).

  Kullanıcı bulunamazsa ya da bireysel abone değilse HATA: sessizce
  yüklemek, parası alınmış krediyi kullanamayacağı bir hesaba yazmak
  olurdu; hata ArvoOS'ta siparişi "yüklenmedi" bırakır ve görünür kalır.
*/
create or replace function public.ai_bireysel_kredi_yukle(
  p_user_id uuid,
  p_kredi bigint,
  p_kaynak text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hesap public.ai_bireysel_kredi_hesabi;
begin
  if p_kredi is null or p_kredi <= 0 then
    raise exception 'Yüklenecek kredi pozitif olmalı.';
  end if;
  if p_kaynak is null or btrim(p_kaynak) = '' then
    raise exception 'Kaynak (ödeme kimliği) zorunlu: tekrarlı yüklemeyi bu engelliyor.';
  end if;
  if not public.ai_bireysel_mi(p_user_id) then
    raise exception 'Kullanıcı bireysel abone değil ya da bulunamadı: %', p_user_id;
  end if;

  perform public.ai_bireysel_hesabini_hazirla(p_user_id);

  insert into public.ai_bireysel_kredi_hareketleri (user_id, tur, kredi, kaynak)
  values (p_user_id, 'yukleme', p_kredi, p_kaynak)
  on conflict (tur, kaynak) where kaynak is not null do nothing;

  -- Defter satırı düşmediyse bu ödeme zaten yüklenmiş; bakiyeye dokunma.
  if not found then
    select * into v_hesap from public.ai_bireysel_kredi_hesabi where user_id = p_user_id;
    return coalesce(v_hesap.ek_bakiye, 0);
  end if;

  update public.ai_bireysel_kredi_hesabi
     set ek_bakiye = ek_bakiye + p_kredi, updated_at = now()
   where user_id = p_user_id
  returning * into v_hesap;

  return v_hesap.ek_bakiye;
end;
$$;

revoke all on function public.ai_bireysel_kredi_yukle(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.ai_bireysel_kredi_yukle(uuid, bigint, text) to service_role;
