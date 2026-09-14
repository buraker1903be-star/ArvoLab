-- Faz B: Tez yazım kılavuzunun otomatik senkronizasyonu
-- ------------------------------------------------------------
-- 1) Çalışma, kurumuna ad yerine kimlikle bağlanır (üniversite, enstitü/fakülte, bölüm).
-- 2) Kılavuz eşleştirmesini veritabanı yapar: en özel onaylı kılavuz
--    (bölüm > enstitü/fakülte > üniversite) kendiliğinden bağlanır; istemci
--    guideline_id alanını elle değiştiremez.
-- 3) Onaylanan her sürümün anlık görüntüsü saklanır. Yönetici kuralları yeniden
--    düzenlerken (needs_review) müşteriler son onaylı sürümle çalışmaya devam eder.
-- 4) Metnin sayfa ayarlarının hangi kılavuz sürümünden geldiği tutulur; editör
--    yeni sürümü kullanıcı ayarları değiştirmediyse kendiliğinden uygular.
-- Tekrar çalıştırılabilir (idempotent).

-- ---------- 1) Kolonlar ----------
alter table public.academic_projects
  add column if not exists university_id uuid references public.universities(id) on delete set null,
  add column if not exists academic_unit_id uuid references public.academic_units(id) on delete set null,
  add column if not exists department_id uuid references public.academic_units(id) on delete set null;

create index if not exists academic_projects_university_id_idx on public.academic_projects (university_id);
create index if not exists academic_projects_guideline_id_idx on public.academic_projects (guideline_id);

alter table public.thesis_guidelines
  add column if not exists approved_snapshot jsonb;

alter table public.project_manuscripts
  add column if not exists settings_guideline_id uuid references public.thesis_guidelines(id) on delete set null,
  add column if not exists settings_guideline_version text,
  add column if not exists settings_customized boolean not null default false;

-- ---------- 2) Onaylı kılavuzlar için anlık görüntü ----------
update public.thesis_guidelines
set approved_snapshot = jsonb_build_object(
  'citation_style', citation_style,
  'required_sections', to_jsonb(required_sections),
  'extracted_rules', extracted_rules,
  'min_pages', min_pages,
  'max_pages', max_pages,
  'version_label', version_label,
  'document_title', document_title,
  'source_url', source_url,
  'approved_at', to_char(coalesce(reviewed_at, updated_at, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)
where analysis_status = 'approved'
  and approved_snapshot is null;

-- ---------- 3) Eşleştirme ----------
create or replace function public.best_guideline_for(p_university_id uuid, p_unit_id uuid, p_department_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.thesis_guidelines g
  where p_university_id is not null
    and g.university_id = p_university_id
    and g.is_active
    and g.approved_snapshot is not null
    and (
      g.academic_unit_id is null
      or g.academic_unit_id = p_unit_id
      or g.academic_unit_id = p_department_id
    )
  order by
    case
      when p_department_id is not null and g.academic_unit_id = p_department_id then 0
      when p_unit_id is not null and g.academic_unit_id = p_unit_id then 1
      else 2
    end,
    g.effective_from desc nulls last,
    g.approved_snapshot ->> 'approved_at' desc
  limit 1
$$;

revoke all on function public.best_guideline_for(uuid, uuid, uuid) from public;
grant execute on function public.best_guideline_for(uuid, uuid, uuid) to authenticated, service_role;

-- ---------- 4) Kimlik geri doldurma (tetikleyiciden önce; mevcut bağlar korunur) ----------
update public.academic_projects p
set university_id = u.id
from public.universities u
where p.university_id is null
  and p.university is not null
  and lower(trim(p.university)) = lower(trim(u.name));

update public.academic_projects p
set academic_unit_id = au.id
from public.academic_units au
where p.academic_unit_id is null
  and p.university_id = au.university_id
  and au.parent_unit_id is null
  and p.institute is not null
  and lower(trim(p.institute)) = lower(trim(au.name));

update public.academic_projects p
set department_id = au.id
from public.academic_units au
where p.department_id is null
  and p.academic_unit_id is not null
  and au.parent_unit_id = p.academic_unit_id
  and p.department is not null
  and lower(trim(p.department)) = lower(trim(au.name));

-- Daha özel bir onaylı kılavuz varsa bağla; eşleşme yoksa eski bağ olduğu gibi kalır.
update public.academic_projects p
set guideline_id = best.guideline_id,
    citation_style = coalesce(g.approved_snapshot ->> 'citation_style', p.citation_style)
from (
  select id, public.best_guideline_for(university_id, academic_unit_id, department_id) as guideline_id
  from public.academic_projects
  where project_type = 'thesis' and university_id is not null
) best
join public.thesis_guidelines g on g.id = best.guideline_id
where p.id = best.id
  and best.guideline_id is not null
  and p.guideline_id is distinct from best.guideline_id;

-- ---------- 5) Tetikleyici: kılavuz bağını veritabanı belirler ----------
create or replace function public.sync_academic_project_guideline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resync boolean := coalesce(current_setting('arvolab.guideline_resync', true), '') = 'on';
  v_guideline uuid;
  v_citation text;
