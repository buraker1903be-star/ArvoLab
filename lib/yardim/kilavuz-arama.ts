/*
  KULLANIM KILAVUZUNDA ARAMA (Signature OS 4.4, 05.11.2026).

  Kılavuz on dört bölüm ve yedi soru; sayfa bilgisayarda 6.700, telefonda
  11.900 piksel uzunluğundaydı ve "şifremi nasıl değiştiririm" sorusunun
  cevabını bulmanın tek yolu kaydırmak ya da tarayıcının Ctrl+F'iydi
  (telefonda pratikte yok). Arama çeviriden SONRA, ekrandaki dilde yapılır.

  Eşleşme hoşgörülü: büyük/küçük harf ve Türkçe karakterler fark etmez
  (ı/i, ş/s, ğ/g, ü/u, ö/o, ç/c). Kullanıcı telefonda Türkçe klavyesi
  yokken "sifre" yazınca "Şifre"yi bulmalı. Birden çok sözcük yazılırsa
  HEPSİ geçmeli (VE); tek sözcük yazan geniş, çok yazan dar sonuç alır.

  Saf modül; testi tests/unit/kilavuz-arama.test.ts.
*/

export type AranabilirBolum = { id: string; metinler: string[] };

const HARF: Record<string, string> = { ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c", â: "a", î: "i", û: "u" };

/** Karşılaştırma biçimi: küçük harf, Türkçe karakterler ASCII karşılığına, fazla boşluk tek. */
export function aramaBicimi(metin: string): string {
  return metin
    .replace(/[ıİşŞğĞüÜöÖçÇâîû]/g, (h) => HARF[h] ?? h)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Sorgunun sözcükleri; iki harften kısa olanlar yok sayılır ("ve", "a" gibi gürültü değil ama tek harf). */
export function aramaSozcukleri(sorgu: string): string[] {
  return aramaBicimi(sorgu)
    .split(" ")
    .filter((s) => s.length >= 2);
}

/**
 * Eşleşen bölümlerin kimlikleri, verilen sırada. Sorgu boşsa (ya da yalnızca
 * tek harflerse) null: "arama yok", hepsi görünür. Boş dizi "sonuç yok" demek.
 */
export function kilavuzAra(bolumler: AranabilirBolum[], sorgu: string): string[] | null {
  const sozcukler = aramaSozcukleri(sorgu);
  if (!sozcukler.length) return null;
  return bolumler
    .filter((b) => {
      const govde = aramaBicimi(b.metinler.join(" "));
      return sozcukler.every((s) => govde.includes(s));
    })
    .map((b) => b.id);
}
