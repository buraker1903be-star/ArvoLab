create extension if not exists pgcrypto;

-- ============================================================
-- Roller ve Kurum Yapısı
-- Proje dosyası Bölüm 3 "Hedef Kullanıcılar ve Roller" esas alınmıştır.
-- ============================================================
do $$ begin
  create type public.user_role as enum (
    'client',            -- Üye/Öğrenci (varsayılan — kendi çalışmasını kendi yürütür)
    'employee',          -- Çalışan
    'expert',            -- Uzman
    'controller',        -- Kontrolör
    'academic_manager',  -- Akademik Yönetici
    'system_admin',      -- Sistem Yöneticisi
    'founder'            -- Kurucu/Yönetim
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  full_name text,
  role public.user_role not null default 'client',
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

grant select on public.organizations to authenticated;
grant insert, update on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;

drop policy if exists "Members can view their own organization" on public.organizations;
create policy "Members can view their own organization"
  on public.organizations
  for select
  to authenticated
  using (
    id in (select organization_id from public.profiles where id = (select auth.uid()))
    or public.has_role(array['system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can view profiles in their organization" on public.profiles;
create policy "Users can view profiles in their organization"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
    or public.has_role(array['system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can update their own profile (not their role)" on public.profiles;
create policy "Users can update their own profile (not their role)"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.organization_id is distinct from old.organization_id)
     and not public.has_role(array['system_admin','founder']::public.user_role[]) then
    raise exception 'Rol veya kurum değişikliği için yetkiniz yok.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_self_role_escalation_trigger on public.profiles;
create trigger prevent_self_role_escalation_trigger
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

drop policy if exists "System admins and founders can update any profile" on public.profiles;
create policy "System admins and founders can update any profile"
  on public.profiles
  for update
  to authenticated
  using (public.has_role(array['system_admin','founder']::public.user_role[]))
  with check (public.has_role(array['system_admin','founder']::public.user_role[]));

drop policy if exists "System admins and founders can create organizations" on public.organizations;
create policy "System admins and founders can create organizations"
  on public.organizations
  for insert
  to authenticated
  with check (public.has_role(array['system_admin','founder']::public.user_role[]));

drop policy if exists "System admins and founders can update organizations" on public.organizations;
create policy "System admins and founders can update organizations"
  on public.organizations
  for update
  to authenticated
  using (public.has_role(array['system_admin','founder']::public.user_role[]))
  with check (public.has_role(array['system_admin','founder']::public.user_role[]));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.has_role(roles public.user_role[])
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any(roles)
  );
$$;

create table if not exists public.academic_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  assignee_id uuid references public.profiles(id),
  title text not null check (char_length(title) between 3 and 240),
  project_type text not null check (project_type in ('thesis', 'article', 'project', 'associate-professorship')),
  university text,
  institute text,
  department text,
  citation_style text not null default 'apa7' check (citation_style in ('apa7', 'vancouver', 'chicago', 'ieee')),
  research_method text check (research_method in ('quantitative', 'qualitative', 'mixed', 'review')),
  assignee_name text,
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'planned', 'writing', 'analysis', 'review', 'revision', 'turnitin', 'ready', 'delivered', 'archived')),
  notes text,
  progress smallint not null default 0 check (progress between 0 and 100),
  controller_approved_by uuid references public.profiles(id),
  controller_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academic_projects_owner_id_idx
  on public.academic_projects(owner_id);

create index if not exists academic_projects_due_date_idx
  on public.academic_projects(due_date);

alter table public.academic_projects enable row level security;

grant select, insert, update, delete on public.academic_projects to authenticated;

drop policy if exists "View own, assigned, or oversight-role projects" on public.academic_projects;
create policy "View own, assigned, or oversight-role projects"
  on public.academic_projects
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can create their own academic projects" on public.academic_projects;
create policy "Users can create their own academic projects"
  on public.academic_projects
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Update own, assigned, or oversight-role projects" on public.academic_projects;
create policy "Update own, assigned, or oversight-role projects"
  on public.academic_projects
  for update
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  )
  with check (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Owner or oversight-role can delete projects" on public.academic_projects;
create policy "Owner or oversight-role can delete projects"
  on public.academic_projects
  for delete
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  );

create table if not exists public.citation_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.academic_projects(id) on delete cascade,
  project_title text,
  raw_reference_list text not null,
  body_text text,
  parsed_references jsonb not null default '[]'::jsonb,
  in_text_citations jsonb not null default '[]'::jsonb,
  cross_check jsonb not null default '{}'::jsonb,
  compliance_score numeric,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists citation_checks_project_id_idx
  on public.citation_checks(project_id);

create index if not exists citation_checks_created_by_idx
  on public.citation_checks(created_by);

alter table public.citation_checks enable row level security;

grant select, insert, delete on public.citation_checks to authenticated;

drop policy if exists "Users can view their own citation checks" on public.citation_checks;
create policy "Users can view their own citation checks"
  on public.citation_checks
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.academic_projects p
      where p.id = citation_checks.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can create their own citation checks" on public.citation_checks;
create policy "Users can create their own citation checks"
  on public.citation_checks
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "Users can delete their own citation checks" on public.citation_checks;
create policy "Users can delete their own citation checks"
  on public.citation_checks
  for delete
  to authenticated
  using (created_by = (select auth.uid()));

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

create table if not exists public.document_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.academic_projects(id) on delete cascade,
  project_title text,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  extracted_text text,
  reference_text text,
  analysis jsonb,
  status text not null default 'processing' check (status in ('processing', 'analyzed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists document_uploads_project_id_idx
  on public.document_uploads(project_id);

create index if not exists document_uploads_uploaded_by_idx
  on public.document_uploads(uploaded_by);

alter table public.document_uploads enable row level security;

grant select, insert, delete on public.document_uploads to authenticated;

drop policy if exists "Users can view their own document uploads" on public.document_uploads;
create policy "Users can view their own document uploads"
  on public.document_uploads
  for select
  to authenticated
  using (
    uploaded_by = (select auth.uid())
    or exists (
      select 1 from public.academic_projects p
      where p.id = document_uploads.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can create their own document uploads" on public.document_uploads;
create policy "Users can create their own document uploads"
  on public.document_uploads
  for insert
  to authenticated
  with check (uploaded_by = (select auth.uid()));

drop policy if exists "Users can delete their own document uploads" on public.document_uploads;
create policy "Users can delete their own document uploads"
  on public.document_uploads
  for delete
  to authenticated
  using (uploaded_by = (select auth.uid()));

drop policy if exists "Users can upload to their own folder" on storage.objects;
create policy "Users can upload to their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can read their own files" on storage.objects;
create policy "Users can read their own files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
    )
  );

drop policy if exists "Users can delete their own files" on storage.objects;
create policy "Users can delete their own files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create table if not exists public.thesis_guidelines (
  id uuid primary key default gen_random_uuid(),
  university_name text not null,
  institute_name text,
  version_label text,
  source_url text,
  citation_style text not null default 'apa7' check (citation_style in ('apa7', 'vancouver', 'chicago', 'ieee')),
  required_sections text[] not null default '{}',
  min_pages integer,
  max_pages integer,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists thesis_guidelines_university_idx
  on public.thesis_guidelines(university_name);

alter table public.thesis_guidelines enable row level security;

grant select, insert, update, delete on public.thesis_guidelines to authenticated;

drop policy if exists "All authenticated users can view guidelines" on public.thesis_guidelines;
create policy "All authenticated users can view guidelines"
  on public.thesis_guidelines
  for select
  to authenticated
  using (true);

drop policy if exists "Academic managers and above can create guidelines" on public.thesis_guidelines;
create policy "Academic managers and above can create guidelines"
  on public.thesis_guidelines
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Academic managers and above can update guidelines" on public.thesis_guidelines;
create policy "Academic managers and above can update guidelines"
  on public.thesis_guidelines
  for update
  to authenticated
  using (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]))
  with check (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]));

