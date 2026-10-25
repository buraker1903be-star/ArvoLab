import { sayiMetniBicimle, VARSAYILAN_BICIM, type SayiBicimi } from "@/lib/sayi-bicimi";

/**
 * İstatistik Sonuçlarını Rapor Biçimine Çevirme
 * ------------------------------------------------------------
 * Hesaplanmış (gerçek) istatistik değerlerini standart raporlama
 * biçimine çevirir.
 *
 * SAYININ YAZILIŞI KILAVUZDAN GELİR (25.10.2026). Baştaki sıfır ve
 * ondalık ayırıcı burada da APA'ya sabitti; oysa bu kurallar
 * üniversiteden üniversiteye değişiyor (lib/sayi-bicimi). Daha
 * kötüsü, SPSS yapıştırma aracı kılavuza uyarken bu motor APA'ya
 * sabitti: AYNI EKRANDA iki farklı biçim üretiliyordu. Yorum/sonuç ÜRETMEZ — yalnızca
 * anlamlılık eşiğini (p < .05) mekanik olarak işaretler.
 *
 * NaN KORUMASI. Bozuk değil, MATEMATİKSEL OLARAK TANIMSIZ girdiler
 * gerçek veride sık: bir grubun bütün değerleri aynıysa varyans sıfır,
 * t = 0/0 = NaN. Eskiden bu değer olduğu gibi biçimlendiriliyordu ve
 * öğrenci ekranda tam bir APA satırı görüyordu:
 *
 *     t(4) = NaN, p = NaN — istatistiksel olarak anlamlı değil
 *
 * İki ayrı yanlış vardı. Birincisi "NaN"ın tezе yapıştırılabilir bir
 * sonuç gibi görünmesi. İkincisi daha sinsi: isSignificant(NaN) false
 * döndüğü için ürün, HESAPLANAMAMIŞ bir testi "anlamlı değil" diye
 * RAPORLUYORDU — veri hakkında yanlış bir iddia.
 *
 * Saf modül; testi tests/unit/apa-format.test.ts.
 */

/** Sayı gerçekten raporlanabilir mi (NaN ve sonsuz değil). */
export const hesaplanabilir = (...degerler: number[]): boolean =>
  degerler.every((deger) => Number.isFinite(deger));

/** Hesaplanamayan değerin yerine yazılan işaret. */
export const HESAPLANAMADI = "—";

/* Biçim verilmezse APA geleneği — eski davranışın aynısı, yani bu
   değişiklik mevcut çağıranları bozmuyor. Çağıran biçimi vermeli. */
export function formatP(p: number, bicim: SayiBicimi = VARSAYILAN_BICIM): string {
  if (!Number.isFinite(p)) return HESAPLANAMADI;
  if (p < 0.001) return `p < ${sayiMetniBicimle("0.001", bicim, true)}`;
  return `p = ${sayiMetniBicimle(p.toFixed(3), bicim, true)}`;
}

/** Yalnızca GERÇEKTEN hesaplanmış ve eşiğin altındaki p anlamlıdır. */
export function isSignificant(p: number): boolean {
  return Number.isFinite(p) && p < 0.05;
}

/*
  `sinirliDeger` ±1 ile sınırlı değerler içindir (r, β, η²): baştaki
  sıfır kuralı yalnızca onlara uygulanır. "0.5 kg" gibi bir ölçümden
  sıfırı atmak yanlış olurdu.
*/
export function formatNumber(
  n: number,
  decimals = 2,
  bicim: SayiBicimi = VARSAYILAN_BICIM,
  sinirliDeger = false,
): string {
  if (!Number.isFinite(n)) return HESAPLANAMADI;
  return sayiMetniBicimle(n.toFixed(decimals), bicim, sinirliDeger);
}
