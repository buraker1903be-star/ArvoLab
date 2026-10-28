/*
  TEZ TAKVİMİ: KİLOMETRE TAŞLARI (28.10.2026, kurum sahibinin isteği:
  "ana sayfa ve çalışmalarım için geliştirmeler").

  Çalışmanın yalnızca TEK bir tarihi vardı (academic_projects.due_date).
  Öğrenci "teslime 120 gün" görüyor ama o 120 günü bölümlere bölen bir
  plan yoktu; tempo ancak sonda, teslime haftalar kala çöküyordu. Bu
  tablo bölüm bölüm hedef tarihleri tutuyor: "Literatür taraması —
  15 Kasım", "Yöntem — 1 Aralık". Ana sayfa sıradakini ve geciken
  taşı, Çalışmalarım kartı bütün takvimi gösteriyor.

  Erişim calisma_yapilacaklari ile aynı desen: okuma çalışmayı
  görebilenler (academic_projects'in kendi politikası kurum sınırını
  gozetim_kapsami ile koyuyor; danışman ve kontrolör planı görür), yazma
  can_write_project. Yeni fonksiyon yok.
*/

create table if not exists public.calisma_takvimi (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.academic_projects(id) on delete cascade,
  olusturan uuid not null default auth.uid() references auth.users(id) on delete cascade,
  baslik text not null check (char_length(btrim(baslik)) between 1 and 120),
  hedef_tarih date not null,
  tamamlandi timestamptz,
  olusturuldu timestamptz not null default now()
);

create index if not exists calisma_takvimi_proje_idx
  on public.calisma_takvimi(project_id, hedef_tarih);

/* Aynı adlı iki açık taş anlamsız: taslak takvim iki kez oluşturulursa ikincisi eklenmesin. */
create unique index if not exists calisma_takvimi_tekil_idx
  on public.calisma_takvimi(project_id, lower(btrim(baslik)))
  where tamamlandi is null;

alter table public.calisma_takvimi enable row level security;

revoke all on public.calisma_takvimi from public, anon, authenticated;
grant select, insert, update, delete on public.calisma_takvimi to authenticated;
grant all on public.calisma_takvimi to service_role;

drop policy if exists "Takvimi calismayi gorenler okur" on public.calisma_takvimi;
create policy "Takvimi calismayi gorenler okur"
  on public.calisma_takvimi
  for select
  to authenticated
  using (exists (select 1 from public.academic_projects p where p.id = calisma_takvimi.project_id));

drop policy if exists "Takvime calismaya yazabilen ekler" on public.calisma_takvimi;
create policy "Takvime calismaya yazabilen ekler"
  on public.calisma_takvimi
  for insert
  to authenticated
  with check (olusturan = (select auth.uid()) and public.can_write_project(project_id));

drop policy if exists "Takvimi calismaya yazabilen gunceller" on public.calisma_takvimi;
create policy "Takvimi calismaya yazabilen gunceller"
  on public.calisma_takvimi
  for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

drop policy if exists "Takvimden calismaya yazabilen siler" on public.calisma_takvimi;
create policy "Takvimden calismaya yazabilen siler"
  on public.calisma_takvimi
  for delete
  to authenticated
  using (public.can_write_project(project_id));

notify pgrst, 'reload schema';
