-- ============================================================
-- Destek talebine YANIT yazılabilsin.
--
-- Destek ekranı bugüne kadar tek yönlüydü: kullanıcı yazıyor, yönetici
-- yalnızca durumu değiştiriyordu ("açık" → "inceleniyor" → "çözüldü") ve
-- kullanıcı üründe hiçbir cevap görmüyordu. Sorun yaşayan kişi o ekrana
-- zaten bir şey ters gittiği için geliyor; cevapsız kalmasına en az
-- tahammülü olan yer orası.
--
-- YANIT SÜTUNU KORUNUYOR. UPDATE politikası satırı TALEBİ AÇANA da açıyor;
-- sütun korunmasaydı kullanıcı kendi talebine "sistem yöneticisi yanıtı"
-- yazabilirdi. RLS "kim yazabilir"i söyler, "neyi"yi söylemez.
--
-- Koruma YENİ BİR TETİKLEYİCİ DEĞİL: aynı tabloda status ve requested_by'ı
-- koruyan guard_support_request_update zaten var (20260913120000). Aynı
-- işi yapan ikinci bir tetikleyici eklemek, ikisinin zamanla ayrışması
-- demekti. Gövde canlıdakinin aynısı; yalnızca korunan sütun listesi
-- büyüdü.
-- ============================================================

alter table public.app_support_requests
  add column if not exists admin_note text,
  add column if not exists answered_at timestamptz;

comment on column public.app_support_requests.admin_note is
  'Sistem yöneticisinin yanıtı. Yalnızca yönetici yazabilir (guard_support_request_update).';

create or replace function public.guard_support_request_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null
     or public.has_role(array['system_admin','founder']::public.user_role[]) then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.requested_by is distinct from old.requested_by then
    raise exception 'Destek talebinin durumunu yalnızca Sistem Yöneticisi değiştirebilir.' using errcode = '42501';
  end if;

  -- Yanıt alanları: kullanıcı kendi talebine cevap yazamaz.
  if new.admin_note is distinct from old.admin_note
     or new.answered_at is distinct from old.answered_at then
    raise exception 'Destek yanıtını yalnızca Sistem Yöneticisi yazabilir.' using errcode = '42501';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
