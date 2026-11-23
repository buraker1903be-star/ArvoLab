/*
  GÜÇ ve ÖRNEKLEM (a priori güç çözümlemesi) — 23.11.2026.

  Tezlerde etik kurul başvurusu ve öneri aşamasında "kaç kişi
  toplamalıyım?" sorusu soruluyor; ArvoLab bunu hiç yanıtlamıyordu ve
  öğrenci G*Power'a gidiyordu. Bu modül VERİ DOSYASI OLMADAN çalışır:
  girdi etki büyüklüğü, alfa, hedef güç ve desen bilgisidir.

  YÖNTEM. Güç, G*Power'ın da kullandığı merkezi olmayan (noncentral)
  dağılımlardan hesaplanıyor: t ailesinde noncentral t, F ailesinde
  noncentral F. Örneklem, hedef gücü karşılayan EN KÜÇÜK tam sayıdan
  bulunuyor (artan arama); yuvarlamadan sonra GERÇEKTEN ulaşılan güç
  ayrıca raporlanıyor, çünkü tam sayıya çıkarken güç hedefin üstüne
  çıkar ve "0,80 güç" demek yanıltıcı olur.

  G*POWER KARŞILIKLARI (kabul raporunda da yazılı):
    bagimsizT      t tests → Means: Difference between two independent
                   means (two groups); A priori; etki d
    eslestirilmisT t tests → Means: Difference between two dependent
                   means (matched pairs); A priori; etki dz
    tekYonluAnova  F tests → ANOVA: Fixed effects, omnibus, one-way;
                   A priori; etki f
    korelasyon     Exact → Correlation: Bivariate normal model;
                   A priori; etki r
    regresyon      F tests → Linear multiple regression: Fixed model,
                   R² deviation from zero; A priori; etki f²

  KORELASYONDA TAM DAĞILIM KULLANILIYOR, YAKLAŞIKLIK DEĞİL. Yaygın
  Fisher z yaklaşıklığı (R'deki `pwr::pwr.r.test`) bu modelde gücü
  biraz DÜŞÜK gösteriyor ve bir katılımcı fazla istiyor: r = .30,
  α = .05, çift yönlü, hedef .80 için Fisher z 85 derken tam dağılım
  84 diyor (Monte-Carlo ölçümü 84'te 0,7998 ± 0,0012). Bu yüzden
  r'nin TAM örnekleme yoğunluğu (Hotelling) sayısal olarak
  integre ediliyor — G*Power'ın "Exact" seçeneğiyle aynı model.

  TEK YÖNLÜ TEST SEÇENEĞİ YALNIZCA t AİLESİNDE. ANOVA ve regresyonun
  omnibus F testi doğası gereği tek kuyrukludur; oraya "yön" seçeneği
  koymak, olmayan bir ayarı varmış gibi göstermek olurdu.

  Saf modül; testi tests/unit/stats-guc.test.ts, bağımsız referans
  scripts/referans/guc-referans.R (R: pwr, stats) ve
  scripts/referans/guc-referans.py (Python: statsmodels, scipy).
*/
import type { Metin } from "@/lib/dil";
import { incompleteBeta, lgamma, tKritik, fTestP } from "@/lib/stats-math";
import { normalCDF } from "@/lib/stats-tukey";

/* ---------- Merkezi olmayan dağılımlar ---------- */

/*
  NONCENTRAL t'nin DAĞILIM FONKSİYONU. T' = (Z + δ)/√(V/ν), V ~ χ²_ν.
  s = √(V/ν) üzerinden sayısal integral: P(T' ≤ t) = ∫ Φ(t·s − δ) g(s) ds.
  Seri açılımı yerine integral seçildi; seri büyük δ'da terim kaybediyor,
  integralin hatası ise adım sayısıyla denetlenebiliyor.
*/
export function noncentralTCDF(t: number, df: number, ncp: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0 || !Number.isFinite(ncp)) return NaN;
  /* s'nin yoğunluğu: 2 ν^(ν/2) s^(ν−1) e^(−ν s²/2) / (2^(ν/2) Γ(ν/2)) */
  const logSabit = Math.LN2 + (df / 2) * Math.log(df) - (df / 2) * Math.LN2 - lgamma(df / 2);
  /*
    s = 0 NOKTASI SIFIRLANMAZ. df = 1'de yoğunluk orada sıfır değil
    (s^(df−1) = s^0 = 1); sıfır yazmak Simpson'ın uç terimini düşürüyor
    ve integral 1 yerine 0,9991 çıkıyordu — dağılım fonksiyonunda
    8,6e-4'lük sabit bir kayma demekti.
  */
  const g = (s: number) => {
    if (s < 0) return 0;
    if (s === 0) return df > 1 ? 0 : Math.exp(logSabit);
    return Math.exp(logSabit + (df - 1) * Math.log(s) - (df * s * s) / 2);
  };
  const sMax = Math.min(30, 1 + 14 / Math.sqrt(2 * df) + 2);
  const adim = 4000;
  const h = sMax / adim;
  let toplam = 0;
  for (let i = 0; i <= adim; i += 1) {
    const s = i * h;
    const agirlik = i === 0 || i === adim ? 1 : i % 2 === 1 ? 4 : 2;
    toplam += agirlik * normalCDF(t * s - ncp) * g(s);
  }
  const deger = (toplam * h) / 3;
  return Math.min(1, Math.max(0, deger));
}

