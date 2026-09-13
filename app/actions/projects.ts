"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { findMatchingGuideline } from "@/app/actions/guidelines";
import { getAuthContext, requireRole, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { OVERSIGHT_ROLES } from "@/lib/project-labels";

const OVERSIGHT_ONLY = "Bu işlem için Kontrolör veya üzeri bir role sahip olmalısınız.";

export interface AcademicProject {
  id: string;
  owner_id: string;
  organization_id: string | null;
  guideline_id: string | null;
  title: string;
  project_type: string;
  university: string | null;
  institute: string | null;
  department: string | null;
  citation_style: string;
  research_method: string | null;
  assignee_name: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  notes: string | null;
  progress: number;
  controller_approved_by: string | null;
  controller_approved_at: string | null;
  created_at: string;
}

const PROJECT_TYPES = ["thesis", "article", "project", "associate-professorship"];

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (!title || title.length < 3) {
    redirect("/dashboard/editor/new?error=missing-title");
  }
  if (!PROJECT_TYPES.includes(type)) {
    redirect("/dashboard/editor/new?error=missing-type");
  }

  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const universityId = String(formData.get("universityId") ?? "").trim();
  const academicUnitId = String(formData.get("academicUnitId") ?? "").trim();
  const departmentId = String(formData.get("departmentId") ?? "").trim();
  const matchedGuideline = universityId
    ? await findMatchingGuideline(universityId, academicUnitId || null, departmentId || null)
    : null;

  const { error } = await supabase.from("academic_projects").insert({
    owner_id: user.id,
    organization_id: profile?.organization_id ?? null,
    guideline_id: matchedGuideline?.id ?? null,
    title,
    project_type: type,
    university: String(formData.get("university") ?? "").trim() || null,
    institute: String(formData.get("institute") ?? "").trim() || null,
    department: String(formData.get("department") ?? "").trim() || null,
    citation_style:
      type === "thesis" && matchedGuideline
        ? matchedGuideline.citation_style
        : String(formData.get("citationStyle") ?? "apa7"),
    research_method: String(formData.get("method") ?? "") || null,
    assignee_name: String(formData.get("assignee") ?? "").trim() || null,
    due_date: dueDateRaw || null,
    priority: String(formData.get("priority") ?? "normal"),
    notes: String(formData.get("notes") ?? "").trim() || null,
    status: "new",
  });

  if (error) {
    console.error(error);
    redirect("/dashboard/editor/new?error=save-failed");
  }

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  redirect("/dashboard/editor");
}

export async function getProjects(): Promise<AcademicProject[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("academic_projects")
    .select(
      "id, owner_id, organization_id, guideline_id, title, project_type, university, institute, department, citation_style, research_method, assignee_name, due_date, priority, status, notes, progress, controller_approved_by, controller_approved_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

// Yalnızca Kontrolör / Akademik Yönetici / Sistem Yöneticisi / Kurucu rolleri
// bir çalışmayı onaylayabilir (proje dosyası 6.2 "Biçim" aşaması onayı).
// Veritabanında guard_academic_project_update tetikleyicisi de bunu zorunlu
// kılar; buradaki kontrol kullanıcıya erken/anlaşılır bir hata mesajı vermek içindir.
export async function approveProject(projectId: string): Promise<ActionResult> {
  const auth = await requireRole(OVERSIGHT_ROLES, OVERSIGHT_ONLY);
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase
    .from("academic_projects")
    .update({
      controller_approved_by: auth.user.id,
      controller_approved_at: new Date().toISOString(),
      status: "ready",
    })
    .eq("id", projectId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Onaylanırken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Çalışma bulunamadı." };

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function revokeApproval(projectId: string): Promise<ActionResult> {
  const auth = await requireRole(OVERSIGHT_ROLES, OVERSIGHT_ONLY);
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase
    .from("academic_projects")
    .update({
      controller_approved_by: null,
      controller_approved_at: null,
      status: "revision",
    })
    .eq("id", projectId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "İşlem sırasında bir hata oluştu." };
  }
  if (!data?.length) return { error: "Çalışma bulunamadı." };

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  return { success: true };
}

// Sorumlu uzman ataması, çalışma müşteri tarafından oluşturulduktan
// SONRA, yalnızca Kontrolör ve üzeri roller tarafından yapılır.
// Müşteriye açık "Yeni Çalışma" formunda bu alan bulunmaz.
export async function assignProject(projectId: string, assigneeName: string): Promise<ActionResult> {
  const auth = await requireRole(OVERSIGHT_ROLES, OVERSIGHT_ONLY);
  if ("error" in auth) return { error: auth.error };

  const trimmed = assigneeName.trim();
  const { data, error } = await auth.supabase
    .from("academic_projects")
    .update({ assignee_name: trimmed || null })
    .eq("id", projectId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Atama sırasında bir hata oluştu." };
  }
  if (!data?.length) return { error: "Çalışma bulunamadı." };

  revalidatePath("/dashboard/editor");
  return { success: true };
}

// Silme yetkisi RLS'te zaten tanımlı: çalışmanın sahibi ya da
// Akademik Yönetici/Sistem Yöneticisi/Kurucu rolleri silebilir
// (bkz. "Owner or oversight-role can delete projects" politikası).
// İlişkili kayıtlar (kaynakça kontrolleri, belge yüklemeleri, panelde
// yazma metni vb.) veritabanında ON DELETE CASCADE ile otomatik silinir.
export async function deleteProject(projectId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const { data, error } = await ctx.supabase.from("academic_projects").delete().eq("id", projectId).select("id");

  if (error) {
    console.error(error);
    return { error: "Silme sırasında bir hata oluştu." };
  }
  if (!data?.length) return { error: "Bu çalışmayı silme yetkiniz yok." };

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  return { success: true };
}
