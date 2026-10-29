-- ============================================================
-- AI KREDİSİ: kurum yenilemesi, tarayıcıdan kayıt, eşzamanlı düşme;
-- paylaşım bağlantısının süre sınırı
-- (29.10.2026, kredi yolu incelemesi).
--
-- 1) Kurumun aylık yenilemesi YALNIZCA BİR KURUMDA çalışıyordu.
--    Defter satırının kaynağı to_char(ay, 'YYYY-MM') idi, tekillik
--    dizini ise (tur, kaynak) üzerinde ve kurumdan bağımsız: ayın ilk
--    yenilemesini yapan kurum ('yenileme', '2026-10') satırını yazınca
--    öteki bütün kurumların yenilemesi tekillik hatasıyla düşüyordu.
--    Tüketim tetikleyicisi hatayı yutuyor ve dönem güncellemesi geri
--    alınıyordu: o kurumlar eski ayda kaldı, hiçbir çalışmaları
--    düşülmedi, ai_kredi_durumum eski dönemi görüp tam aylık hakkı
--    gösterdi — kapı hiç kapanmadı. Aynı kurumlara ArvoOS'tan gelen
--    ödemeli kredi yüklemesi de (ai_kredi_yukle hatayı yutmuyor) her
--    seferinde düştü: parası alınan kredi yüklenmedi. Bireysel dal bunu
--    baştan kişi kimliğiyle yazıyordu (20261026181929); kurum dalı da
--    artık öyle.
--
-- 2) Yenileme EŞZAMANLI iki çağrıda iki kez çalışabiliyordu: ikisi de
--    eski dönemi okuyup güncelliyor, ikincisinin defter satırı
--    tekillikten düşüyordu. Güncelleme artık "dönem hâlâ eskiyse"
--    koşuluyla yapılıyor; satır kilidi ikinciyi bekletiyor ve koşul onu
--    eliyor.
--
-- 3) Tüketim kalanı KİLİTSİZ okuyordu. Kalan 5 iken iki paralel 4'lük
--    çalışmada ikincisi 1 − 4 hesaplayıp check (aylik_kalan >= 0)
--    kısıtına çarpıyor, hata yutuluyor ve çalışma bedava kalıyordu.
--    Hesap artık FOR UPDATE ile okunuyor.
--
-- 4) Defter düşülmeyen krediyi de "tüketim" diye yazıyordu: kalan 1
--    iken 40 kredilik çalışmada bakiyeden 1 düşüyor, deftere 40
--    yazılıyordu; defter ile bakiye ayrışıyordu. Defter artık gerçekten
--    düşülen miktarı yazar (kapı kalan > 0 iken çalıştırdığı için son
--    çalışmanın aşan kısmı bilerek affediliyor: tahmini maliyeti model
--    çağrısından önce kesin bilmenin yolu yok).
--
-- 5) ai_assistant_runs'a tarayıcıdan doğrudan INSERT açıktı
--    (20260924100005). Politika yalnızca user_id = auth.uid()
--    istiyordu; kredi tetikleyicisi ekleme SONRASI çalışıyor. Kurumun
--    herhangi bir üyesi oturum jetonuyla prompt_chars = 2 000 000 000
--    olan sahte bir "completed" satırı yazıp kurumun bütün kredisini
--    (satın alınan bakiye dahil) sıfırlayabiliyor, eğitim verisi
--    tablosuna uydurma çalışma ekleyebiliyordu. Satırı artık yalnızca
--    sunucu yazar (lib/ai/kayit.ts, oturum doğrulandıktan sonra
--    service_role ile). Okuma ve puanlama (UPDATE) açık kalıyor.
-- ============================================================

revoke insert on public.ai_assistant_runs from authenticated;
drop policy if exists "Kendi asistan kaydını oluşturur" on public.ai_assistant_runs;

-- ---------------------------------------------------------------------------
-- Kurum hesabı: gövde 20260924100014'teki; anahtar ve yenileme koşulu yeni.
-- ---------------------------------------------------------------------------
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

  -- Ay değiştiyse aylık hak yenilenir; kullanılmayan kısım YANAR.
  update public.ai_kredi_hesabi
     set donem = v_bu_ay, aylik_kalan = coalesce(v_limit, 0), updated_at = now()
   where organization_id = p_organization_id
     and donem < v_bu_ay
  returning * into v_hesap;

  if found then
    insert into public.ai_kredi_hareketleri (organization_id, tur, kredi, kaynak)
    values (p_organization_id, 'yenileme', coalesce(v_limit, 0),
            p_organization_id::text || ':' || to_char(v_bu_ay, 'YYYY-MM'))
    on conflict (tur, kaynak) where kaynak is not null do nothing;
  else
    select * into v_hesap from public.ai_kredi_hesabi where organization_id = p_organization_id;
  end if;

  return v_hesap;
