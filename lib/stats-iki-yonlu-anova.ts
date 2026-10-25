import { fTestP } from "@/lib/stats-math";
import { artikKareToplami } from "@/lib/stats-regresyon";
import { mean } from "@/lib/stats-tests-core";

/*
  İKİ YÖNLÜ ANOVA (26.10.2026).

  Tezlerde en yaygın desenlerden biri programda HİÇ yoktu: "cinsiyet ve
  sınıf düzeyine göre fark var mı" sorusu iki ayrı tek yönlü ANOVA'yla
  yanıtlanamıyor. İki ayrı test ETKİLEŞİMİ göremez — sınıf düzeyinin
  etkisi kadınlarda ve erkeklerde FARKLI olabilir ve asıl bulgu çoğu
  zaman odur. Üstelik iki ayrı test yapmak yanlış pozitif oranını da
  büyütüyor.

  KARELER TOPLAMI MODEL KARŞILAŞTIRMASIYLA (III. tip). Her etkinin
  kareler toplamı, o terim modelden çıkarılınca artıkların ne kadar
  büyüdüğüdür. Ders kitabının kapalı formülleri YALNIZCA hücreler eşit
  büyüklükteyken geçerli; gerçek tez verisinde gruplar neredeyse hiç
  eşit olmuyor (62 kadın, 48 erkek). Dengesiz veride o formülleri
  kullanmak sessizce yanlış kareler toplamı üretirdi.

  Etki kodlaması (1 / −1 / 0) kullanılıyor; III. tip kareler toplamının
  tanımı bunu gerektiriyor. Kukla kodlama (0/1) ile aynı model
  karşılaştırması I. tip üretir ve terimlerin SIRASINA bağlı olur.

  Dengeli veride III. tip, ders kitabı formülleriyle BİREBİR aynı
  çıkmalı; testi tam olarak bunu sınıyor (elle hesaplanmış 2×3 örnek).
*/

export interface AnovaEtkisi {
  ad: string;
  ss: number;
  df: number;
  ms: number;
  f: number;
  p: number;
  /** Kısmi η² = SS / (SS + SSE): bu etkinin AÇIKLADIĞI payı, öteki etkiler sabitken. */
  kismiEtaKare: number;
}

export interface Hucre {
  a: string;
  b: string;
  n: number;
  ortalama: number;
}

export interface IkiYonluAnovaSonucu {
  faktorA: AnovaEtkisi;
  faktorB: AnovaEtkisi;
  etkilesim: AnovaEtkisi;
  hata: { ss: number; df: number; ms: number };
  toplam: { ss: number; df: number };
  hucreler: Hucre[];
  duzeyA: string[];
  duzeyB: string[];
  /** Bütün hücreler aynı büyüklükte mi (raporlamada söylenir). */
  dengeli: boolean;
}

export type IkiYonluGozlem = { a: string; b: string; deger: number };

/** Hesaplanamama sebepleri; çağıran kullanıcıya bunu yazar. */
export type IkiYonluHata = "az-duzey" | "bos-hucre" | "az-gozlem" | "tekil";

function etkiKodu(duzey: string, duzeyler: string[]): number[] {
  const son = duzeyler[duzeyler.length - 1];
  return duzeyler.slice(0, -1).map((d) => (duzey === d ? 1 : duzey === son ? -1 : 0));
}

export function ikiYonluAnova(
  gozlemler: IkiYonluGozlem[],
  adA: string,
  adB: string,
): IkiYonluAnovaSonucu | IkiYonluHata {
  const duzeyA = [...new Set(gozlemler.map((g) => g.a))];
  const duzeyB = [...new Set(gozlemler.map((g) => g.b))];
  if (duzeyA.length < 2 || duzeyB.length < 2) return "az-duzey";

  const hucreler: Hucre[] = [];
  for (const a of duzeyA) {
    for (const b of duzeyB) {
      const degerler = gozlemler.filter((g) => g.a === a && g.b === b).map((g) => g.deger);
      /*
        BOŞ HÜCRE SESSİZ GEÇİLMİYOR: bir hücre hiç gözlem taşımıyorsa
        etkileşim o hücrede tanımsızdır ve model karşılaştırması tekil
        bir matris üretir. "Sonuç yok" demek, uydurulmuş bir sayıdan
        iyidir.
      */
      if (degerler.length === 0) return "bos-hucre";
      hucreler.push({ a, b, n: degerler.length, ortalama: mean(degerler) });
    }
  }

  const n = gozlemler.length;
  const sayiA = duzeyA.length - 1;
  const sayiB = duzeyB.length - 1;
  const sayiAB = sayiA * sayiB;
  const hataDf = n - 1 - sayiA - sayiB - sayiAB;
  if (hataDf < 1) return "az-gozlem";

  const y = gozlemler.map((g) => g.deger);
  const sutunA = gozlemler.map((g) => etkiKodu(g.a, duzeyA));
  const sutunB = gozlemler.map((g) => etkiKodu(g.b, duzeyB));
  const sutunAB = gozlemler.map((_, i) => sutunA[i].flatMap((ka) => sutunB[i].map((kb) => ka * kb)));

  /** İstenen terimlerden tasarım matrisi (sabit terim her zaman var). */
  const matris = (a: boolean, b: boolean, ab: boolean) =>
    gozlemler.map((_, i) => [1, ...(a ? sutunA[i] : []), ...(b ? sutunB[i] : []), ...(ab ? sutunAB[i] : [])]);

  const tam = artikKareToplami(y, matris(true, true, true));
  const aSiz = artikKareToplami(y, matris(false, true, true));
  const bSiz = artikKareToplami(y, matris(true, false, true));
  const abSiz = artikKareToplami(y, matris(true, true, false));
  if (tam === null || aSiz === null || bSiz === null || abSiz === null) return "tekil";

  const hataMs = tam / hataDf;
  const etki = (ad: string, ss: number, df: number): AnovaEtkisi => {
    const ms = ss / df;
    const f = ms / hataMs;
    return {
      ad, ss, df, ms, f,
      p: Number.isFinite(f) ? fTestP(f, df, hataDf) : NaN,
      kismiEtaKare: ss + tam === 0 ? 0 : ss / (ss + tam),
    };
  };

  const genelOrtalama = mean(y);
  const sst = y.reduce((toplam, deger) => toplam + (deger - genelOrtalama) ** 2, 0);
  const ilkN = hucreler[0].n;

  return {
    faktorA: etki(adA, aSiz - tam, sayiA),
    faktorB: etki(adB, bSiz - tam, sayiB),
    etkilesim: etki(`${adA} × ${adB}`, abSiz - tam, sayiAB),
    hata: { ss: tam, df: hataDf, ms: hataMs },
    toplam: { ss: sst, df: n - 1 },
    hucreler,
    duzeyA,
    duzeyB,
    dengeli: hucreler.every((h) => h.n === ilkN),
  };
}
