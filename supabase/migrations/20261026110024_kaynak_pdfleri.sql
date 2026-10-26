/*
  KAYNAK PDF'LERİ (26.10.2026).

  Kaynakça denetimi bir künyenin dizinde (Crossref, OpenAlex) kaydı
  olduğunu gösteriyordu, kaynağın kendisine ulaşılabildiğini değil.
  Kurum sahibinin geri bildirimi: "verdiği kaynakların PDF'lerini tek tek
  kontrol edip ulaşılabilir olması gerekli". Bu tablo çalışmanın her
  künyesi için PDF durumunu tutuyor:

    indirildi   açık erişim PDF'i indirildi, ilk baytları PDF imzası taşıyor
    yuklendi    öğrenci kendi indirdiği PDF'i yükledi
    bulunamadi  açık erişimli PDF yok (ücretli kaynak); öğrenci yükleyebilir
    erisilemedi PDF adresi var ama indirilemedi (sunucu, boyut, HTML sayfa)
    kayit_yok   dizinde kaydı yok: PDF aranmadı, künyeye bakılmalı

  Dosya çalışmanın klasöründe (project-files/<çalışma>/kaynak-pdf/…):
  çalışmayı görebilen PDF'i de görür (storage politikası
  calisma_klasoru, migration 20260924100018) — ZIP'i kurum çalışanı da
  indirebilmeli. Yol bu klasörün dışını gösteremez (kısıt).

  Erişim kanıt matrisiyle aynı desen; yeni fonksiyon yok.
*/

create table if not exists public.kaynak_pdfleri (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.academic_projects(id) on delete cascade,
  kunye_anahtari text not null check (char_length(kunye_anahtari) between 1 and 400),
  kunye text not null check (char_length(kunye) between 1 and 2000),
  doi text check (doi is null or char_length(doi) <= 300),
  durum text not null check (durum in ('indirildi', 'yuklendi', 'bulunamadi', 'erisilemedi', 'kayit_yok')),
  depo_yolu text,
  kaynak_adres text check (kaynak_adres is null or char_length(kaynak_adres) <= 2000),
  /* Yüklenen PDF'te künyenin başlığı geçiyor mu (lib/kaynak-pdf.ts). */
  baslik_eslesti boolean,
  bakildi timestamptz not null default now(),
  olusturan uuid not null default auth.uid() references auth.users(id) on delete cascade,
  unique (project_id, kunye_anahtari),
  /* Dosyası olan durumda yol ŞART, olmayanda YASAK: "indirildi" deyip
     dosyası olmayan satır ZIP'te sessizce eksik kalırdı. */
  check ((durum in ('indirildi', 'yuklendi')) = (depo_yolu is not null)),
  check (depo_yolu is null or depo_yolu like project_id::text || '/kaynak-pdf/%')
);

create index if not exists kaynak_pdfleri_proje_idx on public.kaynak_pdfleri(project_id);

alter table public.kaynak_pdfleri enable row level security;

revoke all on public.kaynak_pdfleri from public, anon, authenticated;
grant select, insert, update, delete on public.kaynak_pdfleri to authenticated;
grant all on public.kaynak_pdfleri to service_role;

drop policy if exists "Kaynak pdflerini calismayi gorenler okur" on public.kaynak_pdfleri;
create policy "Kaynak pdflerini calismayi gorenler okur"
  on public.kaynak_pdfleri for select to authenticated
  using (exists (select 1 from public.academic_projects p where p.id = kaynak_pdfleri.project_id));

drop policy if exists "Kaynak pdfini calismaya yazabilen ekler" on public.kaynak_pdfleri;
create policy "Kaynak pdfini calismaya yazabilen ekler"
  on public.kaynak_pdfleri for insert to authenticated
  with check (olusturan = (select auth.uid()) and public.can_write_project(project_id));

drop policy if exists "Kaynak pdfini calismaya yazabilen gunceller" on public.kaynak_pdfleri;
create policy "Kaynak pdfini calismaya yazabilen gunceller"
  on public.kaynak_pdfleri for update to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

drop policy if exists "Kaynak pdfini calismaya yazabilen siler" on public.kaynak_pdfleri;
create policy "Kaynak pdfini calismaya yazabilen siler"
  on public.kaynak_pdfleri for delete to authenticated
  using (public.can_write_project(project_id));
