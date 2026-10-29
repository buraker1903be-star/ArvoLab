-- ============================================================
-- KANIT KAYDI: HÜKÜM SÜTUNLARI İSTEMCİDEN YAZILAMAZ (29.10.2026).
--
-- RLS "kim yazabilir"i söyler, "neyi"yi söylemez (AGENTS.md). Çalışmaya
-- yazabilen kullanıcı kanit_kayitlari'nın her sütununu PostgREST'ten
-- doğrudan yazabiliyordu:
--
--   1) Künye sonucu (kunye_*, erisim_*): öğrenci kendi kaydına
--      kunye_durumu = 'dogrulandi', kunye_kaynagi = 'crossref' yazıp
--      dizine hiç bakılmamış bir künyeyi "Crossref'te doğrulandı"
--      gösterebiliyordu. Bu sütunları artık yalnızca sunucu yazar
--      (app/actions/kanit.ts kunyeyiDogrula, service_role; yazma hakkı
--      önce can_write_project ile sınanır).
--
--   2) Asistan hükmü: kanit_kaydi_denetle (20261026065320) "asistan"
--      hükmünü kullanıcının HERHANGİ bir tamamlanmış 'kanit' kaydına
--      bağlamaya izin veriyordu. Asistanın "doğrulanamadı" dediği bir
--      çalışmanın kimliğiyle kendi kaydına "doğrudan destekleniyor —
--      asistan" yazmak mümkündü. Hüküm artık asistanın O kayıtta verdiği
--      düzeyle aynı olmalı (findings->>'duzey').
--
-- Ayrı bir tetikleyici: kanit_kaydi_denetle'nin gövdesine dokunmuyor.
-- Ad sırası gereği ondan ÖNCE çalışır; kaynak değişince künyeyi
-- sıfırlayan dal (kanit_kaydi_denetle) bu denetimden sonra işler, yani
-- meşru sıfırlama engellenmez. Çağıranın rolüne baktığı için security
-- INVOKER.
-- ============================================================

create or replace function public.guard_kanit_hukmu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.kunye_durumu is distinct from 'bakilmadi'
       or new.kunye_ayrintisi is not null or new.kunye_kaynagi is not null or new.kunye_bakildi is not null
       or new.erisim_durumu is distinct from 'bilinmiyor' or new.erisim_adresi is not null then
      raise exception 'Künye doğrulama sonucu yalnızca doğrulama işlemiyle yazılır.'
        using errcode = 'insufficient_privilege';
    end if;
  elsif new.kunye_durumu is distinct from old.kunye_durumu
     or new.kunye_ayrintisi is distinct from old.kunye_ayrintisi
     or new.kunye_kaynagi is distinct from old.kunye_kaynagi
     or new.kunye_bakildi is distinct from old.kunye_bakildi
     or new.erisim_durumu is distinct from old.erisim_durumu
     or new.erisim_adresi is distinct from old.erisim_adresi then
    raise exception 'Künye doğrulama sonucu yalnızca doğrulama işlemiyle yazılır.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.degerlendiren = 'asistan'
     and (tg_op = 'INSERT' or new.asistan_kaydi is distinct from old.asistan_kaydi
          or new.destek_duzeyi is distinct from old.destek_duzeyi
          or new.degerlendiren is distinct from old.degerlendiren)
     and not exists (
       select 1 from public.ai_assistant_runs r
       where r.id = new.asistan_kaydi
         and r.findings->>'duzey' = new.destek_duzeyi
     ) then
    raise exception 'Asistan hükmü, asistanın bu kayıtta verdiği düzeyle aynı olmalı.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_kanit_hukmu() from public, anon, authenticated;

drop trigger if exists guard_kanit_hukmu on public.kanit_kayitlari;
create trigger guard_kanit_hukmu
  before insert or update on public.kanit_kayitlari
  for each row execute function public.guard_kanit_hukmu();
