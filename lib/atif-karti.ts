/*
  ATIF KARTI — K3-A (kurum sahibinin onayı 19.11.2026;
  tasarim/baglamli-calisma-alani/KARARLAR.md). Saf modül; testi
  tests/unit/atif-karti.test.ts.

  Belgeye KALICI işaret ya da düğüm eklenmez. Atıf belgede bugün olduğu gibi
  düz metindir; kullanıcı ona tıklayınca, o anda, tıklanan metin çalışmanın
  kaynaklarıyla eşleştirilir. Belge içeriği ve Word, PDF/yazdırma, LaTeX ve
  paylaşım çıktıları değişmez (tests/editor/cikti-yollari.test.ts aynen geçer).

  Eşleşme kuralı:
    - yazar-tarih: ilk yazarın soyadı ve yıl (aynı normalleştirme:
      lib/apa7.ts extractInTextCitations). Atıfta yıl varsa yıl da tutmalı.
    - numaralı: [n] belgedeki kaynakçanın n. girdisidir; o girdide başlığı
      geçen kaynaklar aday olur.
    - dipnotlu stil: atıf dipnotta; kart bu sürümde dipnot atıflarını
      çözmüyor (dipnota tıklamak dipnotu açar).
  Tek aday → kart o kaynakla açılır. Birden çok aday → kullanıcı seçer; ilk
  sonuç kesin kaynak sayılmaz. Aday yok → "eşleşmedi" denir, hiçbir pasaj
  işaretlenmez.
*/

import { extractInTextCitations } from "@/lib/apa7";

export type AtifStilTuru = "yazar-tarih" | "numara" | "dipnot";

export type AtifIsabeti =
  /*
    yazarlar: ilk yazar anahtarı ve olası okumaları. Anlatı atfında cümle
    başındaki sözcük yazar sanılabiliyor ("Ayrıca Ak ve Şahin (2018)" →
    "ayrıca ak"); son sözcük ve listedeki öteki adlar da aday olarak taşınır,
    birden çok kaynak tutarsa kullanıcı seçer.
  */
  | { tur: "yazar-tarih"; bas: number; bit: number; metin: string; yazarlar: string[]; yil: string | null }
  | { tur: "numara"; bas: number; bit: number; metin: string; numara: number };

const YIL_BOS = /^(t\.\s?y\.|n\.\s?d\.)$/i;

/** Paragraf metninde `ofset` konumundaki atıf (yoksa null). */
export function tiklananAtif(metin: string, ofset: number, stil: AtifStilTuru, cikarmaStili: "apa7" | "chicago" | "mla" = "apa7"): AtifIsabeti | null {
  if (stil === "dipnot") return null;
  if (stil === "numara") return numaraliAtif(metin, ofset);

  for (const atif of extractInTextCitations(metin, { style: cikarmaStili })) {
    const bas = atif.position;
    const bit = bas + atif.raw.length;
    if (ofset < bas || ofset > bit) continue;
    if (atif.kind === "narrative") {
      return { tur: "yazar-tarih", bas, bit, metin: atif.raw, yazarlar: yazarOkumalari(atif.authorKey, atif.digerAdaylar), yil: yilAyikla(atif.year) };
    }
    /* Parantez içi grup birden çok atıf taşıyabilir: "(Kaya, 2021; Demir, 2019)". Tıklanan parça seçilir. */
    const ic = atif.raw.slice(1, -1);
    let parcaBas = bas + 1;
    for (const parca of ic.split(";")) {
      const parcaBit = parcaBas + parca.length;
      if (ofset >= parcaBas - 1 && ofset <= parcaBit + 1) {
        const tek = extractInTextCitations(`(${parca.trim()})`, { style: cikarmaStili })[0];
        if (!tek) return null;
        const bosluk = parca.length - parca.trimStart().length;
        return { tur: "yazar-tarih", bas: parcaBas + bosluk, bit: parcaBit, metin: parca.trim(), yazarlar: yazarOkumalari(tek.authorKey, tek.digerAdaylar), yil: yilAyikla(tek.year) };
      }
      parcaBas = parcaBit + 1;
    }
  }
  return null;
}

function numaraliAtif(metin: string, ofset: number): AtifIsabeti | null {
  for (const grup of metin.matchAll(/\[(\d+(?:\s*[-–,]\s*\d+)*)\]/g)) {
    const bas = grup.index ?? 0;
    const bit = bas + grup[0].length;
    if (ofset < bas || ofset > bit) continue;
    /* Gruptaki sayılardan tıklanana en yakını: "[2, 5]" içinde 5'e tıklanınca 5. */
    let enYakin: { n: number; uzaklik: number; bas: number; bit: number } | null = null;
    for (const sayi of grup[1].matchAll(/\d+/g)) {
      const sBas = bas + 1 + (sayi.index ?? 0);
      const sBit = sBas + sayi[0].length;
      const uzaklik = ofset < sBas ? sBas - ofset : ofset > sBit ? ofset - sBit : 0;
      if (!enYakin || uzaklik < enYakin.uzaklik) enYakin = { n: Number(sayi[0]), uzaklik, bas: sBas, bit: sBit };
    }
    if (enYakin) return { tur: "numara", bas: enYakin.bas, bit: enYakin.bit, metin: grup[0], numara: enYakin.n };
  }
  return null;
}