/*
  NONCENTRAL F'nin DAĞILIM FONKSİYONU: merkezi F'lerin Poisson ağırlıklı
  karışımı. P(F' ≤ x) = Σ_j e^(−λ/2)(λ/2)^j/j! · I_y(df1/2 + j, df2/2).
  Terimler λ/2 çevresinde yoğunlaşıyor; toplam 1'e yeterince yaklaşınca
  kesiliyor.
*/
export function noncentralFCDF(x: number, df1: number, df2: number, lambda: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (!Number.isFinite(df1) || !Number.isFinite(df2) || df1 <= 0 || df2 <= 0 || !Number.isFinite(lambda) || lambda < 0) return NaN;
  const y = (df1 * x) / (df1 * x + df2);
  const yari = lambda / 2;
  const enCok = Math.max(200, Math.ceil(yari + 12 * Math.sqrt(yari) + 40));
  let toplam = 0;
  let agirlikToplam = 0;
  for (let j = 0; j <= enCok; j += 1) {
    const logAgirlik = -yari + j * Math.log(Math.max(yari, Number.MIN_VALUE)) - lgamma(j + 1);
    const agirlik = yari === 0 ? (j === 0 ? 1 : 0) : Math.exp(logAgirlik);
    if (agirlik > 0) {
      toplam += agirlik * incompleteBeta(y, df1 / 2 + j, df2 / 2);
      agirlikToplam += agirlik;
    }
    if (agirlikToplam > 1 - 1e-13 && j > yari) break;
  }
  return Math.min(1, Math.max(0, toplam));
}

/** F dağılımının üst kuyruk kritik değeri (ikiye bölme; fTestP monoton azalan). */
export function fKritik(df1: number, df2: number, alfa: number): number {
  let alt = 0;
  let ust = 1e6;
  for (let i = 0; i < 200; i += 1) {
    const orta = (alt + ust) / 2;
    if (fTestP(orta, df1, df2) > alfa) alt = orta;
    else ust = orta;
  }
  return (alt + ust) / 2;
}

/** Standart normalin üst kuyruk kritik değeri: P(Z > z) = p. */
export function zKritik(p: number): number {
  let alt = -40;
  let ust = 40;
  for (let i = 0; i < 200; i += 1) {
    const orta = (alt + ust) / 2;
    if (1 - normalCDF(orta) > p) alt = orta;
    else ust = orta;
  }
  return (alt + ust) / 2;
}

/* ---------- Girdi ve çıktı ---------- */

export type GucYontemi = "bagimsizT" | "eslestirilmisT" | "tekYonluAnova" | "korelasyon" | "regresyon";
export type TestYonu = "iki" | "tek";

export type GucEngel =
  | "etki-gecersiz"
  | "alfa-gecersiz"
  | "guc-gecersiz"
  | "grup-gecersiz"
  | "yordayici-gecersiz"
  | "dagilim-gecersiz"
  | "kayip-gecersiz"
  | "sayisal-hata"
  | "ulasilamiyor";

export interface GucGirdisi {
  yontem: GucYontemi;
  /** d, dz, f, r ya da f² — yönteme göre. */
  etki: number;
  alfa: number;
  hedefGuc: number;
  /** Yalnızca t ailesinde; F ailesinde yok sayılır. */
  yon?: TestYonu;
  /** Tek yönlü ANOVA'da grup sayısı. */
  grupSayisi?: number;
  /** Bağımsız t'de dağılım oranı n2/n1. */
  dagilimOrani?: number;
  /** Çoklu regresyonda yordayıcı sayısı. */
  yordayiciSayisi?: number;
  /** Beklenen kayıp oranı (0 ≤ x < 1). */
  kayipOrani?: number;
}

