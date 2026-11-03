/*
  CÜMLEYE KAYNAK BUL (03.11.2026, Jenni'nin "cite" özelliğinin karşılığı).
  Öğrenci bir cümle seçer; önce KENDİ Literatür kütüphanesinde o cümleye
  yakın kaynaklar, sonra gerçek dizinlerde (OpenAlex, Crossref —
  lib/literatur-arama.ts) arama yapılır.

  Neden model değil: AGENTS.md "asistan kaynak önermez". Dil modeli cümleye
  uygun künye UYDURUR; burada her sonuç bir dizin kaydıdır. Arama ifadesi
  de cümleden kuralla çıkarılır ve öğrenci aramadan önce düzenleyebilir —
  Türkçe cümleden çıkan ifade İngilizce literatürü az bulur, ekranda bu
  yazıyor ve kutu bu yüzden düzenlenebilir.

  "Destekliyor" HÜKMÜ VERİLMEZ: eşleşme başlıktaki ortak sözcüklerdir,
  kaynağın cümleyi gerçekten desteklediğini öğrenci kaynağı okuyarak
  (ya da "Kaynağa sor" ile) doğrular.

  Saf modül; testi tests/unit/cumle-kaynak.test.ts.
*/

const DURAK = new Set(
  (
    "ve veya ile ama fakat ancak çünkü ki de da bu şu o bir iki her çok daha en gibi için kadar göre olarak olan olduğu olduğunu " +
    "olup olması olmak oldu olmuştur olmaktadır olabilir ise ne nasıl neden hem ya yani bunun bunu buna bunlar onların onun " +
    "arasında arasındaki üzerinde üzerine ilgili ilişkin yönelik sonra önce ayrıca özellikle genel genellikle bazı tüm bütün " +
    "çalışma çalışmada çalışmalar çalışmalarda araştırma araştırmalar araştırmada bulgular sonuç sonuçlar göstermektedir " +
    "belirtilmektedir ifade edilmektedir bulunmuştur saptanmıştır ortaya konmuştur literatürde alanyazında yapılan önceki " +
    "the a an and or of in on to for with by from as at is are was were be been being that this these those which who whom " +
    "it its their they them there than then also however thus therefore such may might can could should would has have had " +
    "study studies research findings results show shows shown suggest suggests found literature previous"
  ).split(/\s+/),
);

const sade = (metin: string) => metin.toLocaleLowerCase("tr-TR").normalize("NFC");

/** Cümleden atıf, sayı ve noktalama ayıklanmış sözcükler (sıra korunur, tekrar yok). */
export function anlamliSozcukler(cumle: string): string[] {
  const temiz = cumle
    .replace(/\([^()]*\d{4}[^()]*\)/g, " ") // (Yılmaz, 2020)
    .replace(/\[[\d,\s–-]+\]/g, " ") // [3]
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, " ");
  const gorulen = new Set<string>();
  const sonuc: string[] = [];
  for (const ham of temiz.split(/[^\p{L}\p{N}-]+/u)) {
    const s = sade(ham).replace(/^-+|-+$/g, "");
    if (s.length < 3 || /^\d+$/.test(s) || DURAK.has(s) || gorulen.has(s)) continue;
    gorulen.add(s);
    sonuc.push(s);
  }
  return sonuc;
}

/**
 * Dizin araması için ifade: en uzun (en ayırt edici) sekiz sözcük, cümledeki
 * sırasıyla. Kısaltmalar (ARDL, TÜFE) olduğu gibi kalır.
 */
export function cumleSorgusu(cumle: string, enCok = 8): string {
  const sozcukler = anlamliSozcukler(cumle);
  const secilen = new Set([...sozcukler].sort((a, b) => b.length - a.length).slice(0, enCok));
  const kisaltmalar = [...cumle.matchAll(/(?<![\p{L}])\p{Lu}{2,6}(?![\p{L}])/gu)].map((m) => m[0]);
  const ifade = sozcukler.filter((s) => secilen.has(s));
  for (const k of kisaltmalar) if (!ifade.includes(sade(k))) ifade.push(k);
  return ifade.slice(0, enCok + 2).join(" ");
}

/*
  Türkçe ekler ("enflasyonun", "enflasyondaki") yüzünden sözcük eşitliği
  yerine ilk beş harf karşılaştırılır; İngilizcede de "inflation" /
  "inflationary" eşleşir. Kısa sözcükler (≤5) tamamen eşleşmeli.
*/
const kok = (s: string) => (s.length > 5 ? s.slice(0, 5) : s);

export type KutuphaneKaynagi = { id: string; title: string; authors?: string | null; year?: string | null; notes?: string | null };

/**
 * Kütüphanedeki kaynakları cümleyle ortak köke göre sıralar. Yalnızca en az
 * İKİ ortak kökü olanlar döner: tek ortak sözcük ("enflasyon") alandaki her
 * kaynağı getirir ve listeyi anlamsızlaştırır.
 */
export function kutuphanedenEslesenler<T extends KutuphaneKaynagi>(cumle: string, kaynaklar: T[], enCok = 5): (T & { ortak: string[] })[] {
  const aranan = new Map(anlamliSozcukler(cumle).map((s) => [kok(s), s]));
  if (!aranan.size) return [];
  return kaynaklar
    .map((k) => {
      const kaynakKokleri = new Set(anlamliSozcukler(`${k.title} ${k.notes ?? ""}`).map(kok));
      const ortak = [...aranan.entries()].filter(([kk]) => kaynakKokleri.has(kk)).map(([, s]) => s);
      return { ...k, ortak };
    })
    .filter((k) => k.ortak.length >= 2)
    .sort((a, b) => b.ortak.length - a.ortak.length)
    .slice(0, enCok);
}
