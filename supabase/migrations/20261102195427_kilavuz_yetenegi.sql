-- ============================================================
-- Asistan kaydına yeni yetenek: KILAVUZ KURALLARINI OKUMA (02.11.2026).
--
-- Kurum sahibinin isteği: kurallar üniversiteden üniversiteye değişiyor;
-- kalıpla okuma her yeni yazım biçiminde elle genişletiliyordu. Model
-- kılavuzu bağlamıyla okuyor, her kural kılavuzdan birebir alıntıyla
-- geliyor ve doğrulanıyor (lib/ai/kilavuz-kurallari.ts). Her çalışma
-- öteki yetenekler gibi ai_assistant_runs'a yazılır (AGENTS.md: "her
-- asistan çalışması kaydedilir"); kısıt yeni değeri tanımalı, yoksa kayıt
-- düşer ve yalnızca log'a gider.
-- ============================================================

alter table public.ai_assistant_runs drop constraint if exists ai_assistant_runs_capability_check;
alter table public.ai_assistant_runs
  add constraint ai_assistant_runs_capability_check
  check (capability in ('analiz', 'kaynakca', 'literatur', 'belge', 'kanit', 'makale', 'uak', 'kilavuz'));

notify pgrst, 'reload schema';
