import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized === "metadata.google.internal"
  );
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
}

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

async function assertPublicHttpUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Geçersiz URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Yalnızca HTTP/HTTPS adreslerine izin verilir.");
  }
  if (url.username || url.password) {
    throw new Error("Kimlik bilgisi içeren URL'lere izin verilmez.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("Yerel veya dahili ağ adreslerine erişim engellendi.");
  }

  const literalFamily = isIP(url.hostname);
  if (literalFamily && isPrivateAddress(url.hostname)) {
    throw new Error("Yerel veya özel IP adreslerine erişim engellendi.");
  }

  if (!literalFamily) {
    let addresses: Awaited<ReturnType<typeof lookup>>;
    try {
      addresses = await lookup(url.hostname, { all: true, verbatim: true });
    } catch {
      throw new Error("Kaynak alan adı çözümlenemedi.");
    }
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("Kaynak güvenli bir genel ağ adresine çözülmüyor.");
    }
  }

  return url;
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Kaynak izin verilen boyut sınırını aşıyor.");
  }

  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Kaynak izin verilen boyut sınırını aşıyor.");
    }
    chunks.push(value);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export interface SafeFetchResult {
  url: URL;
  status: number;
  ok: boolean;
  headers: Headers;
  bytes: Uint8Array;
  text(): string;
}

export async function safeFetch(
  input: string,
  options: {
    timeoutMs?: number;
    maxBytes?: number;
    headers?: HeadersInit;
  } = {},
): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let currentUrl = await assertPublicHttpUrl(input);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: options.headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Kaynak geçersiz bir yönlendirme döndürdü.");
      if (redirectCount === MAX_REDIRECTS) throw new Error("Çok fazla yönlendirme algılandı.");
      currentUrl = await assertPublicHttpUrl(new URL(location, currentUrl).toString());
      continue;
    }

    const bytes = await readBodyWithLimit(response, maxBytes);
    return {
      url: currentUrl,
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      bytes,
      text: () => new TextDecoder("utf-8").decode(bytes),
    };
  }

  throw new Error("Kaynak alınamadı.");
}
