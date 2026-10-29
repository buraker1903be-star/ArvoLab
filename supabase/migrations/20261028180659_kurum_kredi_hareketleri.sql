-- Kurumun AI kredi defteri: son hareketler (28.10.2026)
-- ------------------------------------------------------------
-- Kurum sahibinin kararıyla kurum yöneticisi asistan kredisini artık
-- ArvoLab'ın Abonelik ve kredi sayfasından alıyor; bireysel abonenin
-- gördüğü "Son hareketler" listesini kurum yöneticisi de görmeli.
--
-- ai_kredi_hareketleri'nin authenticated için politikası YOK ve öyle
-- kalıyor (20260924100014): tabloyu açmak, her kurum üyesinin defteri
-- okuyabilmesi için yeni bir politika demekti. Okuma bu dar işlevden:
--
--  * Yetki faturaları görmekle AYNI kural (lib/faturalama.ts →
--    faturalamaKapsami): kurumun Akademik Yöneticisi kendi kurumunu,
--    iç ekip (system_admin, founder) seçtiği kurumu. SQL karşılığı
--    gozetim_kapsami(kurum, '{academic_manager}') — kurumlar arası görüş
--    yalnızca iç ekipte, NULL kurum asla eşleşmez (AGENTS.md).
--  * Kurum kimliği PARAMETRE, çünkü iç ekip kurum seçicide seçtiği kurumu
--    görüyor. Parametre güvenliği gevşetmiyor: yetkisi olmayan çağıran
--    hata değil BOŞ liste alır (başka kurumun var olup olmadığı da sızmaz).
--  * Son 8 hareket; sayfa bundan sayı çıkarmıyor, yalnızca listeliyor.
--    Tüketim satırları yalnızca tür, kredi ve zaman taşıyor; kimin
--    çalıştırdığı döndürülmüyor.
create or replace function public.ai_kurum_kredi_hareketleri(p_organization_id uuid)
returns table (tur text, kredi bigint, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select h.tur, h.kredi::bigint, h.created_at
    from public.ai_kredi_hareketleri h
   where p_organization_id is not null
     and h.organization_id = p_organization_id
     and public.gozetim_kapsami(p_organization_id, array['academic_manager']::public.user_role[])
   order by h.created_at desc
   limit 8
$$;

revoke all on function public.ai_kurum_kredi_hareketleri(uuid) from public, anon, authenticated;
grant execute on function public.ai_kurum_kredi_hareketleri(uuid) to authenticated;
