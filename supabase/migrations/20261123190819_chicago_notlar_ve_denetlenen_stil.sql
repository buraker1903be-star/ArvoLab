-- ============================================================
-- Chicago'nun ikinci türü ve "denetlenen stil" (23.11.2026).
--
-- 1) chicago-notlar: Chicago'nun Notlar–Kaynakça yöntemi ayrı bir stil
--    (lib/atif/stiller.ts). Eskiden katalogda tek "Chicago" vardı ve o
--    yazar–tarih sürümüydü: dipnotla yazan öğrencinin atıfları hiç
--    okunmuyor, kaynakçasındaki her künye "metinde atfı yok" çıkıyordu.
--
-- 2) citation_checks.citation_style: denetimin HANGİ stille yapıldığı
--    kaydın kendisinde. Eskiden kaydedilmiyordu; kayıtlı bir sonuç
--    yeniden açılırken stil ÇALIŞMANIN O ANKİ stilinden okunuyordu
--    (app/actions/citation-check.ts, denetimOku). Vancouver'la denetleyip
--    sonra çalışmayı APA 7'ye çeviren biri, eski sonucunu APA kurallarıyla
--    etiketlenmiş görüyordu — hiç verilmemiş bir hüküm.
--    Eski kayıtlarda NULL; okuyan taraf "kaydedilmedi" diyor, stil
--    uydurmuyor.
--
-- Kısıtlar 20261103162214'teki gibi TANIMINDAN bulunup düşürülüyor.
-- ============================================================

do $$
declare
  t text;
  c text;
begin
  foreach t in array array['academic_projects', 'thesis_guidelines'] loop
    for c in
      select con.conname
      from pg_constraint con
      join pg_class cls on cls.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = cls.relnamespace
      where nsp.nspname = 'public'
        and cls.relname = t
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ilike '%citation_style%'
    loop
      execute format('alter table public.%I drop constraint %I', t, c);
    end loop;

    execute format(
      'alter table public.%I add constraint %I check (citation_style in (''apa7'', ''harvard'', ''vancouver'', ''chicago'', ''chicago-notlar'', ''ieee'', ''mla'', ''dipnot'') or citation_style ~ ''^csl:[akpsdy]:[a-z0-9][a-z0-9-]{0,119}$'')',
      t, t || '_citation_style_check');
  end loop;
end
$$;

-- Denetlenen stil. Kısıt YOK: eski kayıtların NULL'ı ve ileride eklenecek
-- bir stilin değeri bu sütunu kilitlemesin; değerin geçerliliğini yazan
-- taraf (app/actions/citation-check.ts) katalogdan doğruluyor.
alter table public.citation_checks
  add column if not exists citation_style text;

comment on column public.citation_checks.citation_style is
  'Denetimin yapıldığı atıf stili (lib/atif/stiller.ts kimliği ya da csl:...). NULL: 23.11.2026 öncesi kayıt, stil bilinmiyor.';

-- Bildirimdeki stil adı; gövde 20261103162214'teki ile aynı, Chicago
-- satırları ayrıldı.
create or replace function public.citation_style_label(p_style text)
returns text
language sql
immutable
as $$
  select case
    when p_style = 'apa7' then 'APA 7'
    when p_style = 'harvard' then 'Harvard'
    when p_style = 'vancouver' then 'Vancouver'
    when p_style = 'chicago' then 'Chicago (Yazar–Tarih)'
    when p_style = 'chicago-notlar' then 'Chicago (Notlar–Kaynakça)'
    when p_style = 'ieee' then 'IEEE'
    when p_style = 'mla' then 'MLA 9'
    when p_style = 'dipnot' then 'Dipnot (klasik)'
    when p_style like 'csl:%' then initcap(replace(split_part(p_style, ':', 3), '-', ' '))
    else coalesce(p_style, '—')
  end
$$;

revoke all on function public.citation_style_label(text) from public, anon, authenticated;
grant execute on function public.citation_style_label(text) to service_role;

notify pgrst, 'reload schema';
