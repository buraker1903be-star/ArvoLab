-- Faz D: sürüm geçmişi, uzman yorumları, içindekiler
-- ------------------------------------------------------------
-- 1) project_manuscript_versions: metnin geri yüklenebilir sürümleri
--    (otomatik: en fazla 10 dakikada bir; elle: etiketli; geri yükleme öncesi yedek).
--    Sürümler değiştirilemez; eski otomatik sürümler veritabanında budanır (son 40).
-- 2) manuscript_comments: danışman/uzman ile müşteri arasında metne bağlı yorumlar.
--    Yorumu yalnızca yazarı düzenleyebilir/silebilir; erişimi olan herkes "çözüldü" işaretleyebilir.
-- 3) project_manuscripts.include_toc: Word çıktısına içindekiler tablosu.
-- Tekrar çalıştırılabilir (idempotent).

alter table public.project_manuscripts
  add column if not exists include_toc boolean not null default false;

-- ---------- Erişim yardımcıları (metin politikalarıyla aynı kural) ----------
-- Görme: çalışmanın sahibi, atanan uzman ve denetim rolleri.
create or replace function public.can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.academic_projects p
    where p.id = p_project_id
      and (p.owner_id = auth.uid() or p.assignee_id = auth.uid())
  )
  or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
$$;

-- Yazma: yalnızca sahip ve atanan uzman (project_manuscripts ekleme/güncelleme kuralı).
create or replace function public.can_write_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.academic_projects p
    where p.id = p_project_id
      and (p.owner_id = auth.uid() or p.assignee_id = auth.uid())
  )
$$;

revoke all on function public.can_view_project(uuid) from public;
revoke all on function public.can_write_project(uuid) from public;
grant execute on function public.can_view_project(uuid) to authenticated, service_role;
grant execute on function public.can_write_project(uuid) to authenticated, service_role;

-- ---------- 1) Sürüm geçmişi ----------
create table if not exists public.project_manuscript_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.academic_projects(id) on delete cascade,
  content jsonb not null,
  plain_text text,
  word_count integer not null default 0,
  settings jsonb,
  kind text not null default 'auto' check (kind in ('auto', 'manual', 'restore')),
  label text check (label is null or char_length(label) <= 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists project_manuscript_versions_project_idx
  on public.project_manuscript_versions (project_id, created_at desc);

alter table public.project_manuscript_versions enable row level security;

grant select, insert on public.project_manuscript_versions to authenticated;

drop policy if exists "View versions of accessible projects" on public.project_manuscript_versions;
create policy "View versions of accessible projects"
  on public.project_manuscript_versions
  for select
  to authenticated
  using (public.can_view_project(project_id));

drop policy if exists "Writers create versions" on public.project_manuscript_versions;
create policy "Writers create versions"
  on public.project_manuscript_versions
  for insert
  to authenticated
  with check (public.can_write_project(project_id) and created_by = (select auth.uid()));

-- Son 40 otomatik sürüm tutulur; elle kaydedilenler ve geri yükleme yedekleri silinmez.
create or replace function public.prune_manuscript_versions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.project_manuscript_versions
  where id in (
    select id from public.project_manuscript_versions
    where project_id = new.project_id and kind = 'auto'
    order by created_at desc
    offset 40
  );
  return null;
end;
$$;

revoke all on function public.prune_manuscript_versions() from public;

drop trigger if exists prune_manuscript_versions_trigger on public.project_manuscript_versions;
create trigger prune_manuscript_versions_trigger
  after insert on public.project_manuscript_versions
  for each row
  when (new.kind = 'auto')
  execute function public.prune_manuscript_versions();

-- ---------- 2) Metne bağlı yorumlar ----------
create table if not exists public.manuscript_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.academic_projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  quote text check (quote is null or char_length(quote) <= 500),
  body text not null check (char_length(body) between 1 and 2000),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists manuscript_comments_project_idx
  on public.manuscript_comments (project_id, created_at);

alter table public.manuscript_comments enable row level security;

grant select, insert, delete on public.manuscript_comments to authenticated;
-- Güncellemede yalnızca "çözüldü" alanları (sütun düzeyinde yetki).
revoke update on public.manuscript_comments from authenticated;
grant update (resolved_at, resolved_by) on public.manuscript_comments to authenticated;

drop policy if exists "View comments of accessible projects" on public.manuscript_comments;
create policy "View comments of accessible projects"
  on public.manuscript_comments
  for select
  to authenticated
  using (public.can_view_project(project_id));

drop policy if exists "Comment on accessible projects" on public.manuscript_comments;
create policy "Comment on accessible projects"
  on public.manuscript_comments
  for insert
  to authenticated
  with check (public.can_view_project(project_id) and author_id = (select auth.uid()));

drop policy if exists "Resolve comments on accessible projects" on public.manuscript_comments;
create policy "Resolve comments on accessible projects"
  on public.manuscript_comments
  for update
  to authenticated
  using (public.can_view_project(project_id))
  with check (public.can_view_project(project_id));

drop policy if exists "Authors or managers delete comments" on public.manuscript_comments;
create policy "Authors or managers delete comments"
  on public.manuscript_comments
  for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  );
