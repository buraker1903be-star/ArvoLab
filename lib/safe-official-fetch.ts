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

  const addresses = [...await resolve4(hostname).catch(() => []), ...await resolve6(hostname).catch(() => [])];
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new Error("Kaynak adresi güvenli bir genel ağ adresine çözümlenemedi.");
  }
  return url;
}

export async function fetchOfficialSource(rawUrl: string): Promise<Response> {
  let current = await assertOfficialUrl(rawUrl);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      headers: { "User-Agent": "ArvoLab-Guideline-Monitor/1.0" },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("Kaynak geçersiz bir yönlendirme döndürdü.");
    current = await assertOfficialUrl(new URL(location, current).toString());
  }
  throw new Error("Kaynak çok fazla yönlendirme yaptı.");
}
