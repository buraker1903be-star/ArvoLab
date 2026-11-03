-- ============================================================
-- Asistan kaydına yeni yetenek: YAZIM ASİSTANI (03.11.2026).
--
-- Kurum sahibinin kararı: asistan sohbet panelinde paragraf yazabilir,
-- belgeye eklemek kullanıcının eylemidir (lib/ai/yazim-asistani.ts).
-- Atıflar yalnızca öğrencinin kütüphanesinden, sayılar yalnızca
-- bağlamdan; çiğneyen cevap düşer ve "rejected" olarak kaydedilir.
-- Her çalışma öteki yetenekler gibi ai_assistant_runs'a yazılır
-- (AGENTS.md); kısıt yeni değeri tanımalı, yoksa kayıt düşer.
-- ============================================================

alter table public.ai_assistant_runs drop constraint if exists ai_assistant_runs_capability_check;
alter table public.ai_assistant_runs
  add constraint ai_assistant_runs_capability_check
  check (capability in ('analiz', 'kaynakca', 'literatur', 'belge', 'kanit', 'makale', 'uak', 'kilavuz', 'yazim'));

notify pgrst, 'reload schema';
