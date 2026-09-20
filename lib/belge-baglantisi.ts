/*
  Kılavuz sayfasından GERÇEK belgeye inmek.

  Keşif, site haritasında "tez-yazim-kilavuzu" geçen adresleri buluyordu ama
  bu adresler çoğu zaman bir PDF değil, bir HTML SAYFASIDIR; kılavuzun
  kendisi o sayfadan bağlantılıdır. Örnek (canlıda doğrulandı):

    https://fbe.gazi.edu.tr/view/page/157656/tez-yazim-kilavuzu
      → https://webupload.gazi.edu.tr/.../turkce_taslak_2023.docx

  Sayfanın kendisi taranınca menü, altbilgi ve paylaş düğmelerinden oluşan
  bir metin çıkıyor; kural çıkarımı doğal olarak boş dönüyor ve kayıt düşük
  güvenle "inceleme gerekli"de kalıyordu. Canlıdaki düşük güvenli
  kayıtların bir bölümünün sebebi bu.

  Sayfada belge yoksa sayfanın kendisi aday olarak kalır: bazı kurumlar
  kuralları doğrudan HTML olarak yayımlıyor.

  Saf modül; testi tests/unit/belge-baglantisi.test.ts.
*/

/** Taranabilir belge uzantıları; sırası tercih sırasıdır. */
const UZANTILAR = [".pdf", ".docx", ".doc"];

const KILAVUZ_IPUCU = /(tez|thesis)/i;
const YAZIM_IPUCU = /(k[ıi]lavuz|klavuz|guide|yaz[ıi]m|template|taslak|format)/i;

/** Adres zaten bir belgeye mi işaret ediyor? */
export function belgeAdresiMi(url: string): boolean {
  try {
    const yol = new URL(url).pathname.toLowerCase();
    return UZANTILAR.some((uzanti) => yol.endsWith(uzanti));
  } catch {
    return false;
  }
}

type Aday = { url: string; puan: number };

/**
 * HTML sayfasındaki en olası kılavuz belgesi.
 *
 * Puanlama: uzantı tercihi + adres ve bağlantı metnindeki ipuçları.
 * Hiçbir aday yoksa null döner ve çağıran sayfanın kendisini kullanır.
 */
export function belgeBaglantisiSec(html: string, tabanUrl: string): string | null {
  const adaylar = new Map<string, Aday>();

  // Bağlantı metni de sinyal: "Tez Yazım Kılavuzu (PDF)" gibi.
  const desen = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const eslesme of html.matchAll(desen)) {
    let hedef: URL;
    try {
      hedef = new URL(eslesme[1], tabanUrl);
    } catch {
      continue;
    }

    const konak = hedef.hostname.toLowerCase();
    // Taramanın tamamı yalnızca resmî .edu.tr kaynaklarında çalışır.
    if (hedef.protocol !== "https:" || !(konak === "edu.tr" || konak.endsWith(".edu.tr"))) continue;

    const yol = hedef.pathname.toLowerCase();
    const uzantiSirasi = UZANTILAR.findIndex((uzanti) => yol.endsWith(uzanti));
    if (uzantiSirasi === -1) continue;

    const metin = eslesme[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const birlesik = `${decodeURIComponent(yol)} ${metin}`;

    /*
      En az bir ipucu ZORUNLU. Sayfadaki rastgele bir PDF (danışman
      değişiklik formu, başvuru dilekçesi) kılavuz değildir; yanlış
      belgeden çıkarılan kural, kuralsızlıktan kötüdür. Tek ipucu yeterli
      sayılıyor çünkü bağlantının bulunduğu sayfa zaten kılavuz sayfası.
    */
    const tezIpucu = KILAVUZ_IPUCU.test(birlesik);
    const yazimIpucu = YAZIM_IPUCU.test(birlesik);
    if (!tezIpucu && !yazimIpucu) continue;

    /*
      PDF, Word şablonuna tercih edilir: şablon dosyası çoğu zaman boş bir
      kapak taşır, kuralların anlatıldığı metin PDF'tedir.
    */
    let puan = (UZANTILAR.length - uzantiSirasi) * 10;
    if (tezIpucu) puan += 6;
    if (yazimIpucu) puan += 6;
    // İngilizce sürümler ikinci sırada: kurallar Türkçe metinden çıkarılıyor.
    if (/(ingilizce|english|_en\b|-en\b)/i.test(birlesik)) puan -= 5;

    const url = hedef.toString();
    const onceki = adaylar.get(url);
    if (!onceki || onceki.puan < puan) adaylar.set(url, { url, puan });
  }

  // İpucusuz adaylar yukarıda elendi; kalanlar arasında en yüksek puanlı.
  const sirali = [...adaylar.values()].sort((a, b) => b.puan - a.puan);
  return sirali[0]?.url ?? null;
}
