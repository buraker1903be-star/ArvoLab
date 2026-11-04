/*
  BU İSTEK BİZİM SAYFAMIZDAN MI GELDİ? (Phase 2, 04.11.2026)

  /auth/confirm'ün POST'u e-posta bağlantısını doğrulayıp OTURUM AÇIYOR.
  Next'in sunucu işlemleri köken denetimini kendisi yapıyor, rota
  işleyicileri yapmıyor. Eskiden başka bir site kendi hesabının
  bağlantısını (token_hash) gizli bir formla buraya gönderip kurbanı
  SALDIRGANIN hesabına sokabiliyordu (giriş CSRF'i): kurban tezini
  saldırganın göreceği bir hesaba yazardı.

  Karar: tarayıcı "başka siteden" diyorsa (Sec-Fetch-Site: cross-site /
  same-site) ya da Origin başlığı bizim adresimiz değilse istek reddedilir.
  İkisi de yoksa (eski tarayıcı, gizlilik eklentisi) izin verilir: meşru
  kullanıcıyı kapıda bırakmamak, nadir bir eski tarayıcıda saldırıyı
  mümkün bırakmaktan iyi.
*/
export function ayniKokenMi(istek: { secFetchSite: string | null; origin: string | null; host: string | null }): boolean {
  const site = istek.secFetchSite?.toLowerCase() ?? null;
  if (site && site !== "same-origin" && site !== "none") return false;
  if (istek.origin && istek.origin !== "null") {
    try {
      return Boolean(istek.host) && new URL(istek.origin).host === istek.host;
    } catch {
      return false;
    }
  }
  if (istek.origin === "null") return false;
  return true;
}
