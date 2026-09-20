-- Kılavuz onay bildirimi hiçbir zaman çalışmayacaktı
-- ------------------------------------------------------------
-- 20260924100007'de bildirim tetikleyicisi şöyle kurulmuştu:
--
--   after insert or update OF ready_for_approval on public.thesis_guidelines
--
-- "update of <sütun>" PostgreSQL'de sütun DEĞİŞTİĞİNDE değil, UPDATE
-- cümlesinde ANILDIĞINDA tetiklenir. ready_for_approval'ı uygulama hiçbir
-- yerde yazmıyor — değeri BEFORE tetikleyicisi satırdan türetiyor. Yani
-- koşul hiçbir güncellemede sağlanmıyordu ve bildirim yalnızca yeni kayıt
-- eklenirken çalışıyordu.
--
-- Sonuç: kuyruğun çözmek için kurulduğu sorun çözülmüyordu. Gece taraması
-- mevcut bir kılavuzun kurallarını tamamlayıp onu "onaya hazır" yaptığında
-- akademik yöneticiye haber gitmeyecekti; kayıt yine sessizce bekleyecekti.
--
-- Fonksiyonun kendisi doğru: zaten yalnızca GEÇİŞ anında bildiriyor
-- (old.ready_for_approval is true ise çıkıyor), bu yüzden her satır
-- güncellemesinde çalışması bildirim tekrarına yol açmaz.
--
-- Tekrar çalıştırılabilir.

drop trigger if exists notify_guideline_ready_trigger on public.thesis_guidelines;
create trigger notify_guideline_ready_trigger
  after insert or update on public.thesis_guidelines
  for each row execute function public.notify_guideline_ready();
