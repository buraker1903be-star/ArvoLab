-- ============================================================
-- ETİK KURUL BAŞVURUSU (02.11.2026, kurum sahibinin isteği).
--
-- Çalışma başına bir kayıt: başvurunun durumu, kurulun kararı ve
-- kurulun istediği belgelerin kontrol listesi. Ekran:
-- app/dashboard/editor/[id]/etik, kurallar: lib/etik/.
--
-- ArvoLab başvuru belgelerini YAZMAZ; yalnızca takip eder ve denetler.
-- Belge listesi öğrencinin yüklediği kurul yönergesinden SÖZLÜKLE
-- çıkarılır (lib/etik/belgeler.ts) — yönergede geçmeyen bir belge
-- "kurul bunu istiyor" diye listeye giremez; öğrencinin elle eklediği
-- satır ayrıca işaretlenir.
--
-- Tarihler TARİH (gün), an değil: kurul kararı ve veri toplama başlangıcı
-- takvim günüdür; saat dilimine bağlı kayma olmasın.
--
-- Yetki makale_profili (20261026065320) ile aynı: çalışmayı görebilen
-- okur (RLS academic_projects'ten miras — gözetim rolleri kendi
-- kurumlarıyla sınırlı), yazabilen (can_write_project) yazar.
-- ============================================================

create table if not exists public.etik_kurul (
  project_id uuid primary key references public.academic_projects(id) on delete cascade,
  durum text not null default 'belirsiz'
    check (durum in ('belirsiz', 'gerekmiyor', 'hazirlaniyor', 'basvuruldu', 'duzeltme', 'onaylandi', 'reddedildi')),
  kurul_adi text check (kurul_adi is null or char_length(kurul_adi) <= 300),
  basvuru_tarihi date,
  onay_tarihi date,
  karar_no text check (karar_no is null or char_length(karar_no) <= 120),
  /* Verinin toplanmaya başlandığı gün: onaydan önceyse ekran ve teslim kontrolü uyarır. */
  veri_toplama_baslangic date,
  /* "Gerekmiyor" diyen öğrenci gerekçesini yazar (ör. yalnızca yayımlanmış veri). */
  gerekmeme_gerekcesi text check (gerekmeme_gerekcesi is null or char_length(gerekmeme_gerekcesi) <= 1000),
  notlar text check (notlar is null or char_length(notlar) <= 4000),
  /* [{anahtar, ad, durum: eksik|hazirlaniyor|hazir, kaynak: yonerge|elle, alinti}] — biçim lib/etik/belgeler.ts'te denetlenir. */
  belgeler jsonb not null default '[]'::jsonb
    check (jsonb_typeof(belgeler) = 'array' and jsonb_array_length(belgeler) <= 40),
  yonerge_adi text check (yonerge_adi is null or char_length(yonerge_adi) <= 300),
  guncelleyen uuid references auth.users(id) on delete set null,
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now(),
  /* Onaylandı demek karar tarihi ve sayısıyla mümkün: tez ve makale bu bilgiyi yazmak zorunda. */
  constraint etik_onay_bilgisi check (durum <> 'onaylandi' or (onay_tarihi is not null and karar_no is not null)),
  constraint etik_tarih_sirasi check (basvuru_tarihi is null or onay_tarihi is null or basvuru_tarihi <= onay_tarihi)
);

alter table public.etik_kurul enable row level security;

revoke all on public.etik_kurul from public, anon, authenticated;
grant select, insert, update, delete on public.etik_kurul to authenticated;
grant all on public.etik_kurul to service_role;

drop policy if exists "Etik kurul kaydini calismayi gorenler okur" on public.etik_kurul;
create policy "Etik kurul kaydini calismayi gorenler okur"
  on public.etik_kurul
  for select
  to authenticated
  using (exists (select 1 from public.academic_projects p where p.id = etik_kurul.project_id));

drop policy if exists "Etik kurul kaydini yazabilen ekler" on public.etik_kurul;
create policy "Etik kurul kaydini yazabilen ekler"
  on public.etik_kurul
  for insert
  to authenticated
  with check (public.can_write_project(project_id));

drop policy if exists "Etik kurul kaydini yazabilen gunceller" on public.etik_kurul;
create policy "Etik kurul kaydini yazabilen gunceller"
  on public.etik_kurul
  for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

drop policy if exists "Etik kurul kaydini yazabilen siler" on public.etik_kurul;
create policy "Etik kurul kaydini yazabilen siler"
  on public.etik_kurul
  for delete
  to authenticated
  using (public.can_write_project(project_id));

-- ---------- Destek: "Etik kurul başvurusu" konusu ----------
-- Uzmana sor'un konu listesi (app/actions/consultancy.ts REQUEST_TYPES ile aynı küme).
alter table public.consultancy_requests drop constraint if exists consultancy_requests_request_type_check;
alter table public.consultancy_requests
  add constraint consultancy_requests_request_type_check
  check (request_type in ('analysis', 'editing', 'methodology', 'statistics', 'full_review', 'ethics', 'other'));

notify pgrst, 'reload schema';
