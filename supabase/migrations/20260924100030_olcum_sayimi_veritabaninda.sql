-- ============================================================
-- Ölçüm sayımı veritabanına taşındı.
--
-- Sayfa (20260924100029 ile gelen /dashboard/olcum) satırları PostgREST'ten
-- çekip uygulamada sayıyordu. İki yerden birden kırılırdı:
--
--  1. PostgREST bir istekte en fazla ~1000 satır döndürür. Bin bireysel
--     kullanıcıyı geçtiğimiz gün bütün sayılar sessizce 1000'de kalırdı —
--     ölçüm sayfasının yapabileceği en kötü şey YANLIŞ bir sayıyı doğru
--     gibi göstermektir; eksik sayı, eksik olduğunu söylemez.
--  2. Aktivasyon sorguları kullanıcı kimliklerini "in (...)" listesiyle
--     gönderiyordu. Birkaç bin kimlik URL sınırını aşar ve istek komple
--     düşer.
--
-- Sayım artık tek bir sorguda burada yapılıyor; uygulama yalnızca oranı
-- hesaplıyor (lib/olcum.ts — payda kuralları orada testli).
--
-- Ölçütlerdeki iki incelik SQL'e de aynen taşındı:
--  * "Ödemeye geçti" durum alanına DEĞİL tarihe bakar: ArvoOS denemeyi
--    başlatırken current_period_end'i trial_ends_at ile aynı yazıyor, yani
--    status = 'active' ödeme yapıldığı anlamına gelmiyor.
--  * Aktivasyon adımları KİŞİ sayar (count(distinct)), satır değil: bir
--    kullanıcının üç çalışması varsa oran %100'ü aşardı.
-- ============================================================

create or replace function public.olcum_ozeti()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sonuc jsonb;
begin
  -- Fonksiyon security definer: kapıyı kendisi tutmak zorunda. Bireysel
  -- abone hiçbir kuruma ait değil, müşteri kurumların gözetim rolleri
  -- onu görmemeli (20260924100029 ile aynı sınır).
  if not public.has_role(array['system_admin','founder']::public.user_role[]) then
    raise exception 'Ürün ölçümü yalnızca iç ekibe açıktır.' using errcode = '42501';
  end if;

  with bireysel as (
    -- Rol süzgeci şart: iç ekibin kendi hesapları da kurumsuz. Onları
    -- "abone adayı" saymak dönüşümü olduğundan kötü gösterirdi.
    select id from public.profiles
    where organization_id is null and role = 'client'
  ),
  abonelik as (
    select
      s.user_id,
      s.trial_ends_at,
      s.current_period_end,
      (
        s.current_period_end is not null
        and (s.trial_ends_at is null or s.current_period_end > s.trial_ends_at)
      ) as odedi,
      coalesce(s.current_period_end, s.trial_ends_at) > now() as erisimi_acik
    from public.individual_subscriptions s
  )
  select jsonb_build_object(
    'kayit', (select count(*) from bireysel),
    'denemeBaslatan', (select count(*) from abonelik),
    'odemeyeGecen', (select count(*) from abonelik where odedi),
    'suAnErisimi', (select count(*) from abonelik where coalesce(erisimi_acik, false)),
    'denemedeBirakan', (
      select count(*) from abonelik
      where not coalesce(erisimi_acik, false) and not odedi and trial_ends_at is not null
    ),
    'yenilemeyen', (
      select count(*) from abonelik where not coalesce(erisimi_acik, false) and odedi
    ),
    'calismaAcan', (
      select count(distinct p.owner_id) from public.academic_projects p
      where p.owner_id in (select id from bireysel)
    ),
    'yazan', (
      select count(distinct p.owner_id)
      from public.project_manuscripts m
      join public.academic_projects p on p.id = m.project_id
      where m.word_count >= 500 and p.owner_id in (select id from bireysel)
    ),
    'asistanKullanan', (
      select count(distinct r.user_id) from public.ai_assistant_runs r
      where r.user_id in (select id from bireysel)
    ),
    'geriBildirimSayisi', (
      select count(*) from public.product_feedback where status = 'answered'
    ),
    'geriBildirimOrtalamasi', (
      select round(avg(score)::numeric, 1) from public.product_feedback
      where status = 'answered' and score is not null
    )
  ) into v_sonuc;

  return v_sonuc;
end;
$$;

revoke all on function public.olcum_ozeti() from public, anon, authenticated;
grant execute on function public.olcum_ozeti() to authenticated, service_role;

comment on function public.olcum_ozeti() is
  'Bireysel abonelik ölçümünün ham sayıları; yalnızca iç ekibe açık, oranlar uygulamada hesaplanır.';

notify pgrst, 'reload schema';
