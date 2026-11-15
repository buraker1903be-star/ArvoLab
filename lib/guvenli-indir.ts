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

/*
  YALNIZCA ASCII. HTTP başlıkları ByteString (Latin-1) olmak zorunda; Node'un
  fetch'i başlıkları kurarken Türkçe karakterde (ğ = 287) TypeError fırlatıyor
  ve istek ağa hiç çıkmıyor. Eskiden (15.11.2026'ya kadar) burada "akademik
  kaynak doğrulama" yazıyordu: açık erişimli HİÇBİR PDF otomatik inmiyor,
  hepsi sessizce "indirilemedi" görünüyordu. Aynı tuzak lib/doi.ts'te
  belgeli (CROSSREF_USER_AGENT). tests/unit/guvenli-indir-baslik.test.ts
  başlıkları gerçek `new Headers(...)`'tan geçirerek sabitliyor.
*/
export const INDIRME_KULLANICI_AJANI = "ArvoLab/1.0 (academic source verification; https://arvolab.app)";

/*
  KARŞI TARAFIN SONUCU olan hata: adres genel ağa çıkmıyor, sunucu
  reddetti, zaman aşımı, bağlantı kurulamadı, sınır aşıldı. Öğrenciye
  "kendiniz yükleyin" denir. Bu sınıfın DIŞINDA kalan her hata (örneğin
  kodun kendisindeki bir TypeError) BİZİM sorunumuzdur ve öyle bildirilir
  (indirmeHatasiTuru): eskiden ikisi aynı "indirilemedi"ye düşüyordu ve bu
  yüzden yukarıdaki hata aylarca fark edilmedi.
*/
export class IndirmeHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "IndirmeHatasi";
  }
}

/** "erisim": karşı taraf ya da ağ; "beklenmeyen": bizim tarafımızda bir hata. */
export function indirmeHatasiTuru(hata: unknown): "erisim" | "beklenmeyen" {
  return hata instanceof IndirmeHatasi ? "erisim" : "beklenmeyen";
}

/*
  fetch'in AĞ hatası (undici: TypeError "fetch failed", nedeni cause'da) ve
  zaman aşımı/iptal karşı tarafın sonucudur. Başka her TypeError (başlık
  kurulamadı, geçersiz seçenek) bizim hatamızdır ve olduğu gibi fırlar.
*/
function agHatasiMi(hata: unknown): boolean {
  if (hata instanceof Error && (hata.name === "TimeoutError" || hata.name === "AbortError")) return true;
  return hata instanceof TypeError && hata.message === "fetch failed";
}

async function genelAdresMi(url: URL): Promise<void> {
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new IndirmeHatasi("Desteklenmeyen adres.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new IndirmeHatasi("Standart dışı port.");
  const ad = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (ad === "localhost" || ad.endsWith(".localhost") || ad.endsWith(".internal") || ad.endsWith(".local")) {
    throw new IndirmeHatasi("İç ağ adresi.");
  }
  const adresler = isIP(ad)
    ? [ad]
    : await Promise.race([
        Promise.all([resolve4(ad).catch(() => []), resolve6(ad).catch(() => [])]).then(([d, a]) => [...d, ...a]),
        new Promise<string[]>((coz) => setTimeout(() => coz([]), 5_000)),
      ]);
  if (!adresler.length || adresler.some(isPrivateAddress)) throw new IndirmeHatasi("Adres genel ağa çözümlenemedi.");
}

/** Adresi indirir; iç ağa giden, sınırı aşan ya da başarısız istek hata fırlatır. */
export async function guvenliIndir(adres: string, enFazlaBayt: number): Promise<{ bayt: Uint8Array; sonAdres: string; tur: string | null }> {
  let url = new URL(adres);
  const bitis = Date.now() + ZAMAN_ASIMI_MS;
  for (let adim = 0; adim <= EN_FAZLA_YONLENDIRME; adim++) {
    await genelAdresMi(url);
    const kalan = bitis - Date.now();
    if (kalan <= 0) throw new IndirmeHatasi("Zaman aşımı.");
    let yanit: Response;
    try {
      yanit = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(kalan),
        cache: "no-store",
        headers: {
          Accept: "application/pdf,*/*;q=0.5",
          "User-Agent": INDIRME_KULLANICI_AJANI,
        },
      });
    } catch (hata) {
      if (agHatasiMi(hata)) throw new IndirmeHatasi(hata instanceof Error ? hata.message : "Bağlantı kurulamadı.");
      throw hata;
    }
    if (yanit.status >= 300 && yanit.status < 400) {
      const hedef = yanit.headers.get("location");
      if (!hedef) throw new IndirmeHatasi("Boş yönlendirme.");
      url = new URL(hedef, url);
      continue;
    }
    if (!yanit.ok) throw new IndirmeHatasi(`HTTP ${yanit.status}`);
    let bayt: Uint8Array;
    try {
      bayt = new Uint8Array(await kaynagiOku(yanit, enFazlaBayt));
    } catch (hata) {
      // Boyut sınırı (kaynagiOku) ya da yarıda kesilen akış: karşı tarafın sonucu.
      throw new IndirmeHatasi(hata instanceof Error ? hata.message : "Dosya okunamadı.");
    }
    return { bayt, sonAdres: url.toString(), tur: yanit.headers.get("content-type") };
  }
  throw new IndirmeHatasi("Çok fazla yönlendirme.");
}
