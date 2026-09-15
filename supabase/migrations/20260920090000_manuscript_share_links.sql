-- Danışmana salt okunur paylaşım bağlantıları
-- ------------------------------------------------------------
-- Çalışmayı yazabilen (sahip, atanan uzman) süreli bir bağlantı oluşturur; bağlantıya sahip
-- herkes giriş yapmadan metnin baskı görünümünü okur. Belirtecin kendisi saklanmaz, yalnızca
-- SHA-256 özeti tutulur; paylaşım sayfası sunucuda (service role) özete göre arar ve süresi
-- dolmuş ya da iptal edilmiş bağlantıyı reddeder. Kullanıcılar yalnızca yazabildikleri
-- çalışmaların bağlantılarını görür, oluşturur ve iptal eder: güncellenebilen tek alan
-- revoked_at'tir ve iptal geri alınamaz. Süre en fazla 90 gündür.
-- Tekrar çalıştırılabilir.

create table if not exists public.manuscript_share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.academic_projects(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text check (label is null or char_length(label) <= 120),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  constraint manuscript_share_links_expiry
    check (expires_at > created_at and expires_at <= created_at + interval '90 days')
);

create index if not exists manuscript_share_links_project_idx
  on public.manuscript_share_links (project_id, created_at desc);

alter table public.manuscript_share_links enable row level security;

revoke all on public.manuscript_share_links from anon, authenticated;
grant select, insert on public.manuscript_share_links to authenticated;
grant update (revoked_at) on public.manuscript_share_links to authenticated;

drop policy if exists "Writers see share links" on public.manuscript_share_links;
create policy "Writers see share links"
  on public.manuscript_share_links for select to authenticated
  using (public.can_write_project(project_id));

drop policy if exists "Writers create share links" on public.manuscript_share_links;
create policy "Writers create share links"
  on public.manuscript_share_links for insert to authenticated
  with check (public.can_write_project(project_id) and created_by = (select auth.uid()));

drop policy if exists "Writers revoke share links" on public.manuscript_share_links;
create policy "Writers revoke share links"
  on public.manuscript_share_links for update to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id) and revoked_at is not null);
