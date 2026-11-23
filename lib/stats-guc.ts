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
  "grup-gecersiz": { tr: "Grup sayısı en az 2 olmalı.", en: "The number of groups must be at least 2." },
  "yordayici-gecersiz": { tr: "Yordayıcı sayısı en az 1 olmalı.", en: "The number of predictors must be at least 1." },
  "dagilim-gecersiz": { tr: "Dağılım oranı sıfırdan büyük olmalı.", en: "The allocation ratio must be greater than zero." },
  "kayip-gecersiz": { tr: "Beklenen kayıp oranı 0 ile 1 arasında olmalı (örneğin %10 için 0,10).", en: "The expected dropout rate must be between 0 and 1 (e.g. 0.10 for 10%)." },
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
 * İki değişkenli normalde örneklem korelasyonu r'nin TAM yoğunluğu
 * (Hotelling). Fisher z yaklaşıklığı yerine bu kullanılıyor.
 */
export function korelasyonYogunlugu(r: number, rho: number, n: number): number {
  if (!(n > 3) || Math.abs(r) >= 1) return 0;
  const sabit = ((n - 2) / Math.sqrt(2 * Math.PI)) * Math.exp(lgamma(n - 1) - lgamma(n - 0.5));
  return (
    sabit *
    Math.pow(1 - rho * rho, (n - 1) / 2) *
    Math.pow(1 - r * r, (n - 4) / 2) *
    Math.pow(1 - rho * r, -(n - 1.5)) *
    hipergeometrik2F1(0.5, 0.5, n - 0.5, (1 + rho * r) / 2)
  );
}

/* Yoğunluğun [a, b] aralığındaki Simpson integrali. */
function korelasyonAlani(a: number, b: number, rho: number, n: number, adim = 400): number {
  if (!(b > a)) return 0;
  const h = (b - a) / adim;
  let toplam = 0;
  for (let i = 0; i <= adim; i += 1) {
    const r = a + i * h;
    const w = i === 0 || i === adim ? 1 : i % 2 === 1 ? 4 : 2;
    toplam += w * korelasyonYogunlugu(r, rho, n);
  }
  return (toplam * h) / 3;
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
  return Math.min(1, Math.max(0, yon === "tek" ? ust : ust + korelasyonAlani(-1, -rc, r, n)));
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
  if (g.yontem === "tekYonluAnova" && (!Number.isFinite(g.grupSayisi ?? NaN) || (g.grupSayisi ?? 0) < 2)) return "grup-gecersiz";
  if (g.yontem === "regresyon" && (!Number.isFinite(g.yordayiciSayisi ?? NaN) || (g.yordayiciSayisi ?? 0) < 1)) return "yordayici-gecersiz";
  if (g.yontem === "bagimsizT" && g.dagilimOrani !== undefined && (!Number.isFinite(g.dagilimOrani) || g.dagilimOrani <= 0)) return "dagilim-gecersiz";
  const kayip = g.kayipOrani ?? 0;
  if (!Number.isFinite(kayip) || kayip < 0 || kayip >= 1) return "kayip-gecersiz";
  return null;
}

/* Bağımsız t'de toplam N, oranla ikiye bölünüyor: n1 = round(N/(1+κ)). */
function ikiGrup(N: number, oran: number): [number, number] {
  const n1 = Math.max(2, Math.round(N / (1 + oran)));
  const n2 = Math.max(2, N - n1);
  return [n1, n2];
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
        grupBasina: new Array<number>(k).fill(N / k),
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
function adimBoyu(g: GucGirdisi): number {
  return g.yontem === "tekYonluAnova" ? (g.grupSayisi ?? 2) : 1;
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
  const guc = (N: number) => gucHesapla(g, N).guc;
  /*
    ÖNCE ARALIK, SONRA İKİYE BÖLME. Doğrusal tarama her adımda bir güç
    hesabı demek ve korelasyonun tam dağılımı tarayıcıda pahalı.
    İkiye bölmeden sonra BİR AŞAĞI YÜRÜYÜŞ var: grup büyüklüğü
    yuvarlanırken güç yerel olarak tekdüze olmayabiliyor, en küçük N
    yine de bulunuyor.
  */
  if (guc(bas) >= g.hedefGuc) {
    const ayrintiBas = gucHesapla(g, bas);
    const kayipBas = g.kayipOrani ?? 0;
    return {
      engel: null, n: bas, grupBasina: ayrintiBas.grupBasina,
      birim: g.yontem === "eslestirilmisT" ? "katilimci" : "gozlem",
      ulasilanGuc: ayrintiBas.guc, birKucukGuc: null,
      baslangicN: kayipBas > 0 ? Math.ceil(bas / (1 - kayipBas)) : null,
      df1: ayrintiBas.df1, df2: ayrintiBas.df2, ncp: ayrintiBas.ncp, kritikDeger: ayrintiBas.kritik,
    };
  }
  let alt = bas;
  let ust = bas + adim;
  while (ust <= EN_COK_N && guc(ust) < g.hedefGuc) {
    alt = ust;
    ust = Math.min(EN_COK_N + adim, alt + Math.max(adim, (ust - bas) * 2));
  }
  if (ust > EN_COK_N) return { engel: "ulasilamiyor" };
  while (ust - alt > adim) {
    const orta = alt + Math.floor((ust - alt) / (2 * adim)) * adim;
    if (orta === alt) break;
    if (guc(orta) >= g.hedefGuc) ust = orta;
    else alt = orta;
  }
  let bulunan = ust;
  while (bulunan - adim >= bas && guc(bulunan - adim) >= g.hedefGuc) bulunan -= adim;
  const sonGuc = guc(bulunan);
  const oncekiGuc = bulunan - adim >= bas ? guc(bulunan - adim) : null;

  const ayrinti = gucHesapla(g, bulunan);
  const kayip = g.kayipOrani ?? 0;
  return {
    engel: null,
    n: bulunan,
    grupBasina: ayrinti.grupBasina,
    birim: g.yontem === "eslestirilmisT" ? "katilimci" : "gozlem",
    ulasilanGuc: sonGuc,
    birKucukGuc: oncekiGuc,
    baslangicN: kayip > 0 ? Math.ceil(bulunan / (1 - kayip)) : null,
    df1: ayrinti.df1,
    df2: ayrinti.df2,
    ncp: ayrinti.ncp,
    kritikDeger: ayrinti.kritik,
  };
}

/** Belirli bir örneklemde gücü verir (sınır senaryoları ve testler için). */
export function gucDegeri(g: GucGirdisi, N: number): number | GucEngeli {
  const engel = girdiDenetle(g);
  if (engel) return { engel };
  return gucHesapla(g, N).guc;
}
