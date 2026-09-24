-- ============================================================
-- Ölçüm: iç ekip bireysel abonelik aynasını okuyabilsin.
--
-- individual_subscriptions yalnızca kişinin kendisine açıktı
-- (20260924100003). Doğru bir varsayılandı ama ürünün en temel sorusunu
-- cevaplanamaz kılıyordu: denemeyi başlatan kaç kişiden kaçı ödemeye geçti?
-- Tablo ArvoOS'un aynası, cevap oradaydı ama ArvoLab tarafında kimse
-- göremiyordu — dönüşüm oranı bugüne kadar hiç ölçülmedi.
--
-- Erişim yalnızca İÇ EKİBE (system_admin, founder) açılıyor. Müşteri
-- kurumların gözetim rolleri bilerek dışarıda: bireysel abone hiçbir kuruma
-- ait değil, kimsenin gözetimi altında değil. gozetim_kapsami'nin kurum
-- dalı NULL kurumda zaten eşleşmezdi; burada niyet açıkça yazılıyor.
-- ============================================================

drop policy if exists "Kendi aboneliğini görür" on public.individual_subscriptions;
create policy "Kendi aboneliğini görür"
  on public.individual_subscriptions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role(array['system_admin','founder']::public.user_role[])
  );

notify pgrst, 'reload schema';
