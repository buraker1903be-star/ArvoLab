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

import type { Dil } from "@/lib/dil";

export type KisaltmaSorunu = {
  kisaltma: string;
  tur: "once-kullanilmis" | "cok-tanimlanmis" | "kullanilmamis" | "acilmamis" | "listede-var-metinde-yok" | "listede-eksik";
  /** Metinde bulunup gösterilecek ifade */
  hedef: string;
  /** Toplu bulgularda (listede var/eksik) bütün kısaltmalar */
  liste?: string[];
};

/*
  03.11.2026 GENİŞLETMESİ (örnek tez):

  - Gövde PARÇALARLA verilir: düzyazı (paragraf, başlık) tanım yapabilir;
    tablo hücresi ve tablo/şekil başlığı yalnızca KULLANIMDIR. Tabloda
    "SC (BIC)" tanım sanılıyordu ("SC" açılım oldu), BIC hem "tanımdan
    önce kullanılmış" hem "bir daha kullanılmamış" uyarısı aldı.
  - Açılımda küçük harfli sözcükler de olur: "Akaike bilgi ölçütü (AIC)"
    eskiden tanım sayılmıyordu (son sözcük büyük harfle başlamalıydı).
    Parantezin hemen önündeki sözcük tamamen büyük harfse ("SC (BIC)")
    bu bir tanım değil, eş addır.
  - KISALTMALAR BÖLÜMÜ AYRI BİR SÖZLÜKTÜR (lib/kaynakca-bolumu.ts,
    belgeBolumleri): ne tanım ne kullanım sayılır. Eskiden gövdenin
    parçası olarak taranıyordu. Sözlük, "hiç tanımlanmamış kısaltmayı
    yakalayamayız" sınırını kaldırıyor: sözlükteki öğenin kısaltma
    olduğunu yazarın kendisi söylemiş. Gövdede kullanılıp gövdede hiç
    açılmayan sözlük öğesi "ilk kullanımda açılmamış" uyarısı alır (BIC,
    FPE, HQ yalnızca Tablo 9'da geçiyordu). Sözlük yoksa davranış
    eskisi gibi: tanımsız kısaltma sessizce geçer.
*/
export type Parca = { metin: string; tanimOlabilir: boolean };
/*
  Tanım kalıbı: parantez içinde 2–6 büyük harf ve hemen ÖNÜNDE en az bir
  sözcük ("Türkiye İstatistik Kurumu (TÜİK)", "Akaike bilgi ölçütü
  (AIC)"). Önündeki sözcük şartı "(2020)" ve "(bkz. Tablo 3)" gibi
  parantezleri ve atıfları eliyor; o sözcük tamamen büyük harfse ("SC
  (BIC)") tanım değil eş ad sayılır. Açılımdan en çok altı sözcük alınır
  (yalnızca mesajda gösterilir).
*/
const BUYUK = "A-ZÇĞİÖŞÜ";
// Sözcük arası boşluk satır sonunu AŞMAZ: parçalar "\n" ile birleşiyor, açılım bir önceki parçadan (tablo hücresinden) başlamasın.
const TANIM = new RegExp(`((?:[\\p{L}][\\p{L}'’–-]*[^\\S\\n]+){0,5}([\\p{L}][\\p{L}'’–-]*))[^\\S\\n]*\\(([${BUYUK}]{2,6})\\)`, "gu");
const tamamenBuyuk = (sozcuk: string) => !/\p{Ll}/u.test(sozcuk);
/*
  Eş ad: "SC (BIC)", "AIC ve SC (BIC)". Son sözcük büyük harfli VE ondan
  önceki sözcük de büyük harfli ya da bağlaçsa (ya da hiç yoksa) bu bir
  tanım değil. "Doğrusal olmayan ARDL (NARDL)" tanımdır: açılım bir
  kısaltma içerse de önü sıradan sözcük.
*/
const esAdMi = (acilim: string, sonSozcuk: string) => {
  if (!tamamenBuyuk(sonSozcuk)) return false;
  const sozcukler = acilim.trim().split(/\s+/u);
  const onceki = sozcukler.at(-2);
  return !onceki || tamamenBuyuk(onceki) || /^(?:ve|veya|ya da|ile|and|or|\/)$/iu.test(onceki);
};

