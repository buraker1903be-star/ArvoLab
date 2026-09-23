-- ============================================================
-- PROJE: ArvoLab (zpfpocyajnxcketdjbxm)
--
-- Doçentlik faaliyet kaydı DÜZENLENEBİLSİN.
--
-- Eskiden kayıt eklendikten sonra değiştirilemiyordu: adet yanlış
-- girildiyse ya da başlıkta yazım hatası varsa tek yol silip yeniden
-- girmekti. Sebep ekranda değil burada: academic_score_entries tablosunda
-- UPDATE ne grant'lenmiş ne de politikası vardı, düzenleme düğmesi
-- konsa bile veritabanı reddederdi.
--
-- owner_id'yi ayrı bir tetikleyici KORUMUYOR, gerek yok: WITH CHECK
-- satırın güncellenmiş halini de sınıyor, kullanıcı kaydını başkasının
-- üzerine geçiremiyor.
--
-- computed_points istemciden geliyor — bu yeni bir açık değil, INSERT
-- politikası da yalnızca owner_id'ye bakıyor. Puan kullanıcının KENDİ
-- beyanı; tablo zaten öyle kurulmuş.
-- ============================================================

grant update on public.academic_score_entries to authenticated;

drop policy if exists "Users can update their own score entries" on public.academic_score_entries;
create policy "Users can update their own score entries"
  on public.academic_score_entries
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

/*
  Abonelik kapısı: insert'te vardı (20260924100003), düzenleme de aynı
  kapıdan geçiyor — project_manuscripts'teki 'insert or update' ile aynı
  gerekçe: ücretli özelliğin ürettiği kaydı değiştirmek de o özelliği
  kullanmaktır.

  SİLME bilerek kapının dışında kalıyor: aboneliği biten kullanıcı kendi
  verisini her zaman kaldırabilmeli.
*/
drop trigger if exists guard_subscription_trigger on public.academic_score_entries;
create trigger guard_subscription_trigger
  before insert or update on public.academic_score_entries
  for each row execute function public.guard_subscription();

notify pgrst, 'reload schema';
