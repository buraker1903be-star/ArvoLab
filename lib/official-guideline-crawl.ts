import { fetchOfficialSource, metniOku } from "@/lib/safe-official-fetch";
import { belgeAdresiMi, belgeBaglantisiSec } from "@/lib/belge-baglantisi";
import { robotsCozumle, robotsIzinVeriyor } from "@/lib/robots";

export type OfficialGuidelineCandidate = { url: string; title: string };

let yokDirectoryPromise: Promise<string> | null = null;

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i").replace(/İ/g, "I").replace(/[^a-zA-Z0-9]+/g, " ")
    .trim().toUpperCase();
}

function decodeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").trim();
}

/*
  Makale, dergi ve bildiri yazım kuralları tez kılavuzu DEĞİLDİR ama
  süzgeçten geçebiliyorlar: Çukurova'nın "tez-ve-dergi/makale-yazim-
  kurallari" adresi "tez" ve "yazim" içerdiği için kılavuz sanılıp
  doğrulanmış kaynak listesine girmişti. Dergi kuralları öğrencinin tezine
  uygulanırsa tamamen yanlış biçim dayatılır.
*/
const KILAVUZ_DEGIL_YOL = /(makale|dergi|journal|bildiri|poster|sempozyum|kongre)/i;

function isGuidelineUrl(url: string) {
  const decoded = decodeURIComponent(url).toLocaleLowerCase("tr-TR");
  if (KILAVUZ_DEGIL_YOL.test(decoded)) return false;
  return /(tez|thesis)/i.test(decoded) && /(kılavuz|kilavuz|klavuz|guide|yazım|yazim)/i.test(decoded);
}

function officialUrl(raw: string, base?: string) {
  try {
    const url = new URL(decodeXml(raw), base);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !(host === "edu.tr" || host.endsWith(".edu.tr"))) return null;
    return url.toString();
  } catch { return null; }
}

/*
  YÖK dizini süreç boyunca bir kez indirilir. Ama önbellek REDDEDİLEN
  promise'i de saklıyordu: ilk istek zaman aşımına uğrarsa sonraki bütün
  çağrılar anında aynı hatayla düşüyor ve keşif o süreç boyunca tamamen
  ölüyordu.

  Canlıda ölçüldü: 72 üniversitelik bir tarama turunda ilki 50 saniyede
  zaman aşımına uğradı, kalan 71'i 0,0 saniyede "alan adı yok" dedi. Gece
  cron'unda aynı şey olsa o turda hiçbir üniversite keşfedilmezdi ve
  sebebi de görünmezdi.

  Artık başarısızlıkta önbellek boşaltılıyor; sonraki çağrı yeniden
  deniyor.
*/
async function yokDirectoryHtml() {
  if (yokDirectoryPromise) return yokDirectoryPromise;
  yokDirectoryPromise = Promise.all([1, 2].map(async (type) => {
    const response = await fetch(`https://www.yok.gov.tr/tr/university?type=${type}`, {
      cache: "no-store", signal: AbortSignal.timeout(30_000),
      headers: { "user-agent": "ArvoLabGuidelineDirectory/1.0" },
    });
    if (!response.ok) throw new Error(`YÖK üniversite dizini alınamadı: HTTP ${response.status}`);
    return metniOku(response);
  })).then((pages) => pages.join("\n"));
  // Hata kalıcı önbelleğe yazılmaz; bir sonraki çağrı baştan dener.
  yokDirectoryPromise.catch(() => {
    yokDirectoryPromise = null;
  });
  return yokDirectoryPromise;
}