/*
  Kısaltma başına bir tarama yapılıyor, tek seferde bütün büyük harfli
  öbekleri toplamak YERİNE. İkincisini yazıp ölçtüm: 466 KB gövde ve 40
  kısaltmada 6,7 ms yerine 12,9 ms sürdü — genel desen belgedeki BÜTÜN
  büyük harfli öbekleri (başlıklar dahil) yakaladığı için daha pahalı.
  Yaklaşık 76 kısaltmadan sonra tersine döner; o kadar kısaltmalı tez
  pratikte görülmüyor, görülürse burası yeniden ölçülmeli.
*/
const kullanimDeseni = (kisaltma: string) => new RegExp(`(?<![\\p{L}])${kisaltma}(?![\\p{L}])`, "gu");

/*
  Kısaltmalar bölümünün satırları → sözlük. Satır "BIC / SC | Bayesci…"
  (tablo), "AIC  Akaike Bilgi Ölçütü" ya da "AIC: …" olabilir; ilk
  sütundaki bütün büyük harfli öğeler alınır ("BIC / SC" → BIC, SC;
  "EKK (OLS)" → EKK, OLS). Başlık satırı ("Kısaltma | Açıklama") ve
  şablon yer tutucusu ("[Kısaltma]") atlanır.
*/
export function kisaltmaSozlugu(satirlar: string[]): Map<string, string> {
  const sozluk = new Map<string, string>();
  for (const satir of satirlar) {
    const temiz = satir.trim();
    if (!temiz || temiz.startsWith("[")) continue;
    const [ilk, ...geri] = temiz.split(/\s*\|\s*|\t+|\s{2,}|\s*:\s+|\s+[–—-]\s+/u);
    for (const oge of ilk.match(new RegExp(`(?<![\\p{L}])[${BUYUK}]{2,6}(?![\\p{L}])`, "gu")) ?? []) {
      if (!sozluk.has(oge)) sozluk.set(oge, geri.join(" ").trim());
    }
  }
  return sozluk;
}

