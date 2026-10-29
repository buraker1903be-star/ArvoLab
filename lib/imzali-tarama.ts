/*
  İMZALI TARAMA SONUCU (29.10.2026). Saf modül (yalnızca node:crypto);
  testi tests/unit/imzali-tarama.test.ts.

  Öğrencinin kılavuzu iki adımda kaydediliyor: tarama hiçbir şey yazmıyor,
  sonucunu tarayıcıya veriyor; öğrenci onaylayınca kayıt işlemi sonucu
  GERİ alıyordu. Geri gelen nesne doğrulanmadan saklanıyordu ve editöre
  inen bütün biçim kuralları (kenar boşluğu, punto, satır aralığı, kelime
  sınırı) yalnızca ondan okunuyor. Yani istemci, öğrencinin onayladığı
  özetten farklı kurallar yazabiliyor ve yönetici kuyruğu bunu "çıkarımın
  okuduğu" diye görüyordu; boyut da yalnızca 25 MB'lik genel gövde
  sınırıyla sınırlıydı ve her liste sayfası bu alanı yeniden okuyor.

  Artık sonuç sunucuda imzalanıyor (HMAC-SHA256), imza kullanıcıya ve
  çalışmaya bağlı ve süreli; kayıt imzayı doğrulamadan hiçbir şey yazmıyor.
*/

import { createHmac, timingSafeEqual } from "node:crypto";

/** Tarama ile onay arasında makul süre: OCR'lı belgede bile dakikalar. */
export const TARAMA_OMRU_MS = 2 * 60 * 60 * 1000;
/** İmzalanacak sonucun azami boyutu (bayt). Tarama sonucu birkaç KB; 4000 karakterlik önizleme dahil. */
export const TARAMA_AZAMI_BAYT = 64 * 1024;

const imza = (anahtar: string, govde: string) => createHmac("sha256", anahtar).update(govde).digest("base64url");

/** Sonucu imzalar; çok büyükse null (çağıran kaydetmeyi reddeder). */
export function taramaImzala(veri: unknown, anahtar: string, kapsam: string, simdi = Date.now()): string | null {
  const govde = Buffer.from(JSON.stringify({ k: kapsam, s: simdi + TARAMA_OMRU_MS, v: veri }), "utf8").toString("base64url");
  if (govde.length > TARAMA_AZAMI_BAYT * 1.4) return null;
  return `${govde}.${imza(anahtar, govde)}`;
}

export type TaramaDogrulama = { ok: true; veri: unknown } | { ok: false; neden: "bozuk" | "imza" | "kapsam" | "sure" };

export function taramaDogrula(belirtec: unknown, anahtar: string, kapsam: string, simdi = Date.now()): TaramaDogrulama {
  if (typeof belirtec !== "string" || belirtec.length > TARAMA_AZAMI_BAYT * 1.5) return { ok: false, neden: "bozuk" };
  const [govde, verilen] = belirtec.split(".");
  if (!govde || !verilen) return { ok: false, neden: "bozuk" };
  const beklenen = Buffer.from(imza(anahtar, govde));
  const gelen = Buffer.from(verilen);
  if (beklenen.length !== gelen.length || !timingSafeEqual(beklenen, gelen)) return { ok: false, neden: "imza" };
  try {
    const cozulen = JSON.parse(Buffer.from(govde, "base64url").toString("utf8")) as { k?: unknown; s?: unknown; v?: unknown };
    if (cozulen.k !== kapsam) return { ok: false, neden: "kapsam" };
    if (typeof cozulen.s !== "number" || cozulen.s < simdi) return { ok: false, neden: "sure" };
    return { ok: true, veri: cozulen.v };
  } catch {
    return { ok: false, neden: "bozuk" };
  }
}
