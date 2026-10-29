-- ============================================================
-- HARVARD saklanabilir bir atıf stili (29.10.2026).
--
-- ArvoLab dünya geneline açıldı (28.10.2026). İngiltere, İrlanda,
-- Avustralya ve Güney Afrika üniversitelerinin çoğu Harvard istiyor;
-- stil listesinde yoktu ve bu öğrenciler APA seçip yanlış denetleniyordu
-- (APA'nın künyesinde yıldan sonra nokta var, Harvard'da yok: kusursuz
-- her künyeye "başlık bulunamadı" düşerdi). Biçim ve denetim kodda
-- (lib/atif/stiller.ts, lib/citation-format.ts, lib/atif/kunye.ts).
--
-- Kısıtlar 20260924100020'deki gibi TANIMINDAN bulunup düşürülüyor:
-- adları sürüme göre değişebiliyor.
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
      'alter table public.%I add constraint %I check (citation_style in (''apa7'', ''harvard'', ''vancouver'', ''chicago'', ''ieee'', ''mla''))',
      t, t || '_citation_style_check');
  end loop;
end
$$;

-- Bildirimdeki stil adı ("Atıf sisteminiz APA 7 → Harvard …"); eskiden
-- tanınmayan değer ham hâliyle ("harvard") yazılırdı. Gövde
-- 20260924100035'teki ile aynı, yalnızca bir satır eklendi.
create or replace function public.citation_style_label(p_style text)
returns text
language sql
immutable
as $$
  select case p_style
    when 'apa7' then 'APA 7'
    when 'harvard' then 'Harvard'
    when 'vancouver' then 'Vancouver'
    when 'chicago' then 'Chicago'
    when 'ieee' then 'IEEE'
    when 'mla' then 'MLA 9'
    else coalesce(p_style, '—')
  end
$$;

revoke all on function public.citation_style_label(text) from public, anon, authenticated;
grant execute on function public.citation_style_label(text) to service_role;

notify pgrst, 'reload schema';
