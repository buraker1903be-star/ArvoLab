/*
  Kısaltma kuralları.

  Kılavuzların ortak maddesi: "Kısaltma ilk geçtiği yerde açık yazılır —
  Türkiye İstatistik Kurumu (TÜİK) — sonrasında yalnızca kısaltma
  kullanılır." Belge kontrolü buna hiç bakmıyordu.

  DENETİM YALNIZCA YAZARIN KENDİ TANIMLARINA DAYANIYOR. "Metindeki büyük
  harfli her öbek kısaltmadır" varsayımıyla arama yapmadık: bölüm
  başlıkları büyük harfle yazılıyor (kılavuzlar öyle istiyor), ölçü
  birimleri, roma rakamları ve dergi adları da büyük harfli. Böyle bir
  tarama, kusursuz bir tezde onlarca uyarı üretir ve kullanıcıya bütün
  uyarıları görmezden gelmeyi öğretir.

  Bunun yerine: yazar "… (TÜİK)" diye bir tanım yazdıysa TÜİK'in bir
  kısaltma olduğunu KESİN biliyoruz. Üç kural o kesinlik üzerine kuruluyor:

    1. Kısaltma tanımından ÖNCE kullanılmışsa, ilk geçtiği yerde açık
       yazılmamış demektir.
    2. Aynı kısaltma iki kez tanımlanmışsa fazlalık.
    3. Tanımlanmış ama bir daha kullanılmamışsa kısaltmaya gerek yoktu.

  Üçü de yanlış alarm üretmiyor çünkü üçü de yazarın kendi yazdığına
  bakıyor. Hiç tanımlanmamış kısaltmayı yakalayamıyoruz; onu güvenilir
  biçimde ayırt etmenin yolu yok ve yanlış suçlamaktansa susmak iyidir.

  Saf modül; testi tests/unit/kisaltmalar.test.ts.
*/

export type KisaltmaSorunu = {
  kisaltma: string;
  tur: "once-kullanilmis" | "cok-tanimlanmis" | "kullanilmamis";
  /** Metinde bulunup gösterilecek ifade */
  hedef: string;
};

/*
  Tanım kalıbı: parantez içinde 2–6 büyük harf ve hemen ÖNÜNDE en az bir
  büyük harfle başlayan sözcük ("Türkiye İstatistik Kurumu (TÜİK)").
  Önündeki sözcük şartı, "(2020)" ve "(bkz. Tablo 3)" gibi parantezleri
  ve atıfları eliyor.
*/
const BUYUK = "A-ZÇĞİÖŞÜ";
const TANIM = new RegExp(
  `((?:[${BUYUK}][\\p{L}]*[\\s-]+){1,6}[${BUYUK}][\\p{L}]*)\\s*\\(([${BUYUK}]{2,6})\\)`,
  "gu",
);

/*
  Kısaltma başına bir tarama yapılıyor, tek seferde bütün büyük harfli
  öbekleri toplamak YERİNE. İkincisini yazıp ölçtüm: 466 KB gövde ve 40
  kısaltmada 6,7 ms yerine 12,9 ms sürdü — genel desen belgedeki BÜTÜN
  büyük harfli öbekleri (başlıklar dahil) yakaladığı için daha pahalı.
  Yaklaşık 76 kısaltmadan sonra tersine döner; o kadar kısaltmalı tez
  pratikte görülmüyor, görülürse burası yeniden ölçülmeli.
*/
const kullanimDeseni = (kisaltma: string) => new RegExp(`(?<![\\p{L}])${kisaltma}(?![\\p{L}])`, "gu");

export function kisaltmaSorunlari(metin: string): KisaltmaSorunu[] {
  const tanimlar = new Map<string, { ilk: number; sayi: number; acilim: string }>();
  for (const eslesme of metin.matchAll(TANIM)) {
    const kisaltma = eslesme[2];
    const yer = eslesme.index ?? 0;
    const kayit = tanimlar.get(kisaltma);
    if (kayit) kayit.sayi += 1;
    else tanimlar.set(kisaltma, { ilk: yer, sayi: 1, acilim: eslesme[1].trim() });
  }

  const sorunlar: KisaltmaSorunu[] = [];
  for (const [kisaltma, kayit] of tanimlar) {
    const yerler = [...metin.matchAll(kullanimDeseni(kisaltma))].map((e) => e.index ?? 0);
    /*
      Tanımın içindeki parantez kullanımı da eşleşiyor; onu ayıklamak için
      tanımın bittiği yere kadar olanlara "önce" demiyoruz. Tanım
      parantezinin konumu, açılımın başlangıcından sonraki ilk geçiştir.
    */
    const tanimYeri = yerler.find((yer) => yer > kayit.ilk) ?? Infinity;
    const oncekiler = yerler.filter((yer) => yer < kayit.ilk);
    const sonrakiler = yerler.filter((yer) => yer > tanimYeri);

    if (oncekiler.length > 0) {
      sorunlar.push({ kisaltma, tur: "once-kullanilmis", hedef: kisaltma });
    }
    if (kayit.sayi > 1) {
      sorunlar.push({ kisaltma, tur: "cok-tanimlanmis", hedef: `${kayit.acilim} (${kisaltma})` });
    }
    if (sonrakiler.length === 0) {
      sorunlar.push({ kisaltma, tur: "kullanilmamis", hedef: `${kayit.acilim} (${kisaltma})` });
    }
  }
  return sorunlar;
}

export const kisaltmaMesaji = (sorun: KisaltmaSorunu): string => {
  switch (sorun.tur) {
    case "once-kullanilmis":
      return `“${sorun.kisaltma}” kısaltması, açık yazıldığı yerden ÖNCE kullanılmış; kısaltma ilk geçtiği yerde açık yazılır.`;
    case "cok-tanimlanmis":
      return `“${sorun.kisaltma}” birden çok kez açık yazılmış; kısaltma yalnızca ilk geçtiği yerde tanımlanır.`;
    case "kullanilmamis":
      return `“${sorun.kisaltma}” tanımlanmış ama bir daha kullanılmamış; tek kullanımlık kısaltma gereksizdir.`;
  }
};
