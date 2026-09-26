-- Model karşılaştırması satır çekerek değil, veritabanında sayılsın.
--
-- app/actions/ai-kayitlar.ts → modelOzetleri, ai_assistant_runs'tan
-- .limit(5000) ile satır çekip toplamları JavaScript'te topluyordu. İki
-- sorun birlikte:
--
--   1. Sıralama YOK. PostgREST'in hangi 5000 satırı döndüreceği belirsiz;
--      tablo sınırı aşınca özet rastgele bir alt kümenin özeti olur.
--   2. Sınıra ulaşılana kadar hiçbir belirti vermez. Tablo 5000'i geçtiği
--      gün ekran aynı görünür, sayılar sessizce eksilir.
--
-- Bu tablonun kararı ağır: fonksiyonun kendi yorumu "pahalı modeli
-- ucuzuyla değiştirmek ancak bu tablo elde varken savunulabilir" diyor.
-- Hata dalında eksik veriye karşı özen gösterilmiş (okuma düşerse özet hiç
-- gösterilmiyor), ama sınırın aynı eksikliği sessizce ürettiği görülmemiş.
--
-- security INVOKER: satırları RLS seçiyor (20260924100028). Kullanıcı kendi
-- kayıtlarının, kontrolör ve akademik yönetici kendi kurumunun, iç ekip
-- hepsinin özetini alır — kapıyı burada yeniden kurmak gerekmiyor ve
-- kurmaya çalışmak ikinci bir doğruluk kaynağı yaratırdı.
--
-- Sayım ölçütleri JavaScript'teki hâliyle birebir: süre ortalaması
-- duration_ms'i boş VE sıfır olanları dışarıda tutuyor (eski kod
-- `if (satir.duration_ms)` ile ikisini de atlıyordu), puanlanan sayısı boş
-- dizgeyi puan saymıyor.
--
-- Tekrar çalıştırılabilir.

create or replace function public.asistan_model_ozetleri()
returns table (
  model text,
  toplam bigint,
  tamamlanan bigint,
  reddedilen bigint,
  basarisiz bigint,
  faydali bigint,
  kismen bigint,
  faydasiz bigint,
  puanlanan bigint,
  ort_sure bigint,
  toplam_karakter bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(r.model, 'bilinmiyor') as model,
    count(*) as toplam,
    count(*) filter (where r.status = 'completed') as tamamlanan,
    count(*) filter (where r.status = 'rejected') as reddedilen,
    count(*) filter (where r.status = 'failed') as basarisiz,
    count(*) filter (where r.rating = 'faydali') as faydali,
    count(*) filter (where r.rating = 'kismen') as kismen,
    count(*) filter (where r.rating = 'faydasiz') as faydasiz,
    count(*) filter (where coalesce(r.rating, '') <> '') as puanlanan,
    coalesce(round(avg(r.duration_ms) filter (where coalesce(r.duration_ms, 0) <> 0)), 0)::bigint as ort_sure,
    coalesce(sum(coalesce(r.prompt_chars, 0) + coalesce(r.output_chars, 0)), 0)::bigint as toplam_karakter
  from public.ai_assistant_runs r
  group by coalesce(r.model, 'bilinmiyor')
  order by count(*) desc;
$$;

/*
  Parametre almıyor ve satır seçimini RLS yapıyor; authenticated'a açık
  olması şart, sayfa kullanıcının kendi oturumuyla çağırıyor.
  tests/db/guvenlik.test.mjs hangi fonksiyonun kime açık olduğunu sabitler.
*/
revoke all on function public.asistan_model_ozetleri() from public, anon, authenticated;
grant execute on function public.asistan_model_ozetleri() to authenticated;
