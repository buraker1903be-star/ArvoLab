-- Satın alınan AI kredisi: yanmayan bakiye.
--
-- Kapı (20260924100013) yalnızca paket hakkına bakıyordu: kredisi biten
-- kurumun yapabileceği tek şey ay sonunu beklemekti. Ek kredi satabilmek
-- için "ödediğini kaybetmeyen" bir bakiye gerekiyor.
--
-- İKİ SAYI, BİR HESAP:
--   aylik_kalan — paket hakkı; her ay başında paket limitiyle yenilenir.
--                 Kullanılmayan yanar: aylık hak bir abonelik hakkıdır,
--                 biriken bir varlık değil.
--   ek_bakiye   — satın alınan kredi; YANMAZ, bitene kadar durur.
--
-- Tüketim önce aylık haktan, o bitince bakiyeden düşer. Sıra önemli:
-- tersi olsaydı müşteri parayla aldığı krediyi, zaten hakkı olan aylık
-- kredisi dururken harcardı.
--
-- BURASI ÖLÇÜM DEĞİL SAYAÇ. 20260924100012'deki ölçüm (arvoos_ai_kullanimi)
-- duruyor ve konsolda "bu ay ne tüketildi" sorusunu yanıtlıyor; bakiye ise
-- sayaç olmak zorunda, çünkü para karşılığı bir hak tutuyor. Sayaç
-- kayabilir diye her hareket ayrıca deftere yazılıyor: bakiye ile defterin
-- toplamı tutmuyorsa bir yerde hata var ve bu görülebilir olmalı.

create table if not exists public.ai_kredi_hesabi (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  -- Aylık hakkın hangi aya ait olduğu; ay değişince yenileniyor.
  donem date not null default date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date,
  aylik_kalan bigint not null default 0 check (aylik_kalan >= 0),
  ek_bakiye bigint not null default 0 check (ek_bakiye >= 0),
  updated_at timestamptz not null default now()
);

/*
  Defter: her hareketin izi. Bakiye tek bir sayı olduğu için "bu kredi
  nereye gitti" sorusunun yanıtı başka türlü kalmıyor — müşteri itiraz
  ettiğinde gösterebileceğimiz tek şey bu.
*/
create table if not exists public.ai_kredi_hareketleri (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- yukleme: satın alma · tuketim: asistan çalışması · yenileme: aylık hak
  tur text not null check (tur in ('yukleme', 'tuketim', 'yenileme')),
  kredi bigint not null,
  /* Nereden geldiği: satın almada ArvoOS ödeme kimliği, tüketimde
     asistan çalışmasının kimliği. Aynı ödemenin iki kez yüklenmesini
     engellemek için de kullanılıyor. */
  kaynak text,
  created_at timestamptz not null default now()
);

create unique index if not exists ai_kredi_hareketleri_kaynak_idx
  on public.ai_kredi_hareketleri (tur, kaynak) where kaynak is not null;
create index if not exists ai_kredi_hareketleri_kurum_idx
  on public.ai_kredi_hareketleri (organization_id, created_at desc);

alter table public.ai_kredi_hesabi enable row level security;
alter table public.ai_kredi_hareketleri enable row level security;

/*
  Politika YOK: bakiyeyi yalnızca tetikleyici ve ArvoOS köprüsü değiştirir.
  Kullanıcıya açılsaydı, kendi bakiyesini yazabilen bir uç nokta olurdu —
  parayla satılan bir hak için en kötüsü. Kullanıcı bakiyesini
  ai_kredi_durumum() üzerinden okuyor.
*/
revoke all on public.ai_kredi_hesabi from anon, authenticated;
revoke all on public.ai_kredi_hareketleri from anon, authenticated;
grant select, insert, update on public.ai_kredi_hesabi to service_role;
grant select, insert on public.ai_kredi_hareketleri to service_role;

-- ---------------------------------------------------------------------------
-- Hesabı hazırla: yoksa aç, ay değiştiyse aylık hakkı yenile
-- ---------------------------------------------------------------------------
-- İç yardımcılar public şemasında: bu projede private şeması YOK (ArvoOS'ta
-- var, ikisi ayrı veritabanı). Gizlilik şema adıyla değil yetkiyle
-- sağlanıyor — her fonksiyonun ardından revoke, AGENTS.md'deki kural.
create or replace function public.ai_kredi_hesabini_hazirla(p_organization_id uuid)
returns public.ai_kredi_hesabi
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bu_ay date := date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date;
  v_limit bigint;
  v_hesap public.ai_kredi_hesabi;
begin
  select coalesce(o.ai_credit_limit, 0) into v_limit
    from public.organizations o where o.id = p_organization_id;

  insert into public.ai_kredi_hesabi (organization_id, donem, aylik_kalan)
  values (p_organization_id, v_bu_ay, coalesce(v_limit, 0))
  on conflict (organization_id) do nothing;

  select * into v_hesap from public.ai_kredi_hesabi where organization_id = p_organization_id;

  /*
    Ay değiştiyse aylık hak yenileniyor; kullanılmayan kısım YANIYOR.
    Devredilseydi aylık hak bir abonelik hakkı değil biriken bir varlık
    olurdu ve altı ay kullanmayan kurum yedinci ay altı aylık hakla
    gelirdi — maliyeti o ay ödenirken.
  */
  if v_hesap.donem < v_bu_ay then
    update public.ai_kredi_hesabi
       set donem = v_bu_ay, aylik_kalan = coalesce(v_limit, 0), updated_at = now()
     where organization_id = p_organization_id
    returning * into v_hesap;

    insert into public.ai_kredi_hareketleri (organization_id, tur, kredi, kaynak)
    values (p_organization_id, 'yenileme', coalesce(v_limit, 0), to_char(v_bu_ay, 'YYYY-MM'));
  end if;

  return v_hesap;
