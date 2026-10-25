/*
  ÖĞRENCİNİN KENDİ YÜKLEDİĞİ KILAVUZ (26.10.2026).

  Kurum sahibinin kararı: kataloğunda onaylı kılavuzu olmayan öğrenci
  kendi PDF'ini yükleyebilsin, kuralları çıkarımla doldurulsun.

  KATALOĞA YAZILMIYOR, ayrı tablo. thesis_guidelines satırları
  veritabanı tetikleyicisiyle o üniversitedeki BÜTÜN çalışmalara
  eşleşiyor; doğrulanmamış bir yükleme oraya girerse başka
  öğrencilerin tezine sızar. Burada kayıt tek bir çalışmaya bağlı ve
  RLS de çalışmanın kendi erişim kuralını izliyor.

  DOĞRULANMAMIŞ OLMASI YAPISAL. Katalogda "onaylı sürüm"
  (approved_snapshot) ile "çalışma hâlindeki kurallar"
  (extracted_rules) ayrımı bir sütunla yapılıyor ve o ayrımı atlamak
  kolay — depo bunun için ayrı bir denetim tutuyor
  (npm run check:rakamlar). Burada ayrım tablonun KENDİSİ: bu tabloda
  duran her şey tanım gereği doğrulanmamıştır, okuyan tarafın bir
  bayrağı kontrol etmeyi unutma ihtimali yok.

  kurallar jsonb: thesis_guidelines.approved_snapshot ile AYNI biçim
  (lib/guideline-rules.ts içindeki Snapshot). İki ayrı biçim olsaydı
  editöre inen kuralların okunduğu yer ikiye ayrılırdı.
*/
create table if not exists public.calisma_kilavuzu (
  project_id uuid primary key references public.academic_projects(id) on delete cascade,
  kaynak_adres text,
  /* Depolamadaki dosyanın yolu; yüklenen PDF silinirse kayıt da anlamsızlaşır. */
  depo_yolu text,
  belge_basligi text,
  kurallar jsonb not null default '{}'::jsonb,
  yukleyen uuid references auth.users(id),
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now()
);

alter table public.calisma_kilavuzu enable row level security;

grant select, insert, update, delete on public.calisma_kilavuzu to authenticated;

/*
  Erişim çalışmanın erişimini izler. Çıplak bir "owner_id = auth.uid()"
  yazılmıyor: çalışmaya atanmış personel ve gözetim rolleri de
  çalışmayı görebiliyor ve kuralları onların da görmesi gerekiyor.
  Tek kaynak academic_projects'in kendi görünürlüğü.
*/
drop policy if exists "Calisma kilavuzunu calismayi gorenler okur" on public.calisma_kilavuzu;
create policy "Calisma kilavuzunu calismayi gorenler okur"
  on public.calisma_kilavuzu
  for select
  to authenticated
  using (
    exists (
      select 1 from public.academic_projects p
      where p.id = calisma_kilavuzu.project_id
    )
  );

/*
  Yazma YALNIZCA çalışmanın sahibi ya da atanan kişi. Gözetim rolleri
  bilerek dışarıda: doğrulanmamış bir kuralı başkasının tezine yazmak,
  kataloğun onay akışını kenardan dolaşmak olurdu.
*/
drop policy if exists "Calisma kilavuzunu sahibi yazar" on public.calisma_kilavuzu;
create policy "Calisma kilavuzunu sahibi yazar"
  on public.calisma_kilavuzu
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.academic_projects p
      where p.id = calisma_kilavuzu.project_id
        and (p.owner_id = auth.uid() or p.assignee_id = auth.uid())
    )
  );

drop policy if exists "Calisma kilavuzunu sahibi gunceller" on public.calisma_kilavuzu;
create policy "Calisma kilavuzunu sahibi gunceller"
  on public.calisma_kilavuzu
  for update
  to authenticated
  using (
    exists (
      select 1 from public.academic_projects p
      where p.id = calisma_kilavuzu.project_id
        and (p.owner_id = auth.uid() or p.assignee_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.academic_projects p
      where p.id = calisma_kilavuzu.project_id
        and (p.owner_id = auth.uid() or p.assignee_id = auth.uid())
    )
  );

drop policy if exists "Calisma kilavuzunu sahibi siler" on public.calisma_kilavuzu;
create policy "Calisma kilavuzunu sahibi siler"
  on public.calisma_kilavuzu
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.academic_projects p
      where p.id = calisma_kilavuzu.project_id
        and (p.owner_id = auth.uid() or p.assignee_id = auth.uid())
    )
  );

/*
  AKADEMİK YÖNETİCİYE SİNYAL. Aynı kurumdan gelen yüklemeler bir
  araya gelince "bu kılavuzu bir kez onayla, herkes doğrulanmış
  sürüme geçsin" demek oluyor. Keşif cron'unun .edu.tr sitelerini
  taramasından daha güçlü bir sinyal: kılavuzu getiren, onu elinde
  tutan kişi.

  security_invoker: görünüm çağıranın yetkisiyle işler. Invoker
  OLMAYAN bir görünüm tablo RLS'ini atlar ve bir öğrencinin yüklediği
  kuralları başkasına gösterirdi.
*/
create or replace view public.calisma_kilavuzu_sinyali
with (security_invoker = true) as
select
  p.university_id,
  p.university as universite_adi,
  k.kaynak_adres,
  count(*)::int as yukleme_sayisi,
  max(k.olusturuldu) as son_yukleme
from public.calisma_kilavuzu k
join public.academic_projects p on p.id = k.project_id
where k.kaynak_adres is not null
group by p.university_id, p.university, k.kaynak_adres;

grant select on public.calisma_kilavuzu_sinyali to authenticated;
