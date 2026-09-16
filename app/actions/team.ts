"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { inviteEmail } from "@/lib/email/auth-emails";
import { requireRole, type ActionResult } from "@/lib/auth-guards";
import { siteOrigin } from "@/lib/site-url";
import { ADMIN_ROLES, ALL_ROLES, type UserRole } from "@/lib/project-labels";

const PAGE_PATH = "/dashboard/team";
const ADMIN_ONLY = "Bu işlem için Sistem Yöneticisi veya Kurucu rolüne sahip olmalısınız.";
const MISSING_SECRET = "Bu işlem için sunucuda SUPABASE_SECRET_KEY tanımlı olmalı (Vercel ortam değişkenleri).";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface TeamMember {
  id: string;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
  created_at: string;
  email: string | null;
  /** Erişimi durdurulmuş (Supabase ban). */
  disabled: boolean;
  /** Davet edildi ama henüz hiç giriş yapmadı. */
  pendingInvite: boolean;
}

export interface TeamDirectory {
  members: TeamMember[];
  /** false ise e-posta, davet ve erişim durdurma kullanılamaz (sunucu anahtarı yok). */
  directoryAvailable: boolean;
}

export interface OrganizationOption {
  id: string;
  name: string;
}

type AuthUserInfo = { email: string | null; disabled: boolean; pendingInvite: boolean };

// E-posta ve erişim durumu auth.users'ta tutulur; yalnızca service role anahtarıyla okunabilir.
async function loadAuthUsers(): Promise<Map<string, AuthUserInfo> | null> {
  try {
    const admin = createAdminClient();
    const users = new Map<string, AuthUserInfo>();
    const now = Date.now();
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const user of data.users) {
        users.set(user.id, {
          email: user.email ?? null,
          disabled: !!user.banned_until && new Date(user.banned_until).getTime() > now,
          pendingInvite: !!user.invited_at && !user.last_sign_in_at,
        });
      }
      if (data.users.length < 200) break;
    }
    return users;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getAllProfiles(): Promise<TeamDirectory> {
  // Server action olarak dışarıdan da çağrılabildiği için e-posta listesi
  // yalnızca yöneticilere döndürülür.
  const auth = await requireRole(ADMIN_ROLES);
  if ("error" in auth) return { members: [], directoryAvailable: false };

  const [{ data, error }, authUsers] = await Promise.all([
    auth.supabase
      .from("profiles")
      .select("id, full_name, role, organization_id, created_at")
      .order("created_at", { ascending: false }),
    loadAuthUsers(),
  ]);

  if (error) {
    console.error(error);
    return { members: [], directoryAvailable: false };
  }

  const members = (data ?? []).map((row) => {
    const info = authUsers?.get(row.id);
    return {
      ...(row as Omit<TeamMember, "email" | "disabled" | "pendingInvite">),
      email: info?.email ?? null,
      disabled: info?.disabled ?? false,
      pendingInvite: info?.pendingInvite ?? false,
    };
  });
  return { members, directoryAvailable: authUsers !== null };
}

