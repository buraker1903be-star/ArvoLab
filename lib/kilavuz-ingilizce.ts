/*
  İNGİLİZCE KILAVUZLARIN KURALLARI (29.10.2026). Saf modül; testi
  tests/unit/kilavuz-ingilizce.test.ts. Kullanan: lib/guideline-scan.ts.

  Kural çıkarımı baştan sona Türkçe kalıplarla yazılmıştı: kenar boşluğu
  "üst/alt/sol/sağ … cm", yazı boyutu "punto", satır aralığı "satır
  aralığı", bölümler "Giriş, Yöntem, Bulgular". ArvoLab dünya geneline
  açıldı (28.10.2026) ve yurt dışındaki öğrencinin yolu kendi kılavuzunu
  yüklemek; "Margins: 1 inch on all sides, double-spaced, 12-point Times
  New Roman" yazan bir kılavuzdan yalnızca yazı tipi çıkıyordu. Öğrenci
  boş bir onay formuyla karşılaşıyor, kuralları elle giriyordu.

  İlkeler Türkçe çıkarımla aynı:
  - Ölçü GÖVDEDEN söz eden cümleden alınır (lib/kilavuz-olcusu.ts);
    "Chapter titles 14 pt, body text 12 pt" gövdeye 12 verir.
  - Bulunamayan kural yazılmaz; yanlış kural öğrencinin belgesine iner,
    eksik kural yalnızca onay formunda sorulur.
  - Kenar boşluğu makul aralıkta olmalı (0,5–8 cm), aksi elenir.

  Bu modül yalnızca İNGİLİZCE belgede çalıştırılır (ingilizceBelgeMi):
  Türkçe bir kılavuzdaki tek bir İngilizce örnek cümle kural üretmesin.
*/

import { govdeOlcusu } from "@/lib/kilavuz-olcusu";

/** Belge İngilizce mi? Sık geçen işlev sözcüklerinin sayımıyla. */
export function ingilizceBelgeMi(metin: string): boolean {
  const kucuk = ` ${metin.toLowerCase().replace(/\s+/g, " ")} `;
  const say = (sozcukler: string[]) => sozcukler.reduce((t, s) => t + (kucuk.split(` ${s} `).length - 1), 0);
  const en = say(["the", "and", "of", "should", "must", "be", "is", "with"]);
  const tr = say(["ve", "bir", "ile", "için", "olarak", "veya", "bu", "olmalıdır"]);
  return en >= 30 && en > tr * 3;
}

/*
  İngilizce bölüm adları. Aynı bölümün iki yazımı tek bölüm sayılır
  ("Acknowledgements"/"Acknowledgments"); yoksa zorunlu bölüm listesi
  aynı şeyi iki kez isterdi.
*/
export const INGILIZCE_BOLUMLER: { ad: string; desen: string }[] = [
  { ad: "Abstract", desen: "Abstract" },
  { ad: "Acknowledgments", desen: "Acknowledge?ments" },
  { ad: "Table of Contents", desen: "Table\\s+of\\s+Contents" },
  { ad: "List of Tables", desen: "List\\s+of\\s+Tables" },
  { ad: "List of Figures", desen: "List\\s+of\\s+Figures" },
  { ad: "Introduction", desen: "Introduction" },
  { ad: "Literature Review", desen: "(?:Review\\s+of\\s+(?:the\\s+)?Literature|Literature\\s+Review)" },
  { ad: "Methodology", desen: "(?:Methodology|Methods|Materials\\s+and\\s+Methods)" },
  { ad: "Results", desen: "Results" },
  { ad: "Discussion", desen: "Discussion" },
  { ad: "Conclusion", desen: "Conclusions?" },
  { ad: "References", desen: "(?:References|Bibliography|Works\\s+Cited)" },
  { ad: "Appendices", desen: "Appendi(?:ces|x)" },
];

/* Ölçü: "1", "1.5", "1 1/2", "1/2", "one", "one and a half", "half". */
const SAYI = "(\\d{1,2}(?:\\.\\d+)?(?:\\s+1/2)?|\\d/\\d|one[- ]and[- ](?:a|one)[- ]half|one[- ]half|one|two|half)";
const BIRIM = "(?:\\s*-?\\s*)(inch(?:es)?\\b|in\\.|in\\b|\"|”|cm\\b|centimet(?:er|re)s?\\b)";

