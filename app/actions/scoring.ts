"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, requireRole, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { MANAGER_ROLES } from "@/lib/project-labels";

const PAGE_PATH = "/dashboard/associate-professorship";

export interface ScoringCriterion {
  id: string;
  code: string;
  label: string;
  category_group: string | null;
  points_per_unit: number;
  notes: string | null;
  is_active: boolean;
}

export interface ScoreEntry {
  id: string;
  criteria_id: string;
  title: string;
  unit_count: number;
  computed_points: number;
  notes: string | null;
  created_at: string;
}

function parseDecimal(raw: string) {
  return Number(raw.trim().replace(",", "."));
}

export async function getCriteria(): Promise<ScoringCriterion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scoring_criteria")
    .select("id, code, label, category_group, points_per_unit, notes, is_active")
    .eq("is_active", true)
    .order("category_group", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function createCriterion(formData: FormData) {
  const auth = await requireRole(MANAGER_ROLES);
  if ("error" in auth) {
    redirect(auth.reason === "unauthenticated" ? "/" : `${PAGE_PATH}?error=forbidden`);
  }

  const code = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const pointsRaw = String(formData.get("pointsPerUnit") ?? "").trim();

  if (!code || !label || !pointsRaw) {
    redirect(`${PAGE_PATH}?error=missing-fields`);
  }

  const points = parseDecimal(pointsRaw);
  if (!Number.isFinite(points) || points < 0) {
    redirect(`${PAGE_PATH}?error=invalid-points`);
  }

  const { error } = await auth.supabase.from("scoring_criteria").insert({
    code,
    label,
    category_group: String(formData.get("categoryGroup") ?? "").trim() || null,
    points_per_unit: points,
    notes: String(formData.get("notes") ?? "").trim() || null,
    updated_by: auth.user.id,
  });

  if (error) {
    console.error(error);
    if (error.code === "23505") {
      redirect(`${PAGE_PATH}?error=duplicate-code`);
    }
    redirect(`${PAGE_PATH}?error=save-failed`);
  }

  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH);
}

// Kriter kodu değiştirilemez (kayıtlar ona bağlı). Puan değişikliği yalnızca
// bundan sonra eklenen faaliyetlere uygulanır; mevcut kayıtların puanı,
// eklendiği andaki değerle saklanır.
export async function updateCriterion(criterionId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kriterleri yalnızca Akademik Yönetici ve üzeri roller düzenleyebilir.");
  if ("error" in auth) return { error: auth.error };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Etiket zorunludur." };

  const points = parseDecimal(String(formData.get("pointsPerUnit") ?? ""));
  if (!Number.isFinite(points) || points < 0) return { error: "Birim başına puan 0 veya daha büyük bir sayı olmalıdır." };

  const { data, error } = await auth.supabase
    .from("scoring_criteria")
    .update({
      label,
      category_group: String(formData.get("categoryGroup") ?? "").trim() || null,
      points_per_unit: points,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", criterionId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Kriter güncellenirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kriter bulunamadı." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function deleteCriterion(criterionId: string): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kriterleri yalnızca Akademik Yönetici ve üzeri roller silebilir.");
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.from("scoring_criteria").delete().eq("id", criterionId);

  if (error?.code === "23503") {
    // Kritere bağlı kullanıcı kayıtları var: kayıtları bozmamak için
    // kriteri silmek yerine pasife alıyoruz (listeden kalkar, geçmiş puanlar korunur).
    const { error: deactivateError } = await auth.supabase
      .from("scoring_criteria")
      .update({ is_active: false, updated_by: auth.user.id })
      .eq("id", criterionId);
    if (deactivateError) {
      console.error(deactivateError);
      return { error: "Kriter pasife alınırken bir hata oluştu." };
    }
  } else if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function getMyScoreEntries(): Promise<(ScoreEntry & { criteria: ScoringCriterion | null })[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("academic_score_entries")
    .select(
      "id, criteria_id, title, unit_count, computed_points, notes, created_at, scoring_criteria(id, code, label, category_group, points_per_unit, notes, is_active)"
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []).map((row) => {
    const { scoring_criteria, ...rest } = row as typeof row & {
      scoring_criteria: ScoringCriterion | ScoringCriterion[] | null;
    };
    const criteria = Array.isArray(scoring_criteria) ? scoring_criteria[0] ?? null : scoring_criteria;
    return { ...rest, criteria };
  });
}

export async function addScoreEntry(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const criteriaId = String(formData.get("criteriaId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const unitCountRaw = String(formData.get("unitCount") ?? "1").trim() || "1";

  if (!criteriaId || !title) {
    redirect(`${PAGE_PATH}?error=missing-entry-fields`);
  }

  const unitCount = parseDecimal(unitCountRaw);
  if (!Number.isFinite(unitCount) || unitCount <= 0) {
    redirect(`${PAGE_PATH}?error=invalid-unit`);
  }

  const { data: criterion, error: criterionError } = await supabase
    .from("scoring_criteria")
    .select("points_per_unit")
    .eq("id", criteriaId)
    .eq("is_active", true)
    .single();

  if (criterionError || !criterion) {
    redirect(`${PAGE_PATH}?error=invalid-criterion`);
  }

  const { error } = await supabase.from("academic_score_entries").insert({
    owner_id: user.id,
    criteria_id: criteriaId,
    title,
    unit_count: unitCount,
    computed_points: unitCount * criterion.points_per_unit,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    console.error(error);
    redirect(`${PAGE_PATH}?error=save-entry-failed`);
  }

  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH);
}

export async function deleteScoreEntry(entryId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const { data, error } = await ctx.supabase
    .from("academic_score_entries")
    .delete()
    .eq("id", entryId)
    .eq("owner_id", ctx.user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kayıt bulunamadı ya da size ait değil." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}
