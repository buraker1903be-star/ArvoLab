import type { Metin } from "./dil";

/*
  KİMLİK DOĞRULAMA KURALLARI: TEK KAYNAK (G1-C A0–A2, 11.11.2026). Saf modül;
  testi tests/unit/kimlik-kurallari.test.ts.

  Buradaki değerler iki yerde birden geçerli olmak zorunda: uygulamanın kendi
  denetimi (sunucu işlemi + tarayıcıdaki form) ve Supabase Auth ayarları. Kod
  Supabase ayarını OKUYAMAZ; bu yüzden değerler burada elle tutulur ve ayar
  değişince buradaki de değişmelidir.

  Eskiden ikisi de dağınıktı ve sapmıştı:
   - Şifre en az uzunluğu sunucuda bir sabitte (8), formda dört ayrı
     minLength={8}'de, iki ekranda da metin olarak "en az 8" yazılıydı.
   - Doğrulama bağlantılarının süresi kayıt ekranında, kayıt ve davet
     e-postasında "24 saat" yazıyordu; Supabase Test'te "Email OTP
     expiration" 3600 saniye (11.11.2026'da ekranda doğrulandı), yani
     bağlantılar 1 saatte düşüyordu. 1–24 saat arasında tıklayan kullanıcı
     vaat edilen bağlantıyı "geçersiz" görüyordu. Kurtarma e-postası zaten
     "1 saat" diyordu.
*/

/*
  Uygulamanın kabul ettiği en kısa şifre. Supabase'teki "Minimum password
  length" ayarı bundan KÜÇÜK ya da EŞİT olmalı: uygulama daha sıkıysa
  Supabase hiçbir zaman "kısa" demez. Tersi olursa kullanıcı uygulamanın
  kabul ettiği şifre için Supabase'ten ret alır.

  Uzunluk JavaScript'in .length'i (UTF-16 birimi) ile ölçülür; tarayıcının
  minLength denetimi de aynı birimi sayar, yani form ve sunucu aynı sonucu
  verir. Supabase uzunluğu UTF-8 BAYTI olarak sayar ve bir karakterin UTF-8
  baytı UTF-16 biriminden hiçbir zaman az değildir: burada geçen şifre
  Supabase'in uzunluk denetiminden de geçer (eşik bundan büyük değilse).
  Uzunluğu geçmek Supabase'in öteki kurallarından (karakter türü, sızıntı)
  geçmek demek DEĞİL; onların cevabı sifre-hatasi.ts'te çevrilir.
*/
export const EN_KISA_SIFRE = 12;

/** Şifre en az uzunluğu karşılamıyorsa kullanıcıya gösterilecek metin; karşılıyorsa null. */
export function sifreUzunlukHatasi(sifre: string): Metin | null {
  if (sifre.length >= EN_KISA_SIFRE) return null;
  return {
    tr: `Şifre en az ${EN_KISA_SIFRE} karakter olmalı.`,
    en: `Password must be at least ${EN_KISA_SIFRE} characters.`,
  };
}

/*
  E-postayla giden doğrulama bağlantılarının (kayıt, davet, kurtarma) süresi.
  Supabase'teki "Email OTP expiration" ayarının (saniye) aynası: üçü de aynı
  ayara bağlı, ayrı ayrı süre verilemiyor. Ayar değişirse yalnızca burası
  değişir; metinler buradan türetilir.
*/
export const DOGRULAMA_BAGLANTISI_SANIYE = 3600;

/** "1 saat" / "1 hour" gibi, cümlenin içine giren süre ifadesi. */
export function baglantiSuresiMetni(saniye: number = DOGRULAMA_BAGLANTISI_SANIYE): Metin {
  if (saniye % 3600 === 0) {
    const saat = saniye / 3600;
    return { tr: `${saat} saat`, en: saat === 1 ? "1 hour" : `${saat} hours` };
  }
  const dakika = Math.max(1, Math.round(saniye / 60));
  return { tr: `${dakika} dakika`, en: dakika === 1 ? "1 minute" : `${dakika} minutes` };
}
