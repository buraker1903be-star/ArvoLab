-- ============================================================
-- Asistan çalışmaları artık bir akademik çalışmaya bağlanabiliyor.
--
-- ArvoLab'ın bütün birimleri academic_projects'e bağlı (literature_sources,
-- citation_checks, document_uploads, project_manuscripts,
-- consultancy_requests). Asistan en yeni birimdi ve bağlanmamıştı: bir tezin
-- analiz denetimleri ile kaynakça yorumları hiçbir yerde o tezle birlikte
-- görünmüyordu.
--
-- İki kazanç: çalışma merkezinde asistan geçmişi görünür hale gelir ve
-- asistan çalışmanın bağlamını (tür, atıf stili, araştırma yöntemi, kurum)
-- bilerek denetler.
--
-- on delete set null: çalışma silinince asistan kaydı silinmez. Kayıt ince
-- ayarın eğitim verisi (20260924100005); bağı kopar, kendisi kalır.
-- ============================================================

alter table public.ai_assistant_runs
  add column if not exists project_id uuid references public.academic_projects(id) on delete set null;

create index if not exists ai_assistant_runs_project_idx
  on public.ai_assistant_runs(project_id, created_at desc)
  where project_id is not null;

/*
  Dokunulmazlık kuralı project_id'yi de kapsamalı. Kayıt eğitim verisi
  olacağı için hangi çalışmaya ait olduğu sonradan değiştirilememeli;
  yoksa kullanıcı başka bir tezin denetimini kendi çalışmasına taşıyabilir.
  Gövdenin geri kalanı 20260924100005'teki ile aynı.
*/
create or replace function public.guard_ai_run_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id
  or new.user_id is distinct from old.user_id
  or new.project_id is distinct from old.project_id
  or new.capability is distinct from old.capability
  or new.status is distinct from old.status
  or new.reject_reason is distinct from old.reject_reason
  or new.model is distinct from old.model
  or new.provider is distinct from old.provider
  or new.context is distinct from old.context
  or new.output is distinct from old.output
  or new.findings is distinct from old.findings
  or new.prompt_chars is distinct from old.prompt_chars
  or new.output_chars is distinct from old.output_chars
  or new.duration_ms is distinct from old.duration_ms
  or new.created_at is distinct from old.created_at
  then
    raise exception 'Asistan kaydının içeriği değiştirilemez; yalnızca değerlendirme yazılabilir.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Zaman damgası istemciden gelmez.
  if new.rating is distinct from old.rating or new.rating_note is distinct from old.rating_note then
    new.rated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.guard_ai_run_update() from public, anon, authenticated;
grant execute on function public.guard_ai_run_update() to service_role;

notify pgrst, 'reload schema';
