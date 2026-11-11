import type { Metin } from "./dil";

/*
  ŞİFRE GÜNCELLEME HATASININ METNİ (G1 Aşama 8.3, 10.11.2026). Saf modül;
  testi tests/unit/sifre-hatasi.test.ts.

  Supabase'te "Secure password change" açıkken oturum yakın tarihli değilse
  updateUser({ password }) "reauthentication_needed" döner. Eskiden bu kod her
  yerde "çıkış yapıp yeniden giriş yapın" metnine çevriliyordu. Şifresi olan
  kullanıcı için doğru, ama kayıt doğrulamasından sonra şifresini henüz
  belirlemeyen (veritabanında şifresi NULL) kullanıcı şifreyle giriş YAPAMAZ:
  ilk şifre ekranında kalıyor, panelin her yolu onu yine bu ekrana
  gönderiyordu (R1, Aşama 8.2). Sıfırlama ve ilk şifre ekranında doğru yol,
  e-posta sahipliğini yeni bir doğrulama bağlantısıyla yeniden kanıtlamak:
  bağlantının açtığı oturum yakın tarihli olduğu için şifre belirlenebilir.
  Güvenlik düzeyi değişmez; ayar kapatılmaz, nonce akışı da gerekmez.
*/

export type SifreBaglami = "sifirlama" | "ayarlar";

/** /forgot-password'e açıklamayla gelmenin tek tanınan nedeni (değer beyaz listeli; metin yansıtılmaz). */
export const YENIDEN_DOGRULAMA_NEDENI = "yeniden-dogrulama";
/** Sabit iç yol: kullanıcıdan gelen hiçbir değer içermez (açık yönlendirme yok). */
export const KURTARMA_YOLU = `/forgot-password?neden=${YENIDEN_DOGRULAMA_NEDENI}`;

export function sifreHatasi(kod: string | undefined, baglam: SifreBaglami): Metin {
  switch (kod) {
    case "same_password":
      return { tr: "Yeni şifre mevcut şifrenizden farklı olmalı.", en: "The new password must be different from your current one." };
    case "weak_password":
      return {
        tr: "Şifre yeterince güçlü değil; harf, rakam ve sembolleri birlikte kullanın.",
        en: "The password is not strong enough; combine letters, numbers and symbols.",
      };
    case "reauthentication_needed":
      return baglam === "sifirlama"
        ? {
            tr: "Güvenlik nedeniyle şifrenizi belirlemeden önce e-posta adresinizi yeniden doğrulamanız gerekiyor. Aşağıdan yeni bir doğrulama bağlantısı isteyin.",
            en: "For security reasons, you need to verify your email address again before setting your password. Request a new verification link below.",
          }
        : {
            tr: "Güvenlik nedeniyle çıkış yapıp yeniden giriş yaptıktan sonra tekrar deneyin.",
            en: "For security reasons, sign out, sign in again and then retry.",
          };
    default:
      return { tr: "Şifre güncellenemedi. Lütfen tekrar deneyin.", en: "The password could not be updated. Please try again." };
  }
}
