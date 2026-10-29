import { createAdminClient } from "@/lib/supabase/admin";

// Bireysel abonelik ArvoOS'ta tutulur: fiyat, deneme süresi ve askıya alma
// kararı oradadır. ArvoLab yalnızca "durumum ne" diye sorar ve ödeme
// bağlantısı ister. Çağrı sunucudan sunucuya yapılır; paylaşılan gizli
// anahtar (PRODUCT_BRIDGE_SECRET) iki tarafta aynıdır.
//
// Kuruma bağlı kullanıcılar bu yoldan geçmez; onların lisansı kurum üzerinden
// organizations tablosuna yansıtılır (lib/license.ts).

import { normalizePlans, type BillingPlan } from "@/lib/billing-plan";
import { krediPaketleriniOku, type KrediPaketi } from "@/lib/kredi-paketleri";
import { faturalamaOku, type Faturalama } from "@/lib/faturalama";
import { kartDurumuOku, kartOdemesiOku, type KartDurumu, type KartOdemesi } from "@/lib/kart-odeme";

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
    /*
      Supabase istemcisi sorgu hatasında istisna FIRLATMAZ, { error } döndürür.
      Bu satır eskiden error'ı hiç okumuyordu: izin eksikliği yüzünden hiçbir
      şey yazılmıyordu ama log'a da bir şey düşmüyordu, sorun görünmez kaldı.
    */
    const { error } = await admin.from("bridge_health").upsert({
      id: "arvoos",
      ...(ok
        ? { last_ok_at: now }
        : { last_error_at: now, last_error: (message ?? "").slice(0, 500), last_error_kind: kind }),
      updated_at: now,
    }, { onConflict: "id" });
    if (error) console.error("[abonelik] köprü sağlık kaydı yazılamadı", error.message);
  } catch (error) {
    console.error("[abonelik] köprü sağlık kaydı yazılamadı", error instanceof Error ? error.message : error);
  }
}

/*
  Bireysel aboneliğin ArvoLab'daki aynası. Abonelik ArvoOS'ta tutuluyor ama
  veritabanı kapısı (public.subscription_open, migration 20260924100003)
  PostgREST'e doğrudan gelen isteği de durdurabilmek için yerel bir kayda
  bakmak zorunda. Ayna yoksa kimse engellenmez, bu yüzden yazılamaması akışı
  bozmaz: yalnızca log'a düşer.
*/
async function mirrorSubscription(userId: string, state: SubscriptionState) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("individual_subscriptions").upsert({
      user_id: userId,
      status: state.status ?? "unknown",
      trial_ends_at: state.trialEndsAt ?? null,
      current_period_end: state.currentPeriodEnd ?? null,
      synced_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) console.error("[abonelik] yerel ayna yazılamadı", error.message);
  } catch (error) {
    console.error("[abonelik] yerel ayna yazılamadı", error instanceof Error ? error.message : error);
  }
}

export interface SubscriptionState {
  status: string;
  access: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** ArvoOS'un sunduğu abonelik planları (aylık, yıllık) */
  plans: BillingPlan[];
  /** Bireysel abonenin alabileceği AI kredi paketleri (ArvoOS'un listesi). */
  krediPaketleri: KrediPaketi[];
  /**
   * Kart saklama ve otomatik yenileme açık mı (ArvoOS'taki özellik anahtarı).
   * Alan gelmezse kapalı: eski ArvoOS sürümü kart işlemlerini tanımıyor.
   */
  cardStorage: boolean;
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
  action: "ensure" | "checkout" | "close" | "credit_checkout",
  user: { id: string; email: string; fullName?: string | null },
  planCode?: string | null,
  paketKodu?: string | null
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
        // Kredi paketi: tutarı ve kredi miktarını ArvoOS koddan belirler.
        ...(paketKodu ? { paket: paketKodu } : {}),
      }),
      cache: "no-store",
      // Zaman aşımı olmadan ArvoOS asılı kalırsa panel de fonksiyon zaman
      // aşımına kadar donuyordu; "ulaşılamazsa kimse engellenmez" ilkesi
      // pratikte bozuluyordu (lib/license-decision.ts).
      signal: AbortSignal.timeout(8000),
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
    const state = {
      ...(payload as unknown as SubscriptionState),
      plans: normalizePlans(payload),
      krediPaketleri: krediPaketleriniOku(payload),
      cardStorage: payload.cardStorage === true,
    };
    /*
      close bir abonelik DURUMU döndürmez ({closed: true}); aynayı onunla
      yazmak "status: unknown" taşıyan uydurma bir satır bırakırdı. Zaten
      satır birazdan kullanıcıyla birlikte siliniyor.
    */
    if (action !== "close" && action !== "credit_checkout") await mirrorSubscription(user.id, state);
    return state;
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

