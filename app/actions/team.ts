"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/project-labels";

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

export interface UpdateResult {
  error?: string;
  success?: boolean;
}

// RLS + trigger (prevent_self_role_escalation) veritabanı seviyesinde
// de zorunlu kılar; burası yalnızca kullanıcıya anlaşılır bir hata
// mesajı vermek içindir.
export async function updateUserRole(userId: string, role: string): Promise<UpdateResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

  if (error) {
    console.error(error);
    if (error.message?.includes("yetkiniz yok") || error.code === "42501") {
      return { error: "Bu işlem için Sistem Yöneticisi veya Kurucu rolüne sahip olmalısınız." };
    }
    return { error: "Rol güncellenirken bir hata oluştu." };
  }

  revalidatePath("/dashboard/team");
  return { success: true };
}

export async function updateUserOrganization(userId: string, organizationId: string): Promise<UpdateResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ organization_id: organizationId || null })
    .eq("id", userId);

  if (error) {
    console.error(error);
    return { error: "Kurum güncellenirken bir hata oluştu." };
  }

  revalidatePath("/dashboard/team");
  return { success: true };
}

export async function createOrganization(formData: FormData): Promise<UpdateResult> {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Kurum adı zorunludur." };

  const { error } = await supabase.from("organizations").insert({ name });
  if (error) {
    console.error(error);
    return { error: "Kurum oluşturulurken bir hata oluştu." };
  }

  revalidatePath("/dashboard/team");
  return { success: true };
}
