/*
  PLAN VE KREDİ KARŞILAŞTIRMASI (24.11.2026).

  Abonelik ve Kredi sayfasındaki iki karşılaştırma penceresinin saf
  mantığı: hangi plan kullanıcının planı, hangi paket en avantajlı, 100
  kredi başına maliyet ne.

  KATALOG NE SÖYLÜYORSA O YAZILIYOR. Plan adı ("Standart", "Plus",
  "Pro") ve plana dahil aylık kredi ArvoOS'un bildirdiği alanlar; köprü
  bunları göndermiyorsa UYDURULMUYOR, satır "—" kalıyor. Fiyatsız bir
  "Abone ol" düğmesi göstermeme kuralının (lib/billing-plan.ts) aynısı:
  müşteriye bilmediğimiz bir şeyi biliyormuş gibi söylemiyoruz.

  Saf modül; testi tests/unit/plan-karsilastirma.test.ts.
*/

import type { BillingInterval, BillingPlan } from "./billing-plan";
import type { KrediPaketi } from "./kredi-paketleri";

export type PlanSatiri = {
  plan: BillingPlan;
  /** Katalogdan gelen görünen ad; yoksa null (çağıran dönem adını yazar). */
  ad: string | null;
  /** Plana dahil aylık asistan kredisi; katalog bildirmezse null. */
  kredi: number | null;
  /** Kullanıcının YÜRÜRLÜKTEKİ planı mı? */
  mevcut: boolean;
};

/**
 * Kullanıcının planını kodundan bulur. Kod bilinmiyorsa hiçbir satır
 * "Mevcut plan" işaretlenmez: yanlış planı işaretlemek, kullanıcıya
 * ödemediği bir planı ödüyormuş gibi göstermekti.
 */
export function planSatirlari(planlar: BillingPlan[], mevcutKod: string | null): PlanSatiri[] {
  return planlar.map((plan) => ({
    plan,
    ad: plan.ad ?? null,
    kredi: plan.kredi ?? null,
    mevcut: Boolean(mevcutKod && plan.code === mevcutKod),
  }));
}

/** Katalogda hangi dönemler var? Yalnızca biri varsa seçici çizilmez. */
export function donemler(planlar: BillingPlan[]): BillingInterval[] {
  const bulunan = new Set<BillingInterval>();
  for (const p of planlar) if (p.interval) bulunan.add(p.interval);
  return (["month", "year"] as BillingInterval[]).filter((d) => bulunan.has(d));
}

/** Seçili dönemin planları; dönemi bilinmeyen plan her dönemde görünür. */
export const donemPlanlari = (planlar: BillingPlan[], donem: BillingInterval | null): BillingPlan[] =>
  donem === null ? planlar : planlar.filter((p) => p.interval === donem || p.interval === null);

/**
 * 100 kredi başına kuruş. Paket karşılaştırmasında istenen ölçü bu;
 * lib/kredi-paketleri.ts'teki binKrediFiyati 1.000 kredi başına.
 */
export const yuzKrediFiyati = (paket: KrediPaketi): number => Math.round((paket.fiyat / paket.kredi) * 100);

/**
 * En yüksek krediyi taşıyan paket ("Yoğun kullanım için"). Eşitlikte
 * ilki; liste zaten krediye göre sıralı geliyor.
 */
export function enYuksekPaket(paketler: KrediPaketi[]): string | null {
  if (!paketler.length) return null;
  return paketler.reduce((a, b) => (b.kredi > a.kredi ? b : a)).kod;
}

/**
 * Katalogda eksik olanlar: ekran bunları "—" gösteriyor, PR ve destek
 * kaydı için de tek yerden okunabilsin.
 */
export function katalogEksikleri(planlar: BillingPlan[]): {
  adYok: boolean;
  krediYok: boolean;
  fiyatYok: boolean;
  planYok: boolean;
} {
  return {
    planYok: planlar.length === 0,
    adYok: planlar.length > 0 && planlar.every((p) => !p.ad),
    krediYok: planlar.length > 0 && planlar.every((p) => p.kredi == null),
    fiyatYok: planlar.length > 0 && planlar.every((p) => p.price == null),
  };
}
