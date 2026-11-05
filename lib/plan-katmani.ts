/*
  PLAN KATMANI (Signature OS 4.4, 05.11.2026).

  Abonelik ve Kredi ekranının "Planınız" başlığındaki etiket. BUGÜN yalnızca
  elimizdeki veriden üretilir: erişim türü (bireysel, kurum, iç ekip) ve
  durum. Ücretsiz / Plus / Pro gibi katmanlar HENÜZ YOK; ArvoOS bir plan
  kodu göndermeye başladığında eşleme BURAYA eklenir (tek yer), ekran
  değişmez. Uydurma bir katman adı yazılmaz: bilinmeyen durumda etiket
  "Abonelik" kalır.

  Saf modül; testi tests/unit/plan-katmani.test.ts.
*/
import type { Metin } from "@/lib/dil";

export type PlanKatmani = "bireysel" | "kurum" | "ic-ekip" | "bilinmiyor";

export const PLAN_ADI: Record<PlanKatmani, Metin> = {
  bireysel: { tr: "Bireysel abonelik", en: "Individual subscription" },
  kurum: { tr: "Kurum lisansı", en: "Institution license" },
  "ic-ekip": { tr: "İç ekip", en: "Internal team" },
  bilinmiyor: { tr: "Abonelik", en: "Subscription" },
};

export function planKatmani(erisim: { kind: string; status: string }): PlanKatmani {
  if (erisim.kind === "staff") return erisim.status === "internal" ? "ic-ekip" : "bilinmiyor";
  if (erisim.kind === "organization") return "kurum";
  if (erisim.kind === "individual") return erisim.status === "unknown" || erisim.status === "unreachable" ? "bilinmiyor" : "bireysel";
  return "bilinmiyor";
}
