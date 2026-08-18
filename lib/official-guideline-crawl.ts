import { fetchOfficialSource } from "@/lib/safe-official-fetch";

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
    return response.text();
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
  return response.text();
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
