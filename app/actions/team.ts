"use server";

import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { inviteEmail } from "@/lib/email/auth-emails";
import { requireRole, type ActionResult } from "@/lib/auth-guards";
import { siteOrigin } from "@/lib/site-url";
import { authConfirmLink } from "@/lib/auth-link";
import { ADMIN_ROLES, ALL_ROLES, type UserRole } from "@/lib/project-labels";

const PAGE_PATH = "/dashboard/team";
const ADMIN_ONLY: Metin = {
  tr: "Bu işlem için Sistem Yöneticisi veya Kurucu rolüne sahip olmalısınız.",
  en: "You need the System Administrator or Founder role for this action.",
};
const MISSING_SECRET: Metin = {
  tr: "Bu işlem için sunucuda SUPABASE_SECRET_KEY tanımlı olmalı (Vercel ortam değişkenleri).",
  en: "This action requires SUPABASE_SECRET_KEY on the server (Vercel environment variables).",
};
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
  /** Son giriş (auth.users); dizin okunamazsa ya da hiç girmediyse null. */
  lastSignInAt: string | null;
}

export interface TeamDirectory {
  members: TeamMember[];
  /** false ise e-posta, davet ve erişim durdurma kullanılamaz (sunucu anahtarı yok). */
  directoryAvailable: boolean;
  /*
    Profil listesi OKUNAMADI. Eskiden okuma hatası boş liste döndürüyordu
    ve sayfa "Listelenecek kullanıcı yok" diyordu: yönetici bütün
    kullanıcıların silindiğini sanabilirdi.
  */
  okunamadi?: boolean;
}

export interface OrganizationOption {
  id: string;
  name: string;
}

type AuthUserInfo = { email: string | null; disabled: boolean; pendingInvite: boolean; lastSignInAt: string | null };

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
          lastSignInAt: user.last_sign_in_at ?? null,
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

  const kurum = await seciliKurum();
  /*
    Sayfa sayfa: PostgREST tek yanıtta en çok 1000 satır döndürüyor.
    Eskiden tek sorgu vardı; 1000'i aşan kurulumda liste ve başlıktaki
    "N kullanıcı" sayısı sessizce 1000'de kalıyordu.
  */
  const profilleriOku = async () => {
    const SAYFA = 1000;
    const satirlar: Omit<TeamMember, "email" | "disabled" | "pendingInvite" | "lastSignInAt">[] = [];
    for (let bas = 0; bas < 50_000; bas += SAYFA) {
      let sorgu = auth.supabase.from("profiles").select("id, full_name, role, organization_id, created_at");
      // İç ekibin kurum seçimi (lib/kurum-secimi.ts): yalnızca görünümü süzer.
      if (kurum) sorgu = sorgu.eq("organization_id", kurum.id);
      const { data, error } = await sorgu.order("created_at", { ascending: false }).order("id").range(bas, bas + SAYFA - 1);
      if (error) return { data: null, error };
      satirlar.push(...((data ?? []) as typeof satirlar));
      if ((data?.length ?? 0) < SAYFA) break;
    }
    return { data: satirlar, error: null };
  };
  const [{ data, error }, authUsers] = await Promise.all([profilleriOku(), loadAuthUsers()]);

  if (error) {
    console.error(error);
    return { members: [], directoryAvailable: false, okunamadi: true };
  }

  const members = (data ?? []).map((row) => {
    const info = authUsers?.get(row.id);
    return {
      ...(row as Omit<TeamMember, "email" | "disabled" | "pendingInvite" | "lastSignInAt">),
      email: info?.email ?? null,
      disabled: info?.disabled ?? false,
      pendingInvite: info?.pendingInvite ?? false,
      lastSignInAt: info?.lastSignInAt ?? null,
    };
  });
  return { members, directoryAvailable: authUsers !== null };
}

