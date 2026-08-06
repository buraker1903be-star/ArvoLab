"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  if (!user) redirect("/?error=invalid-credentials");

  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!subject || !message) {
    redirect("/dashboard/support?error=missing-fields");
  }

  const { error } = await supabase.from("app_support_requests").insert({
    requested_by: user.id,
    subject,
    message,
    category: String(formData.get("category") ?? "other"),
    priority: String(formData.get("priority") ?? "normal"),
    status: "open",
  });

  if (error) {
    console.error(error);
    redirect("/dashboard/support?error=save-failed");
  }

  revalidatePath("/dashboard/support");
  redirect("/dashboard/support");
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

export async function updateSupportRequestStatus(requestId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_support_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    console.error(error);
    return { error: "Güncellenirken bir hata oluştu." };
  }
  revalidatePath("/dashboard/support");
  return { success: true };
}
