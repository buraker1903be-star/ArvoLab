/**
 * Temel İstatistiksel Testler
 * ------------------------------------------------------------
 * Bağımsız örneklem t-testi, tek yönlü ANOVA, Pearson korelasyonu,
 * ki-kare bağımsızlık testi ve Cronbach Alpha güvenilirlik analizi.
 * Tüm formüller elle hesaplanmış / ders kitabı örnekleriyle
 * doğrulanmıştır (bkz. proje test notları). Bu modül YORUM
 * ÜRETMEZ — yalnızca sayısal sonucu hesaplar; APA biçimlendirmesi
 * ve anlamlılık işaretlemesi ayrı bir katmanda (stats-interpreter.ts
 * ile aynı ilkede) yapılır.
 */
import { tTestTwoTailedP, fTestP, chiSquareP, tKritik } from "./stats-math";

export function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
}

export function sd(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

export function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface DescriptiveStats {
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  median: number;
}

export function describeNumeric(arr: number[]): DescriptiveStats {
  return {
    n: arr.length,
    mean: mean(arr),
    sd: arr.length > 1 ? sd(arr) : 0,
    min: Math.min(...arr),
    max: Math.max(...arr),
    median: median(arr),
  };
}

export interface TTestResult {
  t: number;
  df: number;
  p: number;
  m1: number;
  m2: number;
  n1: number;
  n2: number;
  sd1: number;
  sd2: number;
  /** Cohen's d — standartlaştırılmış ortalama farkı. */
  d: number;
  dYorum: EtkiYorumu;
  /** Ortalama farkı ve %95 güven aralığı. */
  fark: number;
  altSinir: number;
  ustSinir: number;
}

/*
  ETKİ BÜYÜKLÜĞÜ (25.10.2026).

  Modül p değeri üretiyordu ama etki büyüklüğü üretmiyordu. p
  "fark var mı" sorusunu yanıtlar, "fark NE KADAR" sorusunu değil:
  büyük örneklemde önemsiz bir fark bile p < .05 çıkar ve etki
  büyüklüğü olmadan okuyucu bunu ayırt edemez. Bu istatistiğin
  kendi gereği; bir yazım kılavuzunun dayatması değil.

  KILAVUZ KURALI DİYE YAZILMADI ve bu bilinçli: raporlama biçimi
  üniversiteden üniversiteye değişiyor (kurum sahibinin uyarısı,
  25.10.2026). Hangi değerin yazılacağına kullanıcının seçtiği
  kılavuz karar verir; bu modülün işi değeri DOĞRU HESAPLAMAK.
  Hesaplanmayan bir değer hiçbir kılavuzda raporlanamaz, o yüzden
  hesap her zaman yapılır; gösterim kılavuza bırakılır.

  Eşikler Cohen (1988). Sınırlar KESİN DEĞİL, yorum kolaylığı için:
  bir araştırmacı .49'u "orta"ya yakın okumalı, ".5'in altı küçük"
  diye değil. O yüzden etiket ayrı bir alan; sayı her zaman yanında.
*/
export type EtkiYorumu = "önemsiz" | "küçük" | "orta" | "büyük";

function cohenYorumu(d: number): EtkiYorumu {
  const mutlak = Math.abs(d);
  if (mutlak < 0.2) return "önemsiz";
  if (mutlak < 0.5) return "küçük";
  if (mutlak < 0.8) return "orta";
  return "büyük";
}

/** η² ve Cramér's V için ortak eşikler (Cohen 1988: .01/.06/.14). */
function oranYorumu(deger: number): EtkiYorumu {
  if (deger < 0.01) return "önemsiz";
  if (deger < 0.06) return "küçük";
  if (deger < 0.14) return "orta";
  return "büyük";
}

export function independentTTest(group1: number[], group2: number[]): TTestResult {
  const n1 = group1.length,
    n2 = group2.length;
  const m1 = mean(group1),
    m2 = mean(group2);
  const v1 = variance(group1),
    v2 = variance(group2);
  const pooledVar = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
  const se = Math.sqrt(pooledVar * (1 / n1 + 1 / n2));
  const t = (m1 - m2) / se;
  const df = n1 + n2 - 2;
  const p = tTestTwoTailedP(Math.abs(t), df);
  /* Cohen's d birleştirilmiş SS ile: iki grubun büyüklüğü farklı
     olduğunda tek bir grubun SS'ini kullanmak etkiyi şişiriyor. */
  const birlesikSS = Math.sqrt(pooledVar);
  const d = birlesikSS === 0 ? 0 : (m1 - m2) / birlesikSS;
  const fark = m1 - m2;
  const pay = tKritik(df) * se;
  return {
    t, df, p, m1, m2, n1, n2,
    sd1: Math.sqrt(v1), sd2: Math.sqrt(v2),
    d, dYorum: cohenYorumu(d),
    fark, altSinir: fark - pay, ustSinir: fark + pay,
  };
}

export interface AnovaResult {
  f: number;
  dfb: number;
  dfw: number;
  p: number;
  ssb: number;
  ssw: number;
  msb: number;
  msw: number;
  groupMeans: number[];
  groupNs: number[];
  /** η² = SSb / SSt — ANOVA'nın etki büyüklüğü. */
  etaKare: number;
  etaYorum: EtkiYorumu;
}

export function oneWayAnova(groups: number[][]): AnovaResult {
  const allValues = groups.flat();
  const grandMean = mean(allValues);
  const N = allValues.length;
  const k = groups.length;
  let ssb = 0,
    ssw = 0;
  const groupMeans: number[] = [];
  for (const g of groups) {
    const gm = mean(g);
    groupMeans.push(gm);
    ssb += g.length * (gm - grandMean) ** 2;
    ssw += g.reduce((s, x) => s + (x - gm) ** 2, 0);
  }
  const dfb = k - 1,
    dfw = N - k;
  const msb = ssb / dfb,
    msw = ssw / dfw;
  const f = msb / msw;
  const p = fTestP(f, dfb, dfw);
  const sst = ssb + ssw;
  const etaKare = sst === 0 ? 0 : ssb / sst;
  return {
    f, dfb, dfw, p, ssb, ssw, msb, msw,
    groupMeans, groupNs: groups.map((g) => g.length),
    etaKare, etaYorum: oranYorumu(etaKare),
  };
}

export interface CorrelationResult {
  r: number;
  df: number;
  p: number;
  n: number;
  /* r'nin kendisi etki büyüklüğü; r² "açıklanan varyans" olarak
     raporlanıyor ve okuyucuya yüzde olarak çok daha anlaşılır
     geliyor ("varyansın %18'i"). */
  rKare: number;
  rYorum: EtkiYorumu;
}

export function pearsonCorrelation(x: number[], y: number[]): CorrelationResult {
  const n = x.length;
  const mx = mean(x),
    my = mean(y);
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const r = num / Math.sqrt(dx * dy);
  const df = n - 2;
  const t = (r * Math.sqrt(df)) / Math.sqrt(1 - r * r);
  const p = tTestTwoTailedP(Math.abs(t), df);
  /* Cohen (1988) korelasyonda ayrı eşikler veriyor (.10/.30/.50);
     η²'nin eşikleriyle karıştırmamak için r doğrudan yorumlanıyor. */
  const mutlak = Math.abs(r);
  const rYorum: EtkiYorumu = mutlak < 0.1 ? "önemsiz" : mutlak < 0.3 ? "küçük" : mutlak < 0.5 ? "orta" : "büyük";
  return { r, df, p, n, rKare: r * r, rYorum };
}

export interface ChiSquareResult {
  /** Cramér's V — ki-karenin etki büyüklüğü (0–1). */
  cramersV: number;
  vYorum: EtkiYorumu;
  chi2: number;
  df: number;
  p: number;
  n: number;
}

export function chiSquareIndependence(table: number[][]): ChiSquareResult {
  const rowTotals = table.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = table[0].map((_, c) => table.reduce((s, row) => s + row[c], 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);
  let chi2 = 0;
  for (let r = 0; r < table.length; r++) {
    for (let c = 0; c < table[0].length; c++) {
      const expected = (rowTotals[r] * colTotals[c]) / grandTotal;
      chi2 += (table[r][c] - expected) ** 2 / expected;
    }
  }
  const df = (table.length - 1) * (table[0].length - 1);
  const p = chiSquareP(chi2, df);
  /* Cramér's V: χ² örneklem büyüklüğüyle doğrudan büyüyor, yani
     tek başına ilişkinin GÜCÜNÜ söylemiyor. V tabloyu normalleştirip
     0–1 aralığına indiriyor. Payda tablonun KISA kenarına bakar
     (min(satır,sütun)−1); uzun kenara bakmak 2×5 gibi tablolarda
     etkiyi olduğundan küçük gösterirdi. */
  const kisaKenar = Math.min(table.length, table[0].length) - 1;
  const cramersV = grandTotal === 0 || kisaKenar <= 0 ? 0 : Math.sqrt(chi2 / (grandTotal * kisaKenar));
  return { chi2, df, p, n: grandTotal, cramersV, vYorum: oranYorumu(cramersV) };
}

export interface FrequencyRow {
  value: string;
  count: number;
  percent: number;
}

export function frequencyTable(values: (string | number)[]): FrequencyRow[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = values.length;
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, percent: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

export interface CorrelationMatrixCell {
  varA: string;
  varB: string;
  r: number;
  p: number;
  n: number;
}

export function correlationMatrix(
  columns: { name: string; values: number[] }[]
): CorrelationMatrixCell[] {
  const results: CorrelationMatrixCell[] = [];
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      const a = columns[i],
        b = columns[j];
      const n = Math.min(a.values.length, b.values.length);
      if (n < 3) continue;
      const r = pearsonCorrelation(a.values.slice(0, n), b.values.slice(0, n));
      results.push({ varA: a.name, varB: b.name, r: r.r, p: r.p, n: r.n });
    }
  }
  return results;
}

export interface CronbachAlphaResult {
  alpha: number;
  k: number;
  n: number;
}

export function cronbachAlpha(items: number[][]): CronbachAlphaResult {
  const k = items.length;
  const itemVariances = items.map((item) => variance(item));
  const n = items[0].length;
  const totalScores: number[] = [];
  for (let i = 0; i < n; i++) {
    totalScores.push(items.reduce((s, item) => s + item[i], 0));
  }
  const totalVar = variance(totalScores);
  const alpha = (k / (k - 1)) * (1 - itemVariances.reduce((a, b) => a + b, 0) / totalVar);
  return { alpha, k, n };
}

/*
  EŞLEŞTİRİLMİŞ ÖRNEKLEM t-TESTİ (25.10.2026).

  Ön test–son test deseni tezlerde en yaygın kurgulardan biri ve
  program bunu HİÇ yapamıyordu. Kullanıcının elindeki tek seçenek
  bağımsız örneklem t-testiydi; aynı kişilerin iki ölçümünü BAĞIMSIZ
  iki grup saymak, eşleşmeden gelen bilgiyi atmak demek: fark gerçek
  olsa bile test onu bulamıyor (güç kaybı) ve "anlamlı fark yok"
  sonucu yanlış yere yazılıyor.

  Hesap farkların kendi üzerinde: d = x − y dizisinin tek örneklem
  t-testi.
*/
export interface EslestirilmisSonuc {
  t: number;
  df: number;
  p: number;
  n: number;
  /** Fark ortalaması (birinci ölçüm − ikinci ölçüm). */
  farkOrtalamasi: number;
  farkSS: number;
  altSinir: number;
  ustSinir: number;
  /** Cohen's dz: fark ortalaması / farkların SS'i. */
  dz: number;
  dzYorum: EtkiYorumu;
}

export function eslestirilmisTTest(oncesi: number[], sonrasi: number[]): EslestirilmisSonuc {
  /*
    EŞLEŞMEYEN GÖZLEM ATILIR, SIFIR SAYILMAZ. Dizilerin boyu
    farklıysa fazlalık ölçümün eşi yok; onu sıfır farkla dahil etmek
    gerçekte olmayan "değişim yok" gözlemleri uydurmak olurdu.
  */
  const n = Math.min(oncesi.length, sonrasi.length);
  const farklar = Array.from({ length: n }, (_, i) => oncesi[i] - sonrasi[i]);

  const farkOrtalamasi = mean(farklar);
  const farkVaryans = variance(farklar);
  const farkSS = Math.sqrt(farkVaryans);
  const se = farkSS / Math.sqrt(n);
  const t = se === 0 ? NaN : farkOrtalamasi / se;
  const df = n - 1;
  const p = Number.isFinite(t) ? tTestTwoTailedP(Math.abs(t), df) : NaN;
  const pay = Number.isFinite(t) ? tKritik(df) * se : NaN;
  const dz = farkSS === 0 ? NaN : farkOrtalamasi / farkSS;

  return {
    t, df, p, n,
    farkOrtalamasi,
    farkSS,
    altSinir: farkOrtalamasi - pay,
    ustSinir: farkOrtalamasi + pay,
    dz,
    dzYorum: cohenYorumu(dz),
  };
}

/*
  ANOVA SONRASI İKİLİ KARŞILAŞTIRMA — BONFERRONI (25.10.2026).

  ANOVA "gruplardan en az biri farklı" diyor, hangisi olduğunu
  söylemiyordu; kullanıcı anlamlı bir F görüp cevapsız kalıyordu.

  TUKEY HSD BİLEREK YOK. Studentized range (q) dağılımı kapalı bir
  formülle hesaplanmıyor; sayısal integral ya da katsayı tablosu
  gerekiyor ve elle yazılan bir kopyadaki hata GÖRÜNMEZ olurdu —
  makul bir p çıkar, kimse fark etmez (Shapiro-Wilk için de aynı
  gerekçeyle yazılmadı). Bonferroni düzeltmesi KAPALI formüllü ve
  elle doğrulanabilir; SPSS de standart seçeneklerinden biri olarak
  sunuyor.

  Bonferroni TEMKİNLİ taraftadır: gerçek farkı kaçırabilir ama
  olmayan farkı bulmaz. Bir tez bulgusunda yanlış pozitif, yanlış
  negatiften pahalıdır.
*/
export interface IkiliKarsilastirma {
  a: string;
  b: string;
  ortalamaFarki: number;
  t: number;
  /** Düzeltilmemiş p; şeffaflık için duruyor. */
  pHam: number;
  /** Bonferroni ile düzeltilmiş p — karar bununla verilir. */
  p: number;
  anlamli: boolean;
}

export function bonferroniKarsilastirmalari(
  gruplar: number[][],
  adlar: string[],
): IkiliKarsilastirma[] {
  const { msw, dfw } = (() => {
    const { msw: m, dfw: d } = oneWayAnova(gruplar);
    return { msw: m, dfw: d };
  })();

  const ciftler: IkiliKarsilastirma[] = [];
  const karsilastirmaSayisi = (gruplar.length * (gruplar.length - 1)) / 2;

  for (let i = 0; i < gruplar.length; i += 1) {
    for (let j = i + 1; j < gruplar.length; j += 1) {
      const ni = gruplar[i].length;
      const nj = gruplar[j].length;
      const fark = mean(gruplar[i]) - mean(gruplar[j]);
      /* Ortak hata karesi (MSw) kullanılıyor: ikili t-testlerin
         kendi varyansını kullanmak ANOVA'nın bilgisini atmak olurdu
         ve serbestlik derecesi gereksiz düşerdi. */
      const se = Math.sqrt(msw * (1 / ni + 1 / nj));
      const t = se === 0 ? NaN : fark / se;
      const pHam = Number.isFinite(t) ? tTestTwoTailedP(Math.abs(t), dfw) : NaN;
      const p = Number.isFinite(pHam) ? Math.min(1, pHam * karsilastirmaSayisi) : NaN;
      ciftler.push({
        a: adlar[i] ?? `Grup ${i + 1}`,
        b: adlar[j] ?? `Grup ${j + 1}`,
        ortalamaFarki: fark,
        t,
        pHam,
        p,
        anlamli: Number.isFinite(p) ? p < 0.05 : false,
      });
    }
  }
  return ciftler;
}
