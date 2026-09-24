-- ============================================================
-- PROJE: ArvoLab (zpfpocyajnxcketdjbxm)
--
-- Kılavuz bağlanınca ATIF SİSTEMİNİN DEĞİŞTİĞİ de söyleniyor.
--
-- Kılavuz onaylandığında resync_project_guidelines çalışıyor ve
-- sync_academic_project_guideline tetikleyicisi çalışmanın citation_style
-- alanını kılavuzunkiyle EZİYOR. Bu doğru davranış — kılavuz neyse o
-- geçerli — ama sonucu ağır: APA ile yazıp kaynakçasını denetlemiş bir
-- öğrencinin çalışması bir gecede IEEE'ye geçiyor, daha önce "uyumlu"
-- çıkan künyeleri biçim hatası vermeye başlıyor.
--
-- Bildirim vardı ama gövdesi yalnızca çalışmanın adıydı: "Çalışmanıza tez
-- yazım kılavuzu bağlandı". Olan biteni değil, olduğunu söylüyordu.
--
-- Üç durum eklendi:
--   1. Kılavuz bağlandı VE stil değişti  → hangi stilden hangisine.
--   2. Kılavuz aynı, stil değişti        → yeniden onayda stil değişmiş olabilir.
--   3. Kılavuz KALDIRILDI                → kurallar sessizce kalkmasın.
--
-- 47 kılavuz onaylanmak üzere; bu bildirim ilk kez o gün gerçek iş yapacak.
-- ============================================================

create or replace function public.citation_style_label(p_style text)
returns text
language sql
immutable
as $$
  select case p_style
    when 'apa7' then 'APA 7'
    when 'vancouver' then 'Vancouver'
    when 'chicago' then 'Chicago'
    when 'ieee' then 'IEEE'
    when 'mla' then 'MLA 9'
    -- Tanınmayan değer ham haliyle döner: "bilinmeyen" yazmak, kullanıcıdan
    -- kendi çalışmasının ayarını gizlemek olurdu.
    else coalesce(p_style, '—')
  end
$$;

/*
  authenticated'a AÇILMIYOR: etiketi yalnızca bildirim tetikleyicisi
  kullanıyor ve o security definer. Arayüz kendi listesini taşıyor
  (lib/atif/stiller.ts). project_status_label da aynı sebeple kapalı;
  guvenlik.test.mjs listeyi sabitliyor ve bu hatayı ilk denemede yakaladı.
*/
revoke all on function public.citation_style_label(text) from public, anon, authenticated;
grant execute on function public.citation_style_label(text) to service_role;

create or replace function public.notify_project_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  link text := '/dashboard/editor/' || new.id || '/write';
  stil_degisti boolean := new.citation_style is distinct from old.citation_style;
  stil_metni text :=
    'Atıf sisteminiz ' || public.citation_style_label(old.citation_style)
    || ' → ' || public.citation_style_label(new.citation_style)
    || ' olarak güncellendi; kaynakça denetimi artık bu sisteme göre çalışır.';
begin
  if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
    perform public.notify(new.assignee_id, new.id, 'assignment', 'Size bir çalışma atandı', new.title, link);
    perform public.notify(new.owner_id, new.id, 'assignment', 'Çalışmanıza uzman atandı', new.title, link);
  end if;
  if new.status is distinct from old.status then
    perform public.notify(new.owner_id, new.id, 'status', 'Çalışmanızın durumu: ' || public.project_status_label(new.status), new.title, link);
  end if;
  if new.controller_approved_at is not null and old.controller_approved_at is null then
    perform public.notify(new.owner_id, new.id, 'approval', 'Çalışmanız kontrolör onayı aldı', new.title, link);
  end if;

  if new.project_type = 'thesis' then
    if new.guideline_id is distinct from old.guideline_id and new.guideline_id is not null then
      perform public.notify(new.owner_id, new.id, 'guideline_update',
        'Çalışmanıza tez yazım kılavuzu bağlandı',
        case when stil_degisti then new.title || ' — ' || stil_metni else new.title end,
        link);
    elsif new.guideline_id is null and old.guideline_id is not null then
      -- Kılavuz pasife alındığında ya da onayı kaldırıldığında kurallar
      -- öğrencinin ekranından kalkıyor; sebebini bilmeli.
      perform public.notify(new.owner_id, new.id, 'guideline_update',
        'Çalışmanıza uygulanan tez yazım kılavuzu kaldırıldı',
        new.title || ' — zorunlu bölümler, sayfa sınırı ve sayfa ayarları artık uygulanmıyor.',
        link);
    elsif stil_degisti and new.guideline_id is not null then
      -- Kılavuz aynı ama yeniden onaylanırken stili değişmiş olabilir.
      perform public.notify(new.owner_id, new.id, 'guideline_update',
        'Kılavuzunuzun atıf sistemi değişti', new.title || ' — ' || stil_metni, link);
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public.notify_project_changes() from public;

notify pgrst, 'reload schema';
