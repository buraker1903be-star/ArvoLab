import { createClient } from "@/lib/supabase/server";

// ArvoLab aboneliği ArvoOS üzerinden tahsil edilir; durum ArvoOS tarafından
// organizations tablosuna yansıtılır (bkz. 20260922090000_arvoos_license_sync).
// Burada yalnızca okunur.
//
// İki bilinçli karar:
//  - Kurumu olmayan kullanıcı engellenmez. ArvoLab'ta iç ekip hesapları kuruma
//    bağlı değil; lisans kontrolü müşteri kurumları içindir.
//  - Kurum kaydı okunamazsa engellenmez. Geçici bir veritabanı hatası bütün
//    kullanıcıları dışarıda bırakmamalı; kapıyı yalnızca net bir "lisans yok"
//    cevabı kapatır.

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export interface LicenseState {
  blocked: boolean;
  status: string;
  periodEnd: string | null;
  organizationName: string | null;
}

export async function getLicenseState(organizationId: string | null): Promise<LicenseState> {
  const open: LicenseState = { blocked: false, status: "internal", periodEnd: null, organizationName: null };
  if (!organizationId) return open;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("name, license_status, current_period_end")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) return open;

  const notExpired = !data.current_period_end || new Date(data.current_period_end).getTime() > Date.now();
  const active = ACTIVE_STATUSES.has(data.license_status) && notExpired;
  return {
    blocked: !active,
    status: data.license_status,
    periodEnd: data.current_period_end,
    organizationName: data.name,
  };
}
