/*
  KÂĞIT BOYUTU (29.10.2026). Saf modül; testi tests/unit/kagit-boyutu.test.ts.

  Bütün çıktılar A4'e sabitti: yazdırma (`@page { size: A4 }`), Word
  (11906 × 16838 twip), sayfa tahmini (21 × 29,7 cm). ABD ve Kanada'da
  tezler US Letter (8,5 × 11 inç = 21,59 × 27,94 cm) basılıyor; A4'te
  dizilmiş bir tez orada hem yanlış kâğıtta çıkıyor hem sayfa tahmini
  (dolayısıyla sayfa sınırı denetimi) kayıyordu — Letter A4'ten kısa,
  aynı metin daha çok sayfa tutar.

  Ölçüler tek yerde: üç çıktı yolu (editör, yazdırma/PDF, Word) ve sayfa
  tahmini buradan okur; ikinci bir "21" yazılmaz.
*/

import type { Metin } from "@/lib/dil";

export const KAGIT_BOYUTLARI = ["a4", "letter"] as const;
export type KagitBoyutu = (typeof KAGIT_BOYUTLARI)[number];

export interface KagitOlcusu {
  ad: Metin;
  genislikCm: number;
  yukseklikCm: number;
  /** Word (OOXML) ölçüsü, twip (1/1440 inç). */
  genislikTwip: number;
  yukseklikTwip: number;
  /** CSS `@page { size }` değeri. */
  css: string;
}

export const KAGITLAR: Record<KagitBoyutu, KagitOlcusu> = {
  a4: { ad: { tr: "A4", en: "A4" }, genislikCm: 21, yukseklikCm: 29.7, genislikTwip: 11906, yukseklikTwip: 16838, css: "A4" },
  letter: {
    ad: { tr: "US Letter (8,5 × 11 inç)", en: "US Letter (8.5 × 11 in)" },
    genislikCm: 21.59,
    yukseklikCm: 27.94,
    genislikTwip: 12240,
    yukseklikTwip: 15840,
    css: "letter",
  },
};

export const VARSAYILAN_KAGIT: KagitBoyutu = "a4";

export const kagitMi = (deger: unknown): deger is KagitBoyutu =>
  typeof deger === "string" && (KAGIT_BOYUTLARI as readonly string[]).includes(deger);

/** Bilinmeyen ya da boş değer A4: mevcut bütün belgeler A4'te dizildi. */
export const kagitOku = (deger: unknown): KagitBoyutu => (kagitMi(deger) ? deger : VARSAYILAN_KAGIT);

export const kagitOlcusu = (deger: unknown): KagitOlcusu => KAGITLAR[kagitOku(deger)];

/**
 * Kılavuz metninden kâğıt boyutu; ikisi birden ya da hiçbiri geçiyorsa null.
 * Türkçe kılavuzların çoğu "A4" yazıyor; ABD kılavuzları "8.5 x 11",
 * "letter-size", "US Letter". Tahmin yapılmaz: söylenmeyen boyut
 * öğrencinin belgesine yazılmaz.
 */
export function kilavuzdanKagit(metin: string): KagitBoyutu | null {
  const letter = /8[.,]5\s*(?:"|”|-?\s*in(?:ch(?:es)?)?\.?)?\s*(?:x|×|by)\s*11\b|\bletter[- ]size\b|\bus\s+letter\b|\bletter\s+(?:paper|format)\b/i.test(metin);
  const a4 = /(?<![\p{L}\d])A4(?![\p{L}\d])/u.test(metin);
  if (letter === a4) return null;
  return letter ? "letter" : "a4";
}
