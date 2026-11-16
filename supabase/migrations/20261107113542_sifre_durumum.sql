/*
  G1 İLK KURULUM KAPISI İÇİN: "bu oturumun hesabında şifre var mı?" (07.11.2026)

  20261106184046'dan beri onay anında, onaydan önce konmuş şifre siliniyor ve
  kayıt şifreyi doğrulamadan SONRA alıyor. Doğrulamayı yapıp şifre
  belirlemeden çıkan (ya da Supabase'in kendi postasıyla, PKCE ile gelen)
  kullanıcı şifresiz bir oturumla panele girebiliyordu: oturum adresin
  sahibine ait olduğu için bu bir yetki açığı değil, ama hesap oturum
  bitince kilitli kalıyor ve şifreyi hiç belirlemeden kritik işlemlere
  (silme talebi, ödeme) geçilebiliyordu. proxy.ts bu fonksiyonla şifresiz
  oturumu önce şifre belirlemeye gönderiyor.

  Neden fonksiyon: auth.users'ı istemci okuyamaz ve Supabase kullanıcı
  nesnesi "şifresi var mı" bilgisini taşımıyor. PARAMETRE ALMIYOR: yalnızca
  çağıranın kendi hesabı; başkasının hesabı hakkında hiçbir şey söylemez.
  Şifrenin kendisini ya da özetini DÖNDÜRMEZ, yalnızca var/yok.
*/
create or replace function public.sifre_durumum()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.encrypted_password, '') <> ''
    from auth.users u
   where u.id = auth.uid();
$$;

revoke all on function public.sifre_durumum() from public, anon, authenticated;
grant execute on function public.sifre_durumum() to authenticated;
