"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    redirect("/?error=invalid-credentials");
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

  const guidelineIdRaw = String(formData.get("guidelineId") ?? "").trim();

  const { error } = await supabase.from("academic_projects").insert({
    owner_id: user.id,
    organization_id: profile?.organization_id ?? null,
    guideline_id: guidelineIdRaw || null,
    title,
    project_type: type,
    university: String(formData.get("university") ?? "").trim() || null,
    institute: String(formData.get("institute") ?? "").trim() || null,
    department: String(formData.get("department") ?? "").trim() || null,
    citation_style: String(formData.get("citationStyle") ?? "apa7"),
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
// RLS bu yetkiyi veritabanı seviyesinde de zorunlu kılar; buradaki kontrol
// kullanıcıya erken/anlaşılır bir hata mesajı vermek içindir.
export async function approveProject(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const oversightRoles = ["controller", "academic_manager", "system_admin", "founder"];
  if (!profile || !oversightRoles.includes(profile.role)) {
    return { error: "Bu işlem için Kontrolör veya üzeri bir role sahip olmalısınız." };
  }

  const { error } = await supabase
    .from("academic_projects")
    .update({
      controller_approved_by: user.id,
      controller_approved_at: new Date().toISOString(),
      status: "ready",
    })
    .eq("id", projectId);

  if (error) {
    console.error(error);
    return { error: "Onaylanırken bir hata oluştu." };
  }

  revalidatePath("/dashboard/editor");
  return { success: true };
}

export async function revokeApproval(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { error } = await supabase
    .from("academic_projects")
    .update({
      controller_approved_by: null,
      controller_approved_at: null,
      status: "revision",
    })
    .eq("id", projectId);

  if (error) {
    console.error(error);
    return { error: "İşlem sırasında bir hata oluştu." };
  }

  revalidatePath("/dashboard/editor");
  return { success: true };
}
