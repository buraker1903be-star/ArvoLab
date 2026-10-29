/*
  KARTLA ÖDEME VE KAYITLI KART (28.10.2026) — köprü yanıtlarının okunması.

  Ödeme mantığının tamamı ArvoOS'ta (PayTR Direkt API, kart saklama,
  otomatik yenileme). ArvoLab yalnızca abonelik köprüsüne sorar
  (card_checkout, card_consent, card_state, card_disable_renewal,
  card_delete) ve ekranı çizer. Kart numarası ArvoLab sunucusuna HİÇ
  gelmez: kart formu doğrudan PayTR'ye gönderilir
  (app/dashboard/abonelik/kart/[oid]/kart-formu.tsx).

  Yanıtlar hoşgörülü ama uydurmadan okunuyor (lib/faturalama.ts ile aynı
  ilke): okunamayan kart satırı ATILIR, kart listesinin kendisi
  okunamıyorsa null döner — "kayıtlı kartınız yok" demek, okunamayanı
  boş göstermek olurdu.

  Saf modül; testi tests/unit/kart-odeme.test.ts.
*/

import type { Metin } from "./dil";

export type KartOdemesi = {
  /** PayTR'nin form adresi; kart formu buraya doğrudan gönderilir. */
  paymentUrl: string;
  merchantOid: string;
  /** Kuruş. */
  amount: number;
  title: string;
  /** PayTR'nin beklediği gizli alanlar (imzalı belirteç dahil; kart verisi DEĞİL). */
  fields: Record<string, string>;
  utoken: string | null;
  consentText: string;
};

export type KayitliKart = {
  id: string;
  last4: string;
  bank: string | null;
  scheme: string | null;
  expMonth: string | null;
  expYear: string | null;
};

export type OtomatikYenileme = {
  active: boolean;
  cardId: string;
  lastError: string | null;
  consentAt: string;
};

export type KartDurumu = { cards: KayitliKart[]; autoRenew: OtomatikYenileme | null };

const metin = (deger: unknown, azami = 200): string | null =>
  typeof deger === "string" && deger.trim() ? deger.trim().slice(0, azami) : null;

/* PayTR sipariş numarası yalnızca harf ve rakam kabul ediyor; adrese ve çerez adına da giriyor. */
export const siparisNoMu = (deger: unknown): deger is string => typeof deger === "string" && /^[A-Za-z0-9]{1,64}$/.test(deger);

/* PayTR alan adları: harf, rakam, alt çizgi. Başka bir ad gizli alan olarak forma girmemeli. */
const ALAN_ADI = /^[a-z0-9_]{1,64}$/i;

export function kartOdemesiOku(payload: unknown): KartOdemesi | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const paymentUrl = typeof p.paymentUrl === "string" && /^https:\/\/[^\s"<>]+$/.test(p.paymentUrl) ? p.paymentUrl : null;
  const merchantOid = siparisNoMu(p.merchantOid) ? p.merchantOid : null;
  const amount = typeof p.amount === "number" && Number.isInteger(p.amount) && p.amount > 0 ? p.amount : null;
  if (!paymentUrl || !merchantOid || !amount) return null;
  if (!p.fields || typeof p.fields !== "object" || Array.isArray(p.fields)) return null;
  const fields: Record<string, string> = {};
  for (const [ad, deger] of Object.entries(p.fields as Record<string, unknown>)) {
    if (!ALAN_ADI.test(ad)) continue;
    if (typeof deger === "string") fields[ad] = deger;
    else if (typeof deger === "number" && Number.isFinite(deger)) fields[ad] = String(deger);
  }
  /*
    Sipariş numarası formda da aynı olmalı: onay (card_consent) adresteki
    numaraya veriliyor; PayTR'ye başka bir numara giderse kullanıcının
    "kartımı kaydetme" kararı başka bir ödemeye yazılmış olurdu.
  */
  if (fields.merchant_oid !== undefined && fields.merchant_oid !== merchantOid) return null;
  return {
    paymentUrl,
    merchantOid,
    amount,
    title: metin(p.title) ?? "ArvoLab",
    fields,
    utoken: metin(p.utoken, 500),
    consentText: metin(p.consentText, 2000) ?? "",
  };
}

export const KART_KIMLIGI = /^[A-Za-z0-9_-]{1,100}$/;

export function kartDurumuOku(payload: unknown): KartDurumu | null {
  const p = payload as { cards?: unknown; autoRenew?: unknown } | null;
  if (!p || !Array.isArray(p.cards)) return null;
  const cards: KayitliKart[] = [];
  for (const oge of p.cards) {
    if (!oge || typeof oge !== "object") continue;
    const k = oge as Record<string, unknown>;
    // Silme düğmesi kimliği geri gönderiyor; sunucu işlemi aynı deseni bekliyor (app/actions/kart-odeme.ts).
    const id = typeof k.id === "string" && KART_KIMLIGI.test(k.id) ? k.id : null;
    const last4 = typeof k.last4 === "string" && /^\d{4}$/.test(k.last4) ? k.last4 : null;
    if (!id || !last4) continue;
    cards.push({
      id,
      last4,
      bank: metin(k.bank, 80),
      scheme: metin(k.scheme, 40),
      expMonth: metin(k.expMonth, 2),
      expYear: metin(k.expYear, 4),
    });
  }
  let autoRenew: OtomatikYenileme | null = null;
  const a = p.autoRenew as Record<string, unknown> | null | undefined;
  if (a && typeof a === "object") {
    const cardId = metin(a.cardId, 100);
    const consentAt = metin(a.consentAt, 40);
    // Hangi karta ve ne zaman verildiği okunamayan bir onay gösterilmez.
    if (cardId && consentAt && typeof a.active === "boolean") {
      autoRenew = { active: a.active, cardId, consentAt, lastError: metin(a.lastError, 300) };
    }
  }
  return { cards, autoRenew };
}

