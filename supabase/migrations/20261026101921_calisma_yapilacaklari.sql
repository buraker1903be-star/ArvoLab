/*
  ÇALIŞMANIN YAPILACAKLARI (26.10.2026).

  Kaynakça asistanının bulguları ekranda kalıyordu: öğrenci "Pesaran
  2001 metinde atıfsız" bulgusunu okuyor, pencereyi kapatınca unutuyordu.
  Bulgunun yanındaki "Yapılacaklara ekle" onu bu tabloya yazıyor;
  Çalışmalarım'daki durum kartının "Başka neler var" listesinde, öğrenci
  "Yaptım" diyene kadar duruyor.

  Metin bulgunun KENDİSİ (başlık ≤60, açıklama ≤400; lib/ai/bulgu.ts):
  asistan öğrencinin çalışmasına cümle yazmıyor, burası da yazmıyor —
  neyin eksik olduğunu hatırlatan bir not. Bulgu bir asistan kaydından
  geldiyse ona bağlanıyor (ai_assistant_runs): hangi değerlendirmenin
  işe yaradığı eğitim verisinde görünsün.

  Erişim kanıt matrisiyle aynı desen: okuma çalışmayı görebilenler
  (academic_projects'in kendi politikası kurum sınırını gozetim_kapsami
  ile koyuyor), yazma can_write_project. Yeni fonksiyon yok.
*/

create table if not exists public.calisma_yapilacaklari (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.academic_projects(id) on delete cascade,
  olusturan uuid not null default auth.uid() references auth.users(id) on delete cascade,
  baslik text not null check (char_length(btrim(baslik)) between 1 and 120),
  aciklama text check (aciklama is null or char_length(aciklama) <= 600),
  /* Nereden geldiği: şimdilik yalnızca kaynakça asistanı. */
  kaynak text not null default 'kaynakca_asistani' check (kaynak in ('kaynakca_asistani', 'elle')),
  asistan_kaydi uuid references public.ai_assistant_runs(id) on delete set null,
  tamamlandi timestamptz,
  olusturuldu timestamptz not null default now()
);

create index if not exists calisma_yapilacaklari_proje_idx
  on public.calisma_yapilacaklari(project_id, olusturuldu desc);

/* Aynı bulgu iki kez eklenmesin: çift tık ya da pencereyi yeniden açıp tekrar basmak. */
create unique index if not exists calisma_yapilacaklari_tekil_idx
  on public.calisma_yapilacaklari(project_id, baslik, coalesce(aciklama, ''))
  where tamamlandi is null;

alter table public.calisma_yapilacaklari enable row level security;

revoke all on public.calisma_yapilacaklari from public, anon, authenticated;
grant select, insert, update, delete on public.calisma_yapilacaklari to authenticated;
grant all on public.calisma_yapilacaklari to service_role;

drop policy if exists "Yapilacaklari calismayi gorenler okur" on public.calisma_yapilacaklari;
create policy "Yapilacaklari calismayi gorenler okur"
  on public.calisma_yapilacaklari
  for select
  to authenticated
  using (exists (select 1 from public.academic_projects p where p.id = calisma_yapilacaklari.project_id));

drop policy if exists "Yapilacagi calismaya yazabilen ekler" on public.calisma_yapilacaklari;
create policy "Yapilacagi calismaya yazabilen ekler"
  on public.calisma_yapilacaklari
  for insert
  to authenticated
  with check (olusturan = (select auth.uid()) and public.can_write_project(project_id));

drop policy if exists "Yapilacagi calismaya yazabilen gunceller" on public.calisma_yapilacaklari;
create policy "Yapilacagi calismaya yazabilen gunceller"
  on public.calisma_yapilacaklari
  for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

drop policy if exists "Yapilacagi calismaya yazabilen siler" on public.calisma_yapilacaklari;
create policy "Yapilacagi calismaya yazabilen siler"
  on public.calisma_yapilacaklari
  for delete
  to authenticated
  using (public.can_write_project(project_id));
