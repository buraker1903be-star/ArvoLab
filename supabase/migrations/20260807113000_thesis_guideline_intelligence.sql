-- AI-assisted thesis guideline registry.
-- Existing thesis_guidelines data remains compatible.

alter table public.thesis_guidelines
  add column if not exists university_id uuid references public.universities(id) on delete set null,
  add column if not exists academic_unit_id uuid references public.academic_units(id) on delete set null,
  add column if not exists document_title text,
  add column if not exists document_type text not null default 'guideline'
    check (document_type in ('guideline', 'template', 'directive', 'writing_rules', 'other')),
  add column if not exists publication_date date,
  add column if not exists effective_from date,
  add column if not exists source_checksum text,
  add column if not exists source_content_type text,
  add column if not exists extracted_rules jsonb not null default '{}'::jsonb,
  add column if not exists ai_analysis jsonb,
  add column if not exists ai_model text,
  add column if not exists analysis_status text not null default 'pending'
    check (analysis_status in ('pending', 'analyzed', 'failed', 'needs_review', 'approved')),
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists thesis_guidelines_university_id_idx
  on public.thesis_guidelines (university_id);

create index if not exists thesis_guidelines_academic_unit_id_idx
  on public.thesis_guidelines (academic_unit_id);

create index if not exists thesis_guidelines_active_lookup_idx
  on public.thesis_guidelines (university_id, academic_unit_id, is_active, effective_from desc);

create unique index if not exists thesis_guidelines_source_checksum_unique_idx
  on public.thesis_guidelines (source_checksum)
  where source_checksum is not null;

create or replace function public.set_thesis_guideline_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_thesis_guideline_updated_at() from public;

drop trigger if exists set_thesis_guideline_updated_at_trigger on public.thesis_guidelines;
create trigger set_thesis_guideline_updated_at_trigger
  before update on public.thesis_guidelines
  for each row execute function public.set_thesis_guideline_updated_at();

-- Backfill relational university references where names match exactly.
update public.thesis_guidelines g
set university_id = u.id
from public.universities u
where g.university_id is null
  and lower(trim(g.university_name)) = lower(trim(u.name));

-- Backfill institute/faculty references where the unit name matches within the university.
update public.thesis_guidelines g
set academic_unit_id = au.id
from public.academic_units au
where g.academic_unit_id is null
  and g.university_id = au.university_id
  and g.institute_name is not null
  and lower(trim(g.institute_name)) = lower(trim(au.name))
  and au.unit_type in ('institute', 'faculty', 'school', 'vocational_school', 'conservatory');

comment on column public.thesis_guidelines.extracted_rules is
  'Normalized, human-reviewable thesis formatting rules extracted from the official source.';
comment on column public.thesis_guidelines.ai_analysis is
  'Raw structured AI extraction result. It must not become active without academic-manager review.';
comment on column public.thesis_guidelines.analysis_status is
  'AI extraction and human review lifecycle. Only approved records should drive strict document checks.';
