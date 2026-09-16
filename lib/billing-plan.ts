// Abonelik planları ArvoOS'ta tanımlanır; tahsilatı da ArvoOS yapar. ArvoLab
// yalnızca ArvoOS'un bildirdiği planı gösterir ve ödeme bağlantısı ister —
// burada fiyat, dönem ya da indirim kararı verilmez.
//
// ArvoOS'un alan adları sürümden sürüme değişebildiği için yanıt hoşgörülü
// okunur: tek plan da (price/interval) plan listesi de (plans[]) kabul edilir,
// eski "monthlyFee" alanı da anlaşılır.

export type BillingInterval = "month" | "year";

export interface BillingPlan {
  /** ArvoOS'taki plan kodu; ödeme isteğinde geri gönderilir */
  code: string | null;
  interval: BillingInterval | null;
  /** Kuruş cinsinden tutar (ArvoOS'un bildirdiği) */
  price: number | null;
}

const MONTH_WORDS = ["month", "monthly", "aylik", "ay"];
const YEAR_WORDS = ["year", "yearly", "annual", "annually", "yillik", "yil"];

/** "monthly", "yıllık", "YEAR" → "month" | "year" */
export function normalizeInterval(value: unknown): BillingInterval | null {
  if (typeof value !== "string") return null;
  const key = value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/[^a-z]/g, "");
  if (MONTH_WORDS.includes(key)) return "month";
  if (YEAR_WORDS.includes(key)) return "year";
  return null;
}

const priceOf = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === "number" && Number.isFinite(item) && item > 0);
  return typeof value === "number" ? Math.round(value) : null;
};

const planFrom = (raw: Record<string, unknown>): BillingPlan => ({
  code: typeof raw.code === "string" && raw.code.trim() ? raw.code.trim() : typeof raw.planCode === "string" ? raw.planCode : null,
  // Eski yanıtlarda dönem yazmaz, tutar "monthlyFee" adıyla gelir: aylık sayılır.
  interval: normalizeInterval(raw.interval ?? raw.period ?? raw.billingInterval) ?? (raw.monthlyFee != null ? "month" : null),
  price: priceOf(raw.price, raw.amount, raw.monthlyFee),
});

const isPlan = (plan: BillingPlan) => plan.price !== null || plan.code !== null;

/** ArvoOS yanıtındaki plan(lar). Hiçbiri okunamazsa boş dizi. */
export function normalizePlans(raw: unknown): BillingPlan[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  const list = Array.isArray(record.plans) ? record.plans : [];
  const plans = list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map(planFrom)
    .filter(isPlan);
  if (plans.length) return plans;
  const single = planFrom(record);
  return isPlan(single) ? [single] : [];
}

// Simge tutarın ardına yazılır ("1.490,00 ₺"). Intl'in "currency" biçimi simgeyi
// öne alıyor; Türkçe yazım kuralı ve sunucu/tarayıcı arasında aynı çıktı için
// sayı biçimlendirilip simge elle eklenir.
export const formatTry = (kurus: number) =>
  `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kurus / 100)} ₺`;

const INTERVAL_LABEL: Record<BillingInterval, string> = { month: "Aylık", year: "Yıllık" };

/** "Yıllık 1.490,00 ₺" — yıllıkta aylık karşılığı da eklenir */
export function describePlan(plan: BillingPlan): string {
  if (plan.price === null) return plan.interval ? INTERVAL_LABEL[plan.interval] : "";
  const amount = formatTry(plan.price);
  if (!plan.interval) return amount;
  const label = `${INTERVAL_LABEL[plan.interval]} ${amount}`;
  return plan.interval === "year" ? `${label} · ayda ${formatTry(Math.round(plan.price / 12))}` : label;
}

/** Ödeme düğmesinin üstündeki kısa etiket */
export function planButtonLabel(plan: BillingPlan): string {
  if (plan.price === null) return plan.interval === "year" ? "Yıllık abone ol" : "Abone ol";
  return `${plan.interval ? INTERVAL_LABEL[plan.interval] : ""} ${formatTry(plan.price)}`.trim();
}
