/*
  GÜVENİLİRLİK ANALİZİ İÇİN VERİ ŞABLONU (23.11.2026).

  Öğrenciler ölçek güvenilirliği için sık sık TEK bir toplam puan sütunu
  yüklüyor. α ve ω madde düzeyinde yanıt ister; toplam puanla hiçbir şey
  hesaplanamıyor ve kullanıcı hatayı ancak dosyayı yükledikten sonra
  görüyordu. Analiz Merkezi artık dosya seçilmeden önce doğru biçimi
  anlatıyor; örnek tablo ve boş şablon buradan geliyor.

  Başlıklar arayüz diline göre: indirilen şablonu açan kişi sütun adını
  kendi dilinde görsün. Şablonda YALNIZCA başlık satırı var — veri
  kurgusal satırlarla değil, kullanıcının kendi yanıtlarıyla dolacak.

  "Katılımcı" sütunu metin olduğu için sayısal sütunlar arasında
  görünmez; madde listesine de düşmez. İsteğe bağlı olmasının nedeni bu:
  varsa analiz dışında kalır, yoksa bir şey değişmez.

  Saf modül; testi tests/unit/analiz-veri-sablonu.test.ts.
*/
import type { Dil } from "@/lib/dil";

/** Şablonun ve örnek tablonun sütun başlıkları (ilki katılımcı sütunu). */
export function sablonBasliklari(dil: Dil): string[] {
  return dil === "en"
    ? ["Participant", "Item 1", "Item 2", "Item 3"]
    : ["Katılımcı", "Madde 1", "Madde 2", "Madde 3"];
}

/** Örnek tablonun satırları. Sayılar KURGUSAL; yalnızca biçimi gösterir. */
export function ornekSatirlar(dil: Dil): string[][] {
  const on = dil === "en" ? "P" : "K";
  return [
    [`${on}1`, "4", "5", "4"],
    [`${on}2`, "3", "3", "2"],
    [`${on}3`, "5", "4", "5"],
    [`${on}4`, "2", "1", "2"],
  ];
}

/** Boş şablon: yalnızca başlık satırı. */
export function bosSablonCsv(dil: Dil): string {
  return `${sablonBasliklari(dil).join(",")}\n`;
}

export function sablonDosyaAdi(dil: Dil): string {
  return dil === "en" ? "reliability-template.csv" : "guvenilirlik-sablonu.csv";
}
