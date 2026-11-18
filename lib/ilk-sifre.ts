/*
  İLK ŞİFRE KAPISI (G1, 07.11.2026). Saf modül; testi tests/unit/ilk-sifre.test.ts.

  Kayıt artık şifreyi e-posta doğrulamasından SONRA alıyor ve veritabanı onay
  anında öncesinden kalan şifreyi siliyor (migration 20261106184046). Şifreyi
  belirlemeden panele geçen oturum adresin sahibine ait (yetki açığı değil),
  ama hesap oturum bitince kilitli kalıyor ve kişi şifre belirlemeden silme,
  ödeme gibi kritik işlemlere geçebiliyordu. Kapı: şifre belirlemesi gereken
  oturumda panelin her yolu (sunucu işlemleri dahil) şifre sayfasına gider.

  KARAR VERİDE, AMR'DE DEĞİL. İlk sürüm AMR'ye bakıp ArvoOS magic link
  oturumunu (otp) muaf tutuyordu; Test'te görüldü ki token_hash ile yapılan
  her doğrulama (kayıt dahil) AMR'ye "otp" yazıyor ve şifresiz kayıt
  kullanıcısı kapıdan geçiyordu. Karar public.ilk_sifre_gerekli()'de
  (migration 20261107120542): şifre yok VE ArvoOS üyesi değil.
  AMR yalnızca sorgudan kaçınmak için: oturum şifreyle açıldıysa hesapta
  şifre vardır, sorulmaz.

  Sorgu okunamazsa kapı KAPANMAZ (null): geçici bir arıza kimseyi panelden
  atmamalı; oturum zaten adresin sahibine ait.
*/

export const ILK_SIFRE_YOLU = "/reset-password?ilk=1";
/** İlk şifre gerekmediği bir kez görülen oturumda kapı tekrar sorgu yapmasın diye: değeri kullanıcı kimliği. */
export const SIFRE_VAR_CEREZI = "arvo_sifre_var";

/** Oturum şifreyle açıldıysa hesapta şifre vardır: veritabanına sormaya gerek yok. */
export function ilkSifreSorulmali(yontemler: readonly string[]): boolean {
  return !yontemler.includes("password");
}

/** gerekli: ilk_sifre_gerekli() sonucu; null = okunamadı (kapı kapanmaz). */
export function ilkSifreGerekli(gerekli: boolean | null): boolean {
  return gerekli === true;
}
