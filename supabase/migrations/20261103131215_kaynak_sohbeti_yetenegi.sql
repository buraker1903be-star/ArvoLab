-- ============================================================
-- Asistan kaydına yeni yetenek: KAYNAKLA SOHBET (03.11.2026).
--
-- Öğrenci kaynağının PDF'ine soru soruyor; cevap PDF'ten birebir alıntı
-- ve PDF sayfasıyla geliyor, alıntı metinde yoksa cevap düşüyor
-- (lib/ai/kaynak-sohbeti.ts). Her çalışma ai_assistant_runs'a yazılır
-- (AGENTS.md); kısıt yeni değeri tanımalı, yoksa kayıt düşer.
-- ============================================================

alter table public.ai_assistant_runs drop constraint if exists ai_assistant_runs_capability_check;
alter table public.ai_assistant_runs
  add constraint ai_assistant_runs_capability_check
  check (capability in ('analiz', 'kaynakca', 'literatur', 'belge', 'kanit', 'makale', 'uak', 'kilavuz', 'yazim', 'kaynak'));

notify pgrst, 'reload schema';
