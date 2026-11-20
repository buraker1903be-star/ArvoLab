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

  20.11.2026'ya kadar personel de hiçbir koşulda yeni kullanıcı
  sayılmıyordu: onun ana sayfası kurumun sayaçlarıydı ve sıfır sayaç
  gerçek bir bilgiydi. Artık herkesin ana sayfası kendi çalışmaları;
  hiç çalışması olmayan personel de "ilk çalışmanızı oluşturun" görür.
*/

export function ilkKullanim(durum: {
  calismaSayisi: number;
  /** Çalışma listesi okunamadı. */
  okunamadi: boolean;
}): boolean {
  if (durum.okunamadi) return false;
  return durum.calismaSayisi === 0;
}
