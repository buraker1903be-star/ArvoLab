/*
  ABONELİĞİ KAPALI KULLANICININ AÇIK KALAN SAYFALARI (28.10.2026). Saf
  modül; testi tests/unit/abonelik-kapisi.test.ts.

  AGENTS.md: "Ödeme, giriş ve destek yolları asla kapatılmaz: engellenen
  kullanıcı kendi kilidini açabilmeli." Panel yerleşimi (dashboard/layout)
  ise abonelik kapanınca /dashboard altındaki HER sayfayı ödeme ekranıyla
  değiştiriyordu: Destek, Abonelik (faturalar, proforma, makbuz) ve Ayarlar
  (şifre, veri indirme, hesap silme) dahil. Ödeme planı tanımlanmamış bir
  kullanıcı "bizimle iletişime geçin" yazısıyla, geçen ayın faturasını
  arayan kurum yöneticisi hiçbir yolla kalıyordu.

  Bu sayfalardaki YAZAN işlemler kendi kapılarını zaten taşıyor (lib/access.ts
  listesi): burada açılan yalnızca ekranın kendisi.
*/
export const KAPISIZ_YOLLAR = [
  "/dashboard/abonelik",
  "/dashboard/settings",
  "/dashboard/expert-requests",
  "/dashboard/support",
] as const;

export function kapisizYolMu(yol: string | null | undefined): boolean {
  if (!yol) return false;
  return KAPISIZ_YOLLAR.some((onek) => yol === onek || yol.startsWith(`${onek}/`));
}

type ErisimDurumu = {
  kind: "individual" | "organization" | string;
  status?: string | null;
  periodEnd?: string | null;
  organizationName?: string | null;
};

/**
 * Kapalı erişimin tam cümlesi. Eskiden "ArvoLab aboneliğiniz" önekine
 * "deneme süreniz doldu" ekleniyordu: deneme süresi biten her kullanıcı
 * "ArvoLab aboneliğiniz deneme süreniz doldu." okuyordu.
 */
export function kapaliErisimCumlesi(erisim: ErisimDurumu): string {
  const bireysel = erisim.kind === "individual";
  const ozne = bireysel ? "ArvoLab aboneliğiniz" : `${erisim.organizationName ?? "Kurumunuzun"} ArvoLab aboneliği`;
  if (erisim.status === "suspended") return `${ozne} askıya alındı.`;
  if (erisim.status === "canceled") return `${ozne} iptal edildi.`;
  if (erisim.status === "trialing") return bireysel ? "ArvoLab deneme süreniz doldu." : `${ozne} deneme süresi doldu.`;
  if (erisim.periodEnd) return `${ozne} sona erdi.`;
  return `${ozne} henüz başlatılmadı.`;
}
