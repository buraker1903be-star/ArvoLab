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
    .select("id, source_url, source_checksum")
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
      const { error: updateError } = await supabase
        .from("thesis_guidelines")
        .update({
          source_checksum: scan.sourceChecksum,
          source_content_type: scan.sourceContentType,
          last_checked_at: new Date().toISOString(),
          ...(changed
            ? {
                analysis_status: "needs_review",
                ai_analysis: {
                  detectedCitationHint: scan.detectedCitationHint,
                  suggestedSections: scan.suggestedSections,
                  textPreview: scan.textPreview,
                  fullTextLength: scan.fullTextLength,
                  detectedAt: new Date().toISOString(),
                },
                review_notes: "Resmî kaynakta içerik değişikliği algılandı; yeniden akademik onay gerekiyor.",
              }
            : {}),
        })
        .eq("id", guideline.id);

      if (updateError) throw updateError;
      results.push({ id: guideline.id, status: changed ? "needs_review" : "unchanged" });
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
