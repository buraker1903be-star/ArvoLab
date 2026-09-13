"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, type ActionResult } from "@/lib/auth-guards";
import { ADMIN_ROLES } from "@/lib/project-labels";

const PAGE_PATH = "/dashboard/support";
const CATEGORIES = ["bug", "access", "feature_request", "billing", "other"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const STATUSES = ["open", "in_progress", "resolved"];

export interface AppSupportRequest {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
}

export async function createSupportRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!subject || !message) {
    redirect(`${PAGE_PATH}?error=missing-fields`);
  }

  const category = String(formData.get("category") ?? "other");
  const priority = String(formData.get("priority") ?? "normal");

  const { error } = await supabase.from("app_support_requests").insert({
    requested_by: user.id,
    subject,
    message,
    category: CATEGORIES.includes(category) ? category : "other",
    priority: PRIORITIES.includes(priority) ? priority : "normal",
    status: "open",
  });

  if (error) {
    console.error(error);
    redirect(`${PAGE_PATH}?error=save-failed`);
  }

  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH);
}

export async function getMySupportRequests(): Promise<AppSupportRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("app_support_requests")
    .select("id, subject, message, category, priority, status, created_at")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function getAllSupportRequests(): Promise<AppSupportRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_support_requests")
    .select("id, subject, message, category, priority, status, created_at")
    .neq("status", "resolved")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function updateSupportRequestStatus(requestId: string, status: string): Promise<ActionResult> {
  const auth = await requireRole(ADMIN_ROLES, "Talep durumunu yalnızca Sistem Yöneticisi veya Kurucu değiştirebilir.");
  if ("error" in auth) return { error: auth.error };
  if (!STATUSES.includes(status)) return { error: "Geçersiz durum." };

  const { data, error } = await auth.supabase
    .from("app_support_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Güncellenirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Talep bulunamadı." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}
