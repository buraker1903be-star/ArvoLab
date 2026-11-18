-- ÇALIŞMA BAŞINA BELGE DİLİ (K1-A, kurum sahibinin onayı 19.11.2026;
-- tasarim/baglamli-calisma-alani/KARARLAR.md).
--
-- Belgenin dili (şekil/tablo etiketleri, içindekiler başlığı, kapak, atıf
-- biçimindeki "vd./et al.") bugüne kadar çalışmada SAKLANMIYORDU:
-- lib/belge-dili.ts makale profilindeki dili, yoksa o anki ARAYÜZ dilini
-- kullanıyordu. Arayüzü İngilizceye çeviren öğrencinin Türkçe tezinin
-- etiketleri de İngilizceye dönüyordu.
--
-- NULL = "seçilmedi": bugünkü türetme aynen sürer. Mevcut çalışmalar
-- BİLEREK doldurulmuyor: bir tezin dili, onu yazanın o gün seçtiği
-- arayüz diline bağlı değil; toplu doldurma yanlış bir değeri kalıcı
-- yapardı. Değer yalnızca kullanıcı seçince yazılır (yeni çalışma
-- penceresi ya da editördeki belge dili seçimi).
--
-- Desteklenen diller yalnızca tr ve en: etiket metinleri bu iki dilde
-- var (on-sayfalar, print-sheet, atıf biçimi). Çeviri yapılmaz; dil yalnızca belgenin
-- KENDİ etiketlerini belirler.
--
-- Yetki: yeni sütun mevcut "Update own, assigned, or oversight-role
-- projects" politikası ve guard_academic_project_update ile yazılır;
-- koruma listesine girmesi gerekmiyor (sahibinin değiştirebileceği bir
-- tercih). RLS değişmedi.
--
-- Geri alma: supabase/geri-alma/20261118122556_calisma_belge_dili.sql

alter table public.academic_projects
  add column if not exists belge_dili text;

alter table public.academic_projects
  drop constraint if exists academic_projects_belge_dili_check;
alter table public.academic_projects
  add constraint academic_projects_belge_dili_check
  check (belge_dili is null or belge_dili in ('tr', 'en'));

comment on column public.academic_projects.belge_dili is
  'Belgenin dili (tr/en). NULL: seçilmedi, makale profili ya da arayüz dili kullanılır (lib/belge-dili.ts). Toplu doldurulmaz.';
