/*
  calisma_kilavuzu yetkileri (20261025222734'ün eksiği).

  O migration tabloyu ve görünümü açtı ama Supabase'in varsayılan
  yetkilerini geri almadı: authenticated'da TRUNCATE, TRIGGER ve
  REFERENCES kaldı. TRUNCATE satır politikalarına bakmaz — RLS'i hiç
  görmeden bütün öğrencilerin yüklediği kılavuzları silebilen bir yol
  demekti. tests/db/guvenlik.test.mjs ("authenticated'da TRUNCATE,
  TRIGGER ve REFERENCES yok") bunu yakalıyordu; CI o migration'dan beri
  kırmızıydı.

  Mevcut migration düzenlenmiyor (AGENTS.md), yenisi ekleniyor.
*/
revoke all on public.calisma_kilavuzu from public, anon, authenticated;
grant select, insert, update, delete on public.calisma_kilavuzu to authenticated;
grant all on public.calisma_kilavuzu to service_role;

revoke all on public.calisma_kilavuzu_sinyali from public, anon, authenticated;
grant select on public.calisma_kilavuzu_sinyali to authenticated;
grant all on public.calisma_kilavuzu_sinyali to service_role;
