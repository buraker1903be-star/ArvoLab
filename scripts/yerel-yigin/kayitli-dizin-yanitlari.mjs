/*
  KAYITLI DİZİN YANITLARI (18.11.2026, 4. tur). Yerel kabul ortamının dış
  ağa (OpenAlex, Crossref) erişimi yok; Makale bul her aramada
  "Dizinlere şu anda ulaşılamıyor" diyor ve sonuç listesinin yerleşimi ile
  "Listeme ekle" davranışı sınanamıyordu.

  Bu dosya Next sunucusu başlamadan önce yüklenir
  (NODE_OPTIONS="--import <bu dosya>") ve yalnızca api.openalex.org/works
  ile api.crossref.org/works aramalarını kayitli-yanitlar/ altındaki
  SENTETİK yanıtlara çevirir; başka hiçbir isteğe dokunmaz. Uygulama kodu
  değişmez. Bu GERÇEK DİZİN KABULÜ DEĞİLDİR: yanıtlar elle yazılmış, biçimi
  uygulamanın okuduğu alanlarla aynı örneklerdir.

  Her yakalanan istek KAYITLI_DIZIN_KAYDI dosyasına bir satır yazılır:
  kabul betiği aramanın gerçekten bu yanıtlardan geldiğini oradan doğrular.
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KLASOR = path.join(path.dirname(fileURLToPath(import.meta.url)), "kayitli-yanitlar");
const KAYIT = process.env.KAYITLI_DIZIN_KAYDI || "";
const yanitlar = {
  "api.openalex.org": fs.readFileSync(path.join(KLASOR, "openalex-works.json"), "utf8"),
  "api.crossref.org": fs.readFileSync(path.join(KLASOR, "crossref-works.json"), "utf8"),
};
const asil = globalThis.fetch;
globalThis.fetch = async function kayitliFetch(girdi, secenek) {
  const adres = typeof girdi === "string" ? girdi : girdi instanceof URL ? girdi.href : girdi?.url;
  let url = null;
  try {
    url = adres ? new URL(adres) : null;
  } catch {
    url = null;
  }
  if (url && yanitlar[url.host] && url.pathname === "/works") {
    if (KAYIT) fs.appendFileSync(KAYIT, JSON.stringify({ zaman: new Date().toISOString(), host: url.host, sorgu: url.searchParams.get("search") ?? url.searchParams.get("query.bibliographic") }) + "\n");
    return new Response(yanitlar[url.host], { status: 200, headers: { "content-type": "application/json", "x-kayitli-yanit": "sentetik" } });
  }
  return asil(girdi, secenek);
};
