-- ============================================================
-- CSL atıf stilleri saklanabilir (03.11.2026).
--
-- Yedi yerleşik stilin yanında Citation Style Language deposundaki ~10 800
-- dergi/yayınevi stili seçilebiliyor. Değer "csl:<kod>:<depodaki ad>"
-- (lib/atif/csl-kimlik.ts, CSL_DESENI ile AYNI desen): kod atfın biçimi
-- (a yazar-tarih, k [1], p (1), s üst simge, d dipnot, y yazar-sayfa).
-- Listeyi buraya yazmak 10 800 değerlik bir kısıt demekti; desen,
-- elle yazılmış saçma değerleri yine reddediyor, stilin dizinde gerçekten
-- bulunduğunu sunucu doğruluyor (app/actions/projects.ts).
--
-- Kısıtlar 20261102151330'daki gibi TANIMINDAN bulunup düşürülüyor.
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
      'alter table public.%I add constraint %I check (citation_style in (''apa7'', ''harvard'', ''vancouver'', ''chicago'', ''ieee'', ''mla'', ''dipnot'') or citation_style ~ ''^csl:[akpsdy]:[a-z0-9][a-z0-9-]{0,119}$'')',
      t, t || '_citation_style_check');
  end loop;
end
$$;

-- Bildirimdeki stil adı; gövde 20261102151330'daki ile aynı, CSL satırı
-- eklendi: eskiden bildirim "csl:s:american-medical-association" diye
-- ham kimliği yazardı. Ad dosya adından türetilir (TS'teki cslGorunenAd'ın
-- kaba karşılığı; bildirimde yeterli).
create or replace function public.citation_style_label(p_style text)
returns text
language sql
immutable
as $$
  select case
    when p_style = 'apa7' then 'APA 7'
    when p_style = 'harvard' then 'Harvard'
    when p_style = 'vancouver' then 'Vancouver'
    when p_style = 'chicago' then 'Chicago'
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
