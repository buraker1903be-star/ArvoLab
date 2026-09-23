-- ============================================================
-- MLA 9 artık saklanabilir bir atıf stili.
--
-- MLA sistemde zaten "tanınıyordu" ama saklanamıyordu: kılavuz metninden
-- atıf sistemi seçen kod (lib/atif-sistemi.ts) MLA'yı sayıyor, baskın
-- çıktığında bile "saklanabilir karşılığı yok" diyip null dönüyordu.
-- Türkiye'de sosyal bilimler ve edebiyat bölümlerinin kılavuzları MLA
-- isteyebiliyor; o öğrenci ya APA seçip yanlış denetleniyor ya da hiç
-- denetlenmiyordu.
--
-- MLA'nın diğerlerinden farkı, motorun üçüncü bir atıf türünü öğrenmesini
-- gerektirdi: metin içi atıfta YIL YOKTUR, sayfa vardır ("Yılmaz 45").
-- Yazar-tarih sanılsaydı çapraz kontrol yılı arar ve hiçbir atıf künyesiyle
-- eşleşmezdi — öğrenci doğru yazdığı her kaynak için "metinde atıf yok"
-- uyarısı alırdı (bkz. lib/atif/stiller.ts, tur: "yazar-sayfa").
--
-- Kısıtlar adsız oluşturulmuştu (schema.sql); adı sürüme göre değişebildiği
-- için burada kolonun CHECK'i adıyla değil, tanımından bulunup düşürülüyor.
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
      'alter table public.%I add constraint %I check (citation_style in (''apa7'', ''vancouver'', ''chicago'', ''ieee'', ''mla''))',
      t, t || '_citation_style_check');
  end loop;
end
$$;

notify pgrst, 'reload schema';
