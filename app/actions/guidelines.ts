"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
      "id, university_name, institute_name, version_label, source_url, citation_style, required_sections, min_pages, max_pages, notes, is_active, last_checked_at, created_at, analysis_status, review_notes"
    )
    .order("university_name", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function createGuideline(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/?error=invalid-credentials");
  }

  const universityName = String(formData.get("universityName") ?? "").trim();
  if (!universityName) {
    redirect("/dashboard/guidelines?error=missing-university");
  }

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
    citation_style: String(formData.get("citationStyle") ?? "apa7"),
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
    redirect("/dashboard/guidelines?error=save-failed");
  }

  revalidatePath("/dashboard/guidelines");
  redirect("/dashboard/guidelines");
}

export async function approveGuideline(guidelineId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["academic_manager", "system_admin", "founder"].includes(profile.role)) {
    return { error: "Bu işlem için Akademik Yönetici veya üzeri bir rol gerekir." };
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
  revalidatePath("/dashboard/guidelines");
  return { success: true };
}

export async function deleteGuideline(guidelineId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("thesis_guidelines").delete().eq("id", guidelineId);
  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  revalidatePath("/dashboard/guidelines");
  return { success: true };
}
