import { isIP } from "node:net";
import { resolve4, resolve6 } from "node:dns/promises";

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const value = address.toLowerCase();
  return value === "::1" || value === "::" || value.startsWith("fc") ||
    value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") ||
    value.startsWith("fea") || value.startsWith("feb") || value.startsWith("ff");
}

async function assertOfficialUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Kılavuz kaynağı standart HTTPS kullanmalıdır.");
  }
  if (!(hostname === "edu.tr" || hostname.endsWith(".edu.tr"))) {
    throw new Error("Otomatik tarama yalnızca resmî .edu.tr kaynaklarında çalışır.");
  }

  /*
    DNS çözümlemesinin zaman aşımı YOKTU ve iki sorgu ardışık çalışıyordu.
    Node'un çözümleyicisi yanıtsız bir ad sunucusunda uzun süre yeniden
    deniyor; tek bir tanımsız alt alan adı dakikalarca bekletebiliyor.

    Canlıda ölçüldü: bir üniversitenin taraması 964 saniye sürdü (gece
    cron'unun TOPLAM bütçesi 300 saniye). Alt alan adı yoklaması yapan
    keşif, tanımsız adlarla dolu olduğu için bu tuzağa tam oturuyor.

    İki sorgu paralel çalışır ve süre sınırlıdır; cevap gelmezse ad
    çözümlenememiş sayılır.
  */
  const addresses = await Promise.race([
    Promise.all([resolve4(hostname).catch(() => []), resolve6(hostname).catch(() => [])]).then(
      ([dort, alti]) => [...dort, ...alti],
    ),
    new Promise<string[]>((coz) => setTimeout(() => coz([]), 5_000)),
  ]);
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new Error("Kaynak adresi güvenli bir genel ağ adresine çözümlenemedi.");
  }
  return url;
}

/*
  Kaynak dosyalar sınırsız okunmaz.

  Eskiden indirilen her şey doğrudan arrayBuffer()'a alınıyordu: ne
  Content-Length bakılıyor ne de akış kesiliyordu. Resmî bir sitedeki 400
  MB'lık taranmış bir kılavuz (Türkiye'de sık), gece çalışan cron'u belleğe
  boğup istegi düşürürdü — üstelik o dosyadan işe yarar metin de çıkmazdı.

  Sınır aşılırsa indirme KESİLİR ve hata verilir; yarım okunan dosyadan
  kural çıkarmak, eksik kuralı doğruymuş gibi kaydetmek olurdu.
*/
export const EN_FAZLA_KAYNAK_BAYT = 40 * 1024 * 1024;

export async function kaynagiOku(response: Response, enFazla = EN_FAZLA_KAYNAK_BAYT): Promise<ArrayBuffer> {
  // Sunucu boyutu bildiriyorsa hiç indirmeden reddedilir.
  const bildirilen = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(bildirilen) && bildirilen > enFazla) {
    throw new Error(`Kaynak dosya çok büyük (${Math.round(bildirilen / 1024 / 1024)} MB); en fazla ${Math.round(enFazla / 1024 / 1024)} MB okunur.`);
  }

  // Content-Length yoksa ya da yanlışsa akış sayılarak okunur.
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const parcalar: Uint8Array[] = [];
  let toplam = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      toplam += value.byteLength;
      if (toplam > enFazla) {
        await reader.cancel();
        throw new Error(`Kaynak dosya çok büyük; en fazla ${Math.round(enFazla / 1024 / 1024)} MB okunur.`);
      }
      parcalar.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const tampon = new Uint8Array(toplam);
  let konum = 0;
  for (const parca of parcalar) {
    tampon.set(parca, konum);
    konum += parca.byteLength;
  }
  return tampon.buffer;
}

/*
  HTML sayfaları (site haritası, arama sonucu, YÖK dizini) için daha dar bir
  sınır: bunlar metin belgesidir, onlarca MB olmaları beklenmez. Site haritası
  dizinleri istisnai olarak büyüyebildiği için sınır yine de cömert.
*/
export async function metniOku(response: Response, enFazla = 8 * 1024 * 1024): Promise<string> {
  return new TextDecoder().decode(await kaynagiOku(response, enFazla));
}

/*
  Zaman aşımı çağırana bırakıldı: kılavuz dosyası indirmek (büyük PDF)
  ile site haritası okumak aynı sabrı hak etmiyor. Site haritası taraması
  üniversite başına onlarca istek yapıyor; her birine 30 saniye vermek,
  tek yavaş sunucunun gece turunu yemesi demek.
*/
export type Dogrulayicilar = { etag?: string | null; lastModified?: string | null };

export async function fetchOfficialSource(
  rawUrl: string,
  secenek?: { zamanAsimiMs?: number; dogrulayicilar?: Dogrulayicilar; yonlendirmeyiIzleme?: boolean },
): Promise<Response> {
  /*
    Koşullu istek başlıkları. Sunucudan geldiği gibi geri gönderilir:
    ETag tırnaklı ve W/ önekli olabiliyor, Last-Modified HTTP tarih
    biçiminde — ikisi de yorumlanmadan taşınmalı.
  */
  const kosulBasliklari: Record<string, string> = {};
  if (secenek?.dogrulayicilar?.etag) kosulBasliklari["If-None-Match"] = secenek.dogrulayicilar.etag;
  if (secenek?.dogrulayicilar?.lastModified) kosulBasliklari["If-Modified-Since"] = secenek.dogrulayicilar.lastModified;

  let current = await assertOfficialUrl(rawUrl);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(secenek?.zamanAsimiMs ?? 30_000),
      headers: { "User-Agent": "ArvoLab-Guideline-Monitor/1.0", ...kosulBasliklari },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    // Çağıran yönlendirmenin KENDİSİYLE ilgileniyorsa ham yanıt döner.
    if (secenek?.yonlendirmeyiIzleme) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("Kaynak geçersiz bir yönlendirme döndürdü.");
    current = await assertOfficialUrl(new URL(location, current).toString());
  }
  throw new Error("Kaynak çok fazla yönlendirme yaptı.");
}