export interface GucSonucu {
  engel: null;
  /** Analize gereken en düşük TOPLAM örneklem. */
  n: number;
  /** Grup başına sayı (bağımsız t ve ANOVA); yoksa null. */
  grupBasina: number[] | null;
  /** Eşleştirilmiş testte örneklem KATILIMCI sayısıdır. */
  birim: "katilimci" | "gozlem";
  /** Yuvarlamadan sonra gerçekten ulaşılan güç. */
  ulasilanGuc: number;
  /** Bir küçük örneklemde güç (hedefin altında kaldığı görülsün); yoksa null. */
  birKucukGuc: number | null;
  /**
   * Arama adımı: bir önceki GEÇERLİ aday N − adim'dir. Ekran bu sayıyı
   * kendi hesaplamıyor — eşit dağılımda adım 2, ANOVA'da grup sayısı.
   */
  adim: number;
  /** Kayıp payı eklenmiş, başlangıçta alınması gereken sayı; kayıp yoksa null. */
  baslangicN: number | null;
  df1: number | null;
  df2: number;
  /** Merkezi olmayan parametre (t'de δ, F'te λ). */
  ncp: number;
  kritikDeger: number;
}

export interface GucEngeli {
  engel: GucEngel;
}

export const GUC_ENGEL_METNI: Record<GucEngel, Metin> = {
  "etki-gecersiz": {
    tr: "Etki büyüklüğü sıfırdan büyük bir sayı olmalı (korelasyonda 1'den küçük).",
    en: "The effect size must be a number greater than zero (and below 1 for a correlation).",
  },
  "alfa-gecersiz": { tr: "Alfa 0 ile 1 arasında olmalı (yaygın değer 0,05).", en: "Alpha must be between 0 and 1 (commonly .05)." },
  "guc-gecersiz": { tr: "Hedef güç 0 ile 1 arasında olmalı (yaygın değer 0,80).", en: "The target power must be between 0 and 1 (commonly .80)." },
  "grup-gecersiz": { tr: "Grup sayısı en az 2 olmalı ve tam sayı olmalı.", en: "The number of groups must be a whole number and at least 2." },
  "yordayici-gecersiz": { tr: "Yordayıcı sayısı en az 1 olmalı ve tam sayı olmalı.", en: "The number of predictors must be a whole number and at least 1." },
  "dagilim-gecersiz": { tr: "Dağılım oranı sıfırdan büyük olmalı.", en: "The allocation ratio must be greater than zero." },
  "kayip-gecersiz": { tr: "Beklenen kayıp oranı 0 ile 1 arasında olmalı (örneğin %10 için 0,10).", en: "The expected dropout rate must be between 0 and 1 (e.g. 0.10 for 10%)." },
  /*
    SAYISAL HATA, "ULAŞILAMIYOR"DAN AYRI. İkisi farklı şeyler:
    biri "bu kadar kişiyle olmaz", öteki "hesabı yapamadım".
    Aynı mesaja koymak, hesap hatasını kullanıcıya bir ARAŞTIRMA
    sonucu gibi gösterirdi.
  */
  "sayisal-hata": {
    tr: "Güç bu değerlerde sayısal olarak hesaplanamadı. Etki büyüklüğünü ya da hedef gücü biraz değiştirip yeniden deneyin; sorun sürerse bildirin.",
    en: "The power could not be computed numerically for these values. Try adjusting the effect size or the target power slightly; if it persists, please report it.",
  },
  ulasilamiyor: {
    tr: "Bu etki büyüklüğü ve hedef güç makul bir örneklemle (en çok 100.000) karşılanmıyor. Etki büyüklüğünü ya da hedef gücü gözden geçirin.",
    en: "This effect size and target power cannot be met with a reasonable sample (up to 100,000). Review the effect size or the target power.",
  },
};

/** Arama üst sınırı: bunun üstü tezlerde uygulanabilir bir örneklem değil. */
export const EN_COK_N = 100000;

/* ---------- Yöntem başına güç ---------- */

