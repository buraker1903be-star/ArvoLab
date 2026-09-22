-- Kurum başına AI tüketimi: ArvoOS'un okuyacağı ölçüm.
--
-- Neden: ArvoOS'ta organization_licenses.ai_credit_limit yıllardır duruyor
-- ama hiçbir kod tüketimi yazmıyor. Konsoldaki kutu her kiracıda "0 kredi ·
-- %0 dolu" gösteriyordu; hiç AI kullanmamış kiracıyla günde bin istek atan
-- kiracı aynı görünüyordu. Kota satmadan önce ölçüm gerekiyor —
-- storage_limit_mb dersi.
--
-- ÖLÇÜ BİRİMİ KARAKTER. Maliyet jetonla oluşuyor ve jetonun en yakın
-- vekili, zaten kaydettiğimiz prompt_chars + output_chars. "Çalışma
-- sayısı" saymak kârı rastlantıya bırakırdı: iki sayfalık bir özetle
-- altmış sayfalık bir analiz aynı 1 çalışma olur, en çok kullanan
-- müşteride en çok zarar edilirdi. Krediye çevirme ArvoOS'ta yapılıyor
-- (1 kredi = 1.000 karakter), çünkü fiyat kararı orada.
--
-- Toplama VERİTABANINDA: PostgREST'te SUM yok, ArvoOS binlerce satırı
-- çekip kendi toplamak zorunda kalırdı.
--
-- ai_assistant_runs'ta organization_id YOK (user_id var); kuruma bağlantı
-- profiles üzerinden. Profilin kuruma bağlanması 20260924100011'de
-- kendiliğinden oluyor.

create or replace function public.arvoos_ai_kullanimi(
  p_organization_id uuid,
  p_since timestamptz
)
returns table (karakter bigint, calisma bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    /*
      Yalnızca TAMAMLANAN çalışmalar sayılıyor. Reddedilen yanıt (uydurma
      sayı, künye izi) kullanıcıya hiç gösterilmiyor; gösterilmeyen bir
      şeyin parasını almak yanlış olur. Maliyeti biz üstleniyoruz — bu da
      denetimi sıkı tutmak için ayrıca bir sebep.
    */
    coalesce(sum(coalesce(r.prompt_chars, 0) + coalesce(r.output_chars, 0)), 0)::bigint as karakter,
    count(*)::bigint as calisma
  from public.ai_assistant_runs r
  join public.profiles p on p.id = r.user_id
  where p.organization_id = p_organization_id
    and r.status = 'completed'
    and r.created_at >= p_since;
$$;

-- Yalnızca ArvoOS köprüsü çağırabilir. Kurumun kendi kullanıcısı bile
-- çağıramaz: başka bir kurumun kimliğini yazıp tüketimini okuyabilirdi.
revoke all on function public.arvoos_ai_kullanimi(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.arvoos_ai_kullanimi(uuid, timestamptz) to service_role;

-- Fonksiyon security definer olduğu için tablo ayrıcalığı şart değil ama
-- köprünün ileride satır okuması gerekirse "permission denied" ile
-- karşılaşmasın: bu projede service_role izinleri kendiliğinden düşmüyor
-- (20260923110000'de aynısı yaşandı).
grant select on public.ai_assistant_runs to service_role;

-- Dönemsel toplama tarih aralığıyla çalışıyor; kullanıcı ve yetenek
-- indeksleri bu sorguya yetmiyordu.
create index if not exists ai_assistant_runs_created_idx
  on public.ai_assistant_runs (created_at desc);