drop policy if exists "Academic managers and above can delete guidelines" on public.thesis_guidelines;
create policy "Academic managers and above can delete guidelines"
  on public.thesis_guidelines
  for delete
  to authenticated
  using (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]));

alter table public.academic_projects
  add column if not exists guideline_id uuid references public.thesis_guidelines(id);

create table if not exists public.scoring_criteria (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  category_group text,
  points_per_unit numeric not null default 0,
  notes text,
  is_active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.scoring_criteria enable row level security;

grant select, insert, update, delete on public.scoring_criteria to authenticated;

drop policy if exists "All authenticated users can view scoring criteria" on public.scoring_criteria;
create policy "All authenticated users can view scoring criteria"
  on public.scoring_criteria
  for select
  to authenticated
  using (true);

drop policy if exists "Academic managers and above can manage scoring criteria" on public.scoring_criteria;
create policy "Academic managers and above can manage scoring criteria"
  on public.scoring_criteria
  for all
  to authenticated
  using (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]))
  with check (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]));

create table if not exists public.academic_score_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  criteria_id uuid not null references public.scoring_criteria(id),
  title text not null,
  unit_count numeric not null default 1 check (unit_count > 0),
  computed_points numeric not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists academic_score_entries_owner_id_idx
  on public.academic_score_entries(owner_id);

