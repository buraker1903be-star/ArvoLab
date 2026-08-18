alter table public.universities
  add column if not exists guideline_discovery_checked_at timestamptz,
  add column if not exists guideline_discovery_status text,
  add column if not exists guideline_discovery_note text;

create index if not exists universities_guideline_discovery_idx
  on public.universities (guideline_discovery_checked_at asc nulls first);

grant select, update on table public.universities to service_role;
grant select, insert, update, delete on table public.thesis_guidelines to service_role;

