import { createAdminClient } from "@/lib/supabase/admin";
import { scanGuidelineUrl, type GuidelineScanResult } from "@/lib/guideline-scan";

type University = { id: string; name: string };

type Candidate = {
  url: string;
  title: string;
};

const SEARCH_URL = "https://html.duckduckgo.com/html/";
const MAX_CANDIDATES_PER_UNIVERSITY = 3;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTurkish(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function universityTokens(name: string) {
  const ignored = new Set(["UNIVERSITESI", "UNIVERSITE", "T C", "VE"]);
  return normalizeTurkish(name)
    .split(" ")
    .filter((token) => token.length >= 3 && !ignored.has(token));
}

function belongsToUniversity(scan: GuidelineScanResult, universityName: string) {
  const preview = normalizeTurkish(scan.textPreview);
  const tokens = universityTokens(universityName);
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => preview.includes(token));
  return matched.length >= Math.min(2, tokens.length);
}

function extractTargetUrl(rawHref: string) {
  const href = decodeHtml(rawHref);
  const redirect = new URL(href, "https://duckduckgo.com");
  const target = redirect.searchParams.get("uddg") ?? redirect.toString();
  const url = new URL(target);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !(hostname === "edu.tr" || hostname.endsWith(".edu.tr"))) return null;
  return url.toString();
}

async function discoverCandidates(universityName: string): Promise<Candidate[]> {
  const query = `"${universityName}" "tez yazım kılavuzu" filetype:pdf`;
  const response = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(query)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": "Mozilla/5.0 (compatible; ArvoLabGuidelineDiscovery/1.0)" },
  });
  if (!response.ok) throw new Error(`Kılavuz araması başarısız: HTTP ${response.status}`);

  const html = await response.text();
  const candidates = new Map<string, Candidate>();
  const resultPattern = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(resultPattern)) {
    try {
      const url = extractTargetUrl(match[1]);
      if (!url || candidates.has(url)) continue;
      const title = decodeHtml(match[2]);
      if (!/tez|thesis/i.test(`${title} ${url}`) || !/k[ıi]lavuz|guide|yaz[ıi]m/i.test(`${title} ${url}`)) continue;
      candidates.set(url, { url, title });
      if (candidates.size >= MAX_CANDIDATES_PER_UNIVERSITY) break;
    } catch {
      // Ignore malformed or non-official search results.
    }
  }
  return [...candidates.values()];
}

function scanUpdate(scan: GuidelineScanResult, detectedAt: string) {
  const citationStyle = scan.detectedCitationHint?.toLowerCase().replace(" ", "") ?? null;
  return {
    source_checksum: scan.sourceChecksum,
    source_content_type: scan.sourceContentType,
    last_checked_at: detectedAt,
    analysis_status: "needs_review",
    extracted_rules: scan.suggestedRules,
    required_sections: scan.suggestedSections,
    ...(citationStyle ? { citation_style: citationStyle } : {}),
    ai_analysis: {
      detectedCitationHint: scan.detectedCitationHint,
      suggestedSections: scan.suggestedSections,
      suggestedRules: scan.suggestedRules,
      confidence: scan.confidence,
      warnings: scan.warnings,
      textPreview: scan.textPreview,
      fullTextLength: scan.fullTextLength,
      detectedAt,
      discoveredAutomatically: true,
    },
    review_notes: `Resmî .edu.tr kaynağından otomatik keşfedildi; kurallar kullanım öncesinde akademik inceleme bekliyor (güven: %${Math.round(scan.confidence * 100)}).`,
  };
}

export async function discoverGuidelinesForUniversity(university: University) {
  const admin = createAdminClient();
  const checkedAt = new Date().toISOString();
  try {
    const candidates = await discoverCandidates(university.name);
    for (const candidate of candidates) {
      try {
        const scan = await scanGuidelineUrl(candidate.url);
        if (!belongsToUniversity(scan, university.name)) continue;

        const { data: duplicateByUrl } = await admin
          .from("thesis_guidelines")
          .select("id")
          .eq("source_url", candidate.url)
          .maybeSingle();
        const { data: duplicateByChecksum } = await admin
          .from("thesis_guidelines")
          .select("id")
          .eq("source_checksum", scan.sourceChecksum)
          .maybeSingle();
        const duplicate = duplicateByUrl ?? duplicateByChecksum;
        if (duplicate) {
          await admin.from("universities").update({
            guideline_discovery_checked_at: checkedAt,
            guideline_discovery_status: "already_known",
            guideline_discovery_note: candidate.url,
          }).eq("id", university.id);
          return { status: "already_known" as const, url: candidate.url };
        }

        const { error: insertError } = await admin.from("thesis_guidelines").insert({
          university_id: university.id,
          university_name: university.name,
          institute_name: null,
          academic_unit_id: null,
          document_title: candidate.title || "Tez Yazım Kılavuzu",
          document_type: "guideline",
          source_url: candidate.url,
          is_active: true,
          ...scanUpdate(scan, checkedAt),
        });
        if (insertError) throw insertError;

        await admin.from("universities").update({
          guideline_discovery_checked_at: checkedAt,
          guideline_discovery_status: "discovered",
          guideline_discovery_note: candidate.url,
        }).eq("id", university.id);
        return { status: "discovered" as const, url: candidate.url };
      } catch {
        // Try the next official candidate.
      }
    }

    await admin.from("universities").update({
      guideline_discovery_checked_at: checkedAt,
      guideline_discovery_status: "not_found",
      guideline_discovery_note: `${candidates.length} resmî aday incelendi.`,
    }).eq("id", university.id);
    return { status: "not_found" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kılavuz keşfi başarısız.";
    await admin.from("universities").update({
      guideline_discovery_checked_at: checkedAt,
      guideline_discovery_status: "failed",
      guideline_discovery_note: message.slice(0, 500),
    }).eq("id", university.id);
    return { status: "failed" as const, error: message };
  }
}

export async function getUniversitiesDueForGuidelineDiscovery(limit = 2) {
  const admin = createAdminClient();
  const retryBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("universities")
    .select("id, name")
    .or(`guideline_discovery_checked_at.is.null,guideline_discovery_checked_at.lt.${retryBefore}`)
    .order("guideline_discovery_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as University[];
}