begin
  -- Kurum ve tür değişmediyse bağ istemciden değiştirilemez (yeniden eşleştirme hariç).
  if tg_op = 'UPDATE'
     and not v_resync
     and new.university_id is not distinct from old.university_id
     and new.academic_unit_id is not distinct from old.academic_unit_id
     and new.department_id is not distinct from old.department_id
     and new.project_type is not distinct from old.project_type then
    new.guideline_id := old.guideline_id;
    return new;
  end if;

  -- Tez yazım kılavuzları yalnızca tezlere uygulanır.
  if new.project_type <> 'thesis' then
    new.guideline_id := null;
    return new;
  end if;

  -- Dizinde olmayan (serbest metin) kurum: yeni kayıtta bağ yok; yeniden
  -- eşleştirmede eski (ad eşleşmeli) bağ korunur.
  if new.university_id is null then
    if tg_op = 'INSERT' or not v_resync then
      new.guideline_id := null;
    end if;
    return new;
  end if;

  v_guideline := public.best_guideline_for(new.university_id, new.academic_unit_id, new.department_id);
  new.guideline_id := v_guideline;
  if v_guideline is not null then
    select coalesce(approved_snapshot ->> 'citation_style', citation_style)
    into v_citation
    from public.thesis_guidelines
    where id = v_guideline;
    if v_citation is not null then
      new.citation_style := v_citation;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_academic_project_guideline() from public;

-- Ad sırası önemli: guard_academic_project_update_trigger önce çalışır.
drop trigger if exists sync_academic_project_guideline_trigger on public.academic_projects;
create trigger sync_academic_project_guideline_trigger
  before insert or update on public.academic_projects
  for each row execute function public.sync_academic_project_guideline();

-- ---------- 6) Kılavuz onaylanınca/değişince bağları yenile ----------
create or replace function public.resync_project_guidelines(p_guideline_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  v_count integer := 0;
  v_legacy integer := 0;
begin
  if auth.uid() is not null
     and not public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]) then
    raise exception 'Bu işlem için Akademik Yönetici veya üzeri bir rol gerekir.' using errcode = '42501';
  end if;

  select id, university_id, university_name, institute_name, approved_snapshot, is_active
  into g
  from public.thesis_guidelines
  where id = p_guideline_id;
  if not found then
    return 0;
  end if;

  perform set_config('arvolab.guideline_resync', 'on', true);

  -- Aynı üniversitedeki tezler ve bu kılavuza bağlı olanlar yeniden eşleştirilir.
  update public.academic_projects
  set updated_at = updated_at
  where project_type = 'thesis'
    and university_id is not null
    and (university_id = g.university_id or guideline_id = p_guideline_id);
  get diagnostics v_count = row_count;

  -- Dizinde olmayan kurum adıyla açılmış, henüz bağsız tezler (eski davranış).
  if g.approved_snapshot is not null and g.is_active then
    update public.academic_projects
    set guideline_id = g.id,
        citation_style = coalesce(g.approved_snapshot ->> 'citation_style', citation_style)
    where project_type = 'thesis'
      and university_id is null
      and guideline_id is null
      and university is not null
      and lower(trim(university)) = lower(trim(g.university_name))
      and (g.institute_name is null or lower(trim(coalesce(institute, ''))) = lower(trim(g.institute_name)));
    get diagnostics v_legacy = row_count;
  end if;

  perform set_config('arvolab.guideline_resync', 'off', true);
  return v_count + v_legacy;
end;
$$;

revoke all on function public.resync_project_guidelines(uuid) from public;
grant execute on function public.resync_project_guidelines(uuid) to authenticated, service_role;