/** İki bağımsız grup t-testi; n1, n2 grup büyüklükleri, d Cohen d. */
export function gucBagimsizT(n1: number, n2: number, d: number, alfa: number, yon: TestYonu): number {
  const df = n1 + n2 - 2;
  if (df < 1) return 0;
  const ncp = d * Math.sqrt((n1 * n2) / (n1 + n2));
  if (yon === "tek") {
    const tc = tKritik(df, 1 - 2 * alfa);
    return 1 - noncentralTCDF(tc, df, ncp);
  }
  const tc = tKritik(df, 1 - alfa);
  /* İki kuyruk da sayılıyor (G*Power böyle yapar); ters kuyruk küçük ama atılmıyor. */
  return 1 - noncentralTCDF(tc, df, ncp) + noncentralTCDF(-tc, df, ncp);
}

/** Eşleştirilmiş t-testi; n ÇİFT (katılımcı) sayısı, dz fark puanının etki büyüklüğü. */
export function gucEslestirilmisT(n: number, dz: number, alfa: number, yon: TestYonu): number {
  const df = n - 1;
  if (df < 1) return 0;
  const ncp = dz * Math.sqrt(n);
  if (yon === "tek") {
    const tc = tKritik(df, 1 - 2 * alfa);
    return 1 - noncentralTCDF(tc, df, ncp);
  }
  const tc = tKritik(df, 1 - alfa);
  return 1 - noncentralTCDF(tc, df, ncp) + noncentralTCDF(-tc, df, ncp);
}

/** Eşit gruplu tek yönlü ANOVA; N toplam, k grup sayısı, f Cohen f. */
export function gucTekYonluAnova(N: number, k: number, f: number, alfa: number): number {
  const df1 = k - 1;
  const df2 = N - k;
  if (df2 < 1) return 0;
  const lambda = f * f * N;
  return 1 - noncentralFCDF(fKritik(df1, df2, alfa), df1, df2, lambda);
}

/*
  GAUSS HİPERGEOMETRİK FONKSİYONU 2F1(a,b;c;z), |z| < 1 için seri.
  r'nin tam yoğunluğunda geçiyor; terim oranı z'ye yakınsadığı için
  seri geometrik hızda kapanıyor.
*/
function hipergeometrik2F1(a: number, b: number, c: number, z: number): number {
  let terim = 1;
  let toplam = 1;
  for (let k = 0; k < 6000; k += 1) {
    terim *= ((a + k) * (b + k)) / ((c + k) * (1 + k)) * z;
    toplam += terim;
    if (Math.abs(terim) < 1e-16 * Math.abs(toplam)) break;
  }
  return toplam;
}

/**
 * r'nin TAM yoğunluğunun LOGARİTMASI (Hotelling).
 *
 * ÜSLER LOG UZAYINDA TOPLANIYOR. Eskiden üç `Math.pow` ayrı ayrı
 * alınıp çarpılıyordu; büyük N'de (1 − r²)^((n−4)/2) sıfıra iniyor,
 * (1 − ρr)^(−(n−1,5)) sonsuza çıkıyor ve çarpım 0 × ∞ = NaN oluyordu.
 * ρ = 0,01 ile N = 78.500'de güç NaN dönüyor, arama bunu sayı sanıp
 * "güç hesaplanamadı" demek yerine bir örneklem bildiriyordu.
 * 1'e yakın tabanlarda `log1p` kullanılıyor: log(1 − x) doğrudan
 * hesaplanınca küçük x'te anlamlı basamak kaybediyor.
 */
export function korelasyonLogYogunlugu(r: number, rho: number, n: number): number {
  if (!(n > 4) || Math.abs(r) >= 1 || Math.abs(rho) >= 1) return -Infinity;
  const f = hipergeometrik2F1(0.5, 0.5, n - 0.5, (1 + rho * r) / 2);
  if (!(f > 0) || !Number.isFinite(f)) return NaN;
  return (
    Math.log(n - 2) -
    0.5 * Math.log(2 * Math.PI) +
    lgamma(n - 1) -
    lgamma(n - 0.5) +
    ((n - 1) / 2) * Math.log1p(-rho * rho) +
    ((n - 4) / 2) * Math.log1p(-r * r) -
    (n - 1.5) * Math.log1p(-rho * r) +
    Math.log(f)
  );
}

/** Yoğunluğun kendisi; toplam TEK SEFERDE üsse çevriliyor. */
export function korelasyonYogunlugu(r: number, rho: number, n: number): number {
  const l = korelasyonLogYogunlugu(r, rho, n);
  if (Number.isNaN(l)) return NaN;
  return l === -Infinity ? 0 : Math.exp(l);
}

