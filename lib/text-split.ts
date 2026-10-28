/**
 * Kaynakça/References başlığını arayarak metni gövde ve kaynakça
 * olarak ikiye böler. Bu dosyanın KASITLI OLARAK hiçbir ağır
 * bağımlılığı (mammoth, pdf-parse vb.) yoktur — çünkü Panelde
 * Yazma (manuscript) akışı gibi dosya çıkarımına ihtiyaç duymayan
 * yerlerde de kullanılır. Ağır kütüphaneleri buraya eklemeyin;
 * onlar yalnızca lib/document-extract.ts içinde olmalı.
 */
/*
  İngilizce başlıklar: REFERENCES ve BIBLIOGRAPHY baştan beri vardı;
  MLA'nın "Works Cited" ve "Reference List" yazımı 28.10.2026'da eklendi
  — İngilizce çalışmada bunlar bulunmazsa kaynakça gövdeye karışır ve
  her künye "metinde atıf" sanılırdı.
*/
const REFERENCE_HEADING_RE =
  /\n\s*(KAYNAKÇA|KAYNAKLAR|REFERENCES|REFERENCE LIST|WORKS CITED|BIBLIOGRAPHY|BİBLİYOGRAFYA)\s*\n/i;

export function splitBodyAndReferences(fullText: string): {
  bodyText: string;
  referenceText: string;
} {
  const match = fullText.match(REFERENCE_HEADING_RE);
  if (!match || match.index === undefined) {
    return { bodyText: fullText, referenceText: "" };
  }

  const splitAt = match.index + match[0].length;
  return {
    bodyText: fullText.slice(0, match.index),
    referenceText: fullText.slice(splitAt),
  };
}
