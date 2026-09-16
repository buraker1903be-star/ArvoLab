import { createClient } from "@/lib/supabase/server";
import { licenseDecision, type LicenseState } from "@/lib/license-decision";

// ArvoLab aboneliği ArvoOS üzerinden tahsil edilir; durum ArvoOS tarafından
// organizations tablosuna yansıtılır (bkz. 20260922090000_arvoos_license_sync).
// Burada yalnızca okunur; karar lib/license-decision.ts'te verilir.
//
// Kurumu olmayan kullanıcı engellenmez: ArvoLab'ta iç ekip hesapları kuruma
// bağlı değil, lisans kontrolü müşteri kurumları içindir.

export type { LicenseState } from "@/lib/license-decision";

export async function getLicenseState(organizationId: string | null): Promise<LicenseState> {
  const open: LicenseState = { blocked: false, status: "internal", periodEnd: null, organizationName: null };
  if (!organizationId) return open;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("name, license_status, current_period_end, synced_at")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) return open;

  return licenseDecision(data);
}