/**
 * Hesabı kalıcı silinen abonenin ArvoOS kaydını kapatır.
 *
 * Kayıt SİLİNMEZ: subscriber_payments ve payment_links ona cascade ile bağlı
 * ve VUK ödeme kayıtlarının beş yıl saklanmasını zorunlu tutuyor. ArvoOS
 * durumu 'canceled' yapıp kişisel alanları anonimleştiriyor.
 *
 * Yalnızca kalıcı silme anında çağrılıyor, silme TALEBİNDE değil: 30 günlük
 * bekleme içinde geri dönen kullanıcının anonimleştirilmiş kaydını geri
 * getirmek gerekirdi ve o yol hatanın kolayca saklanacağı bir yol.
 *
 * null dönerse kapatma doğrulanamamıştır; çağıran hesabı SİLMEMELİ, yoksa
 * ArvoOS'ta sahibi olmayan bir abone kaydı kalır.
 */
export const closeSubscription = (user: { id: string; email: string }) => call("close", user);

/** Ödeme bağlantısı üretir; kullanıcı PayTR'nin güvenli sayfasına gider. */
export const startSubscriptionCheckout = (
  user: { id: string; email: string; fullName?: string | null },
  planCode?: string | null
) => call("checkout", user, planCode);

/**
 * AI kredi paketi için ödeme bağlantısı üretir (bireysel abone).
 * Kurum üyesine ArvoOS 409 döndürür: kurumun kredisini kurum yöneticisi alır.
 */
export const startCreditCheckout = (
  user: { id: string; email: string; fullName?: string | null },
  paketKodu: string
) => call("credit_checkout", user, null, paketKodu);

