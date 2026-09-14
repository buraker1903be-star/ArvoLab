"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, requireRole, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { EXPERT_ROLES } from "@/lib/project-labels";

const PAGE_PATH = "/dashboard/expert-requests";
const REQUEST_TYPES = ["analysis", "editing", "methodology", "statistics", "full_review", "other"];

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

export async function createConsultancyRequest(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  const { supabase, user } = ctx;

  let projectId = String(formData.get("projectId") ?? "").trim() || null;
  let projectTitle = String(formData.get("projectTitle") ?? "").trim() || null;
  const requestTypeRaw = String(formData.get("requestType") ?? "other");
  const requestType = REQUEST_TYPES.includes(requestTypeRaw) ? requestTypeRaw : "other";
  const message = String(formData.get("message") ?? "").trim() || null;

  if (projectId) {
    // Çalışma seçildiyse başlığı talebe yaz (listelerde "Bağımsız talep"
    // görünmesin) ve yalnızca kullanıcının erişebildiği bir çalışmaya bağla.
    const { data: project } = await supabase
      .from("academic_projects")
      .select("title")
      .eq("id", projectId)
      .maybeSingle();
    if (project) {
      projectTitle = project.title;
    } else {
      projectId = null;
    }
  }

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
    return { error: "Talep oluşturulurken bir hata oluştu." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
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

export async function acceptRequest(requestId: string): Promise<ActionResult> {
  const auth = await requireRole(EXPERT_ROLES, "Talepleri yalnızca Uzman ve üzeri roller üstlenebilir.");
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase
    .from("consultancy_requests")
    .update({ assigned_expert_id: auth.user.id, status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "open") // yalnızca hâlâ açık bir talep üstlenilebilir (yarış durumunu önler)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Talep üstlenilirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Bu talep artık açık değil; başka bir uzman üstlenmiş olabilir." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function completeRequest(requestId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const { data, error } = await ctx.supabase
    .from("consultancy_requests")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("assigned_expert_id", ctx.user.id)
    .eq("status", "accepted")
    .select("id");

  if (error) {
    console.error(error);
    return { error: "İşlem sırasında bir hata oluştu." };
  }
  if (!data?.length) return { error: "Bu talebi yalnızca üstlenen uzman tamamlayabilir." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function cancelRequest(requestId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const { data, error } = await ctx.supabase
    .from("consultancy_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("requested_by", ctx.user.id)
    .eq("status", "open")
    .select("id");

  if (error) {
    console.error(error);
    return { error: "İşlem sırasında bir hata oluştu." };
  }
  if (!data?.length) return { error: "Yalnızca açık durumdaki kendi talebinizi iptal edebilirsiniz." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}
