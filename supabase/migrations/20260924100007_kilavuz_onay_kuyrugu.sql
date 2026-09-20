-- Kılavuz onay kuyruğu: "onaya hazır" kararı görünür hâle geliyor
-- ------------------------------------------------------------
-- Sorun: gece çalışan tarama (app/api/cron/guideline-refresh) bir kılavuzun
-- onaya hazır olup olmadığını zaten hesaplıyor (güven >= 0.90, en az 4 zorunlu
-- bölüm, atıf stili algılanmış) ama bu kararı yalnızca review_notes METNİNE
-- yazıyordu. Karar sorgulanamıyor, kimseye bildirilmiyordu. Sonuç: canlıda 18
-- kılavuzun tamamı needs_review'da bekliyor, hiçbiri onaylanmamış, dolayısıyla
-- approved_snapshot her kayıtta null ve kılavuz özelliği (zorunlu bölümler,
-- sayfa sınırı, atıf stili, editör sayfa ayarları) müşteride hiç çalışmıyor.
--
-- Çözüm iki parça:
--   1. ready_for_approval: satırın kendisinden hesaplanan, sorgulanabilir alan.
--   2. Akademik yöneticilere bildirim; BİLDİRİMİ YALNIZCA TETİKLEYİCİ ÜRETİR
--      (20260918090000_notifications.sql'deki değişmez): hiçbir uygulama akışı
--      bildirimi unutamaz.
--
-- Tekrar çalıştırılabilir.

-- ---------- 1. Onaya hazırlık ölçütü ----------

alter table public.thesis_guidelines
  add column if not exists ready_for_approval boolean not null default false;

/*
  Alan her zaman satırdan türetilir; elle yazılması anlamsız olurdu.

  Ölçüt cron'daki readyForApproval ile AYNI: güven >= 0.90, en az 4 zorunlu
  bölüm, dolu kural kümesi, algılanmış atıf stili. İki yerde farklı eşik
  tutmak, yöneticinin gördüğü listeyi cron'un kararından ayırırdı.

  Ölçüt ayrı bir yardımcı fonksiyona konmadı: tetikleyici fonksiyonları
  EXECUTE yetkisi istemez ama içeriden çağırdıkları normal fonksiyonlar
  ister; yardımcı için authenticated'a yetki vermek gerekirdi ve kural
  gereği hiçbir fonksiyon gereksiz yere açılmaz (AGENTS.md).
*/
create or replace function public.set_thesis_guideline_ready()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.ready_for_approval :=
    new.analysis_status = 'needs_review'
    and coalesce(array_length(new.required_sections, 1), 0) >= 4
    and new.extracted_rules is not null
    and new.extracted_rules <> '{}'::jsonb
    -- Atıf stili algılanmamışsa yönetici elle seçmeli; tek tık onay değildir.
    and nullif(new.ai_analysis ->> 'detectedCitationHint', '') is not null
    and coalesce((new.ai_analysis ->> 'confidence')::numeric, 0) >= 0.90;
  return new;
end;
$$;

revoke all on function public.set_thesis_guideline_ready() from public, anon, authenticated;

drop trigger if exists set_thesis_guideline_ready_trigger on public.thesis_guidelines;
create trigger set_thesis_guideline_ready_trigger
  before insert or update on public.thesis_guidelines
  for each row execute function public.set_thesis_guideline_ready();

-- Kuyruk sorgusu: yalnızca bekleyenler okunur.
create index if not exists thesis_guidelines_onay_kuyrugu_idx
  on public.thesis_guidelines (ready_for_approval, last_checked_at)
  where analysis_status = 'needs_review' and is_active;

-- ---------- 2. Akademik yöneticilere bildirim ----------

create or replace function public.notify_guideline_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  yonetici record;
  birim text;
begin
  /*
    Yalnızca GEÇİŞ anında bildirilir. Her gece çalışan tarama aynı satırı
    tekrar tekrar güncelliyor; her güncellemede bildirim atmak, yöneticinin
    zilini anlamsızlaştırır ve gerçek bir haberi görünmez yapardı.
  */
  if new.ready_for_approval is not true then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.ready_for_approval is true then
    return new;
  end if;

  birim := coalesce(new.institute_name, new.university_name);

  for yonetici in
    select id from public.profiles
    where role in ('academic_manager', 'system_admin', 'founder')
  loop
    perform public.notify(
      yonetici.id,
      null,
      'guideline_update',
      'Tez yazım kılavuzu onay bekliyor',
      birim || ' kılavuzunun kuralları otomatik çıkarıldı; tek adım onayınızı bekliyor.',
      '/dashboard/guidelines'
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_guideline_ready() from public, anon, authenticated;

drop trigger if exists notify_guideline_ready_trigger on public.thesis_guidelines;
create trigger notify_guideline_ready_trigger
  after insert or update of ready_for_approval on public.thesis_guidelines
  for each row execute function public.notify_guideline_ready();

-- ---------- 3. Mevcut kayıtlar için alanı doldur ----------

/*
  Tetikleyici yalnızca bundan sonraki yazmalarda çalışır; canlıdaki 18 kayıt
  bir sonraki geceye kadar kuyrukta görünmezdi. Boş bir güncelleme
  tetikleyiciyi çalıştırır.

  Bildirim tetikleyicisi bu sırada da çalışır ve hazır olanlar için
  yöneticilere bildirim gider — istenen budur: bekleyen iş zaten vardı,
  yalnızca kimse görmüyordu.
*/
update public.thesis_guidelines set updated_at = updated_at;
