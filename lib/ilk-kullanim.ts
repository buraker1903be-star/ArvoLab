/*
  Ana sayfanın "ilk kez giren kullanıcı" kararı.

  Ekranın tamamı tezinin ortasındaki birine göre kurulmuştu: "Kaldığınız
  yerden devam edin", dört sayaç ve yaklaşan teslimler. Hiç çalışması olmayan
  birine bunların hepsi sıfır ve "yok" olarak çıkıyordu — parasını yeni ödemiş
  bir öğrencinin gördüğü ilk ekran dört sıfır ve dört "yok" cümlesiydi.

  Karar burada duruyor çünkü içindeki iki koşul da sessizce kaybolmaya açık:

  - OKUNAMAYAN liste yeni kullanıcı SAYILMAZ. Geçici bir arızada "hoş
    geldiniz, ilk çalışmanızı oluşturun" demek, çalışmaları duran birine
    hepsinin gittiğini söylemektir (lib/liste-sonucu.ts).
  - PERSONEL yeni kullanıcı sayılmaz. Onlar için sıfır sayaç gerçek bir
    bilgidir ("bekleyen iş yok"), eksik bir kurulum değil.
*/

export function ilkKullanim(durum: {
  calismaSayisi: number;
  /** Çalışma listesi okunamadı. */
  okunamadi: boolean;
  /** Kullanıcı personel rollerinden birinde. */
  personel: boolean;
}): boolean {
  if (durum.okunamadi || durum.personel) return false;
  return durum.calismaSayisi === 0;
}
