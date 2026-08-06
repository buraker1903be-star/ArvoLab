/**
 * SPSS Çıktısı → APA 7 Biçimlendirme Yardımcısı
 * ------------------------------------------------------------
 * Kullanıcının SPSS'ten kopyaladığı, ZATEN HESAPLANMIŞ istatistik
 * değerlerini (t, F, r, χ², p vb.) tanır ve APA 7 raporlama
 * biçimine çevirir. Yeni bir analiz YAPMAZ, yorum/sonuç ÜRETMEZ;
 * yalnızca sayısal değerleri standart akademik biçime dönüştürür
 * ve anlamlılık eşiğini (p < .05) mekanik olarak işaretler.
 */

export interface DetectedStatistic {
  raw: string;
  type: "t-test" | "anova" | "correlation" | "chi-square" | "regression" | "unknown";
  apaSentenceFragment: string;
  significant: boolean | null; // p değeri bulunamadıysa null
}

function formatP(pValue: number): string {
  if (pValue < 0.001) return "p < .001";
  const trimmed = pValue.toFixed(3).replace(/^0\./, ".");
  return `p = ${trimmed}`;
}

function isSignificant(pValue: number): boolean {
  return pValue < 0.05;
}

// t(28) = 2.45, p = .021  |  t = 2.45, df = 28, p = .021
const T_TEST_RE =
  /t\s*\(?\s*(\d+(?:[.,]\d+)?)\s*\)?\s*=\s*(-?\d+[.,]\d+)[,;]?\s*p\s*[=<]\s*([.,]?\d+[.,]?\d*)/gi;

// F(2, 57) = 4.31, p = .018
const ANOVA_RE =
  /F\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*=\s*(\d+[.,]\d+)[,;]?\s*p\s*[=<]\s*([.,]?\d+[.,]?\d*)/gi;

// r = .42, p = .003   |   r(48) = .42, p = .003
const CORRELATION_RE =
  /r\s*\(?\s*(\d*)\s*\)?\s*=\s*(-?[.,]\d+)[,;]?\s*p\s*[=<]\s*([.,]?\d+[.,]?\d*)/gi;

// χ2(1, N=120) = 6.14, p = .013  |  chi-square(1) = 6.14, p = .013
const CHI_SQUARE_RE =
  /(?:χ2|χ²|chi-square)\s*\(\s*(\d+)\s*(?:,\s*N\s*=\s*(\d+))?\s*\)\s*=\s*(\d+[.,]\d+)[,;]?\s*p\s*[=<]\s*([.,]?\d+[.,]?\d*)/gi;

function parseNumber(raw: string): number {
  return parseFloat(raw.replace(",", "."));
}

export function detectStatistics(rawText: string): DetectedStatistic[] {
  const results: DetectedStatistic[] = [];

  let m: RegExpExecArray | null;

  const tRe = new RegExp(T_TEST_RE);
  while ((m = tRe.exec(rawText)) !== null) {
    const df = m[1];
    const tValue = parseNumber(m[2]);
    const pValue = parseNumber(m[3]);
    const sig = isSignificant(pValue);
    results.push({
      raw: m[0],
      type: "t-test",
      significant: sig,
      apaSentenceFragment: `t(${df}) = ${tValue.toFixed(2)}, ${formatP(pValue)}${
        sig ? "" : " (istatistiksel olarak anlamlı değil)"
      }`,
    });
  }

  const fRe = new RegExp(ANOVA_RE);
  while ((m = fRe.exec(rawText)) !== null) {
    const df1 = m[1];
    const df2 = m[2];
    const fValue = parseNumber(m[3]);
    const pValue = parseNumber(m[4]);
    const sig = isSignificant(pValue);
    results.push({
      raw: m[0],
      type: "anova",
      significant: sig,
      apaSentenceFragment: `F(${df1}, ${df2}) = ${fValue.toFixed(2)}, ${formatP(pValue)}${
        sig ? "" : " (istatistiksel olarak anlamlı değil)"
      }`,
    });
  }

  const rRe = new RegExp(CORRELATION_RE);
  while ((m = rRe.exec(rawText)) !== null) {
    const df = m[1];
    const rValue = parseNumber(m[2]);
    const pValue = parseNumber(m[3]);
    const sig = isSignificant(pValue);
    results.push({
      raw: m[0],
      type: "correlation",
      significant: sig,
      apaSentenceFragment: `r${df ? `(${df})` : ""} = ${rValue.toFixed(2)}, ${formatP(pValue)}${
        sig ? "" : " (istatistiksel olarak anlamlı değil)"
      }`,
    });
  }

  const chiRe = new RegExp(CHI_SQUARE_RE);
  while ((m = chiRe.exec(rawText)) !== null) {
    const df = m[1];
    const n = m[2];
    const chiValue = parseNumber(m[3]);
    const pValue = parseNumber(m[4]);
    const sig = isSignificant(pValue);
    results.push({
      raw: m[0],
      type: "chi-square",
      significant: sig,
      apaSentenceFragment: `χ²(${df}${n ? `, N = ${n}` : ""}) = ${chiValue.toFixed(2)}, ${formatP(pValue)}${
        sig ? "" : " (istatistiksel olarak anlamlı değil)"
      }`,
    });
  }

  return results;
}