export async function resolveOfficialUniversityDomain(universityName: string) {
  const html = await yokDirectoryHtml();
  const target = normalize(universityName);
  const cards = html.split(/<div class="university-card-uni"/i).slice(1);
  const card = cards.find((item) => {
    const match = /data-name="([^"]+)"/i.exec(item.slice(0, 500));
    return match && normalize(match[1]) === target;
  });
  if (!card) return null;
  for (const match of card.slice(0, 12_000).matchAll(/href="(https:\/\/[^"#]+)"/gi)) {
    const url = officialUrl(match[1]);
    if (url && !new URL(url).hostname.endsWith("yok.gov.tr")) return new URL(url).hostname.replace(/^www\./, "");
  }
  return null;
}

async function readText(url: string) {
  // Site haritası ve HTML sayfası: kısa sabır yeter.
  const response = await fetchOfficialSource(url, { zamanAsimiMs: 12_000 });
  if (!response.ok) return null;
  return metniOku(response);
}

/**
 * Aday HTML sayfasıysa içindeki gerçek kılavuz belgesine iner.
 *
 * Site haritaları çoğu zaman bir HTML sayfası veriyor; kılavuzun kendisi o
 * sayfadan bağlantılı (canlıda doğrulandı: fbe.gazi.edu.tr'nin kılavuz
 * sayfası webupload.gazi.edu.tr'deki .docx dosyasına bağlanıyor). Sayfanın
 * kendisi taranınca menü ve altbilgi metni çıkıyor, kural çıkarımı boş
 * dönüyordu.
 *
 * Belge bulunamazsa sayfanın kendisi kalır: bazı kurumlar kuralları
 * doğrudan HTML olarak yayımlıyor.
 */
async function belgeyeIn(aday: OfficialGuidelineCandidate): Promise<OfficialGuidelineCandidate> {
  if (belgeAdresiMi(aday.url)) return aday;
  const html = await readText(aday.url).catch(() => null);
  if (!html) return aday;
  const belge = belgeBaglantisiSec(html, aday.url);
  if (!belge) return aday;
  return { url: belge, title: aday.title };
}

/*
  Enstitülerin kendi alt alan adları.

  Tez yazım kılavuzu enstitü düzeyinde yayımlanır ve enstitülerin çoğunun
  ayrı sitesi vardır (sbe.gazi.edu.tr gibi). Üniversitenin ana site
  haritası bu alt alanlara bağlanmaz; yalnızca ana alan adı taranınca
  enstitü kılavuzlarının büyük kısmı hiç görünmüyordu.

  Liste bilerek kısa: her ek önek, her üniversite için fazladan bir istek
  demek. Yaygın kısaltmalar kapsanıyor.
*/
const ENSTITU_ONEKLERI = [
  "sbe", "fbe", "sabe", "sagbe", "sagbil", "ebe", "lee", "gse",
  "enstitu", "lisansustu", "sosyalbilimler", "fenbilimleri", "saglikbilimleri", "egitimbilimleri",
];

/**
 * Bu alt alan adı gerçekten ayrı bir site mi?
 *
 * Çoğu üniversitede joker DNS var: tanımsız her alt alan ana siteye
 * yönleniyor. Önek listesi büyüdükçe bu, ana sitenin her önek için
 * yeniden taranması demek olurdu — kuruma 14 kat gereksiz yük.
 *
 * Tek istekle ayırt edilir: yanıt başka bir ana bilgisayara yönlendirme
 * ise bu alt alan kendi sitesi değildir.
 */
async function altAlanKendiSitesiMi(host: string): Promise<boolean> {
  try {
    const yanit = await fetchOfficialSource(`https://${host}/`, { zamanAsimiMs: 8_000, yonlendirmeyiIzleme: true });
    const hedef = yanit.headers.get("location");
    if (!hedef) return yanit.ok;
    return new URL(hedef, `https://${host}/`).hostname.toLowerCase() === host.toLowerCase();
  } catch {
    // Çözümlenemeyen ad: alt alan yok.
    return false;
  }
}

/** İsteklerin arasına konan nezaket gecikmesi (aynı kuruma arka arkaya yüklenmemek için). */
const bekle = (ms: number) => new Promise((coz) => setTimeout(coz, ms));

