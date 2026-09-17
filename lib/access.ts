import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getLicenseState } from "@/lib/license";
import { ensureSubscription } from "@/lib/subscription";
import { ADMIN_ROLES, type UserRole } from "@/lib/project-labels";
import type { BillingPlan } from "@/lib/billing-plan";

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
  /** Bireysel abone için ArvoOS'un sunduğu planlar (aylık, yıllık) */
  plans: BillingPlan[];
}

const open = (kind: AccessKind, status: string): AccessState => ({
  blocked: false, kind, status, trialEndsAt: null, periodEnd: null, organizationName: null, plans: [],
});

/*
  cache(): aynı istekte panel düzeni ve ana sayfa erişim durumunu ayrı ayrı
  soruyor; ArvoOS'a yalnızca bir kez gidilsin. Anahtar olarak profil NESNESİ
  değil alanları veriliyor: cache() nesneleri kimliğe göre eşliyor, ayrı
  okumalardan gelen iki eşdeğer profil önbelleği ıskalatırdı.
*/
const accessFor = cache(async function accessFor(
  id: string,
  role: UserRole,
  organizationId: string | null,
  fullName: string | null
): Promise<AccessState> {
  if (ADMIN_ROLES.includes(role)) return open("staff", "internal");

  if (organizationId) {
    const license = await getLicenseState(organizationId);
    return {
      blocked: license.blocked,
      kind: "organization",
      status: license.status,
      trialEndsAt: null,
      periodEnd: license.periodEnd,
      organizationName: license.organizationName,
      // Kurumun aboneliğini kurumu öder; burada ödeme planı gösterilmez.
      plans: [],
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return open("individual", "unknown");

  // Kimlik profilden gelir (auth çağrısı yalnızca e-posta için); ikisi aynı kullanıcıdır.
  const subscription = await ensureSubscription({ id, email: user.email, fullName });
  // ArvoOS'a ulaşılamadı: engelleme.
  if (!subscription) return open("individual", "unreachable");

  return {
    blocked: !subscription.access,
    kind: "individual",
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt,
    periodEnd: subscription.currentPeriodEnd,
    organizationName: null,
    plans: subscription.plans,
  };
});

export async function getAccessState(
  profile: { id: string; role: UserRole; organization_id: string | null; full_name: string | null } | null
): Promise<AccessState> {
  if (!profile) return open("staff", "unknown");
  return accessFor(profile.id, profile.role, profile.organization_id, profile.full_name);
}
