"use server";

import { ceviri } from "@/lib/dil-sunucu";
import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, requireRole, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
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
  if (!ctx) return { error: await oturumYokMesaji() };
  const { supabase, user } = ctx;
  const t = await ceviri();

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
    return { error: t({ tr: "Talep oluşturulurken bir hata oluştu.", en: "Something went wrong while creating the request." }) };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function getMyRequests(): Promise<ListeSonucu<ConsultancyRequest>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return listeBasarili([]);

  const { data, error } = await supabase
    .from("consultancy_requests")
    .select("*")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

export async function getOpenRequests(): Promise<ListeSonucu<ConsultancyRequest>> {
  const supabase = await createClient();
  const kurum = await seciliKurum();
  // İç ekibin kurum seçimi: talebi açanın kurumuna göre (lib/kurum-secimi.ts).
  if (kurum && !kurum.kullanicilar.length) return listeBasarili([]);
  let sorgu = supabase.from("consultancy_requests").select("*").eq("status", "open");
  if (kurum) sorgu = sorgu.in("requested_by", kurum.kullanicilar);
  const { data, error } = await sorgu.order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

export async function getAssignedToMe(): Promise<ListeSonucu<ConsultancyRequest>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return listeBasarili([]);

  const kurum = await seciliKurum();
  if (kurum && !kurum.kullanicilar.length) return listeBasarili([]);
  let sorgu = supabase.from("consultancy_requests").select("*").eq("assigned_expert_id", user.id).in("status", ["accepted", "completed"]);
  if (kurum) sorgu = sorgu.in("requested_by", kurum.kullanicilar);
  const { data, error } = await sorgu.order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

export async function acceptRequest(requestId: string): Promise<ActionResult> {
  const auth = await requireRole(EXPERT_ROLES, {
    tr: "Talepleri yalnızca Uzman ve üzeri roller üstlenebilir.",
    en: "Only Experts and higher roles can take on requests.",
  });
  if ("error" in auth) return { error: auth.error };
  const t = await ceviri();

  const { data, error } = await auth.supabase
    .from("consultancy_requests")
    .update({ assigned_expert_id: auth.user.id, status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "open") // yalnızca hâlâ açık bir talep üstlenilebilir (yarış durumunu önler)
    .select("id");

  if (error) {
    console.error(error);
    return { error: t({ tr: "Talep üstlenilirken bir hata oluştu.", en: "Something went wrong while taking on the request." }) };
  }
  if (!data?.length) {
    return {
      error: t({
        tr: "Bu talep artık açık değil; başka bir uzman üstlenmiş olabilir.",
        en: "This request is no longer open; another expert may have taken it.",
      }),
    };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function completeRequest(requestId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();

  const { data, error } = await ctx.supabase
    .from("consultancy_requests")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("assigned_expert_id", ctx.user.id)
    .eq("status", "accepted")
    .select("id");

  if (error) {
    console.error(error);
    return { error: t({ tr: "İşlem sırasında bir hata oluştu.", en: "Something went wrong during the operation." }) };
  }
  if (!data?.length) {
    return { error: t({ tr: "Bu talebi yalnızca üstlenen uzman tamamlayabilir.", en: "Only the expert who took on this request can complete it." }) };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function cancelRequest(requestId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();

  const { data, error } = await ctx.supabase
    .from("consultancy_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("requested_by", ctx.user.id)
    .eq("status", "open")
    .select("id");

  if (error) {
    console.error(error);
    return { error: t({ tr: "İşlem sırasında bir hata oluştu.", en: "Something went wrong during the operation." }) };
  }
  if (!data?.length) {
    return { error: t({ tr: "Yalnızca açık durumdaki kendi talebinizi iptal edebilirsiniz.", en: "You can only cancel your own requests that are still open." }) };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}