/* Bir alt aralığın Simpson integrali; yoğunluk sonlu değilse NaN. */
function simpsonParca(a: number, b: number, rho: number, n: number, adim: number): number {
  if (!(b > a)) return 0;
  const h = (b - a) / adim;
  let toplam = 0;
  for (let i = 0; i <= adim; i += 1) {
    const r = a + i * h;
    const w = i === 0 || i === adim ? 1 : i % 2 === 1 ? 4 : 2;
    const y = korelasyonYogunlugu(r, rho, n);
    if (!Number.isFinite(y)) return NaN;
    toplam += w * y;
  }
  return (toplam * h) / 3;
}

/*
  ±1 UCUNA DEĞEN PARÇADA DEĞİŞKEN DÖNÜŞÜMÜ. Yoğunlukta
  (1 − r²)^((n−4)/2) var; küçük örneklemde (n = 5 → üs 1/2) bu, r → ±1'de
  türevi sonsuz olan bir karekök. Düz Simpson orada yavaş yakınsıyor:
  n = 5, ρ = 0,99'da 2.000 aralıkla hata 2,0e-4 kalıyordu. r = 1 − u²
  (ya da r = −1 + u²) koyunca Jacobian 2u, karekökü sadeleştiriyor ve
  integral 200 aralıkta bile 12 basamak oturuyor.
*/
function ucParcasi(ic: number, uc: 1 | -1, rho: number, n: number, adim: number): number {
  const U = Math.sqrt(uc === 1 ? 1 - ic : ic + 1);
  if (!(U > 0)) return 0;
  const h = U / adim;
  let toplam = 0;
  for (let i = 0; i <= adim; i += 1) {
    const u = i * h;
    const r = uc === 1 ? 1 - u * u : -1 + u * u;
    const w = i === 0 || i === adim ? 1 : i % 2 === 1 ? 4 : 2;
    const y = korelasyonYogunlugu(r, rho, n) * 2 * u;
    if (!Number.isFinite(y)) return NaN;
    toplam += w * y;
  }
  return (toplam * h) / 3;
}

/*
  Yoğunluğun [a, b] aralığındaki integrali.

  BÜTÜN ARALIK İNTEGRE EDİLİYOR; TEPE PENCERESİ YALNIZCA ÇÖZÜNÜRLÜĞÜ
  YÖNLENDİRİYOR. Büyük N'de yoğunluk ρ çevresinde daraldığı için sabit
  ızgara tepeyi kaçırıyordu; bunun için ρ ± 16σ penceresi eklenmişti
  (σ ≈ (1 − ρ²)/√n). Ama o pencereyle SINIRLI kalmak, asimptotik σ'nın
  yayılımı olduğundan dar gösterdiği yerlerde olasılık ATIYORDU:
  ρ = 0,99 ve n = 5'te ret bölgesi [0,805, 1] iken pencere [0,848, 1]
  kalıyor, 0,0025'lik olasılık düşüyor ve güç 0,99604 yerine 0,99356
  çıkıyordu — hedef 0,995 olduğunda arama N = 5 yerine N = 6 diyordu.
  Artık aralık üçe bölünüyor: tepe sık ızgarayla, iki yanı kendi
  ızgaralarıyla; ±1'e değen parça dönüşümle. Kapsam tam, çözünürlük
  tepede ve uçta.
*/
function korelasyonAlani(a: number, b: number, rho: number, n: number): number {
  if (!(b > a)) return 0;
  const sigma = Math.max((1 - rho * rho) / Math.sqrt(Math.max(n, 5)), 1e-9);
  const tepeAlt = Math.min(Math.max(a, rho - 16 * sigma), b);
  const tepeUst = Math.max(Math.min(b, rho + 16 * sigma), a);
  const parca = (x: number, y: number, adim: number) => {
    if (!(y > x)) return 0;
    if (y === 1) return ucParcasi(x, 1, rho, n, adim);
    if (x === -1) return ucParcasi(y, -1, rho, n, adim);
    return simpsonParca(x, y, rho, n, adim);
  };
  return parca(a, tepeAlt, 1000) + parca(tepeAlt, tepeUst, 2000) + parca(tepeUst, b, 1000);
}

/**
 * Pearson korelasyonu — G*Power'ın "Exact: Bivariate normal model"i.
 * Test ölçütü |r| > r_kritik; r_kritik, t sınavının kritik değerinden
 * geliyor (t = r√(n−2)/√(1−r²)).
 */
