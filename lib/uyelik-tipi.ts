/*
  ÜYELİK TİPİ (25.11.2026).

  Hesap ekranındaki "Üyelik tipi" satırı ile sol navigasyondaki ad
  altındaki etiket AYNI yerden okunuyor. Eskiden ikisi de ROLÜ
  gösteriyordu ("Üye / Öğrenci"): rol bir yetki kavramı, müşterinin
  "hangi üyelikteyim" sorusunun cevabı değil. İki ekran ayrı ayrı karar
  verseydi biri plan adını, öteki rolü gösterip birbirinden saparlardı.

  ETİKET İKİ ŞEY BİRDEN GEREKTİRİYOR: abonenin YÜRÜRLÜKTEKİ plan kodu
  (access.planKodu) ve o kodun katalogdaki ADI (plans[].ad). Biri bile
  yoksa null dönüyor ve çağıran satırı HİÇ çizmiyor — "—" yazmak ya da
  rolü oraya koymak, bilinmeyeni biliniyormuş gibi göstermek olurdu.

  Bugün gerçek ArvoOS ikisini de bildirmiyor (bkz. #151'deki bağımlılık
  tablosu), yani satır üretimde gizli. Köprü bildirmeye başladığı gün
  kod değişikliği gerekmeden görünür olur.

  Saf modül; testi tests/unit/uyelik-tipi.test.ts.
*/

import type { BillingPlan } from "./billing-plan";

export type UyelikKaynagi = {
  /** lib/access.ts AccessState.plans */
  plans: BillingPlan[];
  /** lib/access.ts AccessState.planKodu */
  planKodu: string | null;
};

/**
 * Abonenin üyelik tipi ("Standart", "Plus", "Pro"); bilinmiyorsa null.
 *
 * Kod katalogda bulunamazsa da null: katalogda olmayan bir koda ad
 * uydurmak, kullanıcıya ödemediği bir planı göstermek olurdu.
 */
export function uyelikTipi({ plans, planKodu }: UyelikKaynagi): string | null {
  if (!planKodu) return null;
  const plan = plans.find((p) => p.code === planKodu);
  const ad = plan?.ad;
  return typeof ad === "string" && ad.trim() ? ad.trim() : null;
}
