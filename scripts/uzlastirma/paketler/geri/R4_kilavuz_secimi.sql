-- ============================================================
-- R4 — P4_kilavuz_secimi paketinin GERİ DÖNÜŞÜ (RELEASE CLOSURE 06; Production'a UYGULANMADI)
-- best_guideline_for Production'daki 20260924100034 gövdesine döner. Veri değişmez; yalnızca yeni çalışmalara atanacak kılavuzun seçim sırası eskiye döner.
-- Tek işlem: hata olursa hiçbir şey değişmez. Tekrar çalıştırılabilir.
-- Sınandığı yer: scripts/uzlastirma/prova-geri.sh (paket + geri dönüş = paketten önceki şema özeti).
-- ============================================================
begin;
create or replace function public.best_guideline_for(
  p_university_id uuid,
  p_unit_id uuid,
  p_department_id uuid,
  p_organization_id uuid
)
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
      g.organization_id is null
      or (p_organization_id is not null and g.organization_id = p_organization_id)
    )
    and (
      g.academic_unit_id is null
      or g.academic_unit_id = p_unit_id
      or g.academic_unit_id = p_department_id
    )
  order by
    -- Kurumun kendi kılavuzu ortak katalogdan önce gelir.
    case when g.organization_id is not null then 0 else 1 end,
    case
      when p_department_id is not null and g.academic_unit_id = p_department_id then 0
      when p_unit_id is not null and g.academic_unit_id = p_unit_id then 1
      else 2
    end,
    g.effective_from desc nulls last,
    g.approved_snapshot ->> 'approved_at' desc
  limit 1
$$;
revoke all on function public.best_guideline_for(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.best_guideline_for(uuid, uuid, uuid, uuid) to service_role;
commit;