/**
 * Son kullanıcının IP'si (PayTR zorunlu tutuyor). Vercel'de x-forwarded-for'un
 * İLK değeri istemcidir; sonrakiler aradaki vekiller. IPv6 en fazla 39 karakter.
 */
export function istemciIpsi(xForwardedFor: string | null | undefined, xRealIp: string | null | undefined): string | null {
  for (const aday of [xForwardedFor?.split(",")[0], xRealIp]) {
    const ip = aday?.trim();
    if (ip && ip.length <= 39 && /^[0-9a-f:.]+$/i.test(ip)) return ip;
  }
  return null;
}

/** Son kullanma yılı seçenekleri: bu yıldan başlayarak 12 yıl, iki haneli ("26"). */
export function sonKullanmaYillari(buYil: number): string[] {
  return Array.from({ length: 12 }, (_, i) => String((buYil + i) % 100).padStart(2, "0"));
}

/* PayTR kart numarasını yalnızca rakam olarak bekliyor; kullanıcı dörderli gruplarla yazıyor. */
export const kartNumarasiTemizle = (deger: string) => deger.replace(/\s+/g, "");

/*
  Köprü hata kodları → abonelik sayfasındaki uyarı (?hata=<anahtar>).
  PayTR'nin ya da ArvoOS'un ham hata metni adrese YAZILMAZ: dışarıdan
  sahte bir uyarı yazdırılabilirdi; adres yalnızca bilinen bir anahtar
  taşır.
*/
export const KART_HATALARI: Record<string, Metin> = {
  kart_ucret: {
    tr: "Abonelik ücreti henüz tanımlanmadı; kartla ödeme şu an alınamıyor. Bizimle iletişime geçin.",
    en: "The subscription fee has not been set yet, so card payment is unavailable right now. Please contact us.",
  },
  kart_kurum: {
    tr: "Aboneliğinizi kurumunuz ödüyor; kişisel kart ödemesi alınmıyor.",
    en: "Your institution pays for your subscription; personal card payments are not accepted.",
  },
  kart_eposta: {
    tr: "Hesabınızın e-posta adresi ödeme için geçerli görünmüyor. Ayarlar'dan kontrol edin ya da destekle iletişime geçin.",
    en: "Your account's email address does not look valid for payment. Check it in Settings or contact support.",
  },
  kart_ip: {
    tr: "Bağlantınızın adresi okunamadı; ödeme başlatılamadı. Sayfayı yenileyip tekrar deneyin.",
    en: "Your connection address could not be read, so the payment could not be started. Refresh the page and try again.",
  },
  kart_kapali: {
    tr: "Kartla ödeme şu an kapalı. Diğer ödeme düğmesini kullanabilirsiniz.",
    en: "Card payment is turned off right now. You can use the other payment button.",
  },
  kart: {
    tr: "Kartla ödeme başlatılamadı; ödeme sistemine şu an ulaşılamıyor. Biraz sonra tekrar deneyin.",
    en: "Card payment could not be started; the payment system is unreachable right now. Try again shortly.",
  },
  kart_islem: {
    tr: "İşlem tamamlanamadı; ödeme sistemine şu an ulaşılamıyor. Biraz sonra tekrar deneyin.",
    en: "The action could not be completed; the payment system is unreachable right now. Try again shortly.",
  },
};

export function kartHataAnahtari(kod: string | null | undefined): keyof typeof KART_HATALARI {
  switch (kod) {
    case "fee_not_set":
      return "kart_ucret";
    case "organization_license":
      return "kart_kurum";
    case "invalid_email":
      return "kart_eposta";
    case "invalid_ip":
      return "kart_ip";
    case "card_storage_disabled":
      return "kart_kapali";
    default:
      return "kart";
  }
}

/* Ödeme dönüşü (?sonuc=…) → abonelik sayfasının ?kart=… değeri. Bilinmeyen her şey "hata". */
export const odemeDonusuDurumu = (sonuc: string | null | undefined): "tamam" | "hata" => (sonuc === "tamam" ? "tamam" : "hata");

/**
 * Kurum kredisi ödemesinin köprü hata kodu → Abonelik sayfasının `?hata=`
 * anahtarı. platform_self: seçili kurum ArvoOS'un kendisi (29.10.2026'ya
 * kadar "ödeme başlatılamadı" genel mesajına düşüyordu).
 */
export function kurumKrediHataAnahtari(kod: string | null | undefined): "paket" | "sahip" | "platform" | "odeme" {
  if (kod === "not_found") return "paket";
  if (kod === "no_owner") return "sahip";
  if (kod === "platform_self") return "platform";
  return "odeme";
}