end;
$$;

revoke all on function public.ai_kredi_hesabini_hazirla(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bireysel hesap: gövde 20261026181929'daki; yalnızca yenileme koşulu yeni.
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

  update public.ai_bireysel_kredi_hesabi
     set donem = v_bu_ay, aylik_kalan = v_hak, updated_at = now()
   where user_id = p_user_id
     and donem < v_bu_ay
  returning * into v_hesap;

  if found then
    insert into public.ai_bireysel_kredi_hareketleri (user_id, tur, kredi, kaynak)
    values (p_user_id, 'yenileme', v_hak, p_user_id::text || ':' || to_char(v_bu_ay, 'YYYY-MM'))
    on conflict (tur, kaynak) where kaynak is not null do nothing;
  else
    select * into v_hesap from public.ai_bireysel_kredi_hesabi where user_id = p_user_id;
  end if;

  return v_hesap;
end;
$$;

revoke all on function public.ai_bireysel_hesabini_hazirla(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tüketim: gövde 20261026181929'daki; kilit ve defter miktarı yeni.
-- ---------------------------------------------------------------------------
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
      perform public.ai_bireysel_hesabini_hazirla(new.user_id);
      select * into v_kisi from public.ai_bireysel_kredi_hesabi
       where user_id = new.user_id for update;
      v_aylik := least(v_kisi.aylik_kalan, v_kredi);
      v_ek := least(v_kisi.ek_bakiye, v_kredi - v_aylik);
      update public.ai_bireysel_kredi_hesabi
         set aylik_kalan = aylik_kalan - v_aylik,
             ek_bakiye = ek_bakiye - v_ek,
             updated_at = now()
       where user_id = new.user_id;
      if v_aylik + v_ek > 0 then
        insert into public.ai_bireysel_kredi_hareketleri (user_id, tur, kredi, kaynak)
        values (new.user_id, 'tuketim', v_aylik + v_ek, new.id::text);
      end if;
    exception when others then
      raise warning '[ai] bireysel kredi düşülemedi (%): %', new.user_id, sqlerrm;
    end;
    return new;
  end if;

  begin
    perform public.ai_kredi_hesabini_hazirla(v_org);
    select * into v_hesap from public.ai_kredi_hesabi
     where organization_id = v_org for update;

    -- Önce aylık hak, sonra satın alınan bakiye.
    v_aylik := least(v_hesap.aylik_kalan, v_kredi);
    v_ek := least(v_hesap.ek_bakiye, v_kredi - v_aylik);

    update public.ai_kredi_hesabi
       set aylik_kalan = aylik_kalan - v_aylik,
           ek_bakiye = ek_bakiye - v_ek,
           updated_at = now()
     where organization_id = v_org;

    if v_aylik + v_ek > 0 then
      insert into public.ai_kredi_hareketleri (organization_id, tur, kredi, kaynak)
      values (v_org, 'tuketim', v_aylik + v_ek, new.id::text);
    end if;
  exception when others then
    raise warning '[ai] kredi düşülemedi (%): %', v_org, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.ai_kredi_dus() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Danışman paylaşım bağlantısının 90 günlük sınırı aşılabiliyordu
-- ---------------------------------------------------------------------------
/*
  Sınır check (expires_at <= created_at + 90 gün) ile yazılmış, ama
  INSERT bütün sütunlara açıktı (20260920090000): created_at da
  istemciden geliyordu. PostgREST'e doğrudan created_at = 2199-01-01,
  expires_at = 2199-03-31 yazan bağlantı kısıtı geçiyor ve iki yüzyıl
  açık kalıyordu. Ekleme artık yalnızca uygulamanın yazdığı sütunlara
  açık (app/actions/share-links.ts); created_at, sayaç ve iptal
  varsayılanından gelir.
*/
revoke insert on public.manuscript_share_links from authenticated;
grant insert (project_id, token_hash, label, created_by, expires_at)
  on public.manuscript_share_links to authenticated;

notify pgrst, 'reload schema';
