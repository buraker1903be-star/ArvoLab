import type { Metin } from "./dil";
import { EN_KISA_SIFRE } from "./kimlik-kurallari";

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

/*
  ZAYIF ŞİFRENİN NEDENLERİ (G1-C A1, 11.11.2026). Eskiden "weak_password"
  için tek metin vardı: "harf, rakam ve sembolleri birlikte kullanın". Şifre
  KISA olduğu ya da bilinen bir sızıntıda geçtiği için reddedildiğinde de bu
  yazıyordu; kullanıcı şifresine sembol ekleyip aynı reddi yeniden alıyordu.

  Supabase nedenleri hatanın kendisinde veriyor: @supabase/auth-js 2.112.1'de
  updateUser'ın döndürdüğü AuthWeakPasswordError'un `reasons` alanı
  (lib/fetch.js, lib/errors.js; tipte "length" | "characters" | "pwned").
  Alan sunucudan gelen bir dizi olduğu için tipine güvenilmez: yalnızca
  bilinen üç değer alınır, gerisi yok sayılır ve genel metne düşülür.
  Hata nesnesinin geri kalanı (ileti, durum) bilerek okunmaz.
*/
export const ZAYIF_SIFRE_NEDENLERI = ["length", "characters", "pwned"] as const;
export type ZayifSifreNedeni = (typeof ZAYIF_SIFRE_NEDENLERI)[number];

/** Hata nesnesinden yalnızca tanınan zayıflık nedenlerini, sabit sırayla çıkarır. */
export function zayifSifreNedenleri(hata: unknown): ZayifSifreNedeni[] {
  if (!hata || typeof hata !== "object" || !("reasons" in hata)) return [];
  const ham = (hata as { reasons: unknown }).reasons;
  if (!Array.isArray(ham)) return [];
  return ZAYIF_SIFRE_NEDENLERI.filter((neden) => ham.includes(neden));
}

const ZAYIF_SIFRE_METNI: Record<ZayifSifreNedeni, Metin> = {
  length: {
    tr: `Şifre yeterince uzun değil; en az ${EN_KISA_SIFRE} karakter kullanın.`,
    en: `The password is too short; use at least ${EN_KISA_SIFRE} characters.`,
  },
  characters: {
    tr: "Şifre gerekli karakter türlerini içermiyor; küçük ve büyük harf, rakam ve sembolleri birlikte kullanın.",
    en: "The password does not contain the required character types; combine lowercase and uppercase letters, numbers and symbols.",
  },
  pwned: {
    tr: "Bu şifre bilinen bir veri sızıntısında geçiyor; başka bir şifre seçin.",
    en: "This password appears in a known data breach; choose a different one.",
  },
};

function zayifSifreMetni(verilen: readonly ZayifSifreNedeni[]): Metin {
  // Sıra ve küme sabit: çağıran süzmeden verse de bilinmeyen değer metne girmez.
  const nedenler = ZAYIF_SIFRE_NEDENLERI.filter((neden) => verilen.includes(neden));
  if (nedenler.length === 0) {
    return {
      tr: "Şifre güvenlik koşullarını karşılamıyor. Daha uzun ve farklı bir şifre deneyin.",
      en: "The password does not meet the security requirements. Try a longer, different password.",
    };
  }
  return {
    tr: nedenler.map((neden) => ZAYIF_SIFRE_METNI[neden].tr).join(" "),
    en: nedenler.map((neden) => ZAYIF_SIFRE_METNI[neden].en).join(" "),
  };
}

export function sifreHatasi(kod: string | undefined, baglam: SifreBaglami, nedenler: readonly ZayifSifreNedeni[] = []): Metin {
  switch (kod) {
    case "same_password":
      return { tr: "Yeni şifre mevcut şifrenizden farklı olmalı.", en: "The new password must be different from your current one." };
    case "weak_password":
      return zayifSifreMetni(nedenler);
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
