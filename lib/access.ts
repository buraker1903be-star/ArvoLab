import { createClient } from "@/lib/supabase/server";
import { getLicenseState } from "@/lib/license";
import { ensureSubscription } from "@/lib/subscription";
import { ADMIN_ROLES, type UserRole } from "@/lib/project-labels";

// ArvoLab'a kimin gireceği tek yerde karara bağlanır. İki yol var:
//  - Kurum üyesi: lisansı kurumu öder, durum ArvoOS'tan organizations
//    tablosuna yansıtılır (lib/license.ts).
//  - Bireysel kullanıcı: kendi aboneliği var, ArvoOS'ta tutulur
//    (lib/subscription.ts). İlk girişte deneme süresi orada başlatılır.
//
// İç ekip (system_admin, founder) hiçbir koşulda engellenmez; ArvoOS'a
// ulaşılamadığında da kimse engellenmez — geçici bir arıza kullanıcıları
// dışarıda bırakmamalı. Kapıyı yalnızca net bir "aboneliğin yok" cevabı kapatır.

export type AccessKind = "organization" | "individual" | "staff";

export interface AccessState {
  blocked: boolean;
  kind: AccessKind;
  status: string;
  trialEndsAt: string | null;
  periodEnd: string | null;
  organizationName: string | null;
  monthlyFee: number | null;
}

const open = (kind: AccessKind, status: string): AccessState => ({
  blocked: false, kind, status, trialEndsAt: null, periodEnd: null, organizationName: null, monthlyFee: null,
});

export async function getAccessState(profile: { id: string; role: UserRole; organization_id: string | null; full_name: string | null } | null): Promise<AccessState> {
  if (!profile) return open("staff", "unknown");
  if (ADMIN_ROLES.includes(profile.role)) return open("staff", "internal");

  if (profile.organization_id) {
    const license = await getLicenseState(profile.organization_id);
    return {
      blocked: license.blocked,
      kind: "organization",
      status: license.status,
      trialEndsAt: null,
      periodEnd: license.periodEnd,
      organizationName: license.organizationName,
      monthlyFee: null,
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return open("individual", "unknown");

  const subscription = await ensureSubscription({ id: user.id, email: user.email, fullName: profile.full_name });
  // ArvoOS'a ulaşılamadı: engelleme.
  if (!subscription) return open("individual", "unreachable");

  return {
    blocked: !subscription.access,
    kind: "individual",
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt,
    periodEnd: subscription.currentPeriodEnd,
    organizationName: null,
    monthlyFee: subscription.monthlyFee,
  };
}
