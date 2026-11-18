-- KAYNAK PDF'İ İLE KAYNAK KAYDI ARASINDA AÇIK BAĞ (K2-A, kurum sahibinin
-- onayı 19.11.2026; tasarim/baglamli-calisma-alani/KARARLAR.md).
--
-- kaynak_pdfleri bugüne kadar literature_sources'a yalnızca KÜNYE METNİYLE
-- (kunye_anahtari) bağlıydı: künyenin yazımı değişince eşleşme kopuyor,
-- aynı başlıklı iki kaynakta hangisinin PDF'i olduğu belli olmuyordu.
-- Atıf kartı (K3-A) "bu kaynağın PDF'i" sorusunu tahminle değil bu bağla
-- yanıtlar.
--
-- Bağ İSTEĞE BAĞLI ve yalnızca kullanıcı bağladığında yazılır. Eski
-- satırlar BİLEREK doldurulmuyor (topluca ya da tahminle eşleştirme yok);
-- onlarda künye/DOI eşleşmesi aynen çalışmaya devam eder ve arayüz
-- belirsizliği "olası eşleşme" olarak açıkça gösterir.
--
-- Kaynak silinirse bağ düşer (on delete set null): PDF ve belge yerinde
-- kalır. PDF silinirse kaynak kaydı etkilenmez.
--
-- YETKİ YALNIZCA YABANCI ANAHTARA BIRAKILMIYOR. Yabancı anahtar "bu kimlikte
-- bir kaynak var" der; "bu kaynak bu çalışmanın ve sen onu görebiliyorsun"
-- demez. kaynak_pdf_bagi_denetle tetikleyicisi bağı yazan kişinin GÖZÜYLE
-- (security invoker: literature_sources RLS'i uygulanır) kaynağın AYNI
-- çalışmaya ait olduğunu denetler; başka çalışmanın ya da başka kullanıcının
-- kaynağı reddedilir. Satırı kimin güncelleyebileceğini zaten mevcut RLS
-- söylüyor (can_write_project). Sunucu işlemi aynı denetimi ayrıca yapar
-- (app/actions/kaynak-pdf.ts: pdfKaynaginiBagla) ve anlaşılır mesaj verir.
--
-- Geri alma: supabase/geri-alma/20261118125346_kaynak_pdf_kaynak_bagi.sql

alter table public.kaynak_pdfleri
  add column if not exists kaynak_id uuid references public.literature_sources(id) on delete set null;

create index if not exists kaynak_pdfleri_kaynak_idx on public.kaynak_pdfleri(kaynak_id) where kaynak_id is not null;

comment on column public.kaynak_pdfleri.kaynak_id is
  'Kullanıcının bağladığı kaynak kaydı (K2-A). NULL: bağlanmadı; künye/DOI eşleşmesi kullanılır. Toplu doldurulmaz.';

create or replace function public.kaynak_pdf_bagi_denetle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.kaynak_id is null then
    return new;
  end if;
  -- Bağ ve çalışma değişmediyse (ör. yalnızca durum güncellendi) yeniden denetlenmez.
  if tg_op = 'UPDATE' and new.kaynak_id is not distinct from old.kaynak_id and new.project_id = old.project_id then
    return new;
  end if;
  if not exists (
    select 1 from public.literature_sources s
    where s.id = new.kaynak_id and s.project_id = new.project_id
  ) then
    raise exception 'Kaynak bu çalışmaya ait değil ya da görülemiyor; PDF bağlanmadı.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.kaynak_pdf_bagi_denetle() from public, anon, authenticated;

drop trigger if exists kaynak_pdf_bagi_denetle_trigger on public.kaynak_pdfleri;
create trigger kaynak_pdf_bagi_denetle_trigger
  before insert or update of kaynak_id, project_id on public.kaynak_pdfleri
  for each row execute function public.kaynak_pdf_bagi_denetle();
