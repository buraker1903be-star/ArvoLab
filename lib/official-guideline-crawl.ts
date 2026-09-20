import { fetchOfficialSource, metniOku } from "@/lib/safe-official-fetch";
import { belgeAdresiMi, belgeBaglantisiSec } from "@/lib/belge-baglantisi";

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

function isGuidelineUrl(url: string) {
  const decoded = decodeURIComponent(url).toLocaleLowerCase("tr-TR");
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

async function yokDirectoryHtml() {
  yokDirectoryPromise ??= Promise.all([1, 2].map(async (type) => {
    const response = await fetch(`https://www.yok.gov.tr/tr/university?type=${type}`, {
      cache: "no-store", signal: AbortSignal.timeout(30_000),
      headers: { "user-agent": "ArvoLabGuidelineDirectory/1.0" },
    });
    if (!response.ok) throw new Error(`YÖK üniversite dizini alınamadı: HTTP ${response.status}`);
    return metniOku(response);
  })).then((pages) => pages.join("\n"));
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
  const response = await fetchOfficialSource(url);
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
const ENSTITU_ONEKLERI = ["sbe", "fbe", "sagbil", "ebe", "lee", "gse", "sosyalbilimler", "fenbilimleri"];

/** İsteklerin arasına konan nezaket gecikmesi (aynı kuruma arka arkaya yüklenmemek için). */
const bekle = (ms: number) => new Promise((coz) => setTimeout(coz, ms));

/**
 * Üniversitenin ana alan adı + enstitü alt alan adları taranır.
 *
 * Alt alanlar yalnızca var olanlar için maliyet üretir: çözümlenemeyen ad
 * fetch aşamasında hata verir ve atlanır.
 */
export async function crawlUniversityAndInstitutes(domain: string) {
  const hepsi: OfficialGuidelineCandidate[] = [];
  const gorulen = new Set<string>();

  const ekle = (adaylar: OfficialGuidelineCandidate[]) => {
    for (const aday of adaylar) {
      if (gorulen.has(aday.url)) continue;
      gorulen.add(aday.url);
      hepsi.push(aday);
    }
  };

  ekle(await crawlOfficialGuidelineCandidates(domain).catch(() => []));

  // Ana alan adı "www." taşıyorsa alt alan onun değil, kök alanın altındadır.
  const kok = domain.replace(/^www\./, "");
  for (const onek of ENSTITU_ONEKLERI) {
    await bekle(400);
    ekle(await crawlOfficialGuidelineCandidates(`${onek}.${kok}`).catch(() => []));
  }

  // HTML sayfaları gerçek belgeye indirilir; aynı belgeye çıkan sayfalar tekilleşir.
  const belgeler: OfficialGuidelineCandidate[] = [];
  const gorulenBelge = new Set<string>();
  for (const aday of hepsi) {
    const cozulen = await belgeyeIn(aday);
    if (gorulenBelge.has(cozulen.url)) continue;
    gorulenBelge.add(cozulen.url);
    belgeler.push(cozulen);
  }
  return belgeler;
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

  const discovered = new Set<string>();
  const childSitemaps = new Set<string>();
  for (const sitemap of [...sitemapUrls].slice(0, 4)) {
    const xml = await readText(sitemap).catch(() => null);
    if (!xml) continue;
    for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
      const url = officialUrl(match[1]);
      if (!url) continue;
      if (/sitemap/i.test(url) && !isGuidelineUrl(url)) childSitemaps.add(url);
      else if (isGuidelineUrl(url)) discovered.add(url);
    }
  }
  for (const sitemap of [...childSitemaps].slice(0, 6)) {
    const xml = await readText(sitemap).catch(() => null);
    if (!xml) continue;
    for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
      const url = officialUrl(match[1]); if (url && isGuidelineUrl(url)) discovered.add(url);
    }
  }

  const home = await readText(`https://${domain}/`).catch(() => null);
  for (const match of (home ?? "").matchAll(/href=["']([^"']+)["']/gi)) {
    const url = officialUrl(match[1], `https://${domain}/`); if (url && isGuidelineUrl(url)) discovered.add(url);
  }

  return [...discovered].slice(0, 6).map((url): OfficialGuidelineCandidate => ({
    url, title: decodeURIComponent(new URL(url).pathname.split("/").pop() || "Tez Yazım Kılavuzu"),
  }));
}
