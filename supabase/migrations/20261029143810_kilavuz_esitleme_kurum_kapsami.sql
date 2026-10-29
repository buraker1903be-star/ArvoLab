-- ============================================================
-- KILAVUZ EŞİTLEMESİ VE GERİ BİLDİRİM KUYRUĞU KURUM SINIRINDA
-- (29.10.2026, personel ekranları incelemesi).
--
-- 1) resync_project_guidelines (20260915090000) bir kurumun kılavuzunu
--    BAŞKA kurumların ve bireysel abonelerin tezlerine bağlıyordu:
--      * Kapı çıplak has_role(['academic_manager',…]) idi (AGENTS.md:
--        "yeni bir okuma politikasında çıplak has_role yazmayın" — yazma
--        için de geçerli). A kurumunun Akademik Yöneticisi HERHANGİ bir
--        onaylı kılavuzun kimliğiyle RPC'yi doğrudan çağırabiliyordu.
--      * "Eski davranış" dalı, üniversite adı eşleşen her bağsız teze
--        guideline_id ve citation_style yazıyordu; kılavuzun kurumuna hiç
--        bakmıyordu. 20260924100034'te best_guideline_for kurumu gözetecek
--        biçimde düzeltilmişti, ama eşitleme bayrağı açıkken tetikleyici
--        bu dalın yazdığı değeri koruyor: düzeltme atlanıyordu.
--    PGlite'ta yeniden üretildi: A'nın yöneticisi çağırınca B kurumunun
--    tezi ve bir bireysel abonenin tezi A'nın kılavuzuna bağlandı, atıf
--    stilleri apa7'den mla'ya döndü; B'nin öğrencilerine "kılavuz
--    onaylandı" bildirimi gitti.
--
--    Artık: kurumun kılavuzunu yalnızca O kurumun yöneticisi (ya da iç
--    ekip) eşitler; genel (kurumsuz) kılavuzu yalnızca iç ekip. Bağsız
--    tez yalnızca kılavuz genelse ya da tezin kurumu kılavuzun kurumuyla
--    aynıysa bağlanır. NULL kurum asla eşleşmez (AGENTS.md).
--
--    Gövde 20260915090000'deki; değişen yalnızca kapı, kurum sütununun
--    okunması ve eski dalın kurum koşulu.
--
-- 2) product_feedback.organization_id istemciden yazılabiliyordu
--    (politika yalnızca user_id = auth.uid() istiyor). A kurumunun
--    öğrencisi organization_id = B yazınca geri bildirimi B'nin
--    yöneticisinin kuyruğuna düşüyor, A'nınkinden kayboluyordu. Sütun
--    artık oturumla gelen yazmada yazanın kurumundan doldurulur ("cevap
--    anındaki kurumun kopyası" — 20260924100019'un tanımı).
-- ============================================================

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
  select id, university_id, university_name, institute_name, approved_snapshot, is_active, organization_id
  into g
  from public.thesis_guidelines
  where id = p_guideline_id;
  if not found then
    return 0;
  end if;

  if auth.uid() is not null then
    if g.organization_id is null then
      if not public.has_role(array['system_admin','founder']::public.user_role[]) then
        raise exception 'Genel kılavuzu yalnızca iç ekip eşitleyebilir.' using errcode = '42501';
      end if;
    elsif not public.gozetim_kapsami(g.organization_id, array['academic_manager']::public.user_role[]) then
      raise exception 'Bu kılavuzu yalnızca kendi kurumunun Akademik Yöneticisi eşitleyebilir.' using errcode = '42501';
    end if;
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
      and (g.institute_name is null or lower(trim(coalesce(institute, ''))) = lower(trim(g.institute_name)))
      -- Kurumun kılavuzu yalnızca kendi kurumunun tezine; NULL eşleşmez.
      and (g.organization_id is null
           or g.organization_id = coalesce(organization_id, public.kullanici_kurumu(owner_id)));
    get diagnostics v_legacy = row_count;
  end if;

  perform set_config('arvolab.guideline_resync', 'off', true);
  return v_count + v_legacy;
end;
$$;

revoke all on function public.resync_project_guidelines(uuid) from public, anon, authenticated;
grant execute on function public.resync_project_guidelines(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------

-- Çağıranın rolüne (current_user) baktığı için security INVOKER: definer
-- olsaydı current_user her zaman sahip olurdu ve koşul hiç tutmazdı.
create or replace function public.product_feedback_kurumu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.organization_id := public.kullanici_kurumu(new.user_id);
  end if;
  return new;
end;
$$;

revoke all on function public.product_feedback_kurumu() from public, anon, authenticated;

drop trigger if exists product_feedback_kurumu on public.product_feedback;
create trigger product_feedback_kurumu
  before insert or update on public.product_feedback
  for each row execute function public.product_feedback_kurumu();
