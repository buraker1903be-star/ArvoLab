"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ConsultancyRequest {
  id: string;
  project_id: string | null;
  project_title: string | null;
  requested_by: string;
  request_type: string;
  message: string | null;
  status: "open" | "accepted" | "completed" | "cancelled";
  assigned_expert_id: string | null;
  created_at: string;
}



export async function createConsultancyRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?error=invalid-credentials");

  const projectId = String(formData.get("projectId") ?? "").trim() || null;
  const projectTitle = String(formData.get("projectTitle") ?? "").trim() || null;
  const requestType = String(formData.get("requestType") ?? "other");
  const message = String(formData.get("message") ?? "").trim() || null;

  const { error } = await supabase.from("consultancy_requests").insert({
    project_id: projectId,
    project_title: projectTitle,
    requested_by: user.id,
    request_type: requestType,
    message,
    status: "open",
  });

  if (error) {
    console.error(error);
    redirect("/dashboard/expert-requests?error=save-failed");
  }

  revalidatePath("/dashboard/expert-requests");
  redirect("/dashboard/expert-requests");
}

export async function getMyRequests(): Promise<ConsultancyRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("consultancy_requests")
    .select("*")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function getOpenRequests(): Promise<ConsultancyRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consultancy_requests")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function getAssignedToMe(): Promise<ConsultancyRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("consultancy_requests")
    .select("*")
    .eq("assigned_expert_id", user.id)
    .in("status", ["accepted", "completed"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function acceptRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { error } = await supabase
    .from("consultancy_requests")
    .update({ assigned_expert_id: user.id, status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "open"); // yalnızca hâlâ açık bir talep üstlenilebilir (yarış durumunu önler)

  if (error) {
    console.error(error);
    return { error: "Talep üstlenilirken bir hata oluştu." };
  }
  revalidatePath("/dashboard/expert-requests");
  return { success: true };
}

export async function completeRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("consultancy_requests")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    console.error(error);
    return { error: "İşlem sırasında bir hata oluştu." };
  }
  revalidatePath("/dashboard/expert-requests");
  return { success: true };
}

export async function cancelRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("consultancy_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    console.error(error);
    return { error: "İşlem sırasında bir hata oluştu." };
  }
  revalidatePath("/dashboard/expert-requests");
  return { success: true };
}
