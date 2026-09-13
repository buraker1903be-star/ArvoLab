"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, type ActionResult } from "@/lib/auth-guards";
import { ADMIN_ROLES, ALL_ROLES, type UserRole } from "@/lib/project-labels";

const PAGE_PATH = "/dashboard/team";
const ADMIN_ONLY = "Bu işlem için Sistem Yöneticisi veya Kurucu rolüne sahip olmalısınız.";

export interface TeamMember {
  id: string;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
  created_at: string;
  email: string | null;
}

export interface OrganizationOption {
  id: string;
  name: string;
}

// Not: profiles tablosu e-posta tutmaz (e-posta auth.users'ta yaşar).
// Burada auth.admin API'sine erişimimiz yok (service role gerektirir),
// bu yüzden liste görünümünde e-posta yerine kullanıcı id'sinin bir
// kısmı ve ad soyad gösterilir.
export async function getAllProfiles(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []).map((row) => ({ ...row, email: null }));
}

export async function getOrganizations(): Promise<OrganizationOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").select("id, name").order("name");
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
