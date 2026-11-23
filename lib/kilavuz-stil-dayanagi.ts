/*
  KILAVUZDAN ÇIKAN STİLİN DAYANAĞI (23.11.2026).

  Çıkarım stilin ADINI söylüyordu ("APA 7"), nereden okuduğunu değil.
  Öğrenci "bu doğru mu?" sorusunu cevaplayabilmek için kılavuzu açıp
  aramak zorundaydı; çoğu açmıyor ve yanlış bir çıkarım sessizce
  çalışmasına yerleşiyordu — yanlış sistem, hiç sistem olmamasından
  kötüdür (lib/atif-sistemi.ts'teki not).

  Burada üretilen şey bir HÜKÜM DEĞİL, gösterilecek kanıt: stilin adının
  geçtiği cümle, üstündeki bölüm başlığı ve (metinde sayfa ayracı varsa)
  sayfa numarası. Kanıt bulunamazsa null döner ve ekran "kılavuzda
  cümlesini bulamadım" der — uydurma bir alıntı, alıntısızlıktan kötü.

  Saf modül; testi tests/unit/kilavuz-stil-dayanagi.test.ts.
*/

import type { AtifSistemi } from "@/lib/atif-sistemi";

export type StilDayanagi = {
  /** Stilin adının geçtiği cümle, kılavuzdan birebir. */
  alinti: string;
  /** Alıntının üstündeki en yakın başlık; bulunamazsa null. */
  bolum: string | null;
  /** Sayfa ayracı taşıyan metinlerde sayfa numarası; yoksa null (tahmin edilmez). */
  sayfa: number | null;
};

/** Stilin metinde aranan adı; lib/atif-sistemi.ts'teki desenlerle aynı ölçüt. */
const AD: Record<AtifSistemi, RegExp> = {
  apa7: /\bapa\b/i,
  vancouver: /\bvancouver\b/i,
  harvard: /\bharvard\b(?!\s+(?:university|business|medical|law|college))/i,
  chicago: /\bchicago\b/i,
  ieee: /\bieee\b/i,
  mla: /\bmla\b/i,
  /* "Dipnot" bir ad değil yöntem; kuralı anlatan cümle aranıyor. */
  dipnot: /\bdipnot\b/i,
};

/*
  Kuralı SÖYLEYEN cümle, adın geçtiği herhangi bir cümleden değerlidir:
  kılavuzların çoğunda "APA, Chicago, MLA gibi sistemler" diye bir
  sayım cümlesi de bulunur ve onu dayanak diye göstermek öğrenciyi
  yanıltır. Buyurgan yüklemi olan cümle öne alınıyor.
*/
const BUYURGAN = /\b(kullanıl|esas al|uyul|göre yaz|zorunlu|yapılır|hazırlan|must|shall|should|required|accordance|follow)/i;
/* Başlık adayı: kısa, noktayla bitmeyen, sonunda iki nokta olabilen satır. */
const BASLIK = /^\s*(?:\d+(?:\.\d+)*\.?\s+)?([\p{L}][\p{L}\p{N}\s,'’()\/-]{2,70})\s*:?\s*$/u;

const temizle = (metin: string) => metin.replace(/\s+/g, " ").trim();

/** Metni cümlelere böler; satır sonu da cümle sonu sayılır (kılavuzlar listelerle yazılır). */
const cumleler = (metin: string): { metin: string; indeks: number }[] => {
  const parcalar: { metin: string; indeks: number }[] = [];
  const desen = /[^.!?\n]+[.!?]?/g;
  let eslesme: RegExpExecArray | null;
  while ((eslesme = desen.exec(metin))) {
    const ham = eslesme[0];
    if (ham.trim().length >= 10) parcalar.push({ metin: ham, indeks: eslesme.index });
  }
  return parcalar;
};

/** Alıntının üstündeki en yakın başlık satırı. */
const ustBaslik = (metin: string, indeks: number): string | null => {
  const satirlar = metin.slice(0, indeks).split("\n");
  /* En fazla 40 satır geriye bakılıyor: daha uzağı "ilgili bölüm" sayılmaz. */
  for (const satir of satirlar.slice(-40).reverse()) {
    const temiz = satir.trim();
    if (!temiz) continue;
    const eslesme = BASLIK.exec(temiz);
    if (eslesme) return temizle(eslesme[1]);
  }
  return null;
};

/** Sayfa ayracı (\f) taşıyan metinlerde alıntının sayfası; yoksa null. */
const sayfaNo = (metin: string, indeks: number): number | null => {
  if (!metin.includes("\f")) return null;
  return metin.slice(0, indeks).split("\f").length;
};

export function stilDayanagi(metin: string, stil: AtifSistemi | null | undefined): StilDayanagi | null {
  if (!stil || !metin.trim()) return null;
  const desen = AD[stil];
  if (!desen) return null;
  const adaylar = cumleler(metin).filter((c) => desen.test(c.metin));
  if (!adaylar.length) return null;
  /* Buyurgan cümle varsa o; yoksa ilk geçiş. */
  const secilen = adaylar.find((c) => BUYURGAN.test(c.metin)) ?? adaylar[0];
  const alinti = temizle(secilen.metin).slice(0, 300);
  if (alinti.length < 10) return null;
  return { alinti, bolum: ustBaslik(metin, secilen.indeks), sayfa: sayfaNo(metin, secilen.indeks) };
}

/*
  ÇELİŞKİ: metinde iki sistem birden geçiyor ve biri ötekini açık ara
  geçmiyorsa seçim öğrencinindir (atifSistemiSec zaten null dönüyor).
  Burada ekrana verilecek olan şey ADAYLAR ve her birinin dayanağı:
  öğrenciye "hangisi?" diye sorarken iki cümleyi birden göstermek,
  soruyu cevaplanabilir kılan tek şey.
*/
export function celiskiliAdaylar(
  metin: string,
  gecisler: { sistem: string; etiket: string; sayim: number }[],
): { sistem: string; etiket: string; sayim: number; dayanak: StilDayanagi | null }[] {
  return gecisler
    .slice(0, 3)
    .map((g) => ({ ...g, dayanak: stilDayanagi(metin, g.sistem as AtifSistemi) }));
}
