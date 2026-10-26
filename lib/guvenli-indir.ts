import { isIP } from "node:net";
import { resolve4, resolve6 } from "node:dns/promises";
import { isPrivateAddress, kaynagiOku } from "./safe-official-fetch";

/*
  GENEL AĞDAN GÜVENLİ İNDİRME: açık erişimli kaynak PDF'leri (arXiv,
  kurum arşivleri, dergi siteleri).

  safe-official-fetch.ts yalnızca .edu.tr'ye izin veriyor (kılavuz
  taraması); kaynak PDF'leri her yerde olabilir. Bu yüzden ad sınırı yok,
  ama SSRF süzgeci aynı:
    - yalnızca http(s), kimlik bilgisi ve standart dışı port yok;
    - ad çözülür, iç ağ adresine çıkan istek yapılmaz;
    - yönlendirmeler OTOMATİK izlenmez: her adımda adres yeniden
      denetlenir (genel bir sunucunun 302 ile 169.254.169.254'e
      göndermesi klasik yol), en fazla 5 adım;
    - süre ve boyut sınırlı.

  BİLİNEN SINIR (safe-official-fetch.ts'tekiyle aynı): ad iki kez
  çözülüyor (DNS rebinding penceresi). Burada adresler öğrencinin değil,
  OpenAlex'in açık erişim kayıtlarından geliyor; saldırganın bir kaynak
  kaydını kendi alan adına yönlendirip o adın DNS'ini de yönetmesi
  gerekiyor.
*/

const ZAMAN_ASIMI_MS = 20_000;
const EN_FAZLA_YONLENDIRME = 5;

async function genelAdresMi(url: URL): Promise<void> {
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Desteklenmeyen adres.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Standart dışı port.");
  const ad = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (ad === "localhost" || ad.endsWith(".localhost") || ad.endsWith(".internal") || ad.endsWith(".local")) {
    throw new Error("İç ağ adresi.");
  }
  const adresler = isIP(ad)
    ? [ad]
    : await Promise.race([
        Promise.all([resolve4(ad).catch(() => []), resolve6(ad).catch(() => [])]).then(([d, a]) => [...d, ...a]),
        new Promise<string[]>((coz) => setTimeout(() => coz([]), 5_000)),
      ]);
  if (!adresler.length || adresler.some(isPrivateAddress)) throw new Error("Adres genel ağa çözümlenemedi.");
}

/** Adresi indirir; iç ağa giden, sınırı aşan ya da başarısız istek hata fırlatır. */
export async function guvenliIndir(adres: string, enFazlaBayt: number): Promise<{ bayt: Uint8Array; sonAdres: string; tur: string | null }> {
  let url = new URL(adres);
  const bitis = Date.now() + ZAMAN_ASIMI_MS;
  for (let adim = 0; adim <= EN_FAZLA_YONLENDIRME; adim++) {
    await genelAdresMi(url);
    const kalan = bitis - Date.now();
    if (kalan <= 0) throw new Error("Zaman aşımı.");
    const yanit = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(kalan),
      cache: "no-store",
      headers: {
        Accept: "application/pdf,*/*;q=0.5",
        "User-Agent": "ArvoLab/1.0 (akademik kaynak doğrulama; https://arvolab.app)",
      },
    });
    if (yanit.status >= 300 && yanit.status < 400) {
      const hedef = yanit.headers.get("location");
      if (!hedef) throw new Error("Boş yönlendirme.");
      url = new URL(hedef, url);
      continue;
    }
    if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`);
    const bayt = new Uint8Array(await kaynagiOku(yanit, enFazlaBayt));
    return { bayt, sonAdres: url.toString(), tur: yanit.headers.get("content-type") };
  }
  throw new Error("Çok fazla yönlendirme.");
}
