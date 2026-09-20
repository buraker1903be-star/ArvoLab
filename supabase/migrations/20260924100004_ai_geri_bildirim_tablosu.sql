-- ============================================================
-- ai_feedback_requests tablosu canlıda yok.
--
-- Tablo schema.sql'de tanımlı ama canlı veritabanına hiç uygulanmamış
-- (20.09.2026: abonelik kapısı tetikleyicisi 11 tablodan yalnızca 10'una
-- kurulabildi, eksik olan buydu). Sonucu: AI geri bildirimi alınıyor ama
-- geçmişe yazılamıyor; app/actions/ai-feedback.ts insert hatasını okumadığı
-- için sorun sessiz kaldı ve "Son geri bildirim" hep boş göründü.
--
-- schema.sql'deki tanımın aynısı; zaten varsa hiçbir şey değişmez.
-- ============================================================

create table if not exists public.ai_feedback_requests (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document_uploads(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  feedback_text text,
  model text,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ai_feedback_requests_document_id_idx
  on public.ai_feedback_requests(document_id);

alter table public.ai_feedback_requests enable row level security;

revoke all on public.ai_feedback_requests from public, anon;
grant select, insert on public.ai_feedback_requests to authenticated;
grant all on public.ai_feedback_requests to service_role;

drop policy if exists "Users can view their own ai feedback" on public.ai_feedback_requests;
create policy "Users can view their own ai feedback"
  on public.ai_feedback_requests
  for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can create their own ai feedback" on public.ai_feedback_requests;
create policy "Users can create their own ai feedback"
  on public.ai_feedback_requests
  for insert
  to authenticated
  with check (requested_by = (select auth.uid()));

-- Abonelik kapısı (20260924100003) bu tabloyu atlamıştı; şimdi kurulur.
drop trigger if exists guard_subscription_trigger on public.ai_feedback_requests;
create trigger guard_subscription_trigger
  before insert on public.ai_feedback_requests
  for each row execute function public.guard_subscription();

notify pgrst, 'reload schema';
