/*
  "Kayıt yok" ile "okuyamadım" birbirinden ayrılır.

  Panelin bütün liste okumaları şu kalıbı izliyordu:

      if (error) { console.error(error); return []; }

  Hata konsola gidiyor, kullanıcıya BOŞ LİSTE dönüyordu. Sonuç, geçici bir
  ağ ya da RLS arızasında kullanıcının "Henüz kayıtlı bir çalışma yok.
  Üniversitenizi seçerek başlayın." ekranını görmesiydi — yani tezini
  kaybettiğini sanmasıydı. Boş listeyle karşılaşan kullanıcıyı "hiç
  kaydınız yok" diye karşılamak, veri gerçekten yokken doğru; okuma
  başarısızken yanlış bilgi vermektir.

  Akış yine düşürülmez: sayfa açılır, liste boş gelir, ama kullanıcıya
  bunun bir ARIZA olduğu söylenir ve yeniden denemesi istenir.

  Saf tip; testi yok (tip ve iki küçük kurucu).
*/

export type ListeSonucu<T> = {
  satirlar: T[];
  /** Okuma başarısız oldu; liste boş ama bu "kayıt yok" demek değil. */
  okunamadi: boolean;
};

export const listeBasarili = <T>(satirlar: T[] | null): ListeSonucu<T> => ({
  satirlar: satirlar ?? [],
  okunamadi: false,
});

export const listeOkunamadi = <T>(): ListeSonucu<T> => ({ satirlar: [], okunamadi: true });
