import { createAdminClient } from "@/lib/supabase/admin";
import { scanGuidelineUrl } from "@/lib/guideline-scan";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: guidelines, error } = await supabase
    .from("thesis_guidelines")
    .select("id, source_url, source_checksum, analysis_status, university_name, institute_name")
    .not("source_url", "is", null)
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true })
    .limit(8);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const guideline of guidelines ?? []) {
    try {
      const scan = await scanGuidelineUrl(guideline.source_url!);
      const changed = Boolean(guideline.source_checksum && guideline.source_checksum !== scan.sourceChecksum);
      const citationStyle = scan.detectedCitationHint?.toLowerCase().replace(" ", "") ?? null;
      const readyForApproval = scan.confidence >= 0.9 && scan.suggestedSections.length >= 4 && Boolean(citationStyle);
      const keepPreviousApproval = changed && guideline.analysis_status === "approved";
      const detectedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("thesis_guidelines")
        .update({
          source_checksum: scan.sourceChecksum,
          source_content_type: scan.sourceContentType,
          last_checked_at: detectedAt,
          ai_analysis: {
            detectedCitationHint: scan.detectedCitationHint,
            suggestedSections: scan.suggestedSections,
            suggestedRules: scan.suggestedRules,
            confidence: scan.confidence,
            warnings: scan.warnings,
            textPreview: scan.textPreview,
            fullTextLength: scan.fullTextLength,
            detectedAt,
            pendingReview: keepPreviousApproval,
          },
          ...(!keepPreviousApproval ? {
            analysis_status: "needs_review",
            extracted_rules: scan.suggestedRules,
            required_sections: scan.suggestedSections,
            ...(citationStyle ? { citation_style: citationStyle } : {}),
            reviewed_by: null,
            reviewed_at: null,
            review_notes: readyForApproval
              ? `Kurallar otomatik dolduruldu (güven: %${Math.round(scan.confidence * 100)}); tek adım onay bekliyor.`
              : `Otomatik çıkarım inceleme gerektiriyor (güven: %${Math.round(scan.confidence * 100)}).`,
          } : {
            analysis_status: "approved",
            review_notes: "Yeni sürüm algılandı; önceki onaylı kurallar korunuyor ve yönetici incelemesi bekliyor.",
          }),
        })
        .eq("id", guideline.id);

      if (updateError) throw updateError;
      results.push({ id: guideline.id, status: keepPreviousApproval ? "previous_rules_kept" : readyForApproval ? "ready_for_approval" : "needs_review" });
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : "Tarama başarısız.";
      await supabase
        .from("thesis_guidelines")
        .update({
          review_notes: `Son otomatik kontrol başarısız: ${message}`.slice(0, 1000),
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", guideline.id);
      results.push({ id: guideline.id, status: "failed", error: message });
    }
  }

  return Response.json({ checked: results.length, results });
}
