-- ============================================================
-- PROJE: ArvoLab (zpfpocyajnxcketdjbxm)
--
-- Aynı düzeyde iki onaylı kılavuz varsa seçim KARARLI olsun.
--
-- 26.09.2026'da 17 kılavuz toplu onaylandı ve iki üniversitede ikişer
-- kayıt çıktı (Adıyaman, Burdur) — ikisi de üniversite geneli, yani
-- academic_unit_id boş. best_guideline_for'un sıralaması orada tükeniyordu:
--
--   organization_id → birim özgüllüğü → effective_from → approved_at
--
-- Toplu onayda approved_at hepsinde AYNI ana damgalandığı için son kırıcı
-- kalmadı ve "limit 1" hangisini döndüreceğini Postgres'in o anki planına
-- bıraktı. Burdur'da bu, Fen Bilimleri kılavuzu ile Eğitim Bilimleri
-- kılavuzu arasında rastgele seçim demekti; ikisi farklı kurallar taşıyor
-- ve öğrencinin editörüne inen kurallar sorgudan sorguya değişebilirdi.
--
-- İki kırıcı ekleniyor:
--   * created_at desc — sonradan eklenen kayıt daha güncel olma
--     ihtimali yüksek (kurum yeni sürümü yayımladığında yenisi girer).
--   * id — mutlak son çare; eşitlikte hep aynı kayıt kazansın.
--
-- Bu bir TERCİH sırası değil, kararlılık garantisi: aynı düzeyde iki
-- kılavuzun bulunması başlı başına gözden geçirilmesi gereken bir durum
-- ve panel artık bunu satırda uyarı olarak gösteriyor.
--
-- Gövdenin geri kalanı 20260924100034'teki gibi.
-- ============================================================

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
    g.approved_snapshot ->> 'approved_at' desc,
    -- Buradan sonrası KARARLILIK için: toplu onayda approved_at eşitlenir.
    g.created_at desc,
    g.id
  limit 1
$$;

revoke all on function public.best_guideline_for(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.best_guideline_for(uuid, uuid, uuid, uuid) to service_role;

notify pgrst, 'reload schema';
