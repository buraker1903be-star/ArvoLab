// Kurum lisansından erişim kararı. Saf: veritabanı ve Next'e bağlı değil,
// böylece birim testiyle sınanır (tests/unit/license-decision.test.ts).
// Okuma tarafı lib/license.ts'tedir.
//
// Üç bilinçli karar — hepsi aynı ilkeden: kapıyı yalnızca net bir "lisans yok"
// cevabı kapatır, bilgisizlik kapatmaz.
//  - Kurum kaydı okunamazsa engellenmez. Geçici bir veritabanı hatası bütün
//    kullanıcıları dışarıda bırakmamalı.
//  - ArvoOS bu kurumu hiç bildirmediyse (synced_at boş) engellenmez. Sütunun
//    varsayılanı 'inactive' olduğu için, yansıtma başlamadan önce her kurum
//    "lisanssız" görünür; bu bir cevap değil, cevabın henüz gelmemiş olmasıdır.
//    Yansıtma bir kez çalıştıktan sonra kapı normal işler.
//  - Bilinmeyen bir durum adı geçersiz sayılır (yalnızca active/trialing geçer).

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export interface LicenseState {
  blocked: boolean;
  status: string;
  periodEnd: string | null;
  organizationName: string | null;
}

/** organizations tablosunda lisans için okunan alanlar */
export interface LicenseRow {
  name?: string | null;
  license_status?: string | null;
  current_period_end?: string | null;
  /** ArvoOS'un son yansıtma zamanı; boşsa bu kurum hiç bildirilmemiş */
  synced_at?: string | null;
}

export function licenseDecision(row: LicenseRow | null | undefined, now: Date = new Date()): LicenseState {
  if (!row) return { blocked: false, status: "unknown", periodEnd: null, organizationName: null };

  const organizationName = row.name ?? null;
  const periodEnd = row.current_period_end ?? null;
  if (!row.synced_at) return { blocked: false, status: "unsynced", periodEnd, organizationName };

  const status = row.license_status ?? "inactive";
  const notExpired = !periodEnd || new Date(periodEnd).getTime() > now.getTime();
  return { blocked: !(ACTIVE_STATUSES.has(status) && notExpired), status, periodEnd, organizationName };
}