export function gucKorelasyon(n: number, r: number, alfa: number, yon: TestYonu): number {
  if (n < 5) return 0;
  const tc = tKritik(n - 2, yon === "tek" ? 1 - 2 * alfa : 1 - alfa);
  const rc = tc / Math.sqrt(tc * tc + n - 2);
  const ust = korelasyonAlani(rc, 1, r, n);
  const toplam = yon === "tek" ? ust : ust + korelasyonAlani(-1, -rc, r, n);
  if (!Number.isFinite(toplam)) return NaN;
  return Math.min(1, Math.max(0, toplam));
}

/** Çoklu doğrusal regresyonun omnibus F testi (R² sıfırdan farklı mı); f² Cohen f². */
export function gucRegresyon(N: number, yordayici: number, f2: number, alfa: number): number {
  const df1 = yordayici;
  const df2 = N - yordayici - 1;
  if (df2 < 1) return 0;
  const lambda = f2 * N;
  return 1 - noncentralFCDF(fKritik(df1, df2, alfa), df1, df2, lambda);
}

/* ---------- Örneklem araması ---------- */

function girdiDenetle(g: GucGirdisi): GucEngel | null {
  if (!Number.isFinite(g.etki) || g.etki <= 0) return "etki-gecersiz";
  if (g.yontem === "korelasyon" && g.etki >= 1) return "etki-gecersiz";
  if (!Number.isFinite(g.alfa) || g.alfa <= 0 || g.alfa >= 1) return "alfa-gecersiz";
  if (!Number.isFinite(g.hedefGuc) || g.hedefGuc <= 0 || g.hedefGuc >= 1) return "guc-gecersiz";
  /*
    GRUP ve YORDAYICI SAYISI TAM SAYI OLMALI. 2,5 grup diye bir şey
    yok; üstelik `new Array(2.5)` RangeError atıyordu ve hesap
    katmanı kullanıcıya sebep yerine çökme veriyordu.
  */
  if (g.yontem === "tekYonluAnova" && (!Number.isInteger(g.grupSayisi ?? NaN) || (g.grupSayisi ?? 0) < 2)) return "grup-gecersiz";
  if (g.yontem === "regresyon" && (!Number.isInteger(g.yordayiciSayisi ?? NaN) || (g.yordayiciSayisi ?? 0) < 1)) return "yordayici-gecersiz";
  if (g.yontem === "bagimsizT" && g.dagilimOrani !== undefined && (!Number.isFinite(g.dagilimOrani) || g.dagilimOrani <= 0)) return "dagilim-gecersiz";
  const kayip = g.kayipOrani ?? 0;
  if (!Number.isFinite(kayip) || kayip < 0 || kayip >= 1) return "kayip-gecersiz";
  return null;
}

/*
  BAĞIMSIZ t'DE TOPLAM N'İN İKİYE BÖLÜNMESİ.

  YUVARLAMA KURALI: n1 = round(N / (1 + κ)), sonra [2, N − 2] aralığına
  sıkıştırılıyor; n2 = N − n1. Yani ikinci grup ARTIK, birinciden
  hesaplanmıyor: n1 + n2 HER ZAMAN N. Eskiden n2 ayrıca `max(2, …)`
  ile büyütülüyordu ve uç oranlarda (κ çok küçük ya da çok büyük)
  toplam, aranan N'yi AŞIYORDU: ekranda "128" yazarken gruplar
  126 + 2 = 128 değil 126 + 2'den başka bir toplam veriyordu.
  JavaScript'in `Math.round` kuralı yarımı yukarı atar (0,5 → 1), bu
  yüzden κ = 1 ve tek N'de birinci grup bir kişi büyük olurdu —
  eşit dağılımda arama adımı 2 olduğu için o durum hiç oluşmuyor.
*/
function ikiGrup(N: number, oran: number): [number, number] {
  const ham = Math.round(N / (1 + oran));
  const n1 = Math.min(Math.max(2, ham), N - 2);
  return [n1, N - n1];
}

