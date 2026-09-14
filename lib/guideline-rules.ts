import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeGuidelineEditorSettings, type GuidelineEditorSettings } from "@/lib/guideline-editor-settings";

// Bir çalışmaya uygulanan kılavuzun SON ONAYLI sürümü. Editör, kontrol ve
// Word çıktısı hep buradan okur; böylece üçü aynı kuralları kullanır.
// Yönetici kuralları yeniden düzenlerken (needs_review) müşteri son onaylı
// sürümle çalışmaya devam eder (approved_snapshot).
export interface AppliedGuideline {
  id: string;
  /** Onaylı sürümün kimliği (onay zamanı); editör sayfa ayarlarının kaynağını bununla izler */
  version: string;
  label: string;
  universityName: string;
  instituteName: string | null;
  versionLabel: string | null;
  sourceUrl: string | null;
  citationStyle: string;
  requiredSections: string[];
  minPages: number | null;
  maxPages: number | null;
  settings: GuidelineEditorSettings;
  lastCheckedAt: string | null;
  /** Kaynakta yeni bir sürüm algılandı ya da kurallar yeniden inceleniyor */
  updatePending: boolean;
}

interface Snapshot {
  citation_style?: string;
  required_sections?: string[];
  extracted_rules?: unknown;
  min_pages?: number | null;
  max_pages?: number | null;
  version_label?: string | null;
  document_title?: string | null;
  source_url?: string | null;
  approved_at?: string;
}

export async function loadAppliedGuideline(
  supabase: SupabaseClient,
  guidelineId: string | null | undefined
): Promise<AppliedGuideline | null> {
  if (!guidelineId) return null;
  const { data: g, error } = await supabase
    .from("thesis_guidelines")
    .select("*")
    .eq("id", guidelineId)
    .maybeSingle();
  if (error || !g) {
    if (error) console.error(error);
    return null;
  }

  // Migration öncesi kayıtlar: anlık görüntü yoksa yalnızca şu an onaylıysa canlı alanlar kullanılır.
  const snapshot: Snapshot | null =
    (g.approved_snapshot as Snapshot | null) ??
    (g.analysis_status === "approved"
      ? {
          citation_style: g.citation_style,
          required_sections: g.required_sections,
          extracted_rules: g.extracted_rules,
          min_pages: g.min_pages,
          max_pages: g.max_pages,
          version_label: g.version_label,
          document_title: g.document_title,
          source_url: g.source_url,
          approved_at: g.reviewed_at ?? g.updated_at ?? g.created_at,
        }
      : null);
  if (!snapshot) return null;

  const versionLabel = snapshot.version_label ?? null;
  const label =
    snapshot.document_title ??
    `${g.university_name}${g.institute_name ? ` — ${g.institute_name}` : ""}${versionLabel ? ` (${versionLabel})` : ""}`;
  const analysis = (g.ai_analysis ?? {}) as { pendingReview?: boolean };

  return {
    id: g.id,
    version: String(snapshot.approved_at ?? ""),
    label,
    universityName: g.university_name,
    instituteName: g.institute_name ?? null,
    versionLabel,
    sourceUrl: snapshot.source_url ?? g.source_url ?? null,
    citationStyle: snapshot.citation_style ?? g.citation_style ?? "apa7",
    requiredSections: snapshot.required_sections ?? [],
    minPages: snapshot.min_pages ?? null,
    maxPages: snapshot.max_pages ?? null,
    settings: normalizeGuidelineEditorSettings(snapshot.extracted_rules),
    lastCheckedAt: g.last_checked_at ?? null,
    updatePending: g.analysis_status !== "approved" || Boolean(analysis.pendingReview),
  };
}