function yazarOkumalari(anahtar: string, digerleri: string[] = []): string[] {
  const son = anahtar.split(/\s+/).pop() ?? anahtar;
  return [...new Set([anahtar, son, ...digerleri].filter(Boolean))];
}

function yilAyikla(yil: string | null | undefined): string | null {
  const y = (yil ?? "").trim();
  if (!y || YIL_BOS.test(y)) return null;
  const m = /\d{4}/.exec(y);
  return m ? m[0] : null;
}

export type KartKaynagi = { id: string; title: string; authors: string | null; year: string | null };

/** Kaynak kaydının ilk yazar anahtarı: atıfla AYNI normalleştirmeden geçer. */
export function kaynakYazarAnahtari(authors: string | null): string | null {
  const ilk = (authors ?? "").split(/;|\s&\s|\s(?:ve|and)\s/)[0]?.trim();
  if (!ilk) return null;
  // "Soyad, A." ya da "A. Soyad" biçimi.
  const soyad = ilk.includes(",") ? ilk.split(",")[0].trim() : (ilk.split(/\s+/).filter((p) => !/^[A-ZÇĞİÖŞÜ]\.?$/.test(p)).pop() ?? ilk);
  return extractInTextCitations(`(${soyad}, 2000)`)[0]?.authorKey ?? null;
}

const sade = (metin: string) =>
  metin
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Tıklanan atıfın aday kaynakları (kimlikler). Sıra kaynak listesinin sırası;
 * birden çoksa kullanıcı seçer — ilk aday kesin sayılmaz.
 */
export function atifAdaylari(isabet: AtifIsabeti, kaynaklar: KartKaynagi[], kaynakcaGirdileri: string[] = []): string[] {
  if (isabet.tur === "numara") {
    const girdi = kaynakcaGirdileri[isabet.numara - 1];
    if (!girdi) return [];
    const g = sade(girdi);
    return kaynaklar.filter((k) => {
      const baslik = sade(k.title);
      return baslik.length >= 12 && g.includes(baslik);
    }).map((k) => k.id);
  }
  return kaynaklar
    .filter((k) => {
      const anahtar = kaynakYazarAnahtari(k.authors);
      if (!anahtar || !isabet.yazarlar.includes(anahtar)) return false;
      const kYil = yilAyikla(k.year);
      return isabet.yil === null ? kYil === null : kYil === isabet.yil;
    })
    .map((k) => k.id);
}

/*
  KARTIN YERİ (2. tur tasarımı, madde 2): okunan cümleyi örtmez. Kâğıdın
  sağında yer varsa kart orada, satırın hizasında; yoksa (sağ panel açık,
  dar ekran) satırın ALTINDA. Ekranın dışına taşmaz.
*/
export type Dikdortgen = { left: number; right: number; top: number; bottom: number };
/*
  metinSagi (görsel uyum, 19.11.2026): verilirse sınır kâğıdın dış kenarı
  değil METİN SÜTUNUNUN sağ kenarıdır. Seçim kartı 1440 px'te kâğıdın
  dışındaki 138 px'e sığmıyor, hep seçimin altına düşüp alt satırı
  örtüyordu; kâğıdın iç boşluğu (32 px) metin değil, orada durmak okunanı
  örtmez. Atıf kartı (300 px) kâğıdın dışını kullanmaya devam eder.
*/
export function kartKonumu(girdi: { kagit: Dikdortgen; satir: Dikdortgen; ekranGenisligi: number; ekranYuksekligi: number; genislik: number; yukseklik?: number; metinSagi?: number; bosluk?: number }): { yan: "sag" | "alt"; x: number; y: number } {
  const { kagit, satir, ekranGenisligi, ekranYuksekligi, genislik } = girdi;
  const yukseklik = girdi.yukseklik ?? 220;
  const bosluk = girdi.bosluk ?? 12;
  const sinir = girdi.metinSagi ?? kagit.right;
  if (ekranGenisligi - sinir >= genislik + bosluk * 2) {
    const y = Math.max(8, Math.min(satir.top - 8, ekranYuksekligi - yukseklik - 8));
    return { yan: "sag", x: Math.round(sinir + bosluk), y: Math.round(y) };
  }
  const x = Math.max(8, Math.min(satir.left, ekranGenisligi - genislik - 8));
  /* Satırın altında yer yoksa üstüne: kart ekranın dışına taşıp kaydırma gerektirmesin (satır yine örtülmez). */
  const altta = satir.bottom + 8;
  const y = altta + yukseklik <= ekranYuksekligi - 8 ? altta : Math.max(8, satir.top - yukseklik - 8);
  return { yan: "alt", x: Math.round(x), y: Math.round(y) };
}
