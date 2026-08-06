create extension if not exists pgcrypto;

-- ============================================================
-- Roller ve Kurum Yapısı
-- Proje dosyası Bölüm 3 "Hedef Kullanıcılar ve Roller" esas alınmıştır.
-- ============================================================
do $$ begin
  create type public.user_role as enum (
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

-- auth.users tablosunu genişleten profil kaydı.
-- ÖNEMLİ: rol bilgisi burada (güvenli veritabanı tablosunda) tutulur,
-- kullanıcı tarafından değiştirilebilir JWT/user_metadata'da DEĞİL
-- (bkz. proje dosyası Bölüm 3.1 Yetkilendirme İlkeleri).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  full_name text,
  role public.user_role not null default 'employee',
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

grant select on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;

create policy "Members can view their own organization"
  on public.organizations
  for select
  to authenticated
  using (
    id in (select organization_id from public.profiles where id = (select auth.uid()))
  );

create policy "Users can view profiles in their organization"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  );

create policy "Users can update their own profile (not their role)"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Yeni auth kullanıcısı oluştuğunda otomatik profil satırı açar (varsayılan rol: employee).
-- Rol yükseltmeleri yalnızca güvenilir bir yönetici tarafından SQL/servis anahtarıyla yapılmalıdır.
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

-- Yardımcı fonksiyon: çağıran kullanıcının rolü belirtilen listede mi?
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
  assignee_id uuid references public.profiles(id), -- proje dosyası 6.1: sorumlu çalışan ataması
  title text not null check (char_length(title) between 3 and 240),
  project_type text not null check (project_type in ('thesis', 'article', 'project', 'associate-professorship')),
  university text,
  institute text,
  department text,
  citation_style text not null default 'apa7' check (citation_style in ('apa7', 'vancouver', 'chicago', 'ieee')),
  research_method text check (research_method in ('quantitative', 'qualitative', 'mixed', 'review')),
  assignee_name text, -- geriye dönük uyumluluk (assignee_id boşken serbest metin etiket)
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'planned', 'writing', 'analysis', 'review', 'revision', 'turnitin', 'ready', 'delivered', 'archived')),
  notes text,
  progress smallint not null default 0 check (progress between 0 and 100),
  -- Kontrolör onayı: proje dosyası 6.2 "Tez ve Makale Üretim Akışı" - Biçim/Teslim aşaması onayı
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

-- Görme yetkisi: sahibi, atanan çalışan, ya da denetim rolündeki kullanıcılar
-- (Kontrolör / Akademik Yönetici / Sistem Yöneticisi / Kurucu) - proje dosyası
-- Bölüm 3 "Hedef Kullanıcılar ve Roller" ile uyumlu.
create policy "View own, assigned, or oversight-role projects"
  on public.academic_projects
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Users can create their own academic projects"
  on public.academic_projects
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

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

create policy "Owner or oversight-role can delete projects"
  on public.academic_projects
  for delete
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  );

-- ============================================================
-- APA7 Kaynakça Doğrulama Kayıtları
-- Her kayıt bir academic_projects satırına bağlıdır.
-- Bu tablo İÇERİK ÜRETMEZ; yalnızca kural bazlı format/atıf
-- denetim sonuçlarını saklar (ArvoLab dahili doğrulama motoru).
-- ============================================================
create table if not exists public.citation_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.academic_projects(id) on delete cascade,
  project_title text, -- academic_projects henüz seçilmediyse/kaydedilmediyse geçici etiket
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

-- Kaydı oluşturan kişi görebilir; ayrıca bağlı bir projeye sahipse o yoldan da erişebilir
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

create policy "Users can create their own citation checks"
  on public.citation_checks
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy "Users can delete their own citation checks"
  on public.citation_checks
  for delete
  to authenticated
  using (created_by = (select auth.uid()));
