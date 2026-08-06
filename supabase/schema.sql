create extension if not exists pgcrypto;

create table if not exists public.academic_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academic_projects_owner_id_idx
  on public.academic_projects(owner_id);

create index if not exists academic_projects_due_date_idx
  on public.academic_projects(due_date);

alter table public.academic_projects enable row level security;

grant select, insert, update, delete on public.academic_projects to authenticated;

create policy "Users can view their own academic projects"
  on public.academic_projects
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can create their own academic projects"
  on public.academic_projects
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can update their own academic projects"
  on public.academic_projects
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own academic projects"
  on public.academic_projects
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);
