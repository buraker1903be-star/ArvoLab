/*
  ÖĞRENCİNİN YAZIM RİTMİ: tezin son günlerde gün gün kaç kelimeye
  ulaştığı (26.10.2026, ana sayfa öğrencinin gözünden yeniden kuruldu).

  Öğrencinin ana sayfadaki sorusu "bu hafta ne kadar yazdım?". Cevap
  sürüm geçmişinde: editör en fazla 10 dakikada bir otomatik sürüm
  alıyor (app/actions/manuscript.ts) ve her sürüm o anki kelime sayısını
  taşıyor. Bir günde 140'a yakın sürüm olabiliyor; satırları sayfaya
  çekip orada süzmek PostgREST'in satır tavanına iki haftada
  çarpardı. Fonksiyon gün başına TEK sayı döndürüyor: o günün son
  sürümündeki kelime sayısı.

  Pencerenin öncesindeki son sayı da ("taban") dönüyor: ilk günün net
  yazımı ondan hesaplanıyor. Taban olmasaydı pencerenin ilk günü bütün
  tezi o gün yazılmış gibi gösterirdi.

  security INVOKER: sürüm tablosunun RLS'i geçerli; görülemeyen bir
  çalışmanın kimliği verilirse satır dönmez. Gün sınırı Türkiye saatiyle.
*/
create or replace function public.yazim_ritmi(p_project uuid, p_gun integer default 14)
returns table (gun date, kelime integer)
language sql
stable
security invoker
set search_path = public
as $$
  with sinir as (
    select (now() at time zone 'Europe/Istanbul')::date - least(greatest(coalesce(p_gun, 14), 1), 60) as bas
  ),
  gunluk as (
    select distinct on ((v.created_at at time zone 'Europe/Istanbul')::date)
           (v.created_at at time zone 'Europe/Istanbul')::date as gun,
           v.word_count as kelime
      from public.project_manuscript_versions v, sinir
     where v.project_id = p_project
       and (v.created_at at time zone 'Europe/Istanbul')::date > sinir.bas
     order by (v.created_at at time zone 'Europe/Istanbul')::date, v.created_at desc
  ),
  taban as (
    select sinir.bas as gun, t.word_count as kelime
      from sinir
      cross join lateral (
        select v.word_count
          from public.project_manuscript_versions v
         where v.project_id = p_project
           and (v.created_at at time zone 'Europe/Istanbul')::date <= sinir.bas
         order by v.created_at desc
         limit 1
      ) t
  )
  select gun, kelime from taban
  union all
  select gun, kelime from gunluk
  order by gun
$$;

revoke all on function public.yazim_ritmi(uuid, integer) from public, anon, authenticated;
grant execute on function public.yazim_ritmi(uuid, integer) to authenticated, service_role;
