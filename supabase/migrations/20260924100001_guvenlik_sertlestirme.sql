-- ============================================================
-- Güvenlik sertleştirmesi (20.09.2026 denetimi)
--
-- Uygulama bu kuralların hepsini zaten uyguluyor; ama oturum jetonu
-- tarayıcıda ve PostgREST'e doğrudan istek atılabiliyor. AGENTS.md: RLS asıl
-- katman. Kapatılanlar:
--
-- 1) Rol yükseltme. prevent_self_role_escalation yalnızca "değiştiren
--    system_admin/founder mı" diye bakıyordu: Sistem Yöneticisi kendini
--    Kurucu yapabiliyor, bir Kurucuyu düşürebiliyordu. "Kurucu rolünü yalnızca
--    Kurucu verir/alır" ve "kimse kendi rolünü değiştiremez" artık burada da.
-- 2) Ekleme sırasında korumalar atlanıyordu. Onay/atama/teslim korumaları
--    yalnızca UPDATE'teydi: müşteri çalışmayı "Kontrolör onayı verildi" ya da
--    "Teslim edildi" durumunda, kendini başka kuruma yazarak açabiliyordu;
--    danışmanlık ve destek talebi "tamamlandı/çözüldü" açılabiliyordu.
-- 3) Danışmanlık talebinde uzman ve talep sahibi, durum dışındaki alanları
--    (mesaj, tür, bağlı çalışma) serbestçe değiştirebiliyordu.
-- 4) document_uploads / citation_checks başkasının çalışmasına bağlanabiliyordu
--    (INSERT yalnızca "uploaded_by = ben" istiyordu).
-- 5) Fonksiyon yetkileri. Postgres yeni fonksiyonu PUBLIC'e (anon dahil) açar;
--    buradaki fonksiyonlar yalnızca PUBLIC'ten geri alınmıştı. Canlıda anon ya
--    da authenticated'a ayrıca verilmişse notify (sahte bildirim) ve
--    resync_project_guidelines anonim çağrılabiliyordu (ArvoARC'ta aynı
--    hata siparişi "ödendi" yapan fonksiyonu herkese açık bırakmıştı).
--
-- "auth.uid() boşsa izin ver" kalıbı korunuyor (SQL Editor, cron); anon'un bu
-- tablolara yazma yetkisi olmadığı için anonim istek tetikleyiciye ulaşmaz.
-- Tekrar çalıştırılabilir.
-- ============================================================

-- ---------- 1) Rol yükseltme ----------
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (new.role is distinct from old.role or new.organization_id is distinct from old.organization_id)
     and not public.has_role(array['system_admin','founder']::public.user_role[]) then
    raise exception 'Rol veya kurum değişikliği için yetkiniz yok.' using errcode = '42501';
  end if;

  if new.role is distinct from old.role and new.id = auth.uid() then
    raise exception 'Kendi rolünüzü değiştiremezsiniz; başka bir yöneticiden isteyin.' using errcode = '42501';
  end if;

  -- Kurucu rolü (verilmesi, alınması ya da Kurucunun kurumunun değişmesi) yalnızca Kurucuda.
  if (new.role is distinct from old.role or new.organization_id is distinct from old.organization_id)
     and (new.role = 'founder' or old.role = 'founder')
     and not public.has_role(array['founder']::public.user_role[]) then
    raise exception 'Kurucu rolünü yalnızca bir Kurucu atayabilir veya kaldırabilir.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------- 2) Eklemede korumalar ----------
create or replace function public.guard_academic_project_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null
     or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[]) then
    return new;
  end if;

  if new.owner_id is distinct from auth.uid()
     or new.organization_id is distinct from public.get_my_organization_id()
     or new.controller_approved_by is not null
     or new.controller_approved_at is not null
     or new.assignee_id is not null
     or new.assignee_name is not null
     or coalesce(new.status, 'new') in ('ready', 'delivered') then
    raise exception 'Çalışma yalnızca kendi adınıza, kendi kurumunuzda ve onaysız/atamasız açılabilir.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_academic_project_insert_trigger on public.academic_projects;
create trigger guard_academic_project_insert_trigger
  before insert on public.academic_projects
  for each row execute function public.guard_academic_project_insert();

create or replace function public.guard_consultancy_request_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null
     or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[]) then
    return new;
  end if;

  if new.requested_by is distinct from auth.uid()
     or new.status is distinct from 'open'
     or new.assigned_expert_id is not null
     or (new.project_id is not null and not public.can_view_project(new.project_id)) then
    raise exception 'Talep yalnızca kendi adınıza, açık durumda ve görebildiğiniz bir çalışma için açılabilir.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_consultancy_request_insert_trigger on public.consultancy_requests;
create trigger guard_consultancy_request_insert_trigger
  before insert on public.consultancy_requests
  for each row execute function public.guard_consultancy_request_insert();

