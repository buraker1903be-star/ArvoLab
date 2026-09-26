-- OCR ile okunan kılavuz tek adım onaya girmesin.
--
-- Ölçüt (20260924100007) güven, bölüm sayısı, dolu kural kümesi ve
-- algılanmış atıf sistemine bakıyordu. OCR hiçbirine girmiyor: taranmış
-- görüntüden okunan metin için ayrı bir ceza YOK, yalnızca uyarı
-- ekleniyor (lib/guideline-scan.ts). Yani metni gürültülü bir belge —
-- "ÜNİVERSİTESİ" yerine "ONİVER" okunan türden — pekâlâ "Tek adım onaya
-- hazır" rozetini alıp akademik yöneticiye bildirim ürettiriyordu.
--
-- Cron kodundaki yorum yıllardır bunun tersini söylüyor ("OCR'lı metinden
-- çıkarılan kurallar tek adım onaya girmez"); kural yorumda kalmış,
-- tetikleyiciye hiç geçmemiş.
--
-- Kayıt kaybolmuyor, yalnızca kuyruktaki "bir bakışta onayla" kümesinden
-- çıkıyor: yönetici belgeyi açıp kuralları doğrulayarak yine onaylayabilir.
--
-- Tekrar çalıştırılabilir.

create or replace function public.set_thesis_guideline_ready()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.ready_for_approval :=
    new.analysis_status = 'needs_review'
    and coalesce(array_length(new.required_sections, 1), 0) >= 4
    and new.extracted_rules is not null
    and new.extracted_rules <> '{}'::jsonb
    -- Atıf stili algılanmamışsa yönetici elle seçmeli; tek tık onay değildir.
    and nullif(new.ai_analysis ->> 'detectedCitationHint', '') is not null
    -- OCR metni gürültülü: kurallar eksik ya da hatalı çıkmış olabilir.
    and coalesce((new.ai_analysis ->> 'ocrUsed')::boolean, false) is not true
    and coalesce((new.ai_analysis ->> 'confidence')::numeric, 0) >= 0.90;
  return new;
end;
$$;

revoke all on function public.set_thesis_guideline_ready() from public, anon, authenticated;

/*
  Alan satırdan türetiliyor ve yalnızca satır güncellenince yeniden
  hesaplanıyor; ölçütü değiştirmek eski satırlara kendiliğinden yansımaz.
  Yalnızca DEĞERİ DEĞİŞECEK olanlara dokunuluyor: gereksiz güncelleme
  notify_guideline_ready tetikleyicisini de boşuna çalıştırırdı.

  Bildirim tekrarı olmaz: notify_guideline_ready yalnızca false → true
  geçişinde haber veriyor, buradaki geçiş ters yönde.
*/
update public.thesis_guidelines
   set ready_for_approval = ready_for_approval
 where ready_for_approval
   and coalesce((ai_analysis ->> 'ocrUsed')::boolean, false);
