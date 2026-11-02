-- ============================================================
-- DİPNOT (klasik yöntem) saklanabilir bir atıf stili (02.11.2026).
--
-- Türk sosyal bilimler kılavuzlarının çoğu (ör. DEÜ Sosyal Bilimler)
-- metin içi yöntemin yanında dipnotlu atıfa izin veriyor; hukuk, tarih ve
-- ilahiyat tezlerinin büyük kısmı böyle yazılıyor. Stil listede yoktu ve
-- bu öğrenciler APA seçip yanlış denetleniyordu: dipnottaki atıflar hiç
-- okunmuyor, kaynakçadaki her künye "metinde atfı yok" çıkıyordu. Biçim
-- ve denetim kodda (lib/atif/stiller.ts, lib/citation-format.ts,
-- lib/atif/dipnot.ts, lib/atif/kunye.ts).
--
-- Kısıtlar 20261029113842'deki gibi TANIMINDAN bulunup düşürülüyor:
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
      'alter table public.%I add constraint %I check (citation_style in (''apa7'', ''harvard'', ''vancouver'', ''chicago'', ''ieee'', ''mla'', ''dipnot''))',
      t, t || '_citation_style_check');
  end loop;
end
$$;

-- Bildirimdeki stil adı; gövde 20261029113842'deki ile aynı, yalnızca bir
-- satır eklendi (eskiden tanınmayan değer ham hâliyle "dipnot" yazılırdı).
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
    when 'dipnot' then 'Dipnot (klasik)'
    else coalesce(p_style, '—')
  end
$$;

revoke all on function public.citation_style_label(text) from public, anon, authenticated;
grant execute on function public.citation_style_label(text) to service_role;

notify pgrst, 'reload schema';
