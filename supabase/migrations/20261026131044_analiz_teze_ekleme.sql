/*
  ANALİZ SONUCUNU TEZE EKLEME SIRASI (26.10.2026, kurum sahibinin isteği:
  "öğrenci seçtiği analiz sonucunu Yapılacaklara Ekle gibi butona basarak
  teze ekleme sırasına koymalı").

  Çalışmalarım kartının Analiz penceresinde sonuç "Teze ekleme sırasına
  koy" ile kaydediliyor (teze_eklenecek); editörün "Analiz ekle"
  penceresi sıradakileri listeliyor ve imlecin olduğu yere eklenince
  teze_eklendi yazılıyor.

  Kaydın İÇERİĞİ yine değişmez (migration 20260924100024: "tutanak
  sonradan düzenlenemez"). Güncelleme yetkisi YALNIZCA bu iki sütunda
  (sütun düzeyinde grant): başlık ve APA metni hâlâ güncellenemiyor.
*/
alter table public.analiz_sonuclari
  add column if not exists teze_eklenecek boolean not null default false,
  add column if not exists teze_eklendi timestamptz;

/*
  Tablo düzeyindeki UPDATE önce ALINIYOR. Supabase yeni tablolara
  authenticated için her yetkiyi kendiliğinden veriyor; "güncellenemez"
  kuralı bugüne kadar yalnızca update POLİTİKASI olmadığı için
  tutuyordu. Aşağıdaki politika eklenince tablo düzeyi yetkiyle başlık
  ve APA metni de güncellenebilir hâle gelirdi (tests/db/analiz-teze-
  ekleme.test.mjs bunu yakaladı).
*/
revoke update on public.analiz_sonuclari from authenticated;
grant update (teze_eklenecek, teze_eklendi) on public.analiz_sonuclari to authenticated;

drop policy if exists "Kullanici kendi analiz sonucunun teze ekleme durumunu gunceller" on public.analiz_sonuclari;
create policy "Kullanici kendi analiz sonucunun teze ekleme durumunu gunceller"
  on public.analiz_sonuclari
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create index if not exists analiz_sonuclari_proje_sira_idx
  on public.analiz_sonuclari(project_id)
  where teze_eklenecek and teze_eklendi is null;