export async function getOrganizations(): Promise<OrganizationOption[]> {
  const auth = await requireRole(ADMIN_ROLES);
  if ("error" in auth) return [];

  const { data, error } = await auth.supabase.from("organizations").select("id, name").order("name");
  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export type UpdateResult = ActionResult;

// RLS + trigger (prevent_self_role_escalation) veritabanı seviyesinde
// de zorunlu kılar; buradaki kontroller yetkisiz bir isteğin sessizce
// "başarılı" görünmesini engeller.
export async function updateUserRole(userId: string, role: string): Promise<UpdateResult> {
  const auth = await requireRole(ADMIN_ROLES, ADMIN_ONLY);
  if ("error" in auth) return { error: auth.error };

  if (!ALL_ROLES.includes(role as UserRole)) return { error: "Geçersiz rol." };
  if (userId === auth.user.id) {
    return { error: "Kendi rolünüzü değiştiremezsiniz; başka bir yöneticiden isteyin." };
  }

  const { data: target } = await auth.supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: "Kullanıcı bulunamadı." };
  if ((role === "founder" || target.role === "founder") && auth.role !== "founder") {
    return { error: "Kurucu rolünü yalnızca bir Kurucu atayabilir veya kaldırabilir." };
  }

  const { data, error } = await auth.supabase.from("profiles").update({ role }).eq("id", userId).select("id");

  if (error) {
    console.error(error);
    if (error.message?.includes("yetkiniz yok") || error.code === "42501") {
      return { error: ADMIN_ONLY };
    }
    return { error: "Rol güncellenirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Rol güncellenemedi." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function updateUserOrganization(userId: string, organizationId: string): Promise<UpdateResult> {
  const auth = await requireRole(ADMIN_ROLES, ADMIN_ONLY);
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase
    .from("profiles")
    .update({ organization_id: organizationId || null })
    .eq("id", userId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Kurum güncellenirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kullanıcı bulunamadı." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function createOrganization(formData: FormData): Promise<UpdateResult> {
  const auth = await requireRole(ADMIN_ROLES, ADMIN_ONLY);
  if ("error" in auth) return { error: auth.error };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Kurum adı zorunludur." };

  const { error } = await auth.supabase.from("organizations").insert({ name });
  if (error) {
    console.error(error);
    return { error: "Kurum oluşturulurken bir hata oluştu." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

// Davet e-postasındaki bağlantı /auth/confirm üzerinden şifre belirleme
// sayfasına gelir. Supabase "Invite user" e-posta şablonunun token_hash
// kullanacak şekilde ayarlanması gerekir (bkz. README, Faz 3).
export async function inviteUser(formData: FormData): Promise<UpdateResult> {
  const auth = await requireRole(ADMIN_ROLES, ADMIN_ONLY);
  if ("error" in auth) return { error: auth.error };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "client");
  const organizationId = String(formData.get("organizationId") ?? "") || null;

  if (!EMAIL_PATTERN.test(email)) return { error: "Geçerli bir e-posta adresi girin." };
  if (!ALL_ROLES.includes(role as UserRole)) return { error: "Geçersiz rol." };
  if (role === "founder" && auth.role !== "founder") {
    return { error: "Kurucu rolünü yalnızca bir Kurucu atayabilir." };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { error: MISSING_SECRET };
  }

  /*
    inviteUserByEmail e-postayı Supabase'in yerleşik gönderimiyle yollardı;
    saatlik sınırı düşük ve şablonu markasız. generateLink kullanıcıyı yine
    oluşturuyor ama e-postayı göndermiyor — onu kendi şablonumuzla biz
    gönderiyoruz (lib/email/auth-emails.ts).
  */
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
    },
  });

  if (error) {
    console.error(error);
    if (error.status === 422 || /already/i.test(error.message)) {
      return { error: "Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var." };
    }
    if (error.status === 429) return { error: "E-posta gönderim sınırına ulaşıldı; biraz sonra tekrar deneyin." };
    return { error: "Davet gönderilemedi. Supabase e-posta ayarlarını kontrol edin." };
  }

  /*
    Davet e-postası. Gönderilemezse davet yine de geçerli: kullanıcı oluştu ve
    bağlantı üretildi; yönetici gerekirse bağlantıyı elden iletebilir.
  */
  const inviteLink = data.properties?.action_link;
  if (inviteLink) {
    // Davet edenin adı e-postada görünsün; okunamazsa davet yine gider.
    const { data: davetEden } = await auth.supabase
      .from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
    const gonderim = await sendEmail({ to: email, ...inviteEmail(inviteLink, davetEden?.full_name) });
    if (!gonderim.ok) console.error("Davet e-postası gönderilemedi:", email, gonderim.reason);
  }

  // Profil satırı kayıt tetikleyicisiyle (handle_new_user) "Üye / Öğrenci" olarak açılır.
  // Rol ve kurum, yöneticinin kendi oturumuyla atanır (RLS + rol tetikleyicisi geçerli kalır).
  const invitedId = data.user?.id;
  if (invitedId && (role !== "client" || organizationId)) {
    const { error: profileError } = await auth.supabase
      .from("profiles")
      .update({ role, organization_id: organizationId })
      .eq("id", invitedId);
    if (profileError) {
      console.error(profileError);
      return { error: "Davet gönderildi ancak rol/kurum atanamadı; aşağıdaki listeden elle atayın." };
    }
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

// Erişimi durdurma Supabase "ban" özelliğini kullanır: kullanıcı yeniden giriş
// yapamaz ve oturumu en geç erişim anahtarının süresi dolunca (varsayılan 1 saat) kapanır.
export async function setUserAccess(userId: string, enabled: boolean): Promise<UpdateResult> {
  const auth = await requireRole(ADMIN_ROLES, ADMIN_ONLY);
  if ("error" in auth) return { error: auth.error };
  if (userId === auth.user.id) return { error: "Kendi erişiminizi durduramazsınız." };

  const { data: target } = await auth.supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: "Kullanıcı bulunamadı." };
  if (target.role === "founder" && auth.role !== "founder") {
    return { error: "Bir Kurucunun erişimini yalnızca başka bir Kurucu değiştirebilir." };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { error: MISSING_SECRET };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: enabled ? "none" : "876000h",
  });
  if (error) {
    console.error(error);
    return { error: "Erişim güncellenemedi." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}
