-- ArvoLab security + performance foundation
-- Restrict sensitive academic_projects fields at the database boundary and
-- add indexes used by the most common RLS and dashboard access paths.

create index if not exists profiles_organization_id_idx
  on public.profiles (organization_id);

create index if not exists academic_projects_assignee_id_idx
  on public.academic_projects (assignee_id);

create index if not exists academic_projects_organization_id_idx
  on public.academic_projects (organization_id);

create index if not exists academic_projects_status_idx
  on public.academic_projects (status);

create index if not exists academic_projects_owner_status_updated_idx
  on public.academic_projects (owner_id, status, updated_at desc);

create index if not exists document_uploads_uploaded_created_idx
  on public.document_uploads (uploaded_by, created_at desc);

create index if not exists literature_sources_owner_created_idx
  on public.literature_sources (owner_id, created_at desc);

create index if not exists consultancy_requests_assigned_expert_id_idx
  on public.consultancy_requests (assigned_expert_id);

create index if not exists project_manuscripts_project_id_idx
  on public.project_manuscripts (project_id);

create or replace function public.guard_academic_project_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role public.user_role;
begin
  select role into current_role
  from public.profiles
  where id = auth.uid();

  if current_role in ('system_admin', 'founder') then
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.organization_id is distinct from old.organization_id then
    raise exception 'Çalışmanın sahibi veya kurumu bu işlemle değiştirilemez.';
  end if;

  if new.assignee_id is distinct from old.assignee_id
     or new.assignee_name is distinct from old.assignee_name then
    if current_role not in ('academic_manager') then
      raise exception 'Çalışma ataması için Akademik Yönetici veya üzeri rol gerekir.';
    end if;
  end if;

  if new.controller_approved_by is distinct from old.controller_approved_by
     or new.controller_approved_at is distinct from old.controller_approved_at then
    if current_role not in ('controller', 'academic_manager') then
      raise exception 'Kontrol onayı için Kontrolör veya üzeri rol gerekir.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_academic_project_sensitive_fields() from public;

-- Trigger is the final database boundary even when a client talks directly to PostgREST.
drop trigger if exists guard_academic_project_sensitive_fields_trigger
  on public.academic_projects;
create trigger guard_academic_project_sensitive_fields_trigger
  before update on public.academic_projects
  for each row
  execute function public.guard_academic_project_sensitive_fields();

-- Oversight roles should not automatically see every tenant's project.
-- Scope controller/manager access to the same organization; global admins remain global.
drop policy if exists "View own, assigned, or oversight-role projects" on public.academic_projects;
create policy "View own, assigned, or oversight-role projects"
  on public.academic_projects
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.has_role(array['system_admin','founder']::public.user_role[])
    or (
      public.has_role(array['controller','academic_manager']::public.user_role[])
      and organization_id = (
        select p.organization_id from public.profiles p where p.id = (select auth.uid())
      )
    )
  );

drop policy if exists "Update own, assigned, or oversight-role projects" on public.academic_projects;
create policy "Update own, assigned, or oversight-role projects"
  on public.academic_projects
  for update
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.has_role(array['system_admin','founder']::public.user_role[])
    or (
      public.has_role(array['controller','academic_manager']::public.user_role[])
      and organization_id = (
        select p.organization_id from public.profiles p where p.id = (select auth.uid())
      )
    )
  )
  with check (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.has_role(array['system_admin','founder']::public.user_role[])
    or (
      public.has_role(array['controller','academic_manager']::public.user_role[])
      and organization_id = (
        select p.organization_id from public.profiles p where p.id = (select auth.uid())
      )
    )
  );
