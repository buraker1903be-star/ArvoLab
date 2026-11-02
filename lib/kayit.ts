import type { Metin } from "./dil";
/*
  Kayıt formunun doğrulaması. Saf modül; testi tests/unit/kayit.test.ts.

  Sunucu eylemi bu kuralları kullanıyor, form da aynı metinleri gösteriyor:
  iki yerde ayrı yazılsaydı tarayıcının kabul ettiğini sunucu reddeder,
  kullanıcı sebebini anlamadan geri dönerdi.
*/

export const EN_KISA_SIFRE = 8;
const EN_UZUN_AD = 120;
const EN_UZUN_EPOSTA = 254;

/*
  E-posta biçimi burada KABACA denetleniyor. Kesin doğrulama zaten
  doğrulama e-postasının kendisi: adres yanlışsa posta ulaşmaz ve hesap
  açılmaz. Dar bir desen, geçerli ama sıra dışı adresleri (artı işareti,
  uzun uzantı, Türkçe kurum alan adları) haksız yere reddederdi.
*/
const EPOSTA = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

/*
  Telefon (02.11.2026, kurum sahibinin isteği: kayıtta telefon da alınsın).
  Yalnızca rakamlar ve baştaki "+" kalır; boşluk, tire ve parantez yazımı
  serbest ("0532 123 45 67", "+90 (532) 123-4567"). 10–15 rakam: yerel
  Türkiye numarası 10 ya da 11, uluslararası E.164 en çok 15. Ülke kodu
  ZORUNLU değil — yurt dışındaki öğrenciye Türkiye biçimini dayatmamak için.
*/
export function telefonuTemizle(ham: unknown): string | null {
  const metin = String(ham ?? "").trim();
  if (!/^\+?[\d\s().-]+$/.test(metin)) return null;
  const arti = metin.startsWith("+") ? "+" : "";
  const rakamlar = metin.replace(/\D/g, "");
  if (rakamlar.length < 10 || rakamlar.length > 15) return null;
  return arti + rakamlar;
}

export type KayitGirdisi = { email: string; sifre: string; adSoyad: string; kvkk: boolean };
export type KayitDegeri = {
  email: string;
  sifre: string;
  adSoyad: string;
  telefon: string;
  /** Duyuru ve kampanya iletisi izni (isteğe bağlı; ticari elektronik ileti onayı). */
  iletisimIzni: boolean;
};
export type KayitSonucu = { hata: Metin } | { deger: KayitDegeri };

export function kayitGirdisiniDenetle(ham: {
  email?: unknown;
  sifre?: unknown;
  sifreTekrar?: unknown;
  adSoyad?: unknown;
  telefon?: unknown;
  kvkk?: unknown;
  /** Kullanım Sözleşmesi kutusu işaretli. */
  sozlesme?: unknown;
  /** Sözleşme metni sonuna kadar kaydırıldı (kutu ancak o zaman işaretlenebiliyor). */
  sozlesmeOkundu?: unknown;
  iletisimIzni?: unknown;
}): KayitSonucu {
  /*
    E-posta DİLDEN BAĞIMSIZ küçültülüyor. toLocaleLowerCase("tr-TR") "I"yı
    "ı" yapar: "ISIK@…" adresi "ısık@…" olarak kaydedilir ve kullanıcı
    kendi yazdığı adresle bir daha asla giremez (Supabase girişte dil
    kuralı uygulamıyor). Türkçe küçültme yalnızca insan metninde doğru.
  */
  const email = String(ham.email ?? "").trim().toLowerCase().slice(0, EN_UZUN_EPOSTA);
  const sifre = String(ham.sifre ?? "");
  const adSoyad = String(ham.adSoyad ?? "").trim().replace(/\s+/g, " ").slice(0, EN_UZUN_AD);

  if (!adSoyad || adSoyad.length < 2) return { hata: { tr: "Ad ve soyadınızı yazın.", en: "Enter your full name." } };
  if (!email || !EPOSTA.test(email)) return { hata: { tr: "Geçerli bir e-posta adresi yazın.", en: "Enter a valid email address." } };
  const telefon = telefonuTemizle(ham.telefon);
  if (!telefon) return { hata: { tr: "Geçerli bir telefon numarası yazın (10–15 rakam).", en: "Enter a valid phone number (10–15 digits)." } };
  if (sifre.length < EN_KISA_SIFRE) return { hata: { tr: `Şifre en az ${EN_KISA_SIFRE} karakter olmalı.`, en: `Password must be at least ${EN_KISA_SIFRE} characters.` } };
  /*
    Şifre ile e-posta aynı olamaz. Karmaşıklık kuralı (büyük harf, rakam,
    simge) KOYMUYORUZ: kullanıcıyı "Parola1!" gibi tahmin edilebilir
    kalıplara itiyor ve uzunluktan daha az koruyor.
  */
  if (sifre.toLowerCase() === email) return { hata: { tr: "Şifreniz e-posta adresinizle aynı olamaz.", en: "Your password cannot be the same as your email address." } };
  /* Tekrar alanı tarayıcıda da denetleniyor; sunucu yine bakar — form JavaScript'siz de gönderilebilir. */
  if (String(ham.sifreTekrar ?? "") !== sifre) return { hata: { tr: "Şifreler birbiriyle aynı değil.", en: "The passwords don't match." } };
  /*
    Sözleşme onayı iki koşul: kutu işaretli VE metin sonuna kadar okundu.
    Kutu yalnızca okuma bitince işaretlenebiliyor (app/_components/kayit-formu);
    ikinci koşul, bu kuralı atlayan bir gönderimi (betik, eski sekme) durdurur
    — okunmadan verilen onay, delil olarak yazılmamalı.
  */
  if (!ham.sozlesme || !ham.sozlesmeOkundu) return { hata: { tr: "Devam etmek için Kullanım Sözleşmesi'ni okuyup onaylayın.", en: "Please read and accept the Terms of Use to continue." } };
  if (!ham.kvkk) return { hata: { tr: "Devam etmek için aydınlatma metnini onaylayın.", en: "Please accept the privacy notice to continue." } };

  return { deger: { email, sifre, adSoyad, telefon, iletisimIzni: Boolean(ham.iletisimIzni) } };
}