function sayiOku(ham: string): number | undefined {
  const s = ham.toLowerCase().trim();
  if (/^one[- ]and[- ](?:a|one)[- ]half$/.test(s)) return 1.5;
  if (s === "one-half" || s === "one half" || s === "half") return 0.5;
  if (s === "one") return 1;
  if (s === "two") return 2;
  const kesirli = /^(\d{1,2})\s+1\/2$/.exec(s);
  if (kesirli) return Number(kesirli[1]) + 0.5;
  const kesir = /^(\d)\/(\d)$/.exec(s);
  if (kesir) return Number(kesir[2]) ? Number(kesir[1]) / Number(kesir[2]) : undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Ölçüyü santimetreye çevirir (inç × 2,54), iki ondalığa yuvarlar. */
export function cmOlarak(sayi: string, birim: string): number | undefined {
  const deger = sayiOku(sayi);
  if (deger === undefined) return undefined;
  const cm = /^c/i.test(birim) ? deger : deger * 2.54;
  return Math.round(cm * 100) / 100;
}

const EN_AZ_BOSLUK = 0.5;
const EN_COK_BOSLUK = 8;
const makulBosluk = (cm: number | undefined) => (cm !== undefined && cm >= EN_AZ_BOSLUK && cm <= EN_COK_BOSLUK ? cm : undefined);

type Kenar = "top" | "bottom" | "left" | "right";

/**
 * Kenar boşlukları. Önce "bütün kenarlar" ölçüsü ("1-inch margins on all
 * sides", "Margins: 1 inch"), sonra kenara özel ölçüler onu ezer ("left
 * margin 1.5 inches" — ciltleme payı). Kenar sözcüğü geçen ama cümlesinde
 * "margin" olmayan ölçü alınmaz: "page numbers at the top, 0.5 inch from
 * the edge" bir kenar boşluğu değil.
 */
export function ingilizceKenarBosluklari(compact: string): { bosluklar: Partial<Record<Kenar, number>>; elenen: string[] } {
  const bosluklar: Partial<Record<Kenar, number>> = {};
  const elenen: string[] = [];
  const kaydet = (kenarlar: Kenar[], sayi: string, birim: string) => {
    const cm = cmOlarak(sayi, birim);
    if (cm === undefined) return;
    if (makulBosluk(cm) === undefined) {
      elenen.push(`${kenarlar.join("/")}: ${cm} cm`);
      return;
    }
    for (const k of kenarlar) bosluklar[k] = cm;
  };

  const genel = [
    new RegExp(`margins?\\b[^.;]{0,40}?${SAYI}${BIRIM}`, "giu"),
    new RegExp(`${SAYI}${BIRIM}\\s+margins?\\b`, "giu"),
  ];
  for (const desen of genel) {
    for (const m of compact.matchAll(desen)) {
      // Kenar adı geçiyorsa bu genel ölçü değil; aşağıda kenara özel okunur.
      if (/\b(?:top|bottom|left|right|binding|inside|outside)\b/i.test(m[0])) continue;
      if (/page\s+numb/i.test(m[0])) continue;
      if (bosluklar.top === undefined) kaydet(["top", "bottom", "left", "right"], m[1], m[2]);
    }
  }

  const kenarAdi = (ad: string): Kenar[] => {
    const k = ad.toLowerCase();
    if (k === "binding" || k === "inside") return ["left"];
    if (k === "outside") return ["right"];
    return [k as Kenar];
  };
  const ozel = [
    new RegExp(`\\b(top|bottom|left|right|binding|inside|outside)(?:\\s+(?:and\\s+(top|bottom|left|right)\\s+)?margins?)?\\b[^.;]{0,25}?${SAYI}${BIRIM}`, "giu"),
    new RegExp(`${SAYI}${BIRIM}[^.;]{0,20}?(?:on|at|for)\\s+the\\s+(top|bottom|left|right)\\b`, "giu"),
  ];
  for (const [i, desen] of ozel.entries()) {
    for (const m of compact.matchAll(desen)) {
      const cumle = compact.slice(Math.max(0, (m.index ?? 0) - 80), (m.index ?? 0) + m[0].length);
      if (!/margin/i.test(cumle) || /page\s+numb/i.test(m[0])) continue;
      if (i === 0) kaydet([...kenarAdi(m[1]), ...(m[2] ? kenarAdi(m[2]) : [])], m[3], m[4]);
      else kaydet(kenarAdi(m[3]), m[1], m[2]);
    }
  }
  return { bosluklar, elenen };
}

/*
  Satır aralığı sözle yazılıyor ("double-spaced", "single spacing",
  "one-and-a-half spacing"). Gövde ölçüsü yardımcısı sayı okuduğu için
  sözler önce sayıya çevriliyor; metnin geri kalanı değişmiyor.
*/
function araligiSayiyaCevir(compact: string): string {
  return compact
    .replace(/\b(?:one[- ]and[- ](?:a|one)[- ]half)(?=[- ]?(?:line[- ])?spac)/giu, "1.5")
    .replace(/\bdouble(?=[- ]?(?:line[- ])?spac)/giu, "2")
    .replace(/\bsingle(?=[- ]?(?:line[- ])?spac)/giu, "1");
}

const ARALIK = /(\d(?:\.\d+)?)[- ]?(?:line[- ])?spac(?:ed|ing)\b|line\s+spacing[^.;]{0,25}?(\d(?:\.\d+)?)(?!\s*(?:pt|point|inch|in\b|cm))/iu;
const PUNTO = /(\d{1,2}(?:\.\d+)?)\s*-?\s*(?:pt|points?)\b(?!\s+(?:from|above|below))/iu;

const PARAGRAF = "(?:paragraph\\w*|first[- ]line|each\\s+new\\s+paragraph)";
const GIRINTI_OLCU = [
  new RegExp(`${PARAGRAF}[^.;]{0,60}?indent\\w*[^.;]{0,25}?${SAYI}${BIRIM}`, "iu"),
  new RegExp(`indent\\w*[^.;]{0,40}?${PARAGRAF}[^.;]{0,30}?${SAYI}${BIRIM}`, "iu"),
  new RegExp(`${PARAGRAF}[^.;]{0,60}?${SAYI}${BIRIM}[^.;]{0,25}?indent`, "iu"),
];
/* İki sıra da yaygın: "paragraphs should be indented", "Indent the first line of each paragraph". */
const GIRINTI_VAR = new RegExp(`${PARAGRAF}[^.;]{0,60}?indent|\\bindent\\w*[^.;]{0,40}?${PARAGRAF}`, "iu");
const GIRINTI_YOK = /(?:not|never|no)\s+(?:be\s+)?indent|block\s+(?:style|format)\s+paragraphs/iu;

const ASILI = /hanging\s+indent\w*/iu;
const ASILI_OLCU = [
  new RegExp(`hanging\\s+indent\\w*[^.;]{0,25}?${SAYI}${BIRIM}`, "iu"),
  new RegExp(`${SAYI}${BIRIM}[^.;]{0,15}?hanging\\s+indent`, "iu"),
];

const ilkOlcu = (compact: string, desenler: RegExp[]) => {
  for (const desen of desenler) {
    const m = desen.exec(compact);
    if (m) return cmOlarak(m[1], m[2]);
  }
  return undefined;
};

/* Özet ve anahtar kelime sınırları. */
const OZET = "\\babstract\\b";
const OZET_ARALIK = new RegExp(`${OZET}[^.;]{0,80}?(?:between\\s+)?(\\d{2,4})\\s*(?:-|–|to|and)\\s*(\\d{2,4})\\s*words`, "iu");
const OZET_EN_COK = new RegExp(
  `${OZET}[^.;]{0,80}?(?:(?:not\\s+(?:to\\s+)?exceed|no\\s+(?:more|longer)\\s+than|(?:a\\s+)?maximum\\s+of|limited\\s+to|up\\s+to|at\\s+most|under)\\s*(\\d{2,4})\\s*words|(\\d{2,4})\\s*words?\\s+(?:or\\s+(?:less|fewer)|maximum|max\\b))`,
  "iu",
);
const OZET_EN_AZ = new RegExp(`${OZET}[^.;]{0,80}?(?:at\\s+least|(?:a\\s+)?minimum\\s+of)\\s*(\\d{2,4})\\s*words`, "iu");
const ANAHTAR = /key\s*words?[^.;]{0,50}?(\d{1,2})\s*(?:-|–|to|and)\s*(\d{1,2})|(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*key\s*words?/iu;

export function ingilizceOzetKurallari(compact: string): Record<string, number> {
  const kelime = (v?: string) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 20 && n <= 2000 ? n : undefined;
  };
  const adet = (v?: string) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 20 ? n : undefined;
  };
  const aralik = OZET_ARALIK.exec(compact);
  const enCok = OZET_EN_COK.exec(compact);
  const enAz = OZET_EN_AZ.exec(compact);
  const anahtar = ANAHTAR.exec(compact);
  const enAzKelime = kelime(aralik?.[1]) ?? kelime(enAz?.[1]);
  const enCokKelime = kelime(aralik?.[2]) ?? kelime(enCok?.[1] ?? enCok?.[2]);
  const anahtarEnAz = adet(anahtar?.[1] ?? anahtar?.[3]);
  const anahtarEnCok = adet(anahtar?.[2] ?? anahtar?.[4]);
  return {
    ...(enAzKelime && (!enCokKelime || enAzKelime <= enCokKelime) ? { abstract_min_words: enAzKelime } : {}),
    ...(enCokKelime ? { abstract_max_words: enCokKelime } : {}),
    ...(anahtarEnAz && (!anahtarEnCok || anahtarEnAz <= anahtarEnCok) ? { keywords_min: anahtarEnAz } : {}),
    ...(anahtarEnCok ? { keywords_max: anahtarEnCok } : {}),
  };
}

