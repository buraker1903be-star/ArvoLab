"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?error=invalid-credentials");

  const code = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const pointsRaw = String(formData.get("pointsPerUnit") ?? "").trim();

  if (!code || !label || !pointsRaw) {
    redirect("/dashboard/scoring?error=missing-fields");
  }

  const { error } = await supabase.from("scoring_criteria").insert({
    code,
    label,
    category_group: String(formData.get("categoryGroup") ?? "").trim() || null,
    points_per_unit: Number(pointsRaw),
    notes: String(formData.get("notes") ?? "").trim() || null,
    updated_by: user.id,
  });

  if (error) {
    console.error(error);
    if (error.code === "23505") {
      redirect("/dashboard/scoring?error=duplicate-code");
    }
    redirect("/dashboard/scoring?error=save-failed");
  }

  revalidatePath("/dashboard/scoring");
  redirect("/dashboard/scoring");
}

export async function deleteCriterion(criterionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("scoring_criteria").delete().eq("id", criterionId);
  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  revalidatePath("/dashboard/scoring");
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
  if (!user) redirect("/?error=invalid-credentials");

  const criteriaId = String(formData.get("criteriaId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const unitCountRaw = String(formData.get("unitCount") ?? "1").trim();

  if (!criteriaId || !title) {
    redirect("/dashboard/scoring?error=missing-entry-fields");
  }

  const { data: criterion, error: criterionError } = await supabase
    .from("scoring_criteria")
    .select("points_per_unit")
    .eq("id", criteriaId)
    .single();

  if (criterionError || !criterion) {
    redirect("/dashboard/scoring?error=invalid-criterion");
  }

  const unitCount = Number(unitCountRaw) || 1;
  const computedPoints = unitCount * criterion.points_per_unit;

  const { error } = await supabase.from("academic_score_entries").insert({
    owner_id: user.id,
    criteria_id: criteriaId,
    title,
    unit_count: unitCount,
    computed_points: computedPoints,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    console.error(error);
    redirect("/dashboard/scoring?error=save-entry-failed");
  }

  revalidatePath("/dashboard/scoring");
  redirect("/dashboard/scoring");
}

export async function deleteScoreEntry(entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("academic_score_entries").delete().eq("id", entryId);
  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  revalidatePath("/dashboard/scoring");
  return { success: true };
}
