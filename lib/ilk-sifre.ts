/*
  İLK ŞİFRE KAPISI (G1, 07.11.2026). Saf modül; testi tests/unit/ilk-sifre.test.ts.

  Kayıt artık şifreyi e-posta doğrulamasından SONRA alıyor ve veritabanı onay
  anında öncesinden kalan şifreyi siliyor (migration 20261106184046). Şifreyi
  belirlemeden panele geçen oturum adresin sahibine ait (yetki açığı değil),
  ama hesap oturum bitince kilitli kalıyor ve kişi şifre belirlemeden silme,
  ödeme gibi kritik işlemlere geçebiliyordu. Kapı: bu tür oturumda şifre
  yoksa panelin her yolu (sunucu işlemleri dahil) şifre sayfasına gider.

  Kime SORULMAZ: ArvoOS'tan magic link ile gelen kurum üyeleri (otp,
  magiclink) ve şifreyle girenler. ArvoOS üyesinin şifresi bilerek yok; giriş
  ArvoOS üzerinden yapılıyor. Bu yöntemlerden biri oturumda yazılıysa kapı
  sorgu bile yapmaz (her istekte bir veritabanı çağrısı olmasın).

  AMR eksik ya da tanınmayan bir değerse sorulur: yöntemi bilinmeyen oturumu
  serbest bırakmak, şifresiz kayıt kullanıcısını kapının dışında bırakabilirdi.
  Sorgu okunamazsa kapı KAPANMAZ (null): geçici bir arıza kimseyi panelden
  atmamalı; kişinin oturumu zaten adresin sahibine ait.
*/

export const ILK_SIFRE_YOLU = "/reset-password?ilk=1";
/** Şifresi olduğu bir kez doğrulanan oturumda kapı tekrar sorgu yapmasın diye: değeri kullanıcı kimliği. */
export const SIFRE_VAR_CEREZI = "arvo_sifre_var";

/** Şifre olmadan meşru olan girişler: kapı bunlarda hiç sormaz. */
const SIFRESIZ_MESRU = ["otp", "magiclink"];
/** Şifrenin kendisiyle ya da güçlü bir yöntemle girilmiş oturum. */
const SIFRELI_GIRIS = ["password", "oauth", "sso/saml", "totp", "mfa/totp", "mfa/phone", "mfa/webauthn", "web3"];

export function ilkSifreSorulmali(yontemler: readonly string[]): boolean {
  if (yontemler.some((y) => y === "email/signup" || y === "invite" || y === "recovery")) return true;
  if (yontemler.some((y) => SIFRESIZ_MESRU.includes(y) || SIFRELI_GIRIS.includes(y))) return false;
  return true; // eksik ya da tanınmayan AMR
}

/** sifreVar: sifre_durumum() sonucu; null = okunamadı (kapı kapanmaz). */
export function ilkSifreGerekli(yontemler: readonly string[], sifreVar: boolean | null): boolean {
  return sifreVar === false && ilkSifreSorulmali(yontemler);
}
