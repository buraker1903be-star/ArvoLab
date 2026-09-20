/*
  Asistanın uydurma sayı üretmediğini kodla doğrular. Saf modül; testi
  tests/unit/ai-sayi-denetimi.test.ts.

  Dil modelleri akıcı ama uydurur: istemediğiniz yerde "p = .03" ya da
  "%68'i" gibi olmayan bir değer yazabilir. Akademik bir metinde uydurma
  sayı, yanlış cümleden daha ağır bir hatadır. Bu yüzden asistanın çıktısında
  geçen her sayı, kullanıcının verdiği girdide de geçmek zorunda; geçmiyorsa
  cevap kullanıcıya gösterilmez.

  Serbest bırakılanlar: yıl benzeri büyük tam sayılar değil, yalnızca
  akademik metinde kaçınılmaz olan eşikler (.05, .01, .001) ve madde
  numaraları (1., 2.) gibi tek haneli sıra sayıları.
*/

/** Metindeki sayısal değerler; "χ²(1, N = 120) = 6.14" → 1, 120, 6.14 */
export function sayilar(metin: string): string[] {
  // ".05" gibi baştaki sıfırı yazılmayan değerler de yakalanır (APA'da yaygın).
  return (metin.match(/-?(?:\d+(?:[.,]\d+)?|[.,]\d+)/g) ?? []).map(normalize);
}

/** "0,05" ve ".05" aynı sayıdır; baştaki sıfır ve virgül farkı silinir. */
function normalize(ham: string): string {
  const eksi = ham.startsWith("-");
  const sayi = ham.replace("-", "").replace(",", ".");
  const kisa = sayi.includes(".") ? sayi.replace(/^0+(?=\.)/, "").replace(/0+$/, "").replace(/\.$/, "") : sayi.replace(/^0+(?=\d)/, "");
  return (eksi ? "-" : "") + (kisa === "" ? "0" : kisa);
}

/** Her metinde geçebilecek, girdide aranmayan değerler. */
const SERBEST = new Set(["0", "1", "2", "3", "4", "5", ".05", ".01", ".001", "100", "95", "-1"]);

/**
 * Çıktıda geçip girdide geçmeyen sayılar. Boş dizi dönerse cevapta uydurma
 * sayı yoktur. `ekGirdiler` doğrulanmış kaynaklar içindir (ör. tespit edilen
 * istatistiklerin APA karşılıkları).
 */
export function uydurmaSayilar(cikti: string, girdi: string, ...ekGirdiler: string[]): string[] {
  const bilinen = new Set([...sayilar(girdi), ...ekGirdiler.flatMap(sayilar)]);
  return [...new Set(sayilar(cikti))].filter((deger) => !bilinen.has(deger) && !SERBEST.has(deger));
}
