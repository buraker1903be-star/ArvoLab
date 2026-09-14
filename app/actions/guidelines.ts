"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, type ActionResult } from "@/lib/auth-guards";
import { MANAGER_ROLES } from "@/lib/project-labels";

export interface ThesisGuideline {
  id: string;
  university_name: string;
  institute_name: string | null;
  version_label: string | null;
  source_url: string | null;
  citation_style: string;
  required_sections: string[];
  min_pages: number | null;
  max_pages: number | null;
  notes: string | null;
  is_active: boolean;
  last_checked_at: string;
  created_at: string;
  analysis_status: string;
  review_notes: string | null;
  extracted_rules: Record<string, unknown>;
}

export interface GuidelineMatch {
  id: string;
  university_name: string;
  institute_name: string | null;
  document_title: string | null;
  version_label: string | null;
  citation_style: string;
  match_level: "department" | "academic_unit" | "university";
}

/** En özel onaylı kılavuzu seçer; gerekirse üst kuruma geri düşer. */
export async function findMatchingGuideline(
  universityId: string,
  academicUnitId?: string | null,
  departmentId?: string | null
): Promise<GuidelineMatch | null> {
  if (!universityId) return null;

  const supabase = await createClient();
  const select =
    "id, university_name, institute_name, document_title, version_label, citation_style, academic_unit_id";

  for (const candidate of [
    { id: departmentId, level: "department" as const },
    { id: academicUnitId, level: "academic_unit" as const },
  ]) {
    if (!candidate.id) continue;
    const { data } = await supabase
      .from("thesis_guidelines")
      .select(select)
      .eq("university_id", universityId)
      .eq("academic_unit_id", candidate.id)
      .eq("is_active", true)
      .eq("analysis_status", "approved")
      .order("effective_from", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return { ...data, match_level: candidate.level };
  }

  const { data } = await supabase
    .from("thesis_guidelines")
    .select(select)
    .eq("university_id", universityId)
    .is("academic_unit_id", null)
    .eq("is_active", true)
    .eq("analysis_status", "approved")
    .order("effective_from", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? { ...data, match_level: "university" } : null;
}

export async function getGuidelines(): Promise<ThesisGuideline[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("thesis_guidelines")
    .select(
      "id, university_name, institute_name, version_label, source_url, citation_style, required_sections, min_pages, max_pages, notes, is_active, last_checked_at, created_at, analysis_status, review_notes, extracted_rules"
    )
    .order("university_name", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

const REVIEW_FONTS = ["Times New Roman", "Arial", "Calibri", "Cambria", "Garamond", "Georgia", "Verdana", "Book Antiqua"];

export async function updateGuidelineRules(guidelineId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["academic_manager", "system_admin", "founder"].includes(profile.role)) {
    return { error: "Bu işlem için Akademik Yönetici veya üzeri bir rol gerekir." };
  }

  const numberInRange = (name: string, min: number, max: number) => {
    const value = Number(String(formData.get(name) ?? "").replace(",", "."));
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  };
  const fontFamily = String(formData.get("fontFamily") ?? "");
  const margins = {
    top: numberInRange("marginTop", 0, 10),
    bottom: numberInRange("marginBottom", 0, 10),
    left: numberInRange("marginLeft", 0, 10),
    right: numberInRange("marginRight", 0, 10),
  };
  const fontSizePt = numberInRange("fontSizePt", 8, 24);
  const lineSpacing = numberInRange("lineSpacing", 1, 3);
  if (Object.values(margins).some((value) => value === null) || !fontSizePt || !lineSpacing || !REVIEW_FONTS.includes(fontFamily)) {
    return { error: "Biçim ayarlarından biri geçersiz." };
  }

  const requiredSections = String(formData.get("requiredSections") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const citationStyle = String(formData.get("citationStyle") ?? "apa7");
  if (!requiredSections.length || !["apa7", "vancouver", "chicago", "ieee"].includes(citationStyle)) {
    return { error: "Kaynakça sistemi ve en az bir zorunlu bölüm gereklidir." };
  }

  const { error } = await supabase.from("thesis_guidelines").update({
    citation_style: citationStyle,
    required_sections: requiredSections,
    extracted_rules: {
      margins_cm: margins,
      font_family: fontFamily,
      font_size_pt: fontSizePt,
      line_spacing: lineSpacing,
      show_page_numbers: formData.get("showPageNumbers") === "on",
    },
    analysis_status: "needs_review",
    reviewed_by: null,
    reviewed_at: null,
    review_notes: String(formData.get("reviewNotes") ?? "").trim() || "Biçim kuralları güncellendi; yeniden onay gerekiyor.",
  }).eq("id", guidelineId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/guidelines");
  return { success: true };
}

export async function createGuideline(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kılavuz eklemek için Akademik Yönetici veya üzeri bir rol gerekir.");
  if ("error" in auth) return { error: auth.error };
  const { supabase, user } = auth;

  const universityName = String(formData.get("universityName") ?? "").trim();
  if (!universityName) return { error: "Üniversite adı zorunludur." };

  const citationStyle = String(formData.get("citationStyle") ?? "apa7");
  if (!["apa7", "vancouver", "chicago", "ieee"].includes(citationStyle)) return { error: "Geçersiz kaynakça sistemi." };

  const requiredSectionsRaw = String(formData.get("requiredSections") ?? "");
  const requiredSections = requiredSectionsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const minPagesRaw = String(formData.get("minPages") ?? "").trim();
  const maxPagesRaw = String(formData.get("maxPages") ?? "").trim();
  const instituteName = String(formData.get("instituteName") ?? "").trim();

  const { data: university } = await supabase
    .from("universities")
    .select("id")
    .ilike("name", universityName)
    .limit(1)
    .maybeSingle();

  let academicUnitId: string | null = null;
  if (university?.id && instituteName) {
    const { data: unit } = await supabase
      .from("academic_units")
      .select("id")
      .eq("university_id", university.id)
      .ilike("name", instituteName)
      .limit(1)
      .maybeSingle();
    academicUnitId = unit?.id ?? null;
  }

  const { error } = await supabase.from("thesis_guidelines").insert({
    university_name: universityName,
    institute_name: instituteName || null,
    university_id: university?.id ?? null,
    academic_unit_id: academicUnitId,
    version_label: String(formData.get("versionLabel") ?? "").trim() || null,
    source_url: String(formData.get("sourceUrl") ?? "").trim() || null,
    citation_style: citationStyle,
    required_sections: requiredSections,
    min_pages: minPagesRaw ? Number(minPagesRaw) : null,
    max_pages: maxPagesRaw ? Number(maxPagesRaw) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: user.id,
    analysis_status: "needs_review",
    review_notes: "Yeni kayıt; müşteri projelerinde kullanılmadan önce akademik onay gerekiyor.",
  });

  if (error) {
    console.error(error);
    return { error: "Kılavuz kaydedilirken bir hata oluştu." };
  }

  revalidatePath("/dashboard/guidelines");
  return { success: true };
}

// Kılavuzun kimlik bilgileri (üniversite, enstitü, sürüm, kaynak, sayfa aralığı).
// Üniversite ya da enstitü değişirse kılavuz yanlış kuruma uygulanmasın diye
// yeniden akademik onaya düşer.
export async function updateGuidelineDetails(guidelineId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kılavuzları yalnızca Akademik Yönetici ve üzeri roller düzenleyebilir.");
  if ("error" in auth) return { error: auth.error };

  const universityName = String(formData.get("universityName") ?? "").trim();
  if (!universityName) return { error: "Üniversite adı zorunludur." };
  const instituteName = String(formData.get("instituteName") ?? "").trim();

  const parsePages = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : Number.NaN;
  };
  const minPages = parsePages("minPages");
  const maxPages = parsePages("maxPages");
  if (Number.isNaN(minPages) || Number.isNaN(maxPages)) return { error: "Sayfa sayıları 0 veya daha büyük tam sayı olmalı." };
  if (minPages !== null && maxPages !== null && minPages > maxPages) {
    return { error: "Minimum sayfa, maksimum sayfadan büyük olamaz." };
  }

  const { data: current } = await auth.supabase
    .from("thesis_guidelines")
    .select("university_name, institute_name")
    .eq("id", guidelineId)
    .maybeSingle();
  if (!current) return { error: "Kılavuz bulunamadı." };

  const institutionChanged =
    current.university_name !== universityName || (current.institute_name ?? "") !== instituteName;

  const { data: university } = await auth.supabase
    .from("universities")
    .select("id")
    .ilike("name", universityName)
    .limit(1)
    .maybeSingle();

  let academicUnitId: string | null = null;
  if (university?.id && instituteName) {
    const { data: unit } = await auth.supabase
      .from("academic_units")
      .select("id")
      .eq("university_id", university.id)
      .ilike("name", instituteName)
      .limit(1)
      .maybeSingle();
    academicUnitId = unit?.id ?? null;
  }

  const { error } = await auth.supabase
    .from("thesis_guidelines")
    .update({
      university_name: universityName,
      institute_name: instituteName || null,
      university_id: university?.id ?? null,
      academic_unit_id: academicUnitId,
      version_label: String(formData.get("versionLabel") ?? "").trim() || null,
      source_url: String(formData.get("sourceUrl") ?? "").trim() || null,
      min_pages: minPages,
      max_pages: maxPages,
      notes: String(formData.get("notes") ?? "").trim() || null,
      ...(institutionChanged
        ? {
            analysis_status: "needs_review",
            reviewed_by: null,
            reviewed_at: null,
            review_notes: "Kurum bilgisi değişti; yeniden akademik onay gerekiyor.",
          }
        : {}),
    })
    .eq("id", guidelineId);

  if (error) {
    console.error(error);
    return { error: "Kılavuz güncellenirken bir hata oluştu." };
  }

  revalidatePath("/dashboard/guidelines");
  return { success: true };
}

export async function approveGuideline(guidelineId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["academic_manager", "system_admin", "founder"].includes(profile.role)) {
    return { error: "Bu işlem için Akademik Yönetici veya üzeri bir rol gerekir." };
  }

  const { data: guideline, error: guidelineError } = await supabase
    .from("thesis_guidelines")
    .select("university_name, institute_name, citation_style, required_sections, extracted_rules")
    .eq("id", guidelineId)
    .single();
  if (guidelineError || !guideline) return { error: "Kılavuz bulunamadı." };
  if (!guideline.required_sections?.length || !guideline.extracted_rules || Object.keys(guideline.extracted_rules).length === 0) {
    return { error: "Onaylamadan önce biçim kurallarını ve zorunlu bölümleri kaydedin." };
  }

  const { error } = await supabase
    .from("thesis_guidelines")
    .update({
      analysis_status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: "Akademik yönetici tarafından onaylandı.",
    })
    .eq("id", guidelineId);

  if (error) return { error: error.message };

  // Kılavuz eklenmeden önce açılmış tezleri de kurumsal eşleşmeye bağla.
  let projects = supabase
    .from("academic_projects")
    .update({ guideline_id: guidelineId, citation_style: guideline.citation_style })
    .eq("project_type", "thesis")
    .eq("university", guideline.university_name)
    .is("guideline_id", null);
  if (guideline.institute_name) projects = projects.eq("institute", guideline.institute_name);
  await projects;

  revalidatePath("/dashboard/guidelines");
  revalidatePath("/dashboard/editor");
  return { success: true };
}

export async function deleteGuideline(guidelineId: string): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kılavuzları yalnızca Akademik Yönetici ve üzeri roller silebilir.");
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase.from("thesis_guidelines").delete().eq("id", guidelineId).select("id");
  if (error?.code === "23503") {
    return {
      error: "Bu kılavuza bağlı çalışmalar var, bu yüzden silinemez. Kuralları güncelleyerek yeni sürümü onaylayabilirsiniz.",
    };
  }
  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kılavuz bulunamadı." };

  revalidatePath("/dashboard/guidelines");
  return { success: true };
}
