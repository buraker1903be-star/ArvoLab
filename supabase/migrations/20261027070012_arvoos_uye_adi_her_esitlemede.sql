-- ArvoOS'tan gelen personel adı, kişi kuruma bağlandıktan SONRA da işlensin.
--
-- Eskiden ad yalnızca bağlama anında yazılıyordu (arvoos_uyeligini_bagla,
-- 20260924100015) ve bağlama yalnızca KURUMSUZ profilde çalışıyor. Şu
-- durumlarda ad hiç gelmiyordu:
--   - kişi ArvoLab'a girdiğinde ArvoOS'ta adı henüz boştu, ad sonradan
--     girildi (bağlama bir daha çalışmıyor);
--   - kişi kuruma SQL ya da Ekip Yönetimi'nden elle bağlandı (bağlama hiç
--     çalışmadı).
-- 27.10.2026'da AkademikMerkez personeli b.agca bu yüzden ekip listesinde
-- "İsimsiz personel" görünüyordu.
--
-- Artık ArvoOS üye listesini her yazdığında (lisans eşitlemesi) ad,
-- AYNI KURUMA bağlı ve adı BOŞ olan profile işleniyor. Ad doluysa
-- dokunulmuyor: kişi adını ArvoLab'da düzeltmişse bir sonraki eşitleme
-- onu sessizce geri almamalı (20260924100015'teki kuralın aynısı).

create or replace function public.arvoos_uye_adini_isle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(new.full_name), '') is null then
    return new;
  end if;

  update public.profiles p
     set full_name = btrim(new.full_name)
    from auth.users u
   where u.id = p.id
     and lower(btrim(u.email)) = lower(btrim(new.email))
     and p.organization_id = new.organization_id
     and coalesce(btrim(p.full_name), '') = '';

  return new;
end;
$$;

revoke all on function public.arvoos_uye_adini_isle() from public, anon, authenticated;

drop trigger if exists arvoos_uye_adini_isle on public.arvoos_members;
create trigger arvoos_uye_adini_isle
  after insert or update of full_name, organization_id on public.arvoos_members
  for each row execute function public.arvoos_uye_adini_isle();

-- Bugün adı boş kalmış, listede adı olan herkes için bir kez.
update public.profiles p
   set full_name = btrim(m.full_name)
  from auth.users u, public.arvoos_members m
 where u.id = p.id
   and lower(btrim(u.email)) = lower(btrim(m.email))
   and p.organization_id = m.organization_id
   and coalesce(btrim(p.full_name), '') = ''
   and nullif(btrim(m.full_name), '') is not null;
