-- GERİ ALMA: 20261118125346_kaynak_pdf_kaynak_bagi.sql
--
-- Kullanıcıların kurduğu PDF–kaynak bağları KAYBOLUR; PDF'ler ve kaynak
-- kayıtları yerinde kalır, eşleşme yeniden yalnızca künye/DOI ile yapılır.
-- Önce uygulama kodunu bu dalın "4/5" commit'i öncesine alın: kod
-- kaynak_id sütununu okuyup yazıyor.
drop trigger if exists kaynak_pdf_bagi_denetle_trigger on public.kaynak_pdfleri;
drop function if exists public.kaynak_pdf_bagi_denetle();
drop index if exists public.kaynak_pdfleri_kaynak_idx;
alter table public.kaynak_pdfleri drop column if exists kaynak_id;
