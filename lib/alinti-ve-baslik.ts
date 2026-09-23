/*
  Kılavuzların iki klasik maddesi:

  1) UZUN DOĞRUDAN ALINTI. APA 7 ve Türkçe kılavuzların çoğu 40 kelimeyi
     aşan doğrudan alıntının tırnak içinde değil, girintili BLOK ALINTI
     olarak yazılmasını ister. Öğrenciler uzun alıntıyı paragrafın içine
     tırnakla gömüyor; jüri bunu her seferinde yakalıyor, denetim hiç
     yakalamıyordu.

  2) BAŞLIK YERLEŞİMİ. Tablo başlığı tablonun ÜSTÜNDE, şekil başlığı
     şeklin ALTINDA olur. Word çıktısı bunu zaten varsayıyordu
     (lib/tiptap-docx.ts: tablo başlığında keepNext), ama metinde tersi
     yazılmışsa kimse söylemiyordu.

  Saf modül; testi tests/unit/alinti-ve-baslik.test.ts.
*/

interface Dugum {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  content?: Dugum[];
}

/** APA 7 ve Türkçe kılavuzların ortak eşiği. */
export const BLOK_ALINTI_ESIGI = 40;

export interface UzunAlinti {
  metin: string;
  kelime: number;
}

/* Türkçe metinlerde tırnak üç türlü yazılıyor; üçü de alıntıdır. */
const TIRNAK = /[“"«]([^”"»]{120,})[”"»]/gu;
const kelimeSay = (metin: string) => metin.split(/\s+/).filter((parca) => /[\p{L}\p{N}]/u.test(parca)).length;

const metniAl = (dugum: Dugum): string =>
  dugum.type === "text" ? dugum.text ?? "" : (dugum.content ?? []).map(metniAl).join("");

/**
 * Blok alıntı olması gerekirken paragrafın içine tırnakla gömülmüş uzun
 * alıntılar. Zaten blok alıntı içinde olan metin denetlenmez.
 */
export function uzunAlintilar(
  doc: { content?: Dugum[] } | null | undefined,
  esik: number = BLOK_ALINTI_ESIGI,
): UzunAlinti[] {
  const bulunanlar: UzunAlinti[] = [];
  const gez = (dugumler: Dugum[] | undefined, alintiIcinde: boolean) => {
    for (const dugum of dugumler ?? []) {
      if (dugum.type === "blockquote") {
        gez(dugum.content, true);
        continue;
      }
      // Şekil/tablo başlıkları ve kaynakça girdileri alıntı değildir.
      if (dugum.type === "paragraph" && dugum.attrs?.caption) continue;
      if (dugum.type === "paragraph" && !alintiIcinde) {
        const metin = metniAl(dugum);
        for (const eslesme of metin.matchAll(TIRNAK)) {
          const kelime = kelimeSay(eslesme[1]);
          if (kelime >= esik) bulunanlar.push({ metin: eslesme[1].slice(0, 60), kelime });
        }
        continue;
      }
      gez(dugum.content, alintiIcinde);
    }
  };
  gez(doc?.content, false);
  return bulunanlar;
}

export type BaslikTuru = "table" | "figure";

export interface BaslikYerlesimi {
  tur: BaslikTuru;
  baslik: string;
}

const gorsel = (dugum: Dugum | undefined): boolean => {
  if (!dugum) return false;
  if (dugum.type === "image") return true;
  return (dugum.content ?? []).some(gorsel);
};

const bosParagraf = (dugum: Dugum | undefined) =>
  dugum?.type === "paragraph" && !dugum.attrs?.caption && metniAl(dugum).trim() === "" && !gorsel(dugum);

/**
 * Yanlış tarafta duran şekil/tablo başlıkları.
 *
 * Yalnızca KESİN durum raporlanır: başlığın öbür tarafında aradığımız öge
 * var, doğru tarafında yok. Öge hiç eklenmemişse sessiz kalınır — onu
 * numaralandırma denetimi ayrıca söylüyor ve iki yerden birden uyarmak
 * aynı eksiği iki kez saydırırdı.
 */
export function baslikYerlesimSorunlari(doc: { content?: Dugum[] } | null | undefined): BaslikYerlesimi[] {
  const bloklar = doc?.content ?? [];
  const sorunlar: BaslikYerlesimi[] = [];

  const komsu = (indeks: number, yon: 1 | -1): Dugum | undefined => {
    let i = indeks + yon;
    while (bosParagraf(bloklar[i])) i += yon;
    return bloklar[i];
  };

  bloklar.forEach((blok, indeks) => {
    const tur = blok.attrs?.caption;
    if (blok.type !== "paragraph" || (tur !== "table" && tur !== "figure")) return;
    const baslik = metniAl(blok).trim().slice(0, 60);
    const onceki = komsu(indeks, -1);
    const sonraki = komsu(indeks, 1);

    if (tur === "table") {
      // Tablo başlığı tablonun üstünde olmalı.
      if (onceki?.type === "table" && sonraki?.type !== "table") sorunlar.push({ tur, baslik });
    } else if (gorsel(onceki) === false && gorsel(sonraki)) {
      // Şekil başlığı şeklin altında olmalı.
      sorunlar.push({ tur, baslik });
    }
  });

  return sorunlar;
}