create or replace function public.guard_support_request_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.has_role(array['system_admin','founder']::public.user_role[]) then
    return new;
  end if;
  if new.requested_by is distinct from auth.uid() or new.status is distinct from 'open' then
    raise exception 'Destek talebi yalnızca kendi adınıza ve açık durumda oluşturulabilir.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_support_request_insert_trigger on public.app_support_requests;
create trigger guard_support_request_insert_trigger
  before insert on public.app_support_requests
  for each row execute function public.guard_support_request_insert();

-- ---------- 3) Danışmanlık talebinin içeriği ----------
-- Durum geçişleri 20260913120000'deki gibi; ek olarak Kontrolör altındaki
-- roller talebin içeriğini (bağlı çalışma, tür, mesaj) değiştiremez. Uygulama
-- talebi düzenlemiyor; uzman yalnızca üstlenir ve tamamlar.
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

  if new.project_id is distinct from old.project_id
     or new.project_title is distinct from old.project_title
     or new.request_type is distinct from old.request_type
     or new.message is distinct from old.message
     or new.created_at is distinct from old.created_at then
    raise exception 'Talebin içeriği değiştirilemez.' using errcode = '42501';
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

-- ---------- 4) Belge ve atıf kaydı yalnızca görülebilen çalışmaya ----------
-- Uygulamadaki denetimin eşi (document-upload.ts, citation-check.ts): çalışmayı
-- görebilen (sahip, atanan, Kontrolör+) ona kayıt ekler.
create or replace function public.guard_project_link_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or new.project_id is null or public.can_view_project(new.project_id) then
    return new;
  end if;
  raise exception 'Bu çalışmaya kayıt ekleyemezsiniz.' using errcode = '42501';
end;
$$;

drop trigger if exists guard_document_upload_project_trigger on public.document_uploads;
create trigger guard_document_upload_project_trigger
  before insert or update of project_id on public.document_uploads
  for each row execute function public.guard_project_link_insert();

drop trigger if exists guard_citation_check_project_trigger on public.citation_checks;
create trigger guard_citation_check_project_trigger
  before insert or update of project_id on public.citation_checks
  for each row execute function public.guard_project_link_insert();

-- ---------- 5) Fonksiyon yetkileri ----------
-- public şemasındaki her fonksiyon (eklentilerinki hariç) önce herkesten
-- alınır. Sonra:
--  * RLS politikasında ya da sütun varsayılanında geçenler (has_role,
--    get_my_organization_id, can_view_project…) anon ve authenticated'a açık
--    kalır: politika çağıranın yetkisiyle çalışır, kapatılırsa sorgu hata verir.
--    Bunlar yalnızca çağıranın kendi bilgisini döndürür.
--  * Uygulamanın doğrudan çağırdığı resync_project_guidelines authenticated'a
--    açık (kendi içinde rol denetliyor).
--  * Tetikleyici fonksiyonları ve notify gibi iç fonksiyonlar kimseye açık
--    değil: tetikleyiciler çalışırken EXECUTE yetkisi aranmaz, security
--    definer fonksiyonlar içeriden sahibi adına çağırır.
--  * service_role hepsini çağırabilir (köprü, cron).
-- Canlıda repoda olmayan bir fonksiyon politikada kullanılıyorsa o da
-- politikadan tespit edilip açık kalır; bu yüzden liste elle değil katalogdan.
do $$
declare
  f record;
  politikada boolean;
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args, (p.prorettype = 'trigger'::regtype) as tetikleyici
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', f.proname, f.args);
    execute format('grant execute on function public.%I(%s) to service_role', f.proname, f.args);

    if f.tetikleyici then
      continue;
    end if;

    select exists (
      select 1 from pg_policy po
      where pg_get_expr(po.polqual, po.polrelid) ~ ('\m' || f.proname || '\(')
         or pg_get_expr(po.polwithcheck, po.polrelid) ~ ('\m' || f.proname || '\(')
    ) or exists (
      select 1 from pg_attrdef ad
      where pg_get_expr(ad.adbin, ad.adrelid) ~ ('\m' || f.proname || '\(')
    ) into politikada;

    if politikada then
      execute format('grant execute on function public.%I(%s) to anon, authenticated', f.proname, f.args);
    elsif f.proname = 'resync_project_guidelines' then
      execute format('grant execute on function public.%I(%s) to authenticated', f.proname, f.args);
    end if;
  end loop;
end
$$;

-- Bundan sonra oluşturulan fonksiyonlar da kendiliğinden açılmasın
-- (varsayılan yetkiler; PUBLIC'in genel varsayılanını kaldırmaz, bu yüzden
-- yeni her fonksiyonda yine "revoke … from public, anon, authenticated" yazın).
alter default privileges in schema public revoke execute on functions from anon, authenticated;

notify pgrst, 'reload schema';