/** Verilen örneklemde gücü hesaplar; arama ve rapor aynı fonksiyonu kullanır. */
function gucHesapla(g: GucGirdisi, N: number): { guc: number; grupBasina: number[] | null; df1: number | null; df2: number; ncp: number; kritik: number } {
  const yon: TestYonu = g.yon ?? "iki";
  switch (g.yontem) {
    case "bagimsizT": {
      const [n1, n2] = ikiGrup(N, g.dagilimOrani ?? 1);
      const df = n1 + n2 - 2;
      return {
        guc: gucBagimsizT(n1, n2, g.etki, g.alfa, yon),
        grupBasina: [n1, n2],
        df1: null,
        df2: df,
        ncp: g.etki * Math.sqrt((n1 * n2) / (n1 + n2)),
        kritik: tKritik(Math.max(df, 1), yon === "tek" ? 1 - 2 * g.alfa : 1 - g.alfa),
      };
    }
    case "eslestirilmisT":
      return {
        guc: gucEslestirilmisT(N, g.etki, g.alfa, yon),
        grupBasina: null,
        df1: null,
        df2: N - 1,
        ncp: g.etki * Math.sqrt(N),
        kritik: tKritik(Math.max(N - 1, 1), yon === "tek" ? 1 - 2 * g.alfa : 1 - g.alfa),
      };
    case "tekYonluAnova": {
      const k = g.grupSayisi ?? 2;
      return {
        guc: gucTekYonluAnova(N, k, g.etki, g.alfa),
        /* k tam sayı (girdiDenetle) ve N, k'nin katı (adimBoyu): bölme tam. */
        grupBasina: new Array<number>(k).fill(Math.round(N / k)),
        df1: k - 1,
        df2: N - k,
        ncp: g.etki * g.etki * N,
        kritik: fKritik(k - 1, Math.max(N - k, 1), g.alfa),
      };
    }
    case "korelasyon":
      return {
        guc: gucKorelasyon(N, g.etki, g.alfa, yon),
        grupBasina: null,
        df1: null,
        df2: N - 2,
        /* Tam dağılımda merkezi olmayan parametre yok; raporda kritik r duruyor. */
        ncp: NaN,
        kritik: (() => {
          const tc = tKritik(Math.max(N - 2, 1), yon === "tek" ? 1 - 2 * g.alfa : 1 - g.alfa);
          return tc / Math.sqrt(tc * tc + N - 2);
        })(),
      };
    case "regresyon": {
      const p = g.yordayiciSayisi ?? 1;
      return {
        guc: gucRegresyon(N, p, g.etki, g.alfa),
        grupBasina: null,
        df1: p,
        df2: N - p - 1,
        ncp: g.etki * N,
        kritik: fKritik(p, Math.max(N - p - 1, 1), g.alfa),
      };
    }
  }
}

/** Yöntemin gerektirdiği en küçük örneklem (arama buradan başlar). */
function enKucukBaslangic(g: GucGirdisi): number {
  switch (g.yontem) {
    case "bagimsizT":
      return 4;
    case "eslestirilmisT":
      return 3;
    case "tekYonluAnova":
      return (g.grupSayisi ?? 2) * 2;
    case "korelasyon":
      return 5;
    case "regresyon":
      return (g.yordayiciSayisi ?? 1) + 2;
  }
}

/** ANOVA'da eşit grup: toplam N grup sayısının katı olmalı. */
/*
  ARAMA ADIMI. ANOVA'da eşit grup istendiği için toplam N grup
  sayısının katı olmalı. Bağımsız t'de dağılım oranı 1 ise adım 2:
  aksi hâlde 128'in (64 + 64) bir önceki adayı 127 (64 + 63) olurdu
  ve "eşit dağılım" dediğimiz yerde dengesiz bir aday gösterirdik.
  Oran 1 değilken zaten dengeli bir bölme aranmıyor, adım 1.
*/
function adimBoyu(g: GucGirdisi): number {
  if (g.yontem === "tekYonluAnova") return g.grupSayisi ?? 2;
  if (g.yontem === "bagimsizT" && (g.dagilimOrani ?? 1) === 1) return 2;
  return 1;
}

/**
 * Hedef gücü karşılayan EN KÜÇÜK örneklem ve o örneklemde gerçekten
 * ulaşılan güç. Bir küçük adımdaki güç de dönüyor: hedefin altında
 * kaldığı görülebilsin.
 */
