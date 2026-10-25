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

/*
  BASİT ETKİLER (etkileşim anlamlı olduğunda).

  Etkileşim anlamlıysa ana etki tek başına yanıltıcıdır: "sınıf düzeyi
  fark yaratıyor" cümlesi, farkın kadınlarda ve erkeklerde AYNI
  olduğunu varsayar — oysa etkileşimin anlamlı olması tam da bunun
  doğru OLMADIĞINI söylüyor. Doğru okuma, bir faktörün etkisine
  ötekinin HER DÜZEYİNDE ayrı ayrı bakmaktır.

  Her basit etki ayrı bir F testi, yani çoklu karşılaştırma: p değerleri
  Bonferroni ile düzeltiliyor (düzey sayısı kadar). Düzeltmesiz
  bırakmak, etkileşim anlamlı çıktığında art arda test yapıp
  "bir yerde anlamlı bir şey" bulmayı kolaylaştırırdı.

  PAYDA ORTAK HATA KARESİ: iki yönlü modelin MSw'si kullanılıyor, her
  alt grubun kendi hata karesi değil. Alt grubun kendi varyansını
  kullanmak modelin topladığı bilgiyi atmak ve serbestlik derecesini
  gereksiz düşürmek olurdu.
*/
export interface BasitEtki {
  /** Hangi faktörün hangi düzeyinde bakıldığı ("Kadın"). */
  duzey: string;
  /** Bu düzey içinde karşılaştırılan faktör. */
  faktor: string;
  ss: number;
  df: number;
  f: number;
  /** Düzeltilmemiş p; şeffaflık için duruyor. */
  pHam: number;
  /** Bonferroni ile düzeltilmiş p — karar bununla verilir. */
  p: number;
  anlamli: boolean;
}

export function basitEtkiler(
  gozlemler: IkiYonluGozlem[],
  sonuc: IkiYonluAnovaSonucu,
  /** "a": A'nın her düzeyinde B'ye bak; "b": tersi. */
  hangisi: "a" | "b",
  adA: string,
  adB: string,
): BasitEtki[] {
  const duzeyler = hangisi === "a" ? sonuc.duzeyA : sonuc.duzeyB;
  const bakilanFaktor = hangisi === "a" ? adB : adA;
  const sayi = duzeyler.length;

  return duzeyler.map((duzey) => {
    const icerisi = gozlemler.filter((g) => (hangisi === "a" ? g.a : g.b) === duzey);
    const altDuzeyler = [...new Set(icerisi.map((g) => (hangisi === "a" ? g.b : g.a)))];
    const gruplar = altDuzeyler.map((d) =>
      icerisi.filter((g) => (hangisi === "a" ? g.b : g.a) === d).map((g) => g.deger),
    );
    const genel = mean(icerisi.map((g) => g.deger));
    const ss = gruplar.reduce((toplam, grup) => toplam + grup.length * (mean(grup) - genel) ** 2, 0);
    const df = altDuzeyler.length - 1;
    const f = df > 0 ? ss / df / sonuc.hata.ms : NaN;
    const pHam = Number.isFinite(f) ? fTestP(f, df, sonuc.hata.df) : NaN;
    return {
      duzey,
      faktor: bakilanFaktor,
      ss,
      df,
      f,
      pHam,
      p: Number.isFinite(pHam) ? Math.min(1, pHam * sayi) : NaN,
      anlamli: Number.isFinite(pHam) ? Math.min(1, pHam * sayi) < 0.05 : false,
    };
  });
}
