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

import { ciftEslestir } from "@/lib/veri-eslestirme";
import { tTestTwoTailedP, fTestP, chiSquareP, tKritik, logFaktoriyel } from "./stats-math";

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

/*
  WELCH t-TESTİ (eşit varyans varsaymayan).

  Varsayım şeridi Levene p < .05 olduğunda "Welch kullanılmalı" diyordu
  ama programda Welch YOKTU: kullanıcıya uygulayamayacağı bir öneri
  veriliyordu. Varyanslar ayrıştığında birleşik varyanslı t-testi
  standart hatayı yanlış tahmin ediyor — gruplar eşit büyüklükte
  değilse p sistematik olarak sapıyor; büyük grubun varyansı küçükse
  test olduğundan cömert, tersinde olduğundan katı oluyor.

  Serbestlik derecesi Welch-Satterthwaite yaklaşımı: ondalıklı çıkıyor
  ve öyle de raporlanıyor (SPSS de böyle basar), yuvarlanmıyor.

  Etki büyüklüğü birleşik SS ile hesaplanamaz — birleştirme zaten eşit
  varyans varsayıyor. İki varyansın ORTALAMASININ karekökü kullanılıyor
  (eşit varyansta birleşik SS ile aynı sonucu verir).

  Beklenen değerler: Wikipedia'nın Welch örneğiyle doğrulandı
  (t = −2,455356, df = 24,988529, p = 0,021378).
*/
export function welchTTest(group1: number[], group2: number[]): TTestResult {
  const n1 = group1.length;
  const n2 = group2.length;
  const m1 = mean(group1);
  const m2 = mean(group2);
  const v1 = variance(group1);
  const v2 = variance(group2);
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  const t = (m1 - m2) / se;
  const pay = (v1 / n1 + v2 / n2) ** 2;
  const payda = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
  const df = payda === 0 ? NaN : pay / payda;
  const p = tTestTwoTailedP(Math.abs(t), df);
  const ortalamaSS = Math.sqrt((v1 + v2) / 2);
  const d = ortalamaSS === 0 ? 0 : (m1 - m2) / ortalamaSS;
  const fark = m1 - m2;
  const genislik = tKritik(df) * se;
  return {
    t, df, p, m1, m2, n1, n2,
    sd1: Math.sqrt(v1), sd2: Math.sqrt(v2),
    d, dYorum: cohenYorumu(d),
    fark, altSinir: fark - genislik, ustSinir: fark + genislik,
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
  /** Beklenen frekanslar — varsayım denetimi ve raporlama için. */
  beklenen: number[][];
  enKucukBeklenen: number;
  /** Beklenen frekansı 5'in altında olan hücrelerin oranı (0–1). */
  dusukHucreOrani: number;
  /** Cochran ölçütü sağlanıyor mu (aşağıdaki nota bakın). */
  varsayimSaglandi: boolean;
}

/*
  Kİ-KARENİN BEKLENEN FREKANS VARSAYIMI (Cochran ölçütü).

  χ² sürekli bir dağılıma YAKLAŞIM; beklenen frekanslar küçüldükçe
  yaklaşım bozuluyor ve p değeri gerçeğinden küçük çıkıyor, yani test
  olmayan bir ilişkiyi "anlamlı" gösteriyor. Program bunu hiç
  söylemiyordu: 20 kişilik bir veriden çıkan p, 2000 kişilikle aynı
  güvenle yazılıyordu.

  Ölçüt: hiçbir hücrenin beklenen frekansı 1'in altında olmayacak VE
  5'in altındaki hücreler tablonun en çok beşte birini tutacak. 2×2'de
  bu, dört hücrenin de 5 ve üzeri olması demek.
*/
const EN_AZ_BEKLENEN = 1;
const DUSUK_BEKLENEN = 5;
const DUSUK_HUCRE_TAVANI = 0.2;

export function chiSquareIndependence(table: number[][]): ChiSquareResult {
  const rowTotals = table.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = table[0].map((_, c) => table.reduce((s, row) => s + row[c], 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);
  const beklenen = table.map((_, r) => table[0].map((__, c) => (rowTotals[r] * colTotals[c]) / grandTotal));
  let chi2 = 0;
  for (let r = 0; r < table.length; r++) {
    for (let c = 0; c < table[0].length; c++) {
      chi2 += (table[r][c] - beklenen[r][c]) ** 2 / beklenen[r][c];
    }
  }
  const hucreler = beklenen.flat();
  const enKucukBeklenen = Math.min(...hucreler);
  const dusukHucreOrani = hucreler.filter((e) => e < DUSUK_BEKLENEN).length / hucreler.length;
  const varsayimSaglandi = enKucukBeklenen >= EN_AZ_BEKLENEN && dusukHucreOrani <= DUSUK_HUCRE_TAVANI;
  const df = (table.length - 1) * (table[0].length - 1);
  const p = chiSquareP(chi2, df);
  /* Cramér's V: χ² örneklem büyüklüğüyle doğrudan büyüyor, yani
     tek başına ilişkinin GÜCÜNÜ söylemiyor. V tabloyu normalleştirip
     0–1 aralığına indiriyor. Payda tablonun KISA kenarına bakar
     (min(satır,sütun)−1); uzun kenara bakmak 2×5 gibi tablolarda
     etkiyi olduğundan küçük gösterirdi. */
  const kisaKenar = Math.min(table.length, table[0].length) - 1;
  const cramersV = grandTotal === 0 || kisaKenar <= 0 ? 0 : Math.sqrt(chi2 / (grandTotal * kisaKenar));
  return {
    chi2, df, p, n: grandTotal, cramersV, vYorum: oranYorumu(cramersV),
    beklenen, enKucukBeklenen, dusukHucreOrani, varsayimSaglandi,
  };
}

/*
  FISHER KESİN TESTİ (2×2).

  Beklenen frekanslar küçükken χ² yaklaşımı bozuluyor ve varsayım
  uyarısı tek başına kullanıcıyı çıkmazda bırakıyordu: "testin geçersiz"
  deyip yerine bir şey vermemek, Welch'ten önceki durumun aynısı.
  Fisher YAKLAŞIM DEĞİL — kenar toplamları sabitken bütün tabloların
  olasılığı hipergeometrik dağılımla tek tek toplanıyor, yani küçük
  örneklemde doğru olan test bu.

  İki kuyruk, gözlenenden daha "aşırı" olmanın standart tanımıyla:
  olasılığı gözlenen tablonunkinden büyük OLMAYAN her tablo toplanıyor
  (R'ın fisher.test'inin varsayılanı). Ortalamadan uzaklığa göre
  simetrik bölmek, kenarlar dengesizken yanlış kuyruk üretirdi.

  Faktöriyeller logaritmada: 170!'ten sonra çift duyarlık taşıyor.

  Doğrulama: Fisher'ın çay örneği [[3,1],[1,3]] → p = 0,485714.
*/
export function fisherKesinTesti(tablo: number[][]): number {
  if (tablo.length !== 2 || tablo[0].length !== 2 || tablo[1].length !== 2) {
    throw new Error("Fisher kesin testi yalnızca 2×2 tablolarda uygulanır.");
  }
  const [[a, b], [c, d]] = tablo as [[number, number], [number, number]];
  const satir1 = a + b;
  const satir2 = c + d;
  const sutun1 = a + c;
  const sutun2 = b + d;
  const n = satir1 + satir2;
  if (n === 0) return NaN;

  const sabit = logFaktoriyel(satir1) + logFaktoriyel(satir2) + logFaktoriyel(sutun1) + logFaktoriyel(sutun2) - logFaktoriyel(n);
  const olasilik = (x: number) => {
    const y = sutun1 - x;
    const z = satir1 - x;
    const w = satir2 - y;
    if (x < 0 || y < 0 || z < 0 || w < 0) return 0;
    return Math.exp(sabit - logFaktoriyel(x) - logFaktoriyel(z) - logFaktoriyel(y) - logFaktoriyel(w));
  };

  const gozlenen = olasilik(a);
  let toplam = 0;
  const altSinir = Math.max(0, sutun1 - satir2);
  const ustSinir = Math.min(satir1, sutun1);
  for (let x = altSinir; x <= ustSinir; x++) {
    const p = olasilik(x);
    /* Kayan nokta toleransı: gözlenenle AYNI olasılıktaki simetrik
       tablo, yuvarlama yüzünden "daha büyük" sayılıp toplamdan
       düşerse iki kuyruklu p sistematik olarak küçük çıkar. */
    if (p <= gozlenen * (1 + 1e-7)) toplam += p;
  }
  return Math.min(1, toplam);
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

/*
  KORELASYON MATRİSİ — eleme ÇİFT BAZLI.

  Sütunlar tam boyda geliyor, eksik hücreler `null`; her çift kendi
  içinde eşleştiriliyor. Eskiden sütunlar boşları atılmış hâlde
  (kısalmış ve kaymış) geliyor, en kısa olanın boyuna kesiliyordu:
  tek bir eksik hücre o sütunun girdiği BÜTÜN çiftleri kaydırıyordu
  ve matris baştan sona yanlış çıkıyordu.

  Çift bazlı eleme bilerek seçildi (SPSS'in korelasyon varsayılanı):
  liste bazlı eleme, on sütunlu bir veride tek bir eksik hücre
  yüzünden o satırı bütün çiftlerden düşürürdü. Bedeli N'in çiftten
  çifte değişmesi; bu yüzden n her satırda ayrıca yazılıyor.
*/
export function correlationMatrix(
  columns: { name: string; values: (number | null)[] }[]
): CorrelationMatrixCell[] {
  const results: CorrelationMatrixCell[] = [];
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      const a = columns[i];
      const b = columns[j];
      const { x, y } = ciftEslestir(a.values, b.values);
      if (x.length < 3) continue;
      const r = pearsonCorrelation(x, y);
      results.push({ varA: a.name, varB: b.name, r: r.r, p: r.p, n: r.n });
    }
  }
  return results;
}

export interface MaddeIstatistigi {
  /** Maddenin sıra numarası (0 tabanlı); adı çağıran tarafta. */
  sira: number;
  /** Düzeltilmiş madde-toplam korelasyonu: madde ile DİĞER maddelerin toplamı. */
  duzeltilmisKorelasyon: number;
  /** Bu madde atılırsa alfa ne olur (k < 3 ise NaN: iki maddeden biri atılınca alfa tanımsız). */
  alphaSilinirse: number;
}

export interface CronbachAlphaResult {
  alpha: number;
  k: number;
  n: number;
  maddeler: MaddeIstatistigi[];
}

/** Alfanın çekirdeği: ham değer, madde istatistikleri olmadan (kendini çağırmak için). */
function alfaDegeri(items: number[][]): number {
  const k = items.length;
  if (k < 2) return NaN;
  const n = items[0].length;
  const toplamlar: number[] = [];
  for (let i = 0; i < n; i++) toplamlar.push(items.reduce((s, item) => s + item[i], 0));
  const toplamVaryans = variance(toplamlar);
  if (toplamVaryans === 0) return NaN;
  const maddeVaryanslari = items.reduce((a, item) => a + variance(item), 0);
  return (k / (k - 1)) * (1 - maddeVaryanslari / toplamVaryans);
}

/*
  CRONBACH ALFA + MADDE İSTATİSTİKLERİ.

  Tek bir alfa sayısı tezde yetmiyor: jüri "hangi madde ölçeği bozuyor"
  diye soruyor ve SPSS'in bastığı iki sütun isteniyor — düzeltilmiş
  madde-toplam korelasyonu ve "madde silinirse alfa". Düşük alfanın
  sebebini ancak bunlar gösteriyor; alfa 0,62 çıktığında öğrencinin
  elinde atılacak maddeyi gösteren hiçbir şey yoktu.

  Korelasyon DÜZELTİLMİŞ: madde kendi toplamıyla değil, DİĞER
  maddelerin toplamıyla karşılaştırılıyor. Düzeltilmemiş hâli maddeyi
  kendisiyle de ilişkilendirdiği için her maddeyi olduğundan tutarlı
  gösterir ve bozuk maddeyi gizler.

  Maddelerin uzunlukları EŞİT olmalı; çağıran satırları eşleştirerek
  veriyor (lib/veri-eslestirme.ts). Eşit değilse hesap sessizce NaN
  üretirdi, bu yüzden burada açıkça reddediliyor.
*/
export function cronbachAlpha(items: number[][]): CronbachAlphaResult {
  const k = items.length;
  const n = items[0]?.length ?? 0;
  if (items.some((item) => item.length !== n)) {
    throw new Error("Cronbach alfa: bütün maddeler aynı sayıda gözlem taşımalı.");
  }
  const alpha = alfaDegeri(items);

  const maddeler: MaddeIstatistigi[] = items.map((madde, sira) => {
    const digerleri = items.filter((_, i) => i !== sira);
    const digerToplam = Array.from({ length: n }, (_, satir) =>
      digerleri.reduce((s, item) => s + item[satir], 0)
    );
    return {
      sira,
      duzeltilmisKorelasyon: pearsonCorrelation(madde, digerToplam).r,
      // İki maddeli ölçekte bir madde atılınca geriye tek madde kalıyor: alfa tanımsız.
      alphaSilinirse: k >= 3 ? alfaDegeri(digerleri) : NaN,
    };
  });

  return { alpha, k, n, maddeler };
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

/*
  WELCH ANOVA (eşit varyans varsaymayan tek yönlü ANOVA).

  Varsayım şeridi üç ve daha çok grupta da "eşit varyans varsaymayan
  bir test düşünün" diyordu ama karşılığı YOKTU: iki grupta Welch
  t-testi var, üç grupta hiçbir şey. Klasik F, grup varyansları
  ayrıştığında ve gruplar eşit büyüklükte olmadığında sapıyor —
  büyük grubun varyansı küçükse olduğundan cömert.

  Ağırlıklar w = n / s²; serbestlik dereceleri Welch'in yaklaşımıyla
  ondalıklı çıkıyor ve öyle raporlanıyor.

  ETKİ BÜYÜKLÜĞÜ YOK. η² kareler toplamından geliyor ve o hesap eşit
  varyans varsayıyor; Welch F'in yanına koymak, varsaymadığı şeyi
  varsayan bir sayı yazmak olurdu. Uydurmak yerine boş bırakılıyor.

  Doğrulama k = 2'de matematiksel bir ÖZDEŞLİKLE yapılıyor: Welch
  ANOVA iki grupta Welch t-testine indirgenir (F = t², df2 aynı).
  Kendi formülümü kendi formülümle sınamamış oluyorum.
*/
export interface WelchAnovaSonucu {
  f: number;
  df1: number;
  /** Ondalıklı: Welch yaklaşımı. */
  df2: number;
  p: number;
  grupOrtalamalari: number[];
  grupNleri: number[];
}

export function welchAnova(gruplar: number[][]): WelchAnovaSonucu {
  const k = gruplar.length;
  const nler = gruplar.map((g) => g.length);
  const ortalamalar = gruplar.map((g) => mean(g));
  const varyanslar = gruplar.map((g) => variance(g));
  const agirliklar = gruplar.map((_, i) => nler[i] / varyanslar[i]);
  const agirlikToplami = agirliklar.reduce((a, b) => a + b, 0);
  const agirlikliOrtalama =
    agirliklar.reduce((s, w, i) => s + w * ortalamalar[i], 0) / agirlikToplami;

  const lambda = agirliklar.reduce(
    (s, w, i) => s + (1 - w / agirlikToplami) ** 2 / (nler[i] - 1),
    0,
  );
  const pay =
    agirliklar.reduce((s, w, i) => s + w * (ortalamalar[i] - agirlikliOrtalama) ** 2, 0) / (k - 1);
  const payda = 1 + ((2 * (k - 2)) / (k * k - 1)) * lambda;
  const f = pay / payda;
  const df1 = k - 1;
  const df2 = (k * k - 1) / (3 * lambda);
  const p = Number.isFinite(f) ? fTestP(f, df1, df2) : NaN;
  return { f, df1, df2, p, grupOrtalamalari: ortalamalar, grupNleri: nler };
}

/*
  WELCH ANOVA'nın ardından ikili karşılaştırma.

  bonferroniKarsilastirmalari ORTAK hata karesini (MSw) kullanıyor ve
  o da eşit varyans varsayıyor; varyanslar ayrıştığında kullanılamaz.
  Burada her çift kendi Welch t-testiyle karşılaştırılıyor, p'ler
  Bonferroni ile düzeltiliyor.

  GAMES-HOWELL DEĞİL, bilerek: o da studentized range (q) dağılımını
  istiyor ve elle yazılan bir q tablosundaki hata GÖRÜNMEZ olurdu —
  makul bir p çıkar, kimse fark etmez (Tukey HSD ve Shapiro-Wilk de
  aynı gerekçeyle yazılmadı). Welch + Bonferroni kapalı formüllü ve
  elle doğrulanabilir; temkinli taraftadır.
*/
export function welchBonferroniKarsilastirmalari(
  gruplar: number[][],
  adlar: string[],
): IkiliKarsilastirma[] {
  const ciftler: IkiliKarsilastirma[] = [];
  const karsilastirmaSayisi = (gruplar.length * (gruplar.length - 1)) / 2;
  for (let i = 0; i < gruplar.length; i += 1) {
    for (let j = i + 1; j < gruplar.length; j += 1) {
      const r = welchTTest(gruplar[i], gruplar[j]);
      const p = Number.isFinite(r.p) ? Math.min(1, r.p * karsilastirmaSayisi) : NaN;
      ciftler.push({
        a: adlar[i] ?? `Grup ${i + 1}`,
        b: adlar[j] ?? `Grup ${j + 1}`,
        ortalamaFarki: r.fark,
        t: r.t,
        pHam: r.p,
        p,
        anlamli: Number.isFinite(p) ? p < 0.05 : false,
      });
    }
  }
  return ciftler;
}
