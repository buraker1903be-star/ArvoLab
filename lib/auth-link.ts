/*
  Kimlik e-postalarındaki bağlantı ve /auth/confirm'ün dönüş adresi. Saf
  modül; testi tests/unit/auth-link.test.ts.

  Eskiden e-postaya admin.generateLink'in action_link'i konuyordu. O bağlantı
  Supabase'te doğrulanıp oturumu adresin #access_token=… kısmıyla döndürür;
  sunucudaki /auth/confirm o kısmı hiç görmez (ne ?code ne ?token_hash) ve
  her şifre sıfırlama/davet "bağlantı geçersiz" sayfasına düşüyordu
  (16.09.2026 → 20.09.2026). Artık bağlantı doğrudan bizim adresimize,
  hashed_token ile gider; /auth/confirm verifyOtp ile oturum açar.
*/

/*
  "signup": kendi kaydolan kullanıcının doğrulama bağlantısı. Supabase'in
  verifyOtp'si bu türü de tanıyor; /auth/confirm aynı yolu kullanıyor.
*/
export type AuthLinkType = "recovery" | "invite" | "signup";

export function authConfirmLink(origin: string, hashedToken: string, type: AuthLinkType, next = "/reset-password") {
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", type);
  url.searchParams.set("next", next);
  return url.toString();
}

/**
 * /auth/confirm'ün yönlendireceği iç yol. Yalnızca bilinen panel yolları:
 * "/\evil.example" ya da "/%09/evil" gibi değerler new URL() içinde başka
 * alan adına çözülüyordu (açık yönlendirme). Eskiden yalnızca "/" ile
 * başlaması ve "//" olmaması aranıyordu.
 */
export function safeConfirmNext(raw: string | null | undefined): string {
  const value = raw ?? "";
  if (!/^\/(dashboard|reset-password)(?=$|[/?#])/.test(value)) return "/dashboard";
  if (/[\\\s]|%5c|%09|%0a|%0d/i.test(value) || value.includes("//")) return "/dashboard";
  return value;
}