export async function getOrganizations(): Promise<ListeSonucu<OrganizationOption>> {
  const auth = await requireRole(ADMIN_ROLES);
  if ("error" in auth) return listeBasarili([]);

  const { data, error } = await auth.supabase.from("organizations").select("id, name").order("name");
  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

export type UpdateResult = ActionResult;

// RLS + trigger (prevent_self_role_escalation) veritabanı seviyesinde
// de zorunlu kılar; buradaki kontroller yetkisiz bir isteğin sessizce
// "başarılı" görünmesini engeller.
export async function updateUserRole(userId: string, role: string): Promise<UpdateResult> {
  const auth = await requireRole(ADMIN_ROLES, ADMIN_ONLY);
  if ("error" in auth) return { error: auth.error };
  const t = await ceviri();

  if (!ALL_ROLES.includes(role as UserRole)) return { error: t({ tr: "Geçersiz rol.", en: "Invalid role." }) };
  if (userId === auth.user.id) {
    return { error: t({ tr: "Kendi rolünüzü değiştiremezsiniz; başka bir yöneticiden isteyin.", en: "You cannot change your own role; ask another administrator." }) };
  }

  const { data: target } = await auth.supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: t({ tr: "Kullanıcı bulunamadı.", en: "User not found." }) };
  if ((role === "founder" || target.role === "founder") && auth.role !== "founder") {
    return { error: t({ tr: "Kurucu rolünü yalnızca bir Kurucu atayabilir veya kaldırabilir.", en: "Only a Founder can assign or remove the Founder role." }) };
  }

  const { data, error } = await auth.supabase.from("profiles").update({ role }).eq("id", userId).select("id");

  if (error) {
    console.error(error);
    if (error.message?.includes("yetkiniz yok") || error.code === "42501") {
      return { error: t(ADMIN_ONLY) };
    }
    return { error: t({ tr: "Rol güncellenirken bir hata oluştu.", en: "Something went wrong while updating the role." }) };
  }
  if (!data?.length) return { error: t({ tr: "Rol güncellenemedi.", en: "The role could not be updated." }) };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function updateUserOrganization(userId: string, organizationId: string): Promise<UpdateResult> {
  const auth = await requireRole(ADMIN_ROLES, ADMIN_ONLY);
  if ("error" in auth) return { error: auth.error };
  const t = await ceviri();

  const { data, error } = await auth.supabase
    .from("profiles")
    .update({ organization_id: organizationId || null })
    .eq("id", userId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: t({ tr: "Kurum güncellenirken bir hata oluştu.", en: "Something went wrong while updating the institution." }) };
  }
  if (!data?.length) return { error: t({ tr: "Kullanıcı bulunamadı.", en: "User not found." }) };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function createOrganization(formData: FormData): Promise<UpdateResult> {
  const auth = await requireRole(ADMIN_ROLES, ADMIN_ONLY);
  if ("error" in auth) return { error: auth.error };
  const t = await ceviri();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t({ tr: "Kurum adı zorunludur.", en: "Institution name is required." }) };

  const { error } = await auth.supabase.from("organizations").insert({ name });
  if (error) {
    console.error(error);
    return { error: t({ tr: "Kurum oluşturulurken bir hata oluştu.", en: "Something went wrong while creating the institution." }) };
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
  const t = await ceviri();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "client");
  const organizationId = String(formData.get("organizationId") ?? "") || null;

  if (!EMAIL_PATTERN.test(email)) return { error: t({ tr: "Geçerli bir e-posta adresi girin.", en: "Enter a valid email address." }) };
  if (!ALL_ROLES.includes(role as UserRole)) return { error: t({ tr: "Geçersiz rol.", en: "Invalid role." }) };
  if (role === "founder" && auth.role !== "founder") {
    return { error: t({ tr: "Kurucu rolünü yalnızca bir Kurucu atayabilir.", en: "Only a Founder can assign the Founder role." }) };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { error: t(MISSING_SECRET) };
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
    },
  });

  if (error) {
    console.error(error);
    if (error.status === 422 || /already/i.test(error.message)) {
      return { error: t({ tr: "Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var.", en: "A user with this email address already exists." }) };
    }
    if (error.status === 429) {
      return { error: t({ tr: "E-posta gönderim sınırına ulaşıldı; biraz sonra tekrar deneyin.", en: "The email sending limit was reached; try again shortly." }) };
    }
    return { error: t({ tr: "Davet gönderilemedi. Supabase e-posta ayarlarını kontrol edin.", en: "The invitation could not be sent. Check the Supabase email settings." }) };
  }

  /*
    Davet e-postası. Gönderilemezse kullanıcı yine de oluştu; ama eskiden
    işlem "başarılı" dönüyor ve yönetici e-postanın gitmediğini hiç
    öğrenmiyordu (yorum "bağlantıyı elden iletebilir" diyordu, bağlantı
    hiçbir yerde gösterilmiyordu). Yeniden davet de "bu adres zaten kayıtlı"
    diye düşüyordu: çıkmaz. Artık uyarı dönüyor ve çıkış yolu yazıyor —
    şifre sıfırlama bağlantısı davet edilen hesabı da doğrular.
  */
  let davetGitmedi = false;
  // action_link değil: o bağlantı oturumu #access_token ile döndürür, sunucu göremez (lib/auth-link.ts).
  const inviteLink = data.properties?.hashed_token ? authConfirmLink(await siteOrigin(), data.properties.hashed_token, "invite") : null;
  if (inviteLink) {
    // Davet edenin adı e-postada görünsün; okunamazsa davet yine gider.
    const { data: davetEden } = await auth.supabase
      .from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
    const gonderim = await sendEmail({ to: email, ...inviteEmail(inviteLink, davetEden?.full_name, await aktifDil()) });
    if (!gonderim.ok) {
      console.error("Davet e-postası gönderilemedi:", email, gonderim.reason);
      davetGitmedi = true;
    }
  } else {
    console.error("Davet bağlantısı üretilemedi (belirteç boş):", email);
    davetGitmedi = true;
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
      return {
        error: t({
          tr: "Davet gönderildi ancak rol/kurum atanamadı; aşağıdaki listeden elle atayın.",
          en: "The invitation was sent, but the role/institution could not be assigned; set it manually in the list below.",
        }),
      };
    }
  }

  revalidatePath(PAGE_PATH);
  if (davetGitmedi) {
    return {
      success: true,
      warning: t({
        tr: `Hesap oluşturuldu ama davet e-postası ${email} adresine gönderilemedi. Kişiden giriş sayfasındaki "Şifremi unuttum" ile bağlantı istemesini isteyin; o bağlantı hesabı da açar.`,
        en: `The account was created, but the invitation email could not be sent to ${email}. Ask the person to request a link with "Forgot password" on the sign-in page; that link also activates the account.`,
      }),
    };
  }
  return { success: true };
}

// Erişimi durdurma Supabase "ban" özelliğini kullanır: kullanıcı yeniden giriş
// yapamaz ve oturumu en geç erişim anahtarının süresi dolunca (varsayılan 1 saat) kapanır.
export async function setUserAccess(userId: string, enabled: boolean): Promise<UpdateResult> {
  const auth = await requireRole(ADMIN_ROLES, ADMIN_ONLY);
  if ("error" in auth) return { error: auth.error };
  const t = await ceviri();
  if (userId === auth.user.id) return { error: t({ tr: "Kendi erişiminizi durduramazsınız.", en: "You cannot suspend your own access." }) };

  const { data: target } = await auth.supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: t({ tr: "Kullanıcı bulunamadı.", en: "User not found." }) };
  if (target.role === "founder" && auth.role !== "founder") {
    return { error: t({ tr: "Bir Kurucunun erişimini yalnızca başka bir Kurucu değiştirebilir.", en: "Only another Founder can change a Founder's access." }) };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { error: t(MISSING_SECRET) };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: enabled ? "none" : "876000h",
  });
  if (error) {
    console.error(error);
    return { error: t({ tr: "Erişim güncellenemedi.", en: "Access could not be updated." }) };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}
