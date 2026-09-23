"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, requireRole, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { MANAGER_ROLES } from "@/lib/project-labels";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { korunanBirimPuan } from "@/lib/docentlik-puan";

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

export async function getCriteria(): Promise<ListeSonucu<ScoringCriterion>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scoring_criteria")
    .select("id, code, label, category_group, points_per_unit, notes, is_active")
    .eq("is_active", true)
    .order("category_group", { ascending: true });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

export async function createCriterion(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kriter eklemek için Akademik Yönetici veya üzeri bir rol gerekir.");
  if ("error" in auth) return { error: auth.error };

  const code = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const pointsRaw = String(formData.get("pointsPerUnit") ?? "").trim();

  if (!code || !label || !pointsRaw) return { error: "Kod, etiket ve puan alanları zorunludur." };

  const points = parseDecimal(pointsRaw);
  if (!Number.isFinite(points) || points < 0) {
    return { error: "Birim başına puan 0 veya daha büyük bir sayı olmalıdır." };
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
    return { error: error.code === "23505" ? "Bu kriter kodu zaten kullanılıyor." : "Kriter kaydedilirken bir hata oluştu." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
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

export async function getMyScoreEntries(): Promise<ListeSonucu<ScoreEntry & { criteria: ScoringCriterion | null }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return listeBasarili([]);

  const { data, error } = await supabase
    .from("academic_score_entries")
    .select(
      "id, criteria_id, title, unit_count, computed_points, notes, created_at, scoring_criteria(id, code, label, category_group, points_per_unit, notes, is_active)"
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }

  return listeBasarili((data ?? []).map((row) => {
    const { scoring_criteria, ...rest } = row as typeof row & {
      scoring_criteria: ScoringCriterion | ScoringCriterion[] | null;
    };
    const criteria = Array.isArray(scoring_criteria) ? scoring_criteria[0] ?? null : scoring_criteria;
    return { ...rest, criteria };
  }));
}

export async function addScoreEntry(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  /* Abonelik kapısı: Doçentlik puanlama ücretli bir özellik; yeni kayıt üretir. */
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };
  const { supabase, user } = ctx;

  const criteriaId = String(formData.get("criteriaId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const unitCountRaw = String(formData.get("unitCount") ?? "1").trim() || "1";

  if (!criteriaId || !title) return { error: "Kriter ve başlık alanları zorunludur." };

  const unitCount = parseDecimal(unitCountRaw);
  if (!Number.isFinite(unitCount) || unitCount <= 0) {
    return { error: "Adet / birim sayısı 0'dan büyük bir sayı olmalıdır." };
  }

  const { data: criterion, error: criterionError } = await supabase
    .from("scoring_criteria")
    .select("points_per_unit")
    .eq("id", criteriaId)
    .eq("is_active", true)
    .single();

  if (criterionError || !criterion) return { error: "Seçilen kriter bulunamadı." };

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
    return { error: "Kayıt eklenirken bir hata oluştu." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

/*
  Kayıt düzenleme. Eskiden yoktu: yanlış girilen adet ya da başlık için tek
  yol kaydı silip yeniden girmekti — tabloda UPDATE ne grant'lenmişti ne de
  politikası vardı (20260924100023).

  Birim puanın nereden geldiği lib/docentlik-puan.ts'te anlatılıyor: kriter
  aynı kaldığı sürece kaydın kendi puanı korunur, yoksa başlıktaki bir yazım
  hatasını düzelten kullanıcının toplam puanı sessizce değişirdi.
*/
export async function updateScoreEntry(entryId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  /* Abonelik kapısı: ücretli özelliğin ürettiği kaydı değiştirmek de o
     özelliği kullanmaktır. Silme bilerek kapının dışında. */
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };
  const { supabase, user } = ctx;

  const criteriaId = String(formData.get("criteriaId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!criteriaId || !title) return { error: "Kriter ve başlık alanları zorunludur." };

  const unitCount = parseDecimal(String(formData.get("unitCount") ?? "1").trim() || "1");
  if (!Number.isFinite(unitCount) || unitCount <= 0) {
    return { error: "Adet / birim sayısı 0'dan büyük bir sayı olmalıdır." };
  }

  const { data: mevcut, error: okumaHatasi } = await supabase
    .from("academic_score_entries")
    .select("criteria_id, unit_count, computed_points")
    .eq("id", entryId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (okumaHatasi) {
    console.error(okumaHatasi);
    // Okunamayan kaydın üzerine yazmak, birim puanı kritere göre yeniden
    // fiyatlandırırdı: hata "kaydedildi" görünürken puan değişirdi.
    return { error: "Kayıt okunamadı; değişiklik kaydedilmedi, tekrar deneyin." };
  }
  if (!mevcut) return { error: "Kayıt bulunamadı ya da size ait değil." };

  let birimPuan = korunanBirimPuan(mevcut, criteriaId);
  if (birimPuan === null) {
    // Kriter değişti (ya da kaydın puanı türetilemedi): yeni kriterin güncel puanı.
    const { data: criterion, error: kriterHatasi } = await supabase
      .from("scoring_criteria")
      .select("points_per_unit")
      .eq("id", criteriaId)
      .eq("is_active", true)
      .single();
    if (kriterHatasi || !criterion) return { error: "Seçilen kriter bulunamadı." };
    birimPuan = Number(criterion.points_per_unit);
  }

  const { data, error } = await supabase
    .from("academic_score_entries")
    .update({
      criteria_id: criteriaId,
      title,
      unit_count: unitCount,
      computed_points: unitCount * birimPuan,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", entryId)
    .eq("owner_id", user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Kayıt güncellenirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kayıt bulunamadı ya da size ait değil." };

  revalidatePath(PAGE_PATH);
  return { success: true };
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
