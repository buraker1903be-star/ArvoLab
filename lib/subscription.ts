import { createAdminClient } from "@/lib/supabase/admin";

// Bireysel abonelik ArvoOS'ta tutulur: fiyat, deneme süresi ve askıya alma
// kararı oradadır. ArvoLab yalnızca "durumum ne" diye sorar ve ödeme
// bağlantısı ister. Çağrı sunucudan sunucuya yapılır; paylaşılan gizli
// anahtar (PRODUCT_BRIDGE_SECRET) iki tarafta aynıdır.
//
// Kuruma bağlı kullanıcılar bu yoldan geçmez; onların lisansı kurum üzerinden
// organizations tablosuna yansıtılır (lib/license.ts).

import { normalizePlans, type BillingPlan } from "@/lib/billing-plan";

const PRODUCT = "arvolab";

/*
  Köprünün durumu kendi veritabanımıza yazılır. ArvoOS Platform ekranı bunu
  okuyup uyarı gösterir — köprü kopuk olsa bile bu yol çalışır, çünkü ArvoOS
  buraya doğrudan servis anahtarıyla bağlanıyor.

  Yanlış yazılmış bir PRODUCT_BRIDGE_SECRET köprüyü kalıcı olarak kırar ve
  herkes süresiz bedava kullanır; tek iz sunucu log'u olursa aylarca fark
  edilmez. Kullanıcıyı engellemiyoruz ama sessiz de kalmıyoruz.

  Kaydetme başarısız olursa yutulur: sağlık kaydı yüzünden girişi bozmak anlamsız.
*/
async function recordHealth(ok: boolean, message?: string, kind: "permanent" | "transient" = "transient") {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    await admin.from("bridge_health").upsert({
      id: "arvoos",
      ...(ok
        ? { last_ok_at: now }
        : { last_error_at: now, last_error: (message ?? "").slice(0, 500), last_error_kind: kind }),
      updated_at: now,
    }, { onConflict: "id" });
  } catch (error) {
    console.error("[abonelik] köprü sağlık kaydı yazılamadı", error instanceof Error ? error.message : error);
  }
}

export interface SubscriptionState {
  status: string;
  access: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** ArvoOS'un sunduğu abonelik planları (aylık, yıllık) */
  plans: BillingPlan[];
  checkoutUrl?: string;
}

function endpoint() {
  const base = process.env.ARVOOS_BRIDGE_URL;
  const secret = process.env.PRODUCT_BRIDGE_SECRET;
  if (!base || !secret) return null;
  return { url: `${base.replace(/\/$/, "")}/api/bridge/subscription`, secret };
}

export const bridgeConfigured = () => endpoint() !== null;

async function call(
  action: "ensure" | "checkout",
  user: { id: string; email: string; fullName?: string | null },
  planCode?: string | null
) {
  const target = endpoint();
  if (!target) {
    // Ortam değişkeni eksik: kalıcı yapılandırma hatası, kendiliğinden düzelmez.
    await recordHealth(false, "ARVOOS_BRIDGE_URL veya PRODUCT_BRIDGE_SECRET tanımlı değil", "permanent");
    return null;
  }
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-arvo-bridge-secret": target.secret },
      body: JSON.stringify({
        product: PRODUCT,
        action,
        userId: user.id,
        email: user.email,
        fullName: user.fullName ?? null,
        // Dönem seçimi kullanıcınındır; tutarı ArvoOS belirler.
        ...(planCode ? { plan: planCode } : {}),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[abonelik] ArvoOS yanıtı", action, response.status, body);
      /*
        401 anahtar uyuşmuyor, 400 istek hatalı: ikisi de kendiliğinden
        düzelmez, yapılandırma düzeltilmeli. Diğerleri geçici sayılır.
      */
      const kind = response.status === 401 || response.status === 400 ? "permanent" : "transient";
      await recordHealth(false, `${action}: HTTP ${response.status} ${body}`.trim(), kind);
      return null;
    }
    const payload = (await response.json()) as Record<string, unknown>;
    await recordHealth(true);
    return { ...(payload as unknown as SubscriptionState), plans: normalizePlans(payload) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[abonelik] ArvoOS'a ulaşılamadı", action, message);
    await recordHealth(false, `${action}: ${message}`, "transient");
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
export const startSubscriptionCheckout = (
  user: { id: string; email: string; fullName?: string | null },
  planCode?: string | null
) => call("checkout", user, planCode);
