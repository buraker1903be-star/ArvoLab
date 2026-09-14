import { createAdminClient } from "@/lib/supabase/admin";
import { scanGuidelineUrl } from "@/lib/guideline-scan";
import {
  discoverGuidelinesForUniversity,
  getUniversitiesDueForGuidelineDiscovery,
} from "@/lib/guideline-discovery";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const discoveryResults: Array<{
    university: string | null;
    status: "discovered" | "already_known" | "not_found" | "failed";
    url?: string;
    error?: string;
  }> = [];
  try {
    const universities = await getUniversitiesDueForGuidelineDiscovery(2);
    for (const university of universities) {
      discoveryResults.push({
        university: university.name,
        ...await discoverGuidelinesForUniversity(university),
      });
    }
  } catch (discoveryError) {
    discoveryResults.push({
      university: null,
      status: "failed" as const,
      error: discoveryError instanceof Error ? discoveryError.message : "Keşif kuyruğu alınamadı.",
    });
  }

  const { data: guidelines, error } = await supabase
    .from("thesis_guidelines")
    .select("id, source_url, source_checksum, analysis_status, university_name, institute_name, extracted_rules")
    .not("source_url", "is", null)
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true })
    .limit(6);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const guideline of guidelines ?? []) {
    try {
      const scan = await scanGuidelineUrl(guideline.source_url!);
      const previousChecksum = guideline.source_checksum;
      const changed = Boolean(previousChecksum && previousChecksum !== scan.sourceChecksum);
      const isApproved = guideline.analysis_status === "approved";
      const hasRules = Boolean(guideline.extracted_rules && Object.keys(guideline.extracted_rules).length > 0);
      const citationStyle = scan.detectedCitationHint?.toLowerCase().replace(" ", "") ?? null;
      const readyForApproval = scan.confidence >= 0.9 && scan.suggestedSections.length >= 4 && Boolean(citationStyle);
      const detectedAt = new Date().toISOString();
      const analysis = {
        detectedCitationHint: scan.detectedCitationHint,
        suggestedSections: scan.suggestedSections,
        suggestedRules: scan.suggestedRules,
        confidence: scan.confidence,
        warnings: scan.warnings,
        textPreview: scan.textPreview,
        fullTextLength: scan.fullTextLength,
        detectedAt,
        // Onaylı kılavuzun kaynağı değiştiyse yeni dosyanın imzası burada bekler;
        // source_checksum onaylı sürümü göstermeye devam eder (değişiklik kaybolmaz).
        pendingReview: isApproved && changed,
        pendingChecksum: isApproved && changed ? scan.sourceChecksum : null,
      };
      // İlk taramada imzası olmayan kayıtlara imza yazılır.
      const checksumPatch = previousChecksum ? {} : { source_checksum: scan.sourceChecksum };

      let update: Record<string, unknown>;
      let status: string;
      if (isApproved) {
        // Onaylı kurallar hiçbir zaman otomatik değişmez; müşterilerin editörü bozulmaz.
        update = {
          ...checksumPatch,
          source_content_type: scan.sourceContentType,
          last_checked_at: detectedAt,
          ai_analysis: analysis,
          ...(changed
            ? { review_notes: "Resmî kaynakta yeni sürüm algılandı; onaylı kurallar korunuyor, yönetici incelemesi bekliyor." }
            : {}),
        };
        status = changed ? "new_version_pending" : "unchanged";
      } else if (changed || !hasRules) {
        // Onay bekleyen kayıt: yalnızca dosya değiştiyse ya da henüz kural yoksa öneriler yazılır.
        update = {
          source_checksum: scan.sourceChecksum,
          source_content_type: scan.sourceContentType,
          last_checked_at: detectedAt,
          ai_analysis: analysis,
          analysis_status: "needs_review",
          extracted_rules: scan.suggestedRules,
          required_sections: scan.suggestedSections,
          ...(citationStyle ? { citation_style: citationStyle } : {}),
          reviewed_by: null,
          reviewed_at: null,
          review_notes: readyForApproval
            ? `Kurallar otomatik dolduruldu (güven: %${Math.round(scan.confidence * 100)}); tek adım onay bekliyor.`
            : `Otomatik çıkarım inceleme gerektiriyor (güven: %${Math.round(scan.confidence * 100)}).`,
        };
        status = readyForApproval ? "ready_for_approval" : "needs_review";
      } else {
        // Onay bekleyen, dosyası değişmemiş: yöneticinin yaptığı düzenlemeler ezilmez.
        update = { ...checksumPatch, source_content_type: scan.sourceContentType, last_checked_at: detectedAt, ai_analysis: analysis };
        status = "awaiting_review";
      }

      const { error: updateError } = await supabase.from("thesis_guidelines").update(update).eq("id", guideline.id);

      if (updateError) throw updateError;
      results.push({ id: guideline.id, status });
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

  return Response.json({
    discovered: discoveryResults.filter((item) => item.status === "discovered").length,
    discoveryResults,
    checked: results.length,
    results,
  });
}
