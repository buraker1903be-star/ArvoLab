// Bireysel abonelik ArvoOS'ta tutulur: fiyat, deneme süresi ve askıya alma
// kararı oradadır. ArvoLab yalnızca "durumum ne" diye sorar ve ödeme
// bağlantısı ister. Çağrı sunucudan sunucuya yapılır; paylaşılan gizli
// anahtar (PRODUCT_BRIDGE_SECRET) iki tarafta aynıdır.
//
// Kuruma bağlı kullanıcılar bu yoldan geçmez; onların lisansı kurum üzerinden
// organizations tablosuna yansıtılır (lib/license.ts).

const PRODUCT = "arvolab";

export interface SubscriptionState {
  status: string;
  access: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  monthlyFee: number | null;
  checkoutUrl?: string;
}

function endpoint() {
  const base = process.env.ARVOOS_BRIDGE_URL;
  const secret = process.env.PRODUCT_BRIDGE_SECRET;
  if (!base || !secret) return null;
  return { url: `${base.replace(/\/$/, "")}/api/bridge/subscription`, secret };
}

export const bridgeConfigured = () => endpoint() !== null;

async function call(action: "ensure" | "checkout", user: { id: string; email: string; fullName?: string | null }) {
  const target = endpoint();
  if (!target) return null;
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-arvo-bridge-secret": target.secret },
      body: JSON.stringify({ product: PRODUCT, action, userId: user.id, email: user.email, fullName: user.fullName ?? null }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[abonelik] ArvoOS yanıtı", action, response.status, await response.text().catch(() => ""));
      return null;
    }
    return (await response.json()) as SubscriptionState;
  } catch (error) {
    console.error("[abonelik] ArvoOS'a ulaşılamadı", action, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Kullanıcının abonelik durumunu alır; ilk çağrıda kaydı ArvoOS'ta açar ve
 * deneme süresini başlatır. ArvoOS'a ulaşılamazsa null döner — çağıran taraf
 * bunu "engelleme" olarak yorumlamaz; geçici bir arıza kimseyi dışarıda
 * bırakmamalı.
 */
export const ensureSubscription = (user: { id: string; email: string; fullName?: string | null }) => call("ensure", user);

/** Ödeme bağlantısı üretir; kullanıcı PayTR'nin güvenli sayfasına gider. */
export const startSubscriptionCheckout = (user: { id: string; email: string; fullName?: string | null }) => call("checkout", user);
