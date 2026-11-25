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
  /** lib/access.ts AccessState.status — ArvoOS'un bildirdiği durum. */
  durum: string;
};

/*
  ÜCRETLİ PLAN ETİKETİ YALNIZCA ABONELİK ETKİNKEN (25.11.2026).

  Eskiden yalnızca plan koduna bakılıyordu. Köprü DENEMEDEKİ bir
  aboneye de plan kodu bildirebiliyor (deneme bir planın üstünde
  başlatılmış olabilir) ve ekranda aynı anda "Deneme süresi" ile "Pro"
  yazıyordu: kullanıcı ödemediği bir üyeliğin adını kendi hesabında
  görüyordu. Ücretli etiket ancak ödeme ArvoOS'ta doğrulanıp abonelik
  ETKİN olduğunda çıkıyor.

  Denemede, ödemesi gecikmişte, iptal edilmişte ve durumu bilinmeyende
  null dönüyor; çağıran satırı hiç çizmiyor.
*/
const ETKIN_DURUMLAR = new Set(["active", "trialing_paid", "etkin"]);

/**
 * Abonenin üyelik tipi ("Standart", "Plus", "Pro"); bilinmiyorsa ya da
 * abonelik etkin değilse null.
 *
 * Kod katalogda bulunamazsa da null: katalogda olmayan bir koda ad
 * uydurmak, kullanıcıya ödemediği bir planı göstermek olurdu.
 */
export function uyelikTipi({ plans, planKodu, durum }: UyelikKaynagi): string | null {
  if (!ETKIN_DURUMLAR.has(durum)) return null;
  if (!planKodu) return null;
  const plan = plans.find((p) => p.code === planKodu);
  const ad = plan?.ad;
  return typeof ad === "string" && ad.trim() ? ad.trim() : null;
}
