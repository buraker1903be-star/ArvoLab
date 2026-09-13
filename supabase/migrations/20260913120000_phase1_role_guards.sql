-- Faz 1 — Rol korumaları (veritabanı katmanı)
--
-- Uygulamadaki server action'lar artık rol kontrolü yapıyor; bu dosya aynı
-- kuralları veritabanında da zorunlu kılar. Böylece biri API'yi doğrudan
-- (tarayıcı konsolundan, Supabase istemcisiyle) çağırsa bile kurallar geçerli olur.
--
-- Mevcut UPDATE politikaları "sahibi güncelleyebilir" dediği için şu açıklar vardı:
--   * Çalışma sahibi kendi çalışmasına "Kontrolör onayı" yazabiliyordu.
--   * Talep sahibi kendi uzman talebini "tamamlandı" yapabiliyordu.
--   * Destek talebi sahibi kendi talebini "çözüldü" yapabiliyordu.
--
-- auth.uid() boşsa (SQL Editor, service role anahtarı, cron) kontroller atlanır.
-- public.has_role(...) fonksiyonunun mevcut olduğu varsayılır (schema.sql).
-- Tekrar çalıştırılabilir (idempotent).

-- ------------------------------------------------------------
-- academic_projects: onay, atama, sahiplik ve teslim alanları
-- ------------------------------------------------------------
create or replace function public.guard_academic_project_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null
     or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[]) then
    return new;
  end if;

  if new.controller_approved_by is distinct from old.controller_approved_by
     or new.controller_approved_at is distinct from old.controller_approved_at
     or new.assignee_id is distinct from old.assignee_id
     or new.assignee_name is distinct from old.assignee_name
     or new.owner_id is distinct from old.owner_id
     or new.organization_id is distinct from old.organization_id
     or (new.status is distinct from old.status and new.status in ('ready', 'delivered')) then
    raise exception 'Onay, atama ve teslim alanlarını yalnızca Kontrolör ve üzeri roller değiştirebilir.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_academic_project_update_trigger on public.academic_projects;
create trigger guard_academic_project_update_trigger
  before update on public.academic_projects
  for each row execute function public.guard_academic_project_update();

-- ------------------------------------------------------------
-- consultancy_requests: izin verilen durum geçişleri
--   talep sahibi : open -> cancelled
--   uzman        : open -> accepted (kendini atayarak)
--   atanan uzman : accepted -> completed
--   Kontrolör+   : serbest
-- ------------------------------------------------------------
create or replace function public.guard_consultancy_request_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null
     or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[]) then
    return new;
  end if;

  if new.requested_by is distinct from old.requested_by then
    raise exception 'Talep sahibi değiştirilemez.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     or new.assigned_expert_id is distinct from old.assigned_expert_id then
    if old.status = 'open' and new.status = 'cancelled'
       and old.requested_by = uid
       and new.assigned_expert_id is not distinct from old.assigned_expert_id then
      return new;
    end if;

    if old.status = 'open' and new.status = 'accepted'
       and new.assigned_expert_id = uid
       and public.has_role(array['expert']::public.user_role[]) then
      return new;
    end if;

    if old.status = 'accepted' and new.status = 'completed'
       and old.assigned_expert_id = uid
       and new.assigned_expert_id = uid then
      return new;
    end if;

    raise exception 'Bu talep durumu değişikliği için yetkiniz yok.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_consultancy_request_update_trigger on public.consultancy_requests;
create trigger guard_consultancy_request_update_trigger
  before update on public.consultancy_requests
  for each row execute function public.guard_consultancy_request_update();

-- ------------------------------------------------------------
-- app_support_requests: durum yalnızca Sistem Yöneticisi / Kurucu tarafından değişir
-- ------------------------------------------------------------
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

  return new;
end;
$$;

drop trigger if exists guard_support_request_update_trigger on public.app_support_requests;
create trigger guard_support_request_update_trigger
  before update on public.app_support_requests
  for each row execute function public.guard_support_request_update();
