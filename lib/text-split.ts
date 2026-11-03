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
/*
  03.11.2026: bölme kuralı lib/kaynakca-bolumu.ts'e taşındı (metniBol).
  Eskiden "Kaynakça" sözcüğünün İLK geçtiği satırdan belge sonuna kadar
  her şey kaynakça sayılıyordu: İçindekiler'deki satır tezin tamamını,
  ekler de CSV ve kod satırlarını "künye" yapıyordu.
*/
import { metniBol } from "./kaynakca-bolumu";

export function splitBodyAndReferences(fullText: string): {
  bodyText: string;
  referenceText: string;
} {
  return metniBol(fullText);
}
