import type { Metin } from "./dil";
import { tekKarakterTekrariMi, yayginSifreMi } from "./yaygin-sifreler";

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
  ŞİFRE POLİTİKASI (G1-D D1, 11.11.2026; ürün kararı). En az 8, en fazla 64
  karakter; büyük harf, rakam ya da sembol ZORUNLULUĞU YOK; yaygın şifreler
  reddedilir. İlk şifre, kurtarma ve Ayarlar'daki değişiklik aynı kuralı
  kullanır (hepsi applyNewPassword'den geçiyor). Eskiden (G1-C A2, 089ef54)
  en az 12'ydi; ürün kararıyla 8'e indi, merkezi yapı korundu.

  Supabase'teki "Minimum password length" bu değerden KÜÇÜK ya da EŞİT
  olmalı (Test'te 6): uygulama daha sıkıysa Supabase hiçbir zaman "kısa"
  demez. Tersi olursa kullanıcı uygulamanın kabul ettiği şifre için
  Supabase'ten ret alır.

  Uzunluk JavaScript'in .length'i (UTF-16 birimi) ile ölçülür; tarayıcının
  minLength denetimi de aynı birimi sayar, form ve sunucu aynı sonucu verir.
  Formda maxLength BİLEREK YOK (G1-D, 11.11.2026): tarayıcı fazlasını hiçbir
  uyarı vermeden kırpıyordu; gerçek testte 73 karakter yazan kullanıcının
  şifresi ilk 64 karakteriyle kaydedildi ve kullanıcı kaydedilen şifreyi
  bilmiyordu. 64 sınırı artık bu fonksiyonla, açık mesajla söyleniyor.

  72 BAYT: Supabase şifreyi bcrypt ile saklar ve 72 bayttan uzununu kabul
  etmez. Türkçe harfler (ç, ğ, ı, ö, ş, ü ve büyükleri) UTF-8'de 2 bayt:
  64 Türkçe harf 128 bayt eder. Bu yüzden 64 karakter sınırına ek olarak
  bayt sınırı ayrıca denetlenir ve kullanıcıya NEDENİYLE söylenir; yoksa
  60 karakterlik bir şifre "en fazla 64" kuralına uyduğu hâlde Supabase'ten
  genel bir hatayla dönerdi. Bayt denetimi tarayıcının yapamadığı tek
  denetim; form onu ve yaygın şifre denetimini aynı fonksiyonla istemcide de
  gösterir (password-form.tsx), sunucu yine kendisi denetler.
*/
export const EN_KISA_SIFRE = 8;
export const EN_UZUN_SIFRE = 64;
export const SIFRE_BAYT_SINIRI = 72;

/* "Şifre" ve "tekrar" kutuları farklıysa: sunucu (applyNewPassword) ve form aynı metni gösterir. */
export const SIFRE_ESLESMEDI: Metin = { tr: "Şifreler eşleşmiyor.", en: "The passwords do not match." };

const sifreBayti = (sifre: string) => new TextEncoder().encode(sifre).length;

/**
 * Şifre politikasını karşılamıyorsa kullanıcıya gösterilecek metin; karşılıyorsa null.
 * Sıra sabit: kısa → uzun → bayt → tek karakter tekrarı → yaygın (ilk tutan kural söylenir).
 */
export function sifreKuraliHatasi(sifre: string): Metin | null {
  if (sifre.length < EN_KISA_SIFRE) {
    return { tr: `Şifre en az ${EN_KISA_SIFRE} karakter olmalı.`, en: `Password must be at least ${EN_KISA_SIFRE} characters.` };
  }
  if (sifre.length > EN_UZUN_SIFRE) {
    return { tr: `Şifre en fazla ${EN_UZUN_SIFRE} karakter olabilir.`, en: `Password can be at most ${EN_UZUN_SIFRE} characters.` };
  }
  if (sifreBayti(sifre) > SIFRE_BAYT_SINIRI) {
    return {
      tr: `Şifre çok uzun: Türkçe harfler (ç, ğ, ı, ö, ş, ü) ve bazı semboller iki ya da daha fazla bayt sayılır ve şifre en fazla ${SIFRE_BAYT_SINIRI} bayt olabilir. Daha kısa bir şifre seçin ya da bu karakterlerin bir kısmını azaltın.`,
      en: `The password is too long: Turkish letters (ç, ğ, ı, ö, ş, ü) and some symbols count as two or more bytes, and the password can be at most ${SIFRE_BAYT_SINIRI} bytes. Choose a shorter password or use fewer of these characters.`,
    };
  }
  if (tekKarakterTekrariMi(sifre)) {
    return { tr: "Şifre tek bir karakterin tekrarından oluşamaz.", en: "The password cannot be a single character repeated." };
  }
  if (yayginSifreMi(sifre)) {
    return { tr: "Bu şifre çok yaygın ve kolay tahmin edilir; başka bir şifre seçin.", en: "This password is too common and easy to guess; choose a different one." };
  }
  return null;
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
