/*
  ANA SAYFANIN GRAFİĞİ: kullanıcının son günlerdeki çalışma hareketi
  (26.10.2026, ana sayfa ArvoOS'un genel bakış düzenine geçti).

  Sayım BURADA, uygulamada değil. Sayfa satırları çekip bellekte
  saysaydı PostgREST'in satır tavanına çarpıldığı gün grafik sessizce
  eksilirdi — depo bu hatayı iki kez yaşadı (npm run check:rakamlar).
  Fonksiyon yalnızca gün × tür başına bir sayı döndürüyor.

  YALNIZCA ÇAĞIRANIN KENDİ HAREKETİ. Gözetim rolleri RLS ile kurumun
  kayıtlarını da görebiliyor; grafik "benim çalışmam" diyor, kurumun
  toplamını değil. Bu yüzden her kaynakta açıkça auth.uid() süzgeci var.
  security INVOKER: RLS yine geçerli, fonksiyon kimsenin göremediği bir
  satırı sayamaz.

  Gün sınırı Türkiye saatiyle: sunucu UTC'de, gece 00:00–03:00 arası
  kayıt bir önceki güne düşerdi.

  Pencere 2×gün: grafik son `p_gun` günü çiziyor, bir önceki dönemle
  kıyas için onun öncesindeki aynı uzunluk da sayılıyor.
*/
create or replace function public.calisma_hareketlerim(p_gun integer default 14)
returns table (gun date, tur text, adet integer)
language sql
stable
security invoker
set search_path = public
as $$
  with sinir as (
    select now() - make_interval(days => 2 * least(greatest(coalesce(p_gun, 14), 1), 60)) as baslangic
  ),
  hareket as (
    select created_at as an, 'surum'::text as tur
      from public.project_manuscript_versions, sinir
     where created_by = auth.uid() and created_at >= sinir.baslangic
    union all
    select created_at, 'kaynak'
      from public.literature_sources, sinir
     where owner_id = auth.uid() and created_at >= sinir.baslangic
    union all
    select created_at, 'denetim'
      from public.citation_checks, sinir
     where created_by = auth.uid() and created_at >= sinir.baslangic
    union all
    select created_at, 'denetim'
      from public.document_uploads, sinir
     where uploaded_by = auth.uid() and created_at >= sinir.baslangic
    union all
    select created_at, 'asistan'
      from public.ai_assistant_runs, sinir
     where user_id = auth.uid() and status = 'completed' and created_at >= sinir.baslangic
    union all
    select olusturuldu, 'kanit'
      from public.kanit_kayitlari, sinir
     where olusturan = auth.uid() and olusturuldu >= sinir.baslangic
  )
  select (an at time zone 'Europe/Istanbul')::date as gun, tur, count(*)::integer as adet
    from hareket
   group by 1, 2
$$;

revoke all on function public.calisma_hareketlerim(integer) from public, anon, authenticated;
grant execute on function public.calisma_hareketlerim(integer) to authenticated, service_role;
