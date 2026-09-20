import { createAdminClient } from "@/lib/supabase/admin";
import { scanGuidelineUrl, TARAYICI_SURUMU } from "@/lib/guideline-scan";
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

  /*
    ZAMAN BÜTÇESİ

    Uç noktanın sınırı 300 saniye. Enstitü alt alan adları taranmaya ve HTML
    sayfalardan gerçek belgeye inilmeye başlayınca üniversite başına süre
    belirgin şekilde arttı; sabit bir "günde 2 üniversite" sayısı artık
    hem yetersiz hem riskli. Süre aşılırsa istek ortada kesilir: o turda
    yapılan iş yazılmış olsa bile kalan kayıtlar hiç işlenmez ve yanıt
    kaybolur.

    Bu yüzden sayı değil SÜRE sınırlanıyor: yeni bir işe ancak bütçe
    yetiyorsa başlanır. Her üniversite kendi kaydını bitirince güncellediği
    için yarıda kesilme veri kaybı yaratmaz, yalnızca sıradakiler ertesi
    güne kalır.
  */
  const basladi = Date.now();
  const TOPLAM_BUTCE_MS = 270_000;
  const gecen = () => Date.now() - basladi;
  const kalan = () => TOPLAM_BUTCE_MS - gecen();

  /*
    Keşif bütçenin yarısını alır. Hepsini alsaydı, yeni üniversiteler
    bulunurken KAYITLI kılavuzların yeniden taranması hiç sıra alamaz ve
    kaynaktaki sürüm değişiklikleri fark edilmezdi.
  */
  const KESIF_BUTCE_MS = Math.floor(TOPLAM_BUTCE_MS * 0.55);
  /*
    Bir üniversitenin keşfi için ayrılan kaba üst süre. Alt alan adları
    üçerli paralel tarandığından ve site haritası isteklerinin zaman aşımı
    12 saniyeye indiğinden bu süre 70 saniyeden düştü.
  */
  const UNIVERSITE_MALIYETI_MS = 40_000;
  /** Bir kılavuzun yeniden taranması için ayrılan kaba üst süre. */
  const TARAMA_MALIYETI_MS = 25_000;

  const supabase = createAdminClient();
  let kesifDurduruldu = false;
  let taramaDurduruldu = false;
  const discoveryResults: Array<{
    university: string | null;
    status: "discovered" | "already_known" | "not_found" | "failed";
    /* Bir üniversitede birden çok enstitü kılavuzu bulunabilir. */
    count?: number;
    institutes?: string[];
    error?: string;
  }> = [];
  try {
    // Sayı cömert; gerçek sınırı bütçe koyuyor.
    const universities = await getUniversitiesDueForGuidelineDiscovery(12);
    for (const university of universities) {
      // Bitiremeyeceğimiz bir işe başlamak, yarıda kesilmek demektir.
      if (gecen() + UNIVERSITE_MALIYETI_MS > KESIF_BUTCE_MS) {
        kesifDurduruldu = true;
        break;
      }
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
    .select("id, source_url, source_checksum, analysis_status, university_name, institute_name, extracted_rules, ai_analysis")
    .not("source_url", "is", null)
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true })
    .limit(12);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const guideline of guidelines ?? []) {
    if (kalan() < TARAMA_MALIYETI_MS) {
      taramaDurduruldu = true;
      break;
    }
    try {
      const scan = await scanGuidelineUrl(guideline.source_url!);
      const previousChecksum = guideline.source_checksum;
      const changed = Boolean(previousChecksum && previousChecksum !== scan.sourceChecksum);
      const isApproved = guideline.analysis_status === "approved";
      const hasRules = Boolean(guideline.extracted_rules && Object.keys(guideline.extracted_rules).length > 0);
      /*
        Çıkarım kuralları düzeldiğinde eski kayıtlar da düzelsin: dosya
        değişmemiş olsa bile eski sürümle çıkarılmış kayıt yeniden işlenir.
        Onaylı kayıtlar bunun dışında (aşağıdaki ilk dal).
      */
      const eskiSurum = Number((guideline.ai_analysis as { scannerVersion?: unknown } | null)?.scannerVersion ?? 0);
      const surumEskimis = eskiSurum < TARAYICI_SURUMU;
      const citationStyle = scan.detectedCitationHint?.toLowerCase().replace(" ", "") ?? null;
      const readyForApproval = scan.confidence >= 0.9 && scan.suggestedSections.length >= 4 && Boolean(citationStyle);
      const detectedAt = new Date().toISOString();
      const analysis = {
        scannerVersion: TARAYICI_SURUMU,
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
      } else if (changed || !hasRules || surumEskimis) {
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
        status = surumEskimis && !changed && hasRules
          ? "rescanned_new_scanner"
          : readyForApproval
            ? "ready_for_approval"
            : "needs_review";
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
    /*
      Bütçe yüzünden durulduysa görünür olsun: kuyruk ilerlemiyorsa sebebi
      sessiz kalmamalı. Kalan işler ertesi gün sıradan devam eder.
    */
    sureSaniye: Math.round(gecen() / 1000),
    kesifDurduruldu,
    taramaDurduruldu,
  });
}