/*
  Faturalar ve ödemeler (Abonelik ve kredi sayfası). Abonelik durumu
  değil, okunacak bir liste: aynaya ve köprü sağlık kaydına yazılmıyor.
  Ulaşılamazsa null — sayfa "okunamadı" der, boş liste göstermez (boş
  liste "hiç ödemeniz yok" demek olurdu).
*/
async function faturalamaIstegi(govde: Record<string, unknown>): Promise<unknown> {
  const target = endpoint();
  if (!target) return null;
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-arvo-bridge-secret": target.secret },
      body: JSON.stringify({ product: PRODUCT, ...govde }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("[faturalama] ArvoOS yanıtı", govde.action, response.status);
      return null;
    }
    return (await response.json()) as unknown;
  } catch (error) {
    console.error("[faturalama] ArvoOS'a ulaşılamadı", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Bireysel abonenin kendi ödemeleri ve faturaları. */
export const faturalarim = async (user: { id: string; email: string }) =>
  faturalamaOku(await faturalamaIstegi({ action: "billing", userId: user.id, email: user.email }));


/*
  org_billing kurumun KREDİ PAKETLERİNİ de taşıyor (28.10.2026, kurum
  sahibinin kararı: kurum yöneticisi krediyi ArvoLab'dan alıyor). Ayrı bir
  çağrı açılmadı: Abonelik ve kredi sayfası faturaları zaten bu çağrıyla
  okuyor ve paketi kimin görebileceği faturaları kimin görebileceğiyle aynı.
  Yanıt okunamazsa paket listesi boş — sayfa "yüklenemedi" der.
*/
/* YETKİ ÇAĞIRANDA: köprü kurumu kimliğiyle okuyor, kişiyi tanımıyor — kurum yöneticisi olduğu doğrulanmadan çağrılmamalı. */
export async function kurumFaturalamasi(organizationId: string): Promise<{ faturalama: Faturalama | null; krediPaketleri: KrediPaketi[] }> {
  const ham = await faturalamaIstegi({ action: "org_billing", organizationId });
  return { faturalama: faturalamaOku(ham), krediPaketleri: krediPaketleriniOku(ham) };
}

/** Kapsama göre liste: bireysel abonenin kendi ödemeleri ya da kurum yöneticisinin kurumunkiler. */
export async function faturalamaYukle(
  kapsam: { tur: "bireysel" } | { tur: "kurum"; kurumId: string },
  user: { id: string; email: string },
) {
  return (await faturalamaVePaketler(kapsam, user)).faturalama;
}

/** Faturalama ve (kurumda) kredi paketleri tek köprü çağrısıyla. Bireysel abonenin paketleri ensure'dan gelir. */
export async function faturalamaVePaketler(
  kapsam: { tur: "bireysel" } | { tur: "kurum"; kurumId: string },
  user: { id: string; email: string },
): Promise<{ faturalama: Faturalama | null; krediPaketleri: KrediPaketi[] }> {
  if (kapsam.tur === "kurum") return kurumFaturalamasi(kapsam.kurumId);
  return { faturalama: await faturalarim(user), krediPaketleri: [] };
}

/*
  KAYITLI KART VE OTOMATİK YENİLEME (28.10.2026). Ödeme mantığı ArvoOS'ta
  (PayTR kart saklama); burada yalnızca köprü çağrısı var. Yanıt ayrı
  okunuyor çünkü bu çağrıların iş hataları ({error: "fee_not_set"} gibi)
  KULLANICIYA söylenecek bir şey; call() her hatayı null'a indiriyor.

  Köprü sağlık kaydı: yalnızca köprünün kendisinin bozulduğunu gösteren
  hâller (anahtar uyuşmuyor, ulaşılamıyor, kodu olmayan sunucu hatası)
  yazılır. "Ücret tanımlanmadı" ya da "kart saklama kapalı" köprü arızası
  değil; Platform ekranında köprüyü kırmızıya çevirmemeli.
*/
export type KartSonucu<T> = { ok: true; veri: T } | { ok: false; hata: string | null };

type Kullanici = { id: string; email: string; fullName?: string | null };

/*
  İş hatasını taşıyan köprü çağrısı. Kart işlemleri ve kurumun kredi
  ödemesi (org_credit_checkout) aynı sözleşmeyi kullanıyor: 2xx → gövde,
  aksi hâlde {error: "<kod>"}.
*/
async function kodluIstek(action: string, govde: Record<string, unknown>): Promise<KartSonucu<unknown>> {
  const target = endpoint();
  if (!target) {
    await recordHealth(false, "ARVOOS_BRIDGE_URL veya PRODUCT_BRIDGE_SECRET tanımlı değil", "permanent");
    return { ok: false, hata: null };
  }
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-arvo-bridge-secret": target.secret },
      body: JSON.stringify({ product: PRODUCT, action, ...govde }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const yanit = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const kod = typeof yanit?.error === "string" ? yanit.error.slice(0, 64) : null;
      console.error("[kart] ArvoOS yanıtı", action, response.status, kod);
      if (response.status === 401) await recordHealth(false, `${action}: HTTP 401`, "permanent");
      else if (response.status >= 500 && !kod) await recordHealth(false, `${action}: HTTP ${response.status}`, "transient");
      return { ok: false, hata: kod };
    }
    await recordHealth(true);
    return { ok: true, veri: yanit };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[kart] ArvoOS'a ulaşılamadı", action, message);
    await recordHealth(false, `${action}: ${message}`, "transient");
    return { ok: false, hata: null };
  }
}

const kartIstegi = (
  action: "card_checkout" | "card_consent" | "card_state" | "card_disable_renewal" | "card_delete",
  user: Kullanici,
  ek: Record<string, unknown> = {},
) => kodluIstek(action, { userId: user.id, email: user.email, fullName: user.fullName ?? null, ...ek });

/**
 * Kartla ödeme kaydı açar. HER çağrı yeni bir ödeme kaydı demek: yalnızca
 * kullanıcının düğmesinden (sunucu işlemi) çağrılmalı, sayfa çiziminden değil.
 * Tutarı ArvoOS belirler. ip: PayTR son kullanıcının adresini zorunlu tutuyor.
 */
export async function kartOdemesiBaslat(user: Kullanici, ip: string): Promise<KartSonucu<KartOdemesi>> {
  const sonuc = await kartIstegi("card_checkout", user, { ip });
  if (!sonuc.ok) return sonuc;
  const odeme = kartOdemesiOku(sonuc.veri);
  if (!odeme) {
    console.error("[kart] card_checkout yanıtı okunamadı");
    return { ok: false, hata: null };
  }
  return { ok: true, veri: odeme };
}

/**
 * Kullanıcının "kartımı kaydet, otomatik yenilensin" kararı. Kart formu
 * PayTR'ye gönderilmeden ÖNCE yazılır: karar ödemeden önce kayıtlı olmalı,
 * yoksa ArvoOS kartı onaysız saklamış olurdu.
 */
export async function kartOnayiBildir(user: Kullanici, merchantOid: string, autoRenew: boolean, ip: string): Promise<KartSonucu<true>> {
  const sonuc = await kartIstegi("card_consent", user, { merchantOid, autoRenew, ip });
  return sonuc.ok ? { ok: true, veri: true } : sonuc;
}

/** Kayıtlı kartlar ve otomatik yenileme. Okunamazsa ok:false — sayfa "okunamadı" der, "kartınız yok" demez. */
export async function kartDurumum(user: Kullanici): Promise<KartSonucu<KartDurumu>> {
  const sonuc = await kartIstegi("card_state", user);
  if (!sonuc.ok) return sonuc;
  const durum = kartDurumuOku(sonuc.veri);
  if (!durum) {
    console.error("[kart] card_state yanıtı okunamadı");
    return { ok: false, hata: null };
  }
  return { ok: true, veri: durum };
}

export async function otomatikYenilemeKapat(user: Kullanici): Promise<KartSonucu<true>> {
  const sonuc = await kartIstegi("card_disable_renewal", user);
  return sonuc.ok ? { ok: true, veri: true } : sonuc;
}

export async function kayitliKartSil(user: Kullanici, cardId: string): Promise<KartSonucu<true>> {
  const sonuc = await kartIstegi("card_delete", user, { cardId });
  return sonuc.ok ? { ok: true, veri: true } : sonuc;
}

/**
 * Kurumun AI kredi paketi için ödeme bağlantısı (28.10.2026). YETKİ
 * ÇAĞIRANDA: köprü kurumu kimliğiyle tanıyor, kişiyi tanımıyor — çağıran
 * kişinin o kurumun faturalarını görmeye yetkili olduğunu (faturalamaKapsami)
 * doğrulamadan çağrılmamalı. Tutarı ve kredi miktarını ArvoOS paket
 * kodundan belirler.
 */
export async function kurumKrediOdemesiBaslat(organizationId: string, paket: string): Promise<KartSonucu<string>> {
  const sonuc = await kodluIstek("org_credit_checkout", { organizationId, paket });
  if (!sonuc.ok) return sonuc;
  const adres = (sonuc.veri as { checkoutUrl?: unknown } | null)?.checkoutUrl;
  if (typeof adres !== "string" || !/^https:\/\//.test(adres)) {
    console.error("[kredi] org_credit_checkout yanıtında ödeme adresi yok");
    return { ok: false, hata: null };
  }
  return { ok: true, veri: adres };
}
