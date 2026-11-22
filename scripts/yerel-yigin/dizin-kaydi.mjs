/*
  DİZİN YANITLARINI KAYDET / OYNAT (21.11.2026). Yalnızca yerel kabul
  düzeneği içindir; uygulama koduna dokunmaz. Next sunucusuna önceden
  yüklenir:

    NODE_OPTIONS="--import ./scripts/yerel-yigin/dizin-kaydi.mjs" \
    DIZIN_KAYIT=oynat \
    npx next start -p 3150

  Neden: Makale Bul ve künye kabulleri gerçek dizinlere (OpenAlex,
  Crossref) gidiyordu. OpenAlex kimliksiz aramayı yoğunlukta 429 ile
  geri çeviriyor; kabul o gün "dizin cevap vermedi" yüzünden düşüyor ya da
  daha kötüsü, engel bir sonuç gibi okunuyordu. Davranış kabulü artık
  KAYITLI yanıtlarla, gerçek servise erişim ise ayrı bir denetimle
  (dizin-erisim.mjs) ölçülür; erişim engeli hiçbir zaman "geçti" sayılmaz.

  Kipler:
    kaydet — istek gerçek servise gider; yalnızca 200 yanıtı diske yazılır
             (429/5xx kaydedilmez: engel kayda geçip "davranış" olmasın).
    oynat  — kayıt varsa diskten döner; yoksa istek AĞA ÇIKMAZ, ağ hatası
             gibi düşer ve hangi adresin kayıtsız olduğu log'a yazılır.
  Kip verilmezse hiçbir şey değişmez.

  kayitli-dizin-yanitlari.mjs ile farkı: o dosya her aramaya aynı,
  ELLE YAZILMIŞ (sentetik) yanıtı döner ve yalnızca listenin yerleşimini
  sınar. Bu dosya GERÇEK yanıtları adres adres kaydeder
  (kayitli-gercek-yanitlar/, kayıt tarihiyle); künye kontrolünün DOI ve
  başlık sorguları da oradan karşılanır.
*/
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const KIP = process.env.DIZIN_KAYIT ?? "";
const KLASOR = path.resolve(process.env.DIZIN_KAYIT_KLASORU ?? "scripts/yerel-yigin/kayitli-gercek-yanitlar");
const HEDEF = /^https:\/\/(api\.openalex\.org|api\.crossref\.org)\//;

// Kimlik/iletişim parametreleri anahtara girmez: kayıt kimin istediğinden bağımsız.
export function kayitAnahtari(adres) {
  const u = new URL(adres);
  for (const p of ["mailto", "api_key"]) u.searchParams.delete(p);
  u.searchParams.sort();
  return createHash("sha1").update(`${u.origin}${u.pathname}?${u.searchParams}`).digest("hex").slice(0, 20);
}

if (KIP === "kaydet" || KIP === "oynat") {
  fs.mkdirSync(KLASOR, { recursive: true });
  const asil = globalThis.fetch;
  globalThis.fetch = async (girdi, secenek) => {
    const adres = typeof girdi === "string" ? girdi : girdi instanceof URL ? girdi.href : girdi?.url;
    if (!adres || !HEDEF.test(adres)) return asil(girdi, secenek);
    const dosya = path.join(KLASOR, `${kayitAnahtari(adres)}.json`);
    if (KIP === "oynat") {
      if (!fs.existsSync(dosya)) {
        console.error(`[dizin-kaydi] KAYIT YOK (ağa çıkılmadı): ${adres}`);
        throw new TypeError("fetch failed (dizin-kaydi: kayıt yok)");
      }
      const k = JSON.parse(fs.readFileSync(dosya, "utf8"));
      return new Response(k.govde, { status: k.durum, headers: { "content-type": k.tur ?? "application/json" } });
    }
    const cevap = await asil(girdi, secenek);
    if (cevap.status === 200) {
      const govde = await cevap.clone().text();
      fs.writeFileSync(dosya, JSON.stringify({ adres, durum: 200, tur: cevap.headers.get("content-type"), kaydedildi: new Date().toISOString(), govde }));
    } else {
      console.error(`[dizin-kaydi] kaydedilmedi (HTTP ${cevap.status}): ${adres}`);
    }
    return cevap;
  };
  console.error(`[dizin-kaydi] kip=${KIP} klasör=${KLASOR}`);
}