export interface IngilizceKurallar {
  bosluklar: Partial<Record<Kenar, number>>;
  elenenBosluklar: string[];
  punto?: number;
  satirAraligi?: number;
  girintiCm?: number;
  girintiIsteniyor: boolean;
  asili: boolean;
  asiliCm?: number;
  yasla: boolean;
  sayfaNumarasi: boolean;
  bolumYeniSayfa: boolean;
  bolumBuyukHarf: boolean;
  baslikNumarasi: boolean;
  ozet: Record<string, number>;
}

/** İngilizce kılavuz metninden biçim kuralları; bulunamayan alan boş kalır. */
export function ingilizceKurallar(compact: string): IngilizceKurallar {
  const { bosluklar, elenen } = ingilizceKenarBosluklari(compact);
  const punto = govdeOlcusu(compact, PUNTO, (d) => d >= 8 && d <= 24);
  const satirAraligi = govdeOlcusu(araligiSayiyaCevir(compact), ARALIK, (d) => d >= 1 && d <= 3);
  const girintiCm = ilkOlcu(compact, GIRINTI_OLCU);
  const girintiIsteniyor = GIRINTI_VAR.test(compact) && !GIRINTI_YOK.test(compact);
  const asili = ASILI.test(compact);
  return {
    bosluklar,
    elenenBosluklar: elenen,
    punto,
    satirAraligi,
    girintiCm: girintiIsteniyor ? girintiCm : undefined,
    girintiIsteniyor,
    asili,
    asiliCm: asili ? ilkOlcu(compact, ASILI_OLCU) : undefined,
    yasla:
      /(?:text|body|paragraphs?)[^.;]{0,40}?(?<!left[- ]|not\s+be\s+)(?:fully\s+)?justified\b/iu.test(compact) ||
      /full[- ]justification/iu.test(compact),
    sayfaNumarasi: /page\s+numb|paginat/iu.test(compact),
    bolumYeniSayfa:
      /(?:each|every|all)\s+(?:new\s+)?(?:major\s+)?(?:chapters?|main\s+sections?)[^.;]{0,60}?(?<!not\s+|need\s+not\s+)(?:begins?|starts?|must\s+begin|should\s+begin|must\s+start|should\s+start)\s+(?:on|at)\s+(?:the\s+top\s+of\s+)?a\s+new\s+page/iu.test(
        compact,
      ),
    bolumBuyukHarf: /chapter\s+(?:titles?|headings?)[^.;]{0,60}?(?:all\s+cap(?:ital)?s|upper[- ]?case|capital\s+letters)/iu.test(compact),
    baslikNumarasi:
      /(?:headings?|chapters?|sections?)[^.;]{0,40}?\b(?:should|must|are|is)\s+(?:be\s+)?numbered\b(?![^.;]{0,20}pages?)|decimal\s+(?:numbering|system)/iu.test(compact),
    ozet: ingilizceOzetKurallari(compact),
  };
}