/**
 * Üniversitenin ana alan adı + enstitü alt alan adları taranır.
 *
 * Alt alanlar yalnızca var olanlar için maliyet üretir: çözümlenemeyen ad
 * fetch aşamasında hata verir ve atlanır.
 */
/*
  Bir üniversitenin taraması için üst süre sınırı.

  Alt alan yoklaması yönlendirme yapan joker DNS'i eliyor ama yönlendirme
  YAPMADAN 200 dönen jokerleri elemiyor: o durumda on dört alt alanın her
  biri ayrı ayrı taranıyor (robots + site haritaları + ana sayfa) ve
  üniversite başına süre patlıyor. Ölçüldü: 1019 ve 608 saniye.

  İlk denemede sınır yalnızca adımlar ARASINDA kontrol ediliyordu; bu
  yetmedi, çünkü tek bir adım (üç alt alanın paralel taranması, her biri
  on bir istek) tek başına dakikalarca sürebiliyor. Kırklareli 414 saniye
  sürdü ve üstelik daha önce bulduğu iki kılavuzu da kaçırdı.

  Artık sınır işin TAMAMINI yarıştırıyor: süre dolunca o ana kadar
  toplananlarla dönülür. Eksik kalan alt alanlar bir sonraki turda sıra
  alır.
*/
const TARAMA_SURE_SINIRI_MS = 60_000;

export async function crawlUniversityAndInstitutes(domain: string) {
  const hepsi: OfficialGuidelineCandidate[] = [];
  const gorulen = new Set<string>();
  /* Süre dolunca bunlarla dönülür; iş yarıda kesilse de bulunanlar kaybolmaz. */
  const belgeler: OfficialGuidelineCandidate[] = [];
  const gorulenBelge = new Set<string>();

  const ekle = (adaylar: OfficialGuidelineCandidate[]) => {
    for (const aday of adaylar) {
      if (gorulen.has(aday.url)) continue;
      gorulen.add(aday.url);
      hepsi.push(aday);
    }
  };

  const kok = domain.replace(/^www\./, "");
  const ESZAMANLI = 3;

  const tara = async () => {
    ekle(await crawlOfficialGuidelineCandidates(domain).catch(() => []));

    /*
      Önce hangi alt alanların gerçekten var olduğu belirlenir (önek başına
      TEK istek), sonra yalnızca onlar taranır. Joker DNS'li kurumlarda bu,
      ana sitenin on dört kez yeniden taranmasını önlüyor.

      Üçerli gruplar hâlinde paralel: farklı ana bilgisayarlar oldukları
      için aynı sunucuya yüklenilmiyor, gruplar arasında yine bekleniyor.
    */
    const varOlanlar: string[] = [];
    for (let i = 0; i < ENSTITU_ONEKLERI.length; i += ESZAMANLI) {
      const grup = ENSTITU_ONEKLERI.slice(i, i + ESZAMANLI);
      const sonuclar = await Promise.all(
        grup.map(async (onek) => ((await altAlanKendiSitesiMi(`${onek}.${kok}`)) ? `${onek}.${kok}` : null)),
      );
      for (const host of sonuclar) if (host) varOlanlar.push(host);
      if (i + ESZAMANLI < ENSTITU_ONEKLERI.length) await bekle(300);
    }

    for (let i = 0; i < varOlanlar.length; i += ESZAMANLI) {
      const grup = varOlanlar.slice(i, i + ESZAMANLI);
      const sonuclar = await Promise.all(grup.map((host) => crawlOfficialGuidelineCandidates(host).catch(() => [])));
      for (const sonuc of sonuclar) ekle(sonuc);
      if (i + ESZAMANLI < varOlanlar.length) await bekle(400);
    }

    /*
      HTML sayfaları gerçek belgeye indirilir; aynı belgeye çıkan sayfalar
      tekilleşir. Sonuç dizisine TEK TEK eklenir ki süre dolduğunda o ana
      kadar çözülenler elde kalsın.
    */
    for (const aday of hepsi) {
      const cozulen = await belgeyeIn(aday);
      if (gorulenBelge.has(cozulen.url)) continue;
      gorulenBelge.add(cozulen.url);
      belgeler.push(cozulen);
    }
  };

  // Süre dolarsa iş yarıda kalır; toplananlar döner.
  await Promise.race([tara(), bekle(TARAMA_SURE_SINIRI_MS)]);
  /*
    Belgeye inme aşamasına hiç gelinemediyse ham adaylar döner: HTML
    sayfasından kural çıkarmak, hiç aday olmamasından iyidir.
  */
  return belgeler.length ? belgeler : hepsi;
}