end;
$$;

revoke all on function public.ai_kredi_hesabini_hazirla(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tüketim: her tamamlanan çalışmada kendiliğinden düşüyor
-- ---------------------------------------------------------------------------
/*
  TETİKLEYİCİ, uygulama kodu değil. Düşme uygulamada yapılsaydı yeni bir
  yetenek eklenirken unutulabilirdi ve kimse fark etmezdi: kredi
  harcanmadan iş görülür, fatura bize çıkardı. Tetikleyici unutulmaz.

  Akışı düşürmüyor: bakiye yazılamazsa çalışma yine kaydediliyor. Bir
  kaydı kaybetmektense bir krediyi kaybetmek yeğdir.
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
  v_aylik bigint;
  v_ek bigint;
begin
  if new.status <> 'completed' then
    return new;
  end if;

  select p.organization_id into v_org from public.profiles p where p.id = new.user_id;
  -- Kurumu olmayan kullanıcının kurum bakiyesiyle işi yok.
  if v_org is null then
    return new;
  end if;

  -- Başlanan dilim tam sayılır: 1 karakterlik çalışmanın da maliyeti var.
  v_kredi := ceil((coalesce(new.prompt_chars, 0) + coalesce(new.output_chars, 0))::numeric / 1000);
  if v_kredi <= 0 then
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

drop trigger if exists ai_kredi_dus_trg on public.ai_assistant_runs;
create trigger ai_kredi_dus_trg
  after insert on public.ai_assistant_runs
  for each row execute function public.ai_kredi_dus();

-- ---------------------------------------------------------------------------
-- Kapı: artık bakiyeye de bakıyor
-- ---------------------------------------------------------------------------
/*
  DROP + CREATE, "create or replace" değil: dönüş tipine iki sütun
  ekleniyor ve Postgres replace ile dönüş tipini değiştirmiyor
  ("cannot change return type of existing function"). Yetki de bu yüzden
  aşağıda yeniden veriliyor — drop, grant'i de götürüyor.
*/
drop function if exists public.ai_kredi_durumum();

create function public.ai_kredi_durumum()
returns table (
  kullanilan_karakter bigint,
  limit_kredi bigint,
  aylik_kalan bigint,
  ek_bakiye bigint,
  bildirildi boolean,
  ic_ekip boolean
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
  v_bu_ay date := date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date;
begin
  select p.organization_id, p.role into v_org, v_rol
    from public.profiles p where p.id = auth.uid();

  v_ay_basi := date_trunc('month', (now() at time zone 'Europe/Istanbul')) at time zone 'Europe/Istanbul';

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
    /*
      Hesap henüz açılmamışsa ya da dönemi eskiyse aylık hak DOLU sayılıyor:
      hesap ilk çalışmada açılacak. Boş bir satırı "hak bitti" saymak, hiç
      asistan çalıştırmamış kurumu ilk denemesinde kapıda durdururdu.
      Fonksiyon stable olduğu için burada yazamıyoruz; yazma tetikleyicide.
    */
    case
      when v_hesap.organization_id is null or v_hesap.donem < v_bu_ay
        then (select coalesce(o.ai_credit_limit, 0) from public.organizations o where o.id = v_org)
      else v_hesap.aylik_kalan
    end,
    coalesce(v_hesap.ek_bakiye, 0),
    (select o.synced_at is not null from public.organizations o where o.id = v_org),
    coalesce(v_rol in ('system_admin', 'founder'), false);
end;
$$;

revoke all on function public.ai_kredi_durumum() from public, anon;
grant execute on function public.ai_kredi_durumum() to authenticated;

-- ---------------------------------------------------------------------------
-- Yükleme: ArvoOS ödemeyi onaylayınca çağırıyor
-- ---------------------------------------------------------------------------
/*
  p_kaynak ödemenin kimliği ve AYNI ÖDEMENİN İKİ KEZ YÜKLENMESİNİ
  engelliyor: ödeme bildirimleri tekrar gelebiliyor (PayTR yeniden
  deneyebiliyor) ve her denemede kredi eklemek, parasını bir kez ödeyen
  müşteriye üç kat hak vermek demekti.
*/
create or replace function public.ai_kredi_yukle(
  p_organization_id uuid,
  p_kredi bigint,
  p_kaynak text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hesap public.ai_kredi_hesabi;
begin
  if p_kredi is null or p_kredi <= 0 then
    raise exception 'Yüklenecek kredi pozitif olmalı.';
  end if;
  if p_kaynak is null or btrim(p_kaynak) = '' then
    raise exception 'Kaynak (ödeme kimliği) zorunlu: tekrarlı yüklemeyi bu engelliyor.';
  end if;

  perform public.ai_kredi_hesabini_hazirla(p_organization_id);

  insert into public.ai_kredi_hareketleri (organization_id, tur, kredi, kaynak)
  values (p_organization_id, 'yukleme', p_kredi, p_kaynak)
  on conflict (tur, kaynak) where kaynak is not null do nothing;

  -- Defter satırı düşmediyse bu ödeme zaten yüklenmiş; bakiyeye dokunma.
  if not found then
    select * into v_hesap from public.ai_kredi_hesabi where organization_id = p_organization_id;
    return coalesce(v_hesap.ek_bakiye, 0);
  end if;

  update public.ai_kredi_hesabi
     set ek_bakiye = ek_bakiye + p_kredi, updated_at = now()
   where organization_id = p_organization_id
  returning * into v_hesap;

  return v_hesap.ek_bakiye;
end;
$$;

revoke all on function public.ai_kredi_yukle(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.ai_kredi_yukle(uuid, bigint, text) to service_role;