export function ornekemBuyuklugu(g: GucGirdisi): GucSonucu | GucEngeli {
  const engel = girdiDenetle(g);
  if (engel) return { engel };

  const adim = adimBoyu(g);
  const bas = Math.ceil(enKucukBaslangic(g) / adim) * adim;
  /*
    HER GÜÇ DEĞERLENDİRMESİNDE SONLULUK DOĞRULANIYOR. Sonlu olmayan bir
    değer karşılaştırmalarda sessizce "hedefi karşılamadı" gibi
    davranıyor ve arama yanlış yere gidiyordu; ρ = 0,01'de N = 100.000
    bildiriliyor ama gücü NaN oluyordu.
  */
  let sayisalHata = false;
  const guc = (N: number) => {
    const v = gucHesapla(g, N).guc;
    if (!Number.isFinite(v)) {
      sayisalHata = true;
      return NaN;
    }
    return v;
  };
  const kayip = g.kayipOrani ?? 0;
  const sonucUret = (N: number, oncekiGuc: number | null): GucSonucu => {
    const a = gucHesapla(g, N);
    return {
      engel: null,
      n: N,
      grupBasina: a.grupBasina,
      birim: g.yontem === "eslestirilmisT" ? "katilimci" : "gozlem",
      ulasilanGuc: a.guc,
      birKucukGuc: oncekiGuc,
      adim,
      baslangicN: kayip > 0 ? Math.ceil(N / (1 - kayip)) : null,
      df1: a.df1,
      df2: a.df2,
      ncp: a.ncp,
      kritikDeger: a.kritik,
    };
  };

  const basGuc = guc(bas);
  if (sayisalHata) return { engel: "sayisal-hata" };
  if (basGuc >= g.hedefGuc) return sonucUret(bas, null);

  /*
    ÜST SINIRDAKİ GEÇERLİ ÖRNEKLEM ATLANMIYOR. Aralığı ikiye katlayarak
    genişletirken sonraki adım EN_COK_N'i aşınca doğrudan
    "ulaşılamıyor" dönülüyordu; oysa sınırın ALTINDA kalan son geçerli
    aday hedefi karşılıyor olabilirdi. Önce o aday sınanıyor.
  */
  const enBuyuk = bas + Math.floor((EN_COK_N - bas) / adim) * adim;
  if (enBuyuk < bas) return { engel: "ulasilamiyor" };
  const enBuyukGuc = guc(enBuyuk);
  if (sayisalHata) return { engel: "sayisal-hata" };
  /* "Ulaşılamıyor" yalnızca HESAPLANABİLEN son aday gerçekten hedefin altındaysa. */
  if (enBuyukGuc < g.hedefGuc) return { engel: "ulasilamiyor" };

  let alt = bas;
  let ust = enBuyuk;
  /* Önce dar bir aralık: büyük N'de güç hesabı pahalı. */
  for (let deneme = bas + adim; deneme < enBuyuk; deneme = alt + Math.max(adim, (deneme - bas) * 2)) {
    if (guc(deneme) >= g.hedefGuc) {
      ust = deneme;
      break;
    }
    alt = deneme;
  }
  if (sayisalHata) return { engel: "sayisal-hata" };
  while (ust - alt > adim) {
    const orta = alt + Math.floor((ust - alt) / (2 * adim)) * adim;
    if (orta === alt) break;
    if (guc(orta) >= g.hedefGuc) ust = orta;
    else alt = orta;
    if (sayisalHata) return { engel: "sayisal-hata" };
  }
  /* Yerel tekdüze olmama payı: en küçüğü bulana kadar aşağı yürü. */
  let bulunan = ust;
  while (bulunan - adim >= bas && guc(bulunan - adim) >= g.hedefGuc) bulunan -= adim;

  /*
    SONUÇ DÖNMEDEN ÖNCE SÖZLEŞME DOĞRULANIYOR: bulunan aday hedefi
    GERÇEKTEN karşılamalı ve bir önceki GEÇERLİ aday hedefin altında
    kalmalı. Arama bir gün bozulursa sessiz yanlış sayı yerine
    "ulaşılamıyor" dönmesi yeğdir.
  */
  while (bulunan <= enBuyuk && guc(bulunan) < g.hedefGuc) bulunan += adim;
  if (sayisalHata) return { engel: "sayisal-hata" };
  if (bulunan > enBuyuk) return { engel: "ulasilamiyor" };
  const oncekiGuc = bulunan - adim >= bas ? guc(bulunan - adim) : null;
  if (sayisalHata) return { engel: "sayisal-hata" };
  if (oncekiGuc !== null && oncekiGuc >= g.hedefGuc) return { engel: "ulasilamiyor" };
  const son = sonucUret(bulunan, oncekiGuc);
  if (!Number.isFinite(son.ulasilanGuc)) return { engel: "sayisal-hata" };
  return son;
}

/** Belirli bir örneklemde gücü verir (sınır senaryoları ve testler için). */
export function gucDegeri(g: GucGirdisi, N: number): number | GucEngeli {
  const engel = girdiDenetle(g);
  if (engel) return { engel };
  const v = gucHesapla(g, N).guc;
  return Number.isFinite(v) ? v : { engel: "sayisal-hata" };
}