alter table public.academic_score_entries enable row level security;

grant select, insert, delete on public.academic_score_entries to authenticated;

drop policy if exists "Users can view their own score entries" on public.academic_score_entries;
create policy "Users can view their own score entries"
  on public.academic_score_entries
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can create their own score entries" on public.academic_score_entries;
create policy "Users can create their own score entries"
  on public.academic_score_entries
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Users can delete their own score entries" on public.academic_score_entries;
create policy "Users can delete their own score entries"
  on public.academic_score_entries
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

create table if not exists public.consultancy_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.academic_projects(id) on delete cascade,
  project_title text,
  requested_by uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('analysis', 'editing', 'methodology', 'statistics', 'full_review', 'other')),
  message text,
  status text not null default 'open' check (status in ('open', 'accepted', 'completed', 'cancelled')),
  assigned_expert_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultancy_requests_status_idx
  on public.consultancy_requests(status);

create index if not exists consultancy_requests_requested_by_idx
  on public.consultancy_requests(requested_by);

alter table public.consultancy_requests enable row level security;

grant select, insert, update, delete on public.consultancy_requests to authenticated;

drop policy if exists "View own, assigned, or expert-eligible requests" on public.consultancy_requests;
create policy "View own, assigned, or expert-eligible requests"
  on public.consultancy_requests
  for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    or assigned_expert_id = (select auth.uid())
    or public.has_role(array['expert','controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can create their own requests" on public.consultancy_requests;
create policy "Users can create their own requests"
  on public.consultancy_requests
  for insert
  to authenticated
  with check (requested_by = (select auth.uid()));

drop policy if exists "Owner or expert-eligible roles can update requests" on public.consultancy_requests;
create policy "Owner or expert-eligible roles can update requests"
  on public.consultancy_requests
  for update
  to authenticated
  using (
    requested_by = (select auth.uid())
    or assigned_expert_id = (select auth.uid())
    or public.has_role(array['expert','controller','academic_manager','system_admin','founder']::public.user_role[])
  )
  with check (
    requested_by = (select auth.uid())
    or assigned_expert_id = (select auth.uid())
    or public.has_role(array['expert','controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Owner can delete their own requests" on public.consultancy_requests;
create policy "Owner can delete their own requests"
  on public.consultancy_requests
  for delete
  to authenticated
  using (requested_by = (select auth.uid()));

create table if not exists public.originality_checks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document_uploads(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  overall_similarity numeric not null default 0,
  compared_document_count integer not null default 0,
  matches jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists originality_checks_document_id_idx
  on public.originality_checks(document_id);

alter table public.originality_checks enable row level security;

grant select, insert, delete on public.originality_checks to authenticated;

drop policy if exists "Users can view their own originality checks" on public.originality_checks;
create policy "Users can view their own originality checks"
  on public.originality_checks
  for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can create their own originality checks" on public.originality_checks;
create policy "Users can create their own originality checks"
  on public.originality_checks
  for insert
  to authenticated
  with check (requested_by = (select auth.uid()));

drop policy if exists "Users can delete their own originality checks" on public.originality_checks;
create policy "Users can delete their own originality checks"
  on public.originality_checks
  for delete
  to authenticated
  using (requested_by = (select auth.uid()));

create table if not exists public.project_manuscripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.academic_projects(id) on delete cascade,
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  plain_text text,
  word_count integer not null default 0,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_manuscripts enable row level security;

grant select, insert, update on public.project_manuscripts to authenticated;

drop policy if exists "Users can view manuscripts they have project access to" on public.project_manuscripts;
create policy "Users can view manuscripts they have project access to"
  on public.project_manuscripts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.academic_projects p
      where p.id = project_manuscripts.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can create manuscripts for their own projects" on public.project_manuscripts;
create policy "Users can create manuscripts for their own projects"
  on public.project_manuscripts
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.academic_projects p
      where p.id = project_manuscripts.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
  );

drop policy if exists "Users can update manuscripts they have project access to" on public.project_manuscripts;
create policy "Users can update manuscripts they have project access to"
  on public.project_manuscripts
  for update
  to authenticated
  using (
    exists (
      select 1 from public.academic_projects p
      where p.id = project_manuscripts.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.academic_projects p
      where p.id = project_manuscripts.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
  );

create table if not exists public.literature_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.academic_projects(id) on delete set null,
  title text not null,
  authors text,
  year text,
  source_type text not null default 'article' check (source_type in ('article', 'book', 'chapter', 'thesis', 'report', 'website', 'other')),
  doi_or_url text,
  status text not null default 'to_review' check (status in ('to_review', 'read', 'used')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists literature_sources_owner_id_idx
  on public.literature_sources(owner_id);

alter table public.literature_sources enable row level security;

grant select, insert, update, delete on public.literature_sources to authenticated;

drop policy if exists "Users can view their own literature sources" on public.literature_sources;
create policy "Users can view their own literature sources"
  on public.literature_sources
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can create their own literature sources" on public.literature_sources;
create policy "Users can create their own literature sources"
  on public.literature_sources
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Users can update their own literature sources" on public.literature_sources;
create policy "Users can update their own literature sources"
  on public.literature_sources
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Users can delete their own literature sources" on public.literature_sources;
create policy "Users can delete their own literature sources"
  on public.literature_sources
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

create table if not exists public.app_support_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  category text not null default 'other' check (category in ('bug', 'access', 'feature_request', 'billing', 'other')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_support_requests_status_idx
  on public.app_support_requests(status);

alter table public.app_support_requests enable row level security;

grant select, insert, update on public.app_support_requests to authenticated;

drop policy if exists "Users can view their own support requests" on public.app_support_requests;
create policy "Users can view their own support requests"
  on public.app_support_requests
  for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    or public.has_role(array['system_admin','founder']::public.user_role[])
  );

drop policy if exists "Users can create their own support requests" on public.app_support_requests;
create policy "Users can create their own support requests"
  on public.app_support_requests
  for insert
  to authenticated
  with check (requested_by = (select auth.uid()));

drop policy if exists "Owner or system admin can update support requests" on public.app_support_requests;
create policy "Owner or system admin can update support requests"
  on public.app_support_requests
  for update
  to authenticated
  using (
    requested_by = (select auth.uid())
    or public.has_role(array['system_admin','founder']::public.user_role[])
  )
  with check (
    requested_by = (select auth.uid())
    or public.has_role(array['system_admin','founder']::public.user_role[])
  );

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text,
  university_type text not null check (university_type in ('devlet', 'vakif')),
  created_at timestamptz not null default now()
);

alter table public.universities enable row level security;
grant select, insert on public.universities to authenticated;

drop policy if exists "All authenticated users can view universities" on public.universities;
create policy "All authenticated users can view universities"
  on public.universities
  for select
  to authenticated
  using (true);

drop policy if exists "Academic managers and above can add universities" on public.universities;
create policy "Academic managers and above can add universities"
  on public.universities
  for insert
  to authenticated
  with check (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]));
insert into public.universities (name, city, university_type) values
  ('Adana Alparslan Türkeş Bilim ve Teknoloji Üniversitesi', 'Adana', 'devlet'),
  ('Çukurova Üniversitesi', 'Adana', 'devlet'),
  ('Adıyaman Üniversitesi', 'Adıyaman', 'devlet'),
  ('Afyon Kocatepe Üniversitesi', 'Afyonkarahisar', 'devlet'),
  ('Afyonkarahisar Sağlık Bilimleri Üniversitesi', 'Afyonkarahisar', 'devlet'),
  ('Ağrı İbrahim Çeçen Üniversitesi', 'Ağrı', 'devlet'),
  ('Aksaray Üniversitesi', 'Aksaray', 'devlet'),
  ('Amasya Üniversitesi', 'Amasya', 'devlet'),
  ('Ankara Üniversitesi', 'Ankara', 'devlet'),
  ('Ankara Müzik ve Güzel Sanatlar Üniversitesi', 'Ankara', 'devlet'),
  ('Ankara Hacı Bayram Veli Üniversitesi', 'Ankara', 'devlet'),
  ('Ankara Sosyal Bilimler Üniversitesi', 'Ankara', 'devlet'),
  ('Gazi Üniversitesi', 'Ankara', 'devlet'),
  ('Hacettepe Üniversitesi', 'Ankara', 'devlet'),
  ('Orta Doğu Teknik Üniversitesi (ODTÜ)', 'Ankara', 'devlet'),
  ('Ankara Yıldırım Beyazıt Üniversitesi', 'Ankara', 'devlet'),
  ('Milli Savunma Üniversitesi', 'Ankara', 'devlet'),
  ('Polis Akademisi', 'Ankara', 'devlet'),
  ('Ankara Bilim Üniversitesi', 'Ankara', 'vakif'),
  ('Ankara Medipol Üniversitesi', 'Ankara', 'vakif'),
  ('Atılım Üniversitesi', 'Ankara', 'vakif'),
  ('Başkent Üniversitesi', 'Ankara', 'vakif'),
  ('Çankaya Üniversitesi', 'Ankara', 'vakif'),
  ('Bilkent Üniversitesi', 'Ankara', 'vakif'),
  ('Lokman Hekim Üniversitesi', 'Ankara', 'vakif'),
  ('OSTIM Teknik Üniversitesi', 'Ankara', 'vakif'),
  ('TED Üniversitesi', 'Ankara', 'vakif'),
  ('TOBB Ekonomi ve Teknoloji Üniversitesi', 'Ankara', 'vakif'),
  ('Ufuk Üniversitesi', 'Ankara', 'vakif'),
  ('Türk Hava Kurumu Üniversitesi', 'Ankara', 'vakif'),
  ('Yüksek İhtisas Üniversitesi', 'Ankara', 'vakif'),
  ('Akdeniz Üniversitesi', 'Antalya', 'devlet'),
  ('Alanya Alaaddin Keykubat Üniversitesi', 'Antalya', 'devlet'),
  ('Alanya Üniversitesi', 'Antalya', 'vakif'),
  ('Antalya Belek Üniversitesi', 'Antalya', 'vakif'),
  ('Antalya Bilim Üniversitesi', 'Antalya', 'vakif'),
  ('Ardahan Üniversitesi', 'Ardahan', 'devlet'),
  ('Artvin Çoruh Üniversitesi', 'Artvin', 'devlet'),
  ('Aydın Adnan Menderes Üniversitesi', 'Aydın', 'devlet'),
  ('Balıkesir Üniversitesi', 'Balıkesir', 'devlet'),
  ('Bandırma Onyedi Eylül Üniversitesi', 'Balıkesir', 'devlet'),
  ('Bartın Üniversitesi', 'Bartın', 'devlet'),
  ('Batman Üniversitesi', 'Batman', 'devlet'),
  ('Bayburt Üniversitesi', 'Bayburt', 'devlet'),
  ('Bilecik Şeyh Edebali Üniversitesi', 'Bilecik', 'devlet'),
  ('Bingöl Üniversitesi', 'Bingöl', 'devlet'),
  ('Bitlis Eren Üniversitesi', 'Bitlis', 'devlet'),
  ('Bolu Abant İzzet Baysal Üniversitesi', 'Bolu', 'devlet'),
  ('Burdur Mehmet Akif Ersoy Üniversitesi', 'Burdur', 'devlet'),
  ('Bursa Teknik Üniversitesi', 'Bursa', 'devlet'),
  ('Bursa Uludağ Üniversitesi', 'Bursa', 'devlet'),
  ('Mudanya Üniversitesi', 'Bursa', 'vakif'),
  ('Çanakkale Onsekiz Mart Üniversitesi', 'Çanakkale', 'devlet'),
  ('Çankırı Karatekin Üniversitesi', 'Çankırı', 'devlet'),
  ('Hitit Üniversitesi', 'Çorum', 'devlet'),
  ('Pamukkale Üniversitesi', 'Denizli', 'devlet'),
  ('Dicle Üniversitesi', 'Diyarbakır', 'devlet'),
  ('Düzce Üniversitesi', 'Düzce', 'devlet'),
  ('Trakya Üniversitesi', 'Edirne', 'devlet'),
  ('Fırat Üniversitesi', 'Elazığ', 'devlet'),
  ('Erzincan Binali Yıldırım Üniversitesi', 'Erzincan', 'devlet'),
  ('Atatürk Üniversitesi', 'Erzurum', 'devlet'),
  ('Erzurum Teknik Üniversitesi', 'Erzurum', 'devlet'),
  ('Anadolu Üniversitesi', 'Eskişehir', 'devlet'),
  ('Eskişehir Osmangazi Üniversitesi', 'Eskişehir', 'devlet'),
  ('Eskişehir Teknik Üniversitesi', 'Eskişehir', 'devlet'),
  ('Gaziantep Üniversitesi', 'Gaziantep', 'devlet'),
  ('Gaziantep İslam Bilim ve Teknoloji Üniversitesi', 'Gaziantep', 'devlet'),
  ('Hasan Kalyoncu Üniversitesi', 'Gaziantep', 'vakif'),
  ('Sanko Üniversitesi', 'Gaziantep', 'vakif'),
  ('Giresun Üniversitesi', 'Giresun', 'devlet'),
  ('Gümüşhane Üniversitesi', 'Gümüşhane', 'devlet'),
  ('Hakkari Üniversitesi', 'Hakkâri', 'devlet'),
  ('İskenderun Teknik Üniversitesi', 'Hatay', 'devlet'),
  ('Hatay Mustafa Kemal Üniversitesi', 'Hatay', 'devlet'),
  ('Iğdır Üniversitesi', 'Iğdır', 'devlet'),
  ('Süleyman Demirel Üniversitesi', 'Isparta', 'devlet'),
  ('Isparta Uygulamalı Bilimler Üniversitesi', 'Isparta', 'devlet'),
  ('Boğaziçi Üniversitesi', 'İstanbul', 'devlet'),
  ('Galatasaray Üniversitesi', 'İstanbul', 'devlet'),
  ('İstanbul Medeniyet Üniversitesi', 'İstanbul', 'devlet'),
  ('İstanbul Teknik Üniversitesi', 'İstanbul', 'devlet'),
  ('İstanbul Üniversitesi', 'İstanbul', 'devlet'),
  ('İstanbul Üniversitesi-Cerrahpaşa', 'İstanbul', 'devlet'),
  ('Marmara Üniversitesi', 'İstanbul', 'devlet'),
  ('Mimar Sinan Güzel Sanatlar Üniversitesi', 'İstanbul', 'devlet'),
  ('Türk-Alman Üniversitesi', 'İstanbul', 'devlet'),
  ('Türk-Japon Bilim ve Teknoloji Üniversitesi', 'İstanbul', 'devlet'),
  ('Sağlık Bilimleri Üniversitesi', 'İstanbul', 'devlet'),
  ('Yıldız Teknik Üniversitesi', 'İstanbul', 'devlet'),
  ('Acıbadem Mehmet Ali Aydınlar Üniversitesi', 'İstanbul', 'vakif'),
  ('Altınbaş Üniversitesi', 'İstanbul', 'vakif'),
  ('Bahçeşehir Üniversitesi', 'İstanbul', 'vakif'),
  ('Beykoz Üniversitesi', 'İstanbul', 'vakif'),
  ('Bezmialem Vakıf Üniversitesi', 'İstanbul', 'vakif'),
  ('Biruni Üniversitesi', 'İstanbul', 'vakif'),
  ('Demiroğlu Bilim Üniversitesi', 'İstanbul', 'vakif'),
  ('Doğuş Üniversitesi', 'İstanbul', 'vakif'),
  ('Fatih Sultan Mehmet Vakıf Üniversitesi', 'İstanbul', 'vakif'),
  ('Fenerbahçe Üniversitesi', 'İstanbul', 'vakif'),
  ('Haliç Üniversitesi', 'İstanbul', 'vakif'),
  ('İbn Haldun Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul 29 Mayıs Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Arel Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Atlas Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Aydın Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Beykent Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Bilgi Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Ticaret Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Esenyurt Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Galata Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Gedik Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Gelişim Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Sağlık ve Teknoloji Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Kent Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Kültür Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Medipol Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Nişantaşı Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Okan Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Rumeli Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Sabahattin Zaim Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Topkapı Üniversitesi', 'İstanbul', 'vakif'),
  ('İstanbul Yeni Yüzyıl Üniversitesi', 'İstanbul', 'vakif'),
  ('Işık Üniversitesi', 'İstanbul', 'vakif'),
  ('İstinye Üniversitesi', 'İstanbul', 'vakif'),
  ('Kadir Has Üniversitesi', 'İstanbul', 'vakif'),
  ('Koç Üniversitesi', 'İstanbul', 'vakif'),
  ('Maltepe Üniversitesi', 'İstanbul', 'vakif'),
  ('MEF Üniversitesi', 'İstanbul', 'vakif'),
  ('Özyeğin Üniversitesi', 'İstanbul', 'vakif'),
  ('Piri Reis Üniversitesi', 'İstanbul', 'vakif'),
  ('Sabancı Üniversitesi', 'İstanbul', 'vakif'),
  ('Üsküdar Üniversitesi', 'İstanbul', 'vakif'),
  ('Yeditepe Üniversitesi', 'İstanbul', 'vakif'),
  ('Dokuz Eylül Üniversitesi', 'İzmir', 'devlet'),
  ('Ege Üniversitesi', 'İzmir', 'devlet'),
  ('İzmir Yüksek Teknoloji Enstitüsü', 'İzmir', 'devlet'),
  ('İzmir Kâtip Çelebi Üniversitesi', 'İzmir', 'devlet'),
  ('İzmir Bakırçay Üniversitesi', 'İzmir', 'devlet'),
  ('İzmir Demokrasi Üniversitesi', 'İzmir', 'devlet'),
  ('Yaşar Üniversitesi', 'İzmir', 'vakif'),
  ('İzmir Ekonomi Üniversitesi', 'İzmir', 'vakif'),
  ('İzmir Tınaztepe Üniversitesi', 'İzmir', 'vakif'),
  ('Kahramanmaraş İstiklal Üniversitesi', 'Kahramanmaraş', 'devlet'),
  ('Kahramanmaraş Sütçü İmam Üniversitesi', 'Kahramanmaraş', 'devlet'),
  ('Karabük Üniversitesi', 'Karabük', 'devlet'),
  ('Karamanoğlu Mehmetbey Üniversitesi', 'Karaman', 'devlet'),
  ('Kafkas Üniversitesi', 'Kars', 'devlet'),
  ('Kastamonu Üniversitesi', 'Kastamonu', 'devlet'),
  ('Abdullah Gül Üniversitesi', 'Kayseri', 'devlet'),
  ('Erciyes Üniversitesi', 'Kayseri', 'devlet'),
  ('Kayseri Üniversitesi', 'Kayseri', 'devlet'),
  ('Nuh Naci Yazgan Üniversitesi', 'Kayseri', 'vakif'),
  ('Kırıkkale Üniversitesi', 'Kırıkkale', 'devlet'),
  ('Kırklareli Üniversitesi', 'Kırklareli', 'devlet'),
  ('Kırşehir Ahi Evran Üniversitesi', 'Kırşehir', 'devlet'),
  ('Kilis 7 Aralık Üniversitesi', 'Kilis', 'devlet'),
  ('Gebze Teknik Üniversitesi', 'Kocaeli', 'devlet'),
  ('Kocaeli Üniversitesi', 'Kocaeli', 'devlet'),
  ('Kocaeli Sağlık ve Teknoloji Üniversitesi', 'Kocaeli', 'vakif'),
  ('Konya Teknik Üniversitesi', 'Konya', 'devlet'),
  ('Necmettin Erbakan Üniversitesi', 'Konya', 'devlet'),
  ('Selçuk Üniversitesi', 'Konya', 'devlet'),
  ('Konya Gıda ve Tarım Üniversitesi', 'Konya', 'vakif'),
  ('KTO Karatay Üniversitesi', 'Konya', 'vakif'),
  ('Kütahya Dumlupınar Üniversitesi', 'Kütahya', 'devlet'),
  ('Kütahya Sağlık Bilimleri Üniversitesi', 'Kütahya', 'devlet'),
  ('İnönü Üniversitesi', 'Malatya', 'devlet'),
  ('Malatya Turgut Özal Üniversitesi', 'Malatya', 'devlet'),
  ('Manisa Celal Bayar Üniversitesi', 'Manisa', 'devlet'),
  ('Mardin Artuklu Üniversitesi', 'Mardin', 'devlet'),
  ('Mersin Üniversitesi', 'Mersin', 'devlet'),
  ('Tarsus Üniversitesi', 'Mersin', 'devlet'),
  ('Çağ Üniversitesi', 'Mersin', 'vakif'),
  ('Toros Üniversitesi', 'Mersin', 'vakif'),
  ('Muğla Sıtkı Koçman Üniversitesi', 'Muğla', 'devlet'),
  ('Muş Alparslan Üniversitesi', 'Muş', 'devlet'),
  ('Nevşehir Hacı Bektaş Veli Üniversitesi', 'Nevşehir', 'devlet'),
  ('Kapadokya Üniversitesi', 'Nevşehir', 'vakif'),
  ('Niğde Ömer Halisdemir Üniversitesi', 'Niğde', 'devlet'),
  ('Ordu Üniversitesi', 'Ordu', 'devlet'),
  ('Osmaniye Korkut Ata Üniversitesi', 'Osmaniye', 'devlet'),
  ('Recep Tayyip Erdoğan Üniversitesi', 'Rize', 'devlet'),
  ('Sakarya Üniversitesi', 'Sakarya', 'devlet'),
  ('Sakarya Uygulamalı Bilimler Üniversitesi', 'Sakarya', 'devlet'),
  ('Ondokuz Mayıs Üniversitesi', 'Samsun', 'devlet'),
  ('Samsun Üniversitesi', 'Samsun', 'devlet'),
  ('Siirt Üniversitesi', 'Siirt', 'devlet'),
  ('Sinop Üniversitesi', 'Sinop', 'devlet'),
  ('Sivas Cumhuriyet Üniversitesi', 'Sivas', 'devlet'),
  ('Sivas Bilim ve Teknoloji Üniversitesi', 'Sivas', 'devlet'),
  ('Harran Üniversitesi', 'Şanlıurfa', 'devlet'),
  ('Şırnak Üniversitesi', 'Şırnak', 'devlet'),
  ('Tekirdağ Namık Kemal Üniversitesi', 'Tekirdağ', 'devlet'),
  ('Tokat Gaziosmanpaşa Üniversitesi', 'Tokat', 'devlet'),
  ('Karadeniz Teknik Üniversitesi', 'Trabzon', 'devlet'),
  ('Trabzon Üniversitesi', 'Trabzon', 'devlet'),
  ('Avrasya Üniversitesi', 'Trabzon', 'vakif'),
  ('Munzur Üniversitesi', 'Tunceli', 'devlet'),
  ('Uşak Üniversitesi', 'Uşak', 'devlet'),
  ('Van Yüzüncü Yıl Üniversitesi', 'Van', 'devlet'),
  ('Yalova Üniversitesi', 'Yalova', 'devlet'),
  ('Yozgat Bozok Üniversitesi', 'Yozgat', 'devlet'),
  ('Zonguldak Bülent Ecevit Üniversitesi', 'Zonguldak', 'devlet')
on conflict (name) do nothing;
-- ============================================================
-- AI Geri Bildirimi (ChatGPT/OpenAI entegrasyonu)
-- ÖNEMLİ: Bu özellik İÇERİK ÜRETMEZ. Yapay zeka yalnızca
-- yüklenen belgenin YAPISI ve RETORİĞİ hakkında öğretici geri
-- bildirim verir (ör. "giriş bölümünde amaç cümlesi eksik").
-- Öğrencinin çalışmasına doğrudan yapıştırılabilecek metin
-- ÜRETMEZ; bulguların araştırma bağlamındaki anlamını
-- YORUMLAMAZ. Bu ilke prompt seviyesinde (lib/ai-feedback.ts)
-- ve arayüz seviyesinde zorunlu kılınır.
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

grant select, insert on public.ai_feedback_requests to authenticated;

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

-- ============================================================
-- Sayfa Kenar Boşlukları (Panelde Yazma)
-- Türkiye'deki üniversitelerin tez yazım kılavuzlarında sık talep
-- edilen sayfa kenar boşluğu ayarları. Kurum/kılavuza göre değiştiği
-- için sabit bir değer dayatılmaz; kullanıcı serbestçe düzenler ve
-- Word'e aktarımda gerçekten uygulanır.
-- ============================================================
alter table public.project_manuscripts
  add column if not exists margin_top_cm numeric not null default 2.5,
  add column if not exists margin_bottom_cm numeric not null default 2.5,
  add column if not exists margin_left_cm numeric not null default 2.5,
  add column if not exists margin_right_cm numeric not null default 2.5;

-- ============================================================
-- Sayfa Numarası (Panelde Yazma)
-- Türkiye'deki üniversitelerin neredeyse tamamı tez/makalede
-- sayfa numarası ister; varsayılan olarak açık, kullanıcı isterse
-- kapatabilir.
-- ============================================================
alter table public.project_manuscripts
  add column if not exists show_page_numbers boolean not null default true;

-- ============================================================
-- Kapak Sayfası Şablonu (Panelde Yazma)
-- Türkiye'deki tez/makale yazım kılavuzlarının neredeyse tamamında
-- istenen standart kapak sayfası bilgileri. Doldurulursa Word'e
-- aktarımda belgenin ilk sayfası olarak otomatik oluşturulur.
-- ============================================================
alter table public.project_manuscripts
  add column if not exists cover_page jsonb;
