"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { findMatchingGuideline } from "@/app/actions/guidelines";
import { getAuthContext, requireRole, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import {
  OVERSIGHT_ONLY_STATUSES,
  OVERSIGHT_ROLES,
  PROJECT_STATUSES,
  STAFF_ROLES,
  isOversightRole,
  type UserRole,
} from "@/lib/project-labels";

const OVERSIGHT_ONLY = "Bu işlem için Kontrolör veya üzeri bir role sahip olmalısınız.";
const PRIORITIES = ["low", "normal", "high", "urgent"];
const RESEARCH_METHODS = ["quantitative", "qualitative", "mixed", "review"];
const CITATION_STYLES = ["apa7", "vancouver", "chicago", "ieee"];

export interface AcademicProject {
  id: string;
  owner_id: string;
  organization_id: string | null;
  assignee_id: string | null;
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
      "id, owner_id, organization_id, assignee_id, guideline_id, title, project_type, university, institute, department, citation_style, research_method, assignee_name, due_date, priority, status, notes, progress, controller_approved_by, controller_approved_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export interface ProjectEditData {
  id: string;
  owner_id: string;
  assignee_id: string | null;
  guideline_id: string | null;
  title: string;
  project_type: string;
  university: string | null;
  citation_style: string;
  research_method: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  notes: string | null;
  progress: number;
}

export async function getProjectForEdit(projectId: string): Promise<ProjectEditData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_projects")
    .select(
      "id, owner_id, assignee_id, guideline_id, title, project_type, university, citation_style, research_method, due_date, priority, status, notes, progress"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

// Çalışmanın sahibi, atanan personel ve Kontrolör+ roller düzenleyebilir.
// "Teslime hazır / Teslim edildi" durumlarına geçiş (ve bu durumlardan çıkış)
// Kontrolör onayı gerektirir; veritabanı tetikleyicisi de bunu zorunlu kılar.
export async function updateProject(projectId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const current = await getProjectForEdit(projectId);
  if (!current) return { error: "Çalışma bulunamadı." };

  const canOversee = isOversightRole(ctx.role);
  if (!canOversee && current.owner_id !== ctx.user.id && current.assignee_id !== ctx.user.id) {
    return { error: "Bu çalışmayı düzenleme yetkiniz yok." };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3 || title.length > 240) {
    return { error: "Başlık 3 ile 240 karakter arasında olmalı." };
  }

  const priority = String(formData.get("priority") ?? current.priority);
  if (!PRIORITIES.includes(priority)) return { error: "Geçersiz öncelik." };

  const method = String(formData.get("method") ?? "");
  if (method && !RESEARCH_METHODS.includes(method)) return { error: "Geçersiz araştırma yöntemi." };

  const dueDate = String(formData.get("dueDate") ?? "").trim();
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: "Geçersiz teslim tarihi." };

  const progress = Number(formData.get("progress"));
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    return { error: "İlerleme 0 ile 100 arasında bir tam sayı olmalı." };
  }

  // Devre dışı (disabled) alanlar forma eklenmez; o durumda mevcut değer korunur.
  const statusField = formData.get("status");
  const status = statusField === null ? current.status : String(statusField);
  if (!PROJECT_STATUSES.includes(status)) return { error: "Geçersiz durum." };
  if (
    !canOversee &&
    status !== current.status &&
    (OVERSIGHT_ONLY_STATUSES.includes(status) || OVERSIGHT_ONLY_STATUSES.includes(current.status))
  ) {
    return { error: "Bu durum değişikliğini yalnızca Kontrolör ve üzeri roller yapabilir." };
  }

  const citationField = formData.get("citationStyle");
  const citationStyle =
    current.guideline_id || citationField === null ? current.citation_style : String(citationField);
  if (!CITATION_STYLES.includes(citationStyle)) return { error: "Geçersiz kaynakça sistemi." };

  const { data, error } = await ctx.supabase
    .from("academic_projects")
    .update({
      title,
      priority,
      research_method: method || null,
      due_date: dueDate || null,
      progress,
      status,
      citation_style: citationStyle,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: error.code === "42501" ? "Bu değişiklik için yetkiniz yok." : "Kaydedilirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Bu çalışmayı düzenleme yetkiniz yok." };

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  return { success: true };
}

export interface StaffMember {
  id: string;
  full_name: string | null;
  role: UserRole;
}

/** Atama listesi için personel (RLS: aynı kurum ya da Sistem Yöneticisi/Kurucu için herkes). */
export async function getAssignableStaff(): Promise<StaffMember[]> {
  const auth = await requireRole(OVERSIGHT_ROLES);
  if ("error" in auth) return [];

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", [...STAFF_ROLES])
    .order("full_name", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []) as StaffMember[];
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

// Sorumlu personel ataması, çalışma müşteri tarafından oluşturulduktan
// SONRA, yalnızca Kontrolör ve üzeri roller tarafından yapılır.
// Müşteriye açık "Yeni Çalışma" formunda bu alan bulunmaz.
// assignee_id doldurulduğu için atanan kişi çalışmayı RLS üzerinden görebilir.
export async function assignProject(projectId: string, assigneeId: string): Promise<ActionResult> {
  const auth = await requireRole(OVERSIGHT_ROLES, OVERSIGHT_ONLY);
  if ("error" in auth) return { error: auth.error };

  let assignee: StaffMember | null = null;
  if (assigneeId) {
    const { data: staff } = await auth.supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", assigneeId)
      .maybeSingle();
    if (!staff || !STAFF_ROLES.includes(staff.role as UserRole)) {
      return { error: "Seçilen kişi personel listesinde bulunamadı." };
    }
    assignee = staff as StaffMember;
  }

  const { data, error } = await auth.supabase
    .from("academic_projects")
    .update({
      assignee_id: assignee?.id ?? null,
      assignee_name: assignee ? assignee.full_name || "İsimsiz personel" : null,
    })
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
