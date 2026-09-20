-- OCR ile okunan kılavuzlar tek adım onaya girmez
-- ------------------------------------------------------------
-- Taranmış (görüntü) PDF'lerden metin artık OCR ile çıkarılıyor
-- (lib/ocr.ts). Eskiden bu belgelerden BOŞ metin dönüyordu ve kayıt
-- sessizce düşük güvenle bekliyordu; kimse belgenin okunamadığını
-- bilmiyordu.
--
-- Ama OCR metni GÜRÜLTÜLÜDÜR. Ölçüldü: aynı sayfada "GAZİ ÜNİVERSİTESİ"
-- doğru okunurken "ÜNİVERSİTESİ" bir başka yerde "ONİVER" çıkabiliyor.
-- Böyle bir metinden çıkarılan kuralların doğruluğu, metin PDF'inden
-- çıkarılanlarla aynı sayılamaz.
--
-- "Tek adım onaya hazır" rozeti, yöneticiye "buna göz atıp onaylayabilirsin"
-- diyor. OCR'lı kayıtlar bu rozeti almaz: yönetici kuralları belgeyle
-- karşılaştırmalıdır. Kayıt yine kuyrukta görünür, yalnızca "tek adım"
-- sayılmaz.
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
    and coalesce((new.ai_analysis ->> 'confidence')::numeric, 0) >= 0.90
    -- OCR metni gürültülü; kurallar belgeyle karşılaştırılmalı.
    and coalesce((new.ai_analysis ->> 'ocrUsed')::boolean, false) = false;
  return new;
end;
$$;

revoke all on function public.set_thesis_guideline_ready() from public, anon, authenticated;

-- Alan mevcut kayıtlarda yeniden hesaplansın.
update public.thesis_guidelines set updated_at = updated_at;
