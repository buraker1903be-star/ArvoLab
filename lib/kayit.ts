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

export type KayitGirdisi = { email: string; sifre: string; adSoyad: string; kvkk: boolean };
export type KayitSonucu = { hata: string } | { deger: { email: string; sifre: string; adSoyad: string } };

export function kayitGirdisiniDenetle(ham: {
  email?: unknown;
  sifre?: unknown;
  adSoyad?: unknown;
  kvkk?: unknown;
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

  if (!adSoyad || adSoyad.length < 2) return { hata: "Ad ve soyadınızı yazın." };
  if (!email || !EPOSTA.test(email)) return { hata: "Geçerli bir e-posta adresi yazın." };
  if (sifre.length < EN_KISA_SIFRE) return { hata: `Şifre en az ${EN_KISA_SIFRE} karakter olmalı.` };
  /*
    Şifre ile e-posta aynı olamaz. Karmaşıklık kuralı (büyük harf, rakam,
    simge) KOYMUYORUZ: kullanıcıyı "Parola1!" gibi tahmin edilebilir
    kalıplara itiyor ve uzunluktan daha az koruyor.
  */
  if (sifre.toLowerCase() === email) return { hata: "Şifreniz e-posta adresinizle aynı olamaz." };
  if (!ham.kvkk) return { hata: "Devam etmek için aydınlatma metnini onaylayın." };

  return { deger: { email, sifre, adSoyad } };
}
