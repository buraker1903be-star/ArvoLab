/*
  G1 İLK ŞİFRE KAPISI: "bu oturumun şifre belirlemesi gerekiyor mu?" (07.11.2026)

  20261107113542 yalnızca "şifre var mı" diyordu; kapı da AMR'ye bakıp ArvoOS
  magic link oturumunu (bilerek şifresiz) ayırmaya çalışıyordu. Test'te
  görüldü: token_hash ile yapılan HER doğrulama (kayıt, davet, kurtarma,
  magic link) oturuma aynı AMR'yi yazıyor ("otp"), yani AMR kayıt
  kullanıcısıyla ArvoOS üyesini ayıramıyor — şifresiz kayıt kullanıcısı
  kapıdan geçiyordu. Ayrım artık veride: şifre yok VE e-posta ArvoOS'un
  ittiği üye listesinde değil → şifre belirlemeli. ArvoOS üyesi ArvoOS
  üzerinden magic link ile giriyor; ondan şifre istenmez.

  PARAMETRE ALMIYOR: yalnızca çağıranın kendi hesabı; yalnızca evet/hayır
  döner (şifre, özet ya da üye listesi sızmaz).
*/
create or replace function public.ilk_sifre_gerekli()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.encrypted_password, '') = ''
     and not exists (
       select 1 from public.arvoos_members m
        where m.email = lower(btrim(u.email))
     )
    from auth.users u
   where u.id = auth.uid();
$$;

revoke all on function public.ilk_sifre_gerekli() from public, anon, authenticated;
grant execute on function public.ilk_sifre_gerekli() to authenticated;

-- Yerini aldı; çağıranı kalmadı (açık bir fonksiyonu boşta bırakmayalım).
drop function if exists public.sifre_durumum();
