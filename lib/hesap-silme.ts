/*
  Hesap silme: bekleme süresi ve onay.

  Silinen şey bir TEZ. Öfkeyle ya da yanlışlıkla basılan bir düğme yılların
  işini yok etmemeli, hesabı ele geçirilen kullanıcı da korunmalı. Bu yüzden
  silme iki aşamalı: erişim HEMEN kapanır, veri BEKLEME_GUNU kadar durur ve
  bu süre içinde giriş yapmak her şeyi geri getirir.

  Saf modül; testi tests/unit/hesap-silme.test.ts.
*/

/** Verinin kalıcı olarak silinmesine kadar geçen süre. */
export const BEKLEME_GUNU = 30;

const GUN = 24 * 60 * 60 * 1000;

/** Talep bu anda verildiyse veri ne zaman kalıcı silinir? */
export const silinmeTarihi = (talep: string | Date): Date =>
  new Date(new Date(talep).getTime() + BEKLEME_GUNU * GUN);

/**
 * Kalıcı silmeye kaç gün kaldı. Yukarı yuvarlanır: "0 gün kaldı" demek,
 * daha vakti varken bugün silineceğini düşündürürdü. Süre dolduysa 0.
 */
export function kalanGun(talep: string | Date, simdi: Date = new Date()): number {
  const fark = silinmeTarihi(talep).getTime() - simdi.getTime();
  return fark <= 0 ? 0 : Math.ceil(fark / GUN);
}

/** Bekleme süresi doldu mu (cron bu satırı kalıcı silecek mi)? */
export const suresiDoldu = (talep: string | Date, simdi: Date = new Date()): boolean =>
  silinmeTarihi(talep).getTime() <= simdi.getTime();

/*
  Onay için kullanıcının KENDİ e-postasını yazması isteniyor.

  "Evet" demek ya da bir kutu işaretlemek bu ağırlıkta bir işlem için yeterli
  değil; e-postayı yazmak hem niyeti hem de doğru hesapta olunduğunu
  gösteriyor. Karşılaştırma büyük/küçük harf duyarsız ve baştaki/sondaki
  boşluk atılıyor — ama TÜRKÇE KÜÇÜLTME KULLANILMIYOR: "ISIK@..." adresi
  tr-TR kurallarıyla "ısık@..." olur ve kullanıcı kendi adresini yazdığı
  hâlde eşleşmezdi (lib/kayit.ts'te aynı tuzak).
*/
export function onayGecerli(yazilan: unknown, eposta: string | null | undefined): boolean {
  if (typeof yazilan !== "string" || !eposta) return false;
  return yazilan.trim().toLowerCase() === eposta.trim().toLowerCase();
}
