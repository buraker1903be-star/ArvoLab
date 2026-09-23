"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { CALISMA_OKUNAMADI, calismaOzeti } from "@/app/actions/calisma-merkezi";
import { onayUyarisi } from "@/lib/onay-uyarisi";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, requireRole, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { STILLER } from "@/lib/atif/stiller";
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
// Stil listesi tek yerde: lib/atif/stiller.ts. Kopyalanınca yeni stil
// eklendiğinde burası unutuluyor ve seçim sessizce APA'ya düşüyordu.
const CITATION_STYLES: string[] = Object.keys(STILLER);

/*
  Veritabanının kabul ettiği stil listesi bir migration'la genişliyor
  (ör. MLA: 20260924100020). Uygulama önce yayına çıkar, migration SQL
  Editor'den elle uygulanır; arada kalan pencerede yeni stili seçen
  kullanıcı "Kaydedilirken bir hata oluştu" görüyordu ve neyin yanlış
  olduğunu anlamasının yolu yoktu. CHECK ihlali (23514) bu yüzden ayrı
  yazılıyor.
*/
const stilKisiti = (error: { code?: string; message?: string } | null) =>
  error?.code === "23514" && /citation_style/.test(error.message ?? "")
    ? "Bu kaynakça sistemi veritabanında henüz tanımlı değil; sistem yöneticinize bildirin. Şimdilik başka bir sistem seçebilirsiniz."
    : null;

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
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Kurum alanları: ad (kapak sayfası ve listeler için) + kimlik (kılavuz eşleştirmesi için).
// Kılavuzu (guideline_id) veritabanı tetikleyicisi bu kimliklerden belirler.
function readInstitution(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "").trim().slice(0, 240) || null;
  const id = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return UUID_PATTERN.test(value) ? value : null;
  };
  const university_id = id("universityId");
  const academic_unit_id = university_id ? id("academicUnitId") : null;
  const department_id = academic_unit_id ? id("departmentId") : null;
  return {
    university: text("university"),
    institute: text("institute"),
    department: text("department"),
    university_id,
    academic_unit_id,
    department_id,
  };
}

// Hatalar formun içinde gösterilir (yazılanlar kaybolmaz); başarıda editör açılır.
export async function createProject(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return SESSION_MISSING;
  /* Paneldeki kapı yalnızca ekranı kapatıyor; sunucu işlemi doğrudan
     çağrılabildiği için abonelik burada da denetlenmeli. */
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (title.length < 3 || title.length > 240) {
    return { error: "Çalışma başlığı 3 ile 240 karakter arasında olmalıdır." };
  }
  if (!PROJECT_TYPES.includes(type)) {
    return { error: "Lütfen çalışma türünü seçin." };
  }

  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const citationStyle = String(formData.get("citationStyle") ?? "apa7");
  const method = String(formData.get("method") ?? "");
  const priority = String(formData.get("priority") ?? "normal");

  // Tezlerde kılavuz ve kaynakça sistemi, kurum kimliklerinden veritabanında belirlenir.
  const { data: created, error } = await supabase
    .from("academic_projects")
    .insert({
      owner_id: user.id,
      organization_id: profile?.organization_id ?? null,
      title,
      project_type: type,
      ...readInstitution(formData),
      citation_style: CITATION_STYLES.includes(citationStyle) ? citationStyle : "apa7",
      research_method: RESEARCH_METHODS.includes(method) ? method : null,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw) ? dueDateRaw : null,
      priority: PRIORITIES.includes(priority) ? priority : "normal",
      notes: String(formData.get("notes") ?? "").trim() || null,
      status: "new",
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error(error);
    return { error: stilKisiti(error) ?? "Kaydedilirken bir hata oluştu, lütfen tekrar deneyin." };
  }

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  // Müşteri doğrudan yazmaya başlasın.
  redirect(`/dashboard/editor/${created.id}/write`);
}

/**
 * Kullanıcının görebildiği çalışmalar.
 *
 * Dönüş tipi bilerek dizi DEĞİL: okuma başarısızken de boş dizi dönmek,
 * arayüzde "hiç çalışmanız yok" yalanına dönüşüyordu (lib/liste-sonucu.ts).
 */
export async function getProjects(): Promise<ListeSonucu<AcademicProject>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Oturum yoksa gerçekten kayıt yoktur; bu bir okuma arızası değil.
  if (!user) return listeBasarili([]);

  const { data, error } = await supabase
    .from("academic_projects")
    .select(
      "id, owner_id, organization_id, assignee_id, guideline_id, title, project_type, university, institute, department, citation_style, research_method, assignee_name, due_date, priority, status, notes, progress, controller_approved_by, controller_approved_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[projeler] liste okunamadı:", error.message);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

export interface ProjectEditData {
  id: string;
  owner_id: string;
  assignee_id: string | null;
  guideline_id: string | null;
  title: string;
  project_type: string;
  university: string | null;
  institute: string | null;
  department: string | null;
  university_id: string | null;
  academic_unit_id: string | null;
  department_id: string | null;
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
      "id, owner_id, assignee_id, guideline_id, title, project_type, university, institute, department, university_id, academic_unit_id, department_id, citation_style, research_method, due_date, priority, status, notes, progress"
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
      // Kurum değişirse kılavuz veritabanında yeniden eşleştirilir.
      ...(formData.has("universityId") ? readInstitution(formData) : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select("id");

  if (error) {
    console.error(error);
    return {
      error:
        error.code === "42501"
          ? "Bu değişiklik için yetkiniz yok."
          : stilKisiti(error) ?? "Kaydedilirken bir hata oluştu.",
    };
  }
  if (!data?.length) return { error: "Bu çalışmayı düzenleme yetkiniz yok." };

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  // Düzenleme sayfası da yeni değerlerle çizilsin; form kayıttan sonra bu değerlerle yeniden kurulur (action-form.tsx).
  revalidatePath(`/dashboard/editor/${projectId}/edit`);
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
  revalidatePath(`/dashboard/editor/${projectId}`);

  /*
    Onay verildi; şimdi kontrolöre ekosistemin bulduklarını söylüyoruz.
    Denetimler zaten yapılmış durumda ama çalışma merkezinde duruyor ve onay
    listeden veriliyor — merkeze girmediyse hiçbirini görmemiş oluyor.
    Uyarı ENGELLEMEZ: kuralın dışına çıkmayı bilerek seçmiş olabilir.
    Okunamazsa sessiz geçilir, onay zaten verildi.
  */
  try {
    const ozet = await calismaOzeti(projectId);
    // Okunamadıysa uyarı hesaplanmaz; onay zaten verildi, sessiz geçiliyor.
    const uyari = ozet && ozet !== CALISMA_OKUNAMADI
      ? onayUyarisi({ tutarsizliklar: ozet.tutarsizliklar, hazirlik: ozet.hazirlik })
      : null;
    if (uyari) return { success: true, warning: uyari };
  } catch (hata) {
    console.error("[onay] uyarı hesaplanamadı:", hata instanceof Error ? hata.message : hata);
  }

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
