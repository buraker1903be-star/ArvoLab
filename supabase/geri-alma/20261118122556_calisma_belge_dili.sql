-- GERİ ALMA: 20261118122556_calisma_belge_dili.sql
--
-- Sütunu kaldırır; kullanıcıların seçtiği belge dilleri KAYBOLUR ve
-- çalışmalar bugünkü türetmeye (makale profili → arayüz dili) döner.
-- Uygulama kodu sütun yokken de çalışır mı: HAYIR — lib/belge-dili.ts
-- ve projects.ts sütunu okuyup yazıyor. Önce kodu geri alın (bu dalın
-- "2/5" commit'i öncesi), sonra bu dosyayı çalıştırın.
alter table public.academic_projects drop constraint if exists academic_projects_belge_dili_check;
alter table public.academic_projects drop column if exists belge_dili;
-- Şema önbelleği: PostgREST eski sütunu bilmeye devam ederse istekler PGRST204 ile düşer.
notify pgrst, 'reload schema';