export function kisaltmaSorunlari(
  girdi: string | Parca[],
  sozluk?: Map<string, string>,
  /** "Kısaltma | Tanım" satırlı bir gövde tablosunda açılmış olanlar (ör. değişken tablosu) */
  tablodaTanimli: ReadonlySet<string> = new Set(),
): KisaltmaSorunu[] {
  const parcalar: Parca[] = typeof girdi === "string" ? [{ metin: girdi, tanimOlabilir: true }] : girdi;
  // Parçalar tek metinde, konumlarıyla: "önce/sonra" kararı belge sırasına göre.
  let metin = "";
  const tanimBolgeleri: [number, number][] = [];
  for (const parca of parcalar) {
    const bas = metin.length;
    metin += `${parca.metin}\n`;
    if (parca.tanimOlabilir) tanimBolgeleri.push([bas, metin.length]);
  }
  const tanimYerinde = (yer: number) => tanimBolgeleri.some(([a, b]) => yer >= a && yer < b);

  const tanimlar = new Map<string, { ilk: number; sayi: number; acilim: string }>();
  for (const eslesme of metin.matchAll(TANIM)) {
    const [, acilim, sonSozcuk, kisaltma] = eslesme;
    const yer = eslesme.index ?? 0;
    // Tanımın yeri parantezin konumu: açılımın nerede başladığı değil.
    if (!tanimYerinde(yer + eslesme[0].lastIndexOf("(")) || esAdMi(acilim, sonSozcuk)) continue;
    const kayit = tanimlar.get(kisaltma);
    if (kayit) kayit.sayi += 1;
    else tanimlar.set(kisaltma, { ilk: yer, sayi: 1, acilim: acilim.trim() });
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

  if (sozluk?.size) {
    const metindeYok: string[] = [];
    const acilmamis: { kisaltma: string; yer: number }[] = [];
    for (const kisaltma of sozluk.keys()) {
      if (tanimlar.has(kisaltma) || tablodaTanimli.has(kisaltma)) continue;
      const ilk = kullanimDeseni(kisaltma).exec(metin);
      if (ilk) acilmamis.push({ kisaltma, yer: ilk.index });
      else metindeYok.push(kisaltma);
    }
    /* Tek satırda, metindeki sırayla: on altı ayrı uyarı listeyi doldurup
       başka denetimlerin bulgularını görünmez yapardı. Hedef ilk geçiş. */
    if (acilmamis.length) {
      const sirali = acilmamis.sort((a, b) => a.yer - b.yer).map((a) => a.kisaltma);
      sorunlar.push({ kisaltma: sirali[0], tur: "acilmamis", hedef: sirali[0], liste: sirali });
    }
    if (metindeYok.length) sorunlar.push({ kisaltma: metindeYok[0], tur: "listede-var-metinde-yok", hedef: metindeYok[0], liste: metindeYok });
    const listedeEksik = [...tanimlar.keys()].filter((kisaltma) => !sozluk.has(kisaltma));
    if (listedeEksik.length) sorunlar.push({ kisaltma: listedeEksik[0], tur: "listede-eksik", hedef: listedeEksik[0], liste: listedeEksik });
  }
  return sorunlar;
}

export const kisaltmaMesaji = (sorun: KisaltmaSorunu, dil: Dil = "tr"): string => {
  if (dil === "en") {
    switch (sorun.tur) {
      case "once-kullanilmis":
        return `The abbreviation “${sorun.kisaltma}” is used BEFORE the place where it is spelled out; spell out an abbreviation where it first appears.`;
      case "cok-tanimlanmis":
        return `“${sorun.kisaltma}” is spelled out more than once; define an abbreviation only where it first appears.`;
      case "kullanilmamis":
        return `“${sorun.kisaltma}” is defined but never used again; a single-use abbreviation is unnecessary.`;
      case "acilmamis":
        return `Abbreviations not spelled out where they first appear in the main text (only in the list of abbreviations): ${(sorun.liste ?? [sorun.kisaltma]).join(", ")}. At the first use write “Full name (ABBR)”.`;
      case "listede-var-metinde-yok":
        return `In the list of abbreviations but not used in the text: ${(sorun.liste ?? [sorun.kisaltma]).join(", ")}.`;
      case "listede-eksik":
        return `Defined in the text but missing from the list of abbreviations: ${(sorun.liste ?? [sorun.kisaltma]).join(", ")}.`;
    }
  }
  switch (sorun.tur) {
    case "once-kullanilmis":
      return `“${sorun.kisaltma}” kısaltması, açık yazıldığı yerden ÖNCE kullanılmış; kısaltma ilk geçtiği yerde açık yazılır.`;
    case "cok-tanimlanmis":
      return `“${sorun.kisaltma}” birden çok kez açık yazılmış; kısaltma yalnızca ilk geçtiği yerde tanımlanır.`;
    case "kullanilmamis":
      return `“${sorun.kisaltma}” tanımlanmış ama bir daha kullanılmamış; tek kullanımlık kısaltma gereksizdir.`;
    case "acilmamis":
      return `Ana metinde ilk geçtiği yerde açılmamış kısaltmalar (yalnızca Kısaltmalar listesinde var): ${(sorun.liste ?? [sorun.kisaltma]).join(", ")}. İlk kullanımda “Açık adı (KISALTMA)” biçiminde yazın.`;
    case "listede-var-metinde-yok":
      return `Kısaltmalar listesinde olup metinde geçmeyenler: ${(sorun.liste ?? [sorun.kisaltma]).join(", ")}.`;
    case "listede-eksik":
      return `Metinde tanımlanıp Kısaltmalar listesinde olmayanlar: ${(sorun.liste ?? [sorun.kisaltma]).join(", ")}.`;
  }
};