/*
  Adresten okunabilir bir başlık. Ham dosya adı panelde kılavuzun adı
  olarak görünüyor; "AGU_Social_Sciences_Institute_Gr%20-%202025.docx"
  gibi bir metin kullanıcıya hiçbir şey anlatmıyor.
*/
function adresBasligi(url: string): string {
  try {
    const dosya = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "");
    const temiz = dosya
      .replace(/\.(pdf|docx?|html?)$/i, "")
      .replace(/[_+]+/g, " ")
      .replace(/-+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return temiz || "Tez Yazım Kılavuzu";
  } catch {
    return "Tez Yazım Kılavuzu";
  }
}

export async function crawlOfficialGuidelineCandidates(domain: string) {
  const sitemapUrls = new Set([
    `https://${domain}/sitemap.xml`, `https://${domain}/sitemap_index.xml`,
    `https://${domain}/wp-sitemap.xml`,
  ]);
  const robots = await readText(`https://${domain}/robots.txt`).catch(() => null);
  for (const match of (robots ?? "").matchAll(/^sitemap:\s*(\S+)/gim)) {
    const url = officialUrl(match[1]); if (url) sitemapUrls.add(url);
  }

  /*
    robots.txt yalnızca "Sitemap:" satırları için okunuyordu; kurumun
    "Disallow" dediği yollara yine de giriliyordu. Bu dosya kurumun
    taleplerini bildirdiği standart yol ve ArvoLab onlarca üniversitenin
    sunucusuna her gece istek atıyor — uyulur.
  */
  const kurallar = robotsCozumle(robots ?? "");
  const izinli = (url: string) => {
    try {
      return robotsIzinVeriyor(kurallar, new URL(url).pathname);
    } catch {
      return false;
    }
  };

  const discovered = new Set<string>();
  const childSitemaps = new Set<string>();
  for (const sitemap of [...sitemapUrls].filter(izinli).slice(0, 4)) {
    const xml = await readText(sitemap).catch(() => null);
    if (!xml) continue;
    for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
      const url = officialUrl(match[1]);
      if (!url) continue;
      if (!izinli(url)) continue;
      if (/sitemap/i.test(url) && !isGuidelineUrl(url)) childSitemaps.add(url);
      else if (isGuidelineUrl(url)) discovered.add(url);
    }
  }
  for (const sitemap of [...childSitemaps].slice(0, 6)) {
    const xml = await readText(sitemap).catch(() => null);
    if (!xml) continue;
    for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
      const url = officialUrl(match[1]); if (url && isGuidelineUrl(url) && izinli(url)) discovered.add(url);
    }
  }

  const home = izinli(`https://${domain}/`) ? await readText(`https://${domain}/`).catch(() => null) : null;
  for (const match of (home ?? "").matchAll(/href=["']([^"']+)["']/gi)) {
    const url = officialUrl(match[1], `https://${domain}/`);
    if (url && isGuidelineUrl(url) && izinli(url)) discovered.add(url);
  }

  return [...discovered].slice(0, 6).map((url): OfficialGuidelineCandidate => ({ url, title: adresBasligi(url) }));
}
