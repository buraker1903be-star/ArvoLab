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

/*
  APA'da "F(2,57)" İKİ serbestlik derecesidir, "2,57" ondalığı değil. Türkçe
  ondalık ayırıcısı virgül olduğu için ayrıştırıcı bunu 2.57 diye okuyordu:
  girdide "F(2, 57)" boşluklu yazıldığından 2 ve 57 çıkıyor, asistan aynı
  şeyi boşluksuz yazınca uydurma sayı sanılıp cevabın tamamı atılıyordu
  (canlıda 20.09.2026). Yalnızca test adından hemen sonra gelen parantez
  içinde uygulanır; "(p = 0,021)" gibi gerçek ondalıklara dokunmaz.
*/
const SERBESTLIK_DERECESI = /([FtχΧ]\s*²?\s*\(\s*\d+)\s*,\s*(?=\d)/g;

/*
  Standart ve sürüm adları sayısal iddia değildir: "APA 7" kuralın adıdır.
  Canlıda (20.09.2026) doğru çalışan bir denetim yalnızca bu yüzden tümden
  atıldı.
*/
const STANDART_ADI = /\b(APA|MLA|IEEE|Vancouver|Chicago|Tip|Tür)\s*\d+/gi;

/** Metindeki sayısal değerler; "χ²(1, N = 120) = 6.14" → 1, 120, 6.14 */
export function sayilar(metin: string): string[] {
  /*
    İki rakamın arasındaki tire eksi işareti değil, aralıktır: "45-72" iki
    sayıdır (45 ve 72), "-72" değil. Kaynakçada sayfa aralıkları böyle
    yazılıyor ve APA kısa çizgi yerine kısa tire (–) tercih ediyor; ikisini
    ayrı okusaydık, asistan aralığı "45–72" diye yazdığında girdideki
    "45-72" ile eşleşmiyor, doğru cevap uydurma sanılıp atılıyordu.
  */
  const duz = metin.replace(/[\u2010-\u2015]/g, "-").replace(SERBESTLIK_DERECESI, "$1; ");
  // ".05" gibi baştaki sıfırı yazılmayan değerler de yakalanır (APA'da yaygın).
  return [...duz.matchAll(/-?(?:\d+(?:[.,]\d+)?|[.,]\d+)/g)].map((eslesme) => {
    const ham = eslesme[0];
    const oncekiRakam = eslesme.index > 0 && /\d/.test(duz[eslesme.index - 1]);
    return normalize(ham.startsWith("-") && oncekiRakam ? ham.slice(1) : ham);
  });
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
  // Standart adları yalnızca çıktıda ayıklanır; girdide geçmesi zararsız.
  const temiz = cikti.replace(STANDART_ADI, " ");
  return [...new Set(sayilar(temiz))].filter((deger) => !bilinen.has(deger) && !SERBEST.has(deger));
}
