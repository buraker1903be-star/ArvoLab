-- Panel içi bildirimler
-- ------------------------------------------------------------
-- Yorum, uzman ataması, durum değişikliği, kontrolör onayı ve tez kılavuzu (yeni sürüm /
-- yeni eşleşme) olaylarında ilgili kişilere bildirim. Bildirimleri yalnızca veritabanı
-- tetikleyicileri üretir: hiçbir uygulama akışı bildirimi "unutamaz" ve kullanıcılar
-- başkası adına bildirim yazamaz. Kullanıcı yalnızca kendi bildirimlerini görür, okundu
-- işaretler (yalnızca read_at) ve silebilir. Olayı yapan kişiye bildirim gitmez.
-- Tekrar çalıştırılabilir.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.academic_projects(id) on delete cascade,
  kind text not null check (kind in ('comment', 'assignment', 'status', 'approval', 'guideline_update')),
  title text not null check (char_length(title) <= 200),
  body text check (body is null or char_length(body) <= 500),
  link text check (link is null or link like '/dashboard/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

revoke all on public.notifications from authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists "Users see their notifications" on public.notifications;
create policy "Users see their notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users mark their notifications read" on public.notifications;
create policy "Users mark their notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users delete their notifications" on public.notifications;
create policy "Users delete their notifications"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------- Yardımcılar ----------
create or replace function public.project_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'new' then 'Yeni'
    when 'planned' then 'Planlandı'
    when 'writing' then 'Yazım aşamasında'
    when 'analysis' then 'Analiz bekliyor'
    when 'review' then 'İncelemede'
    when 'revision' then 'Revizyonda'
    when 'turnitin' then 'Benzerlik kontrolünde'
    when 'ready' then 'Teslime hazır'
    when 'delivered' then 'Teslim edildi'
    when 'archived' then 'Arşivlendi'
    else p_status
  end
$$;

-- Bildirim yaz (yalnızca tetikleyiciler çağırır; olayı yapana gitmez). Kullanıcı başına
-- 60 günden eski okunmuş bildirimler budanır.
create or replace function public.notify(p_user uuid, p_project uuid, p_kind text, p_title text, p_body text, p_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_user is not distinct from auth.uid() then
    return;
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    return;
  end if;
  insert into public.notifications (user_id, project_id, kind, title, body, link)
  values (p_user, p_project, p_kind, left(p_title, 200), left(p_body, 500), p_link);
  delete from public.notifications
  where user_id = p_user and read_at is not null and created_at < now() - interval '60 days';
end;
$$;

revoke all on function public.notify(uuid, uuid, text, text, text, text) from public;
revoke all on function public.project_status_label(text) from public;
grant execute on function public.project_status_label(text) to authenticated, service_role;

-- ---------- Yorumlar: çalışmanın sahibine ve atanan uzmanına ----------
create or replace function public.notify_manuscript_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  author_name text;
  link text;
begin
  select id, title, owner_id, assignee_id into p from public.academic_projects where id = new.project_id;
  if not found then
    return null;
  end if;
  select coalesce(nullif(trim(full_name), ''), 'Bir ekip üyesi') into author_name from public.profiles where id = new.author_id;
  link := '/dashboard/editor/' || p.id || '/write';
  if p.owner_id is distinct from new.author_id then
    perform public.notify(p.owner_id, p.id, 'comment', 'Yeni yorum: ' || p.title, coalesce(author_name, 'Bir ekip üyesi') || ': ' || left(new.body, 300), link);
  end if;
  if p.assignee_id is distinct from new.author_id and p.assignee_id is distinct from p.owner_id then
    perform public.notify(p.assignee_id, p.id, 'comment', 'Yeni yorum: ' || p.title, coalesce(author_name, 'Bir ekip üyesi') || ': ' || left(new.body, 300), link);
  end if;
  return null;
end;
$$;

revoke all on function public.notify_manuscript_comment() from public;

drop trigger if exists notify_manuscript_comment_trigger on public.manuscript_comments;
create trigger notify_manuscript_comment_trigger
  after insert on public.manuscript_comments
  for each row execute function public.notify_manuscript_comment();

-- ---------- Çalışma: atama, durum, onay, kılavuz eşleşmesi ----------
create or replace function public.notify_project_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  link text := '/dashboard/editor/' || new.id || '/write';
begin
  if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
    perform public.notify(new.assignee_id, new.id, 'assignment', 'Size bir çalışma atandı', new.title, link);
    perform public.notify(new.owner_id, new.id, 'assignment', 'Çalışmanıza uzman atandı', new.title, link);
  end if;
  if new.status is distinct from old.status then
    perform public.notify(new.owner_id, new.id, 'status', 'Çalışmanızın durumu: ' || public.project_status_label(new.status), new.title, link);
  end if;
  if new.controller_approved_at is not null and old.controller_approved_at is null then
    perform public.notify(new.owner_id, new.id, 'approval', 'Çalışmanız kontrolör onayı aldı', new.title, link);
  end if;
  if new.guideline_id is distinct from old.guideline_id and new.guideline_id is not null and new.project_type = 'thesis' then
    perform public.notify(new.owner_id, new.id, 'guideline_update', 'Çalışmanıza tez yazım kılavuzu bağlandı', new.title, link);
  end if;
  return null;
end;
$$;

revoke all on function public.notify_project_changes() from public;

drop trigger if exists notify_project_changes_trigger on public.academic_projects;
create trigger notify_project_changes_trigger
  after update on public.academic_projects
  for each row execute function public.notify_project_changes();

-- ---------- Kılavuzun yeni sürümü onaylandı: bağlı tezlerin sahiplerine ----------
create or replace function public.notify_guideline_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  if new.approved_snapshot is null
     or (old.approved_snapshot is not null
         and new.approved_snapshot ->> 'approved_at' is not distinct from old.approved_snapshot ->> 'approved_at') then
    return null;
  end if;
  for p in
    select id, title, owner_id from public.academic_projects
    where guideline_id = new.id and project_type = 'thesis'
  loop
    perform public.notify(p.owner_id, p.id, 'guideline_update', 'Tez yazım kılavuzunuzun yeni sürümü onaylandı', p.title, '/dashboard/editor/' || p.id || '/write');
  end loop;
  return null;
end;
$$;

revoke all on function public.notify_guideline_approved() from public;

drop trigger if exists notify_guideline_approved_trigger on public.thesis_guidelines;
create trigger notify_guideline_approved_trigger
  after update on public.thesis_guidelines
  for each row execute function public.notify_guideline_approved();
