-- ============================================================
-- SÖZLEŞME ONAYI: KAYIT SIRASINDA (02.11.2026, kurum sahibinin isteği:
-- kayıt penceresinde "Kullanım Sözleşmesi'ni okudum" kutusu).
--
-- Kayıt formundaki sözleşme kutusu ancak metin sonuna kadar okununca
-- işaretlenebiliyor; o onay da panel içindeki onay gibi IP, cihaz ve konumla
-- bu tabloya yazılıyor (app/actions/auth.ts → signUp). Eskiden olay yalnızca
-- 'giris' ya da 'odeme_sonrasi' olabiliyordu: kayıtta verilen onay
-- yazılamaz, kullanıcı ilk girişte aynı sözleşmeyi ikinci kez onaylamak
-- zorunda kalırdı.
--
-- Satırlar değişmez (sozlesme_onayi_degismez); yalnızca izinli değer
-- kümesi genişliyor, eski satırların hiçbiri etkilenmiyor.
-- ============================================================

alter table public.sozlesme_onaylari drop constraint if exists sozlesme_onaylari_olay_check;
alter table public.sozlesme_onaylari
  add constraint sozlesme_onaylari_olay_check check (olay in ('giris', 'odeme_sonrasi', 'kayit'));

notify pgrst, 'reload schema';
