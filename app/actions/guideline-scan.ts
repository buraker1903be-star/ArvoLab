"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { kunyeYamasi, scanGuidelineUrl, TARAYICI_SURUMU, type GuidelineScanResult } from "@/lib/guideline-scan";
import type { ActionResult } from "@/lib/auth-guards";
import { discoverGuidelinesForUniversity } from "@/lib/guideline-discovery";

export interface ScanResponse {
  error?: string;
  result?: GuidelineScanResult;
}

export async function runGuidelineScan(url: string): Promise<ScanResponse> {
  if (!url || !url.trim()) {
    return { error: "Lütfen bir URL girin." };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();

  const oversightRoles = ["academic_manager", "system_admin", "founder"];
  if (!profile || !oversightRoles.includes(profile.role)) {
    return { error: "Bu işlem için Akademik Yönetici veya üzeri bir role sahip olmalısınız." };
  }

  try {
    const result = await scanGuidelineUrl(url.trim());
    return { result };
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Tarama sırasında bir hata oluştu.";
    return { error: message };
  }
}

/**
 * Kayıtlı bir kılavuzu şimdi yeniden tarar ve kurallarını günceller.
 *
 * Eskiden elle tetikleme yolu yoktu: yönetici gece çalışan cron'u beklemek
 * zorundaydı (günde 6 kayıt). Çıkarımda bir hata düzeltildiğinde ya da
 * kurumun sitesinde yeni sürüm yayımlandığında, düzelmesi günler sürüyordu.
 *
 * ONAYLI kılavuza dokunulmaz: onaylı kurallar hiçbir zaman otomatik
 * değişmez, yoksa müşterinin editörü ayağının altından kayar. Onaylı bir
 * kılavuzun yeni sürümü zaten cron tarafından "inceleme bekliyor" olarak
 * işaretleniyor.
 */
export async function kilavuzuYenidenTara(guidelineId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["academic_manager", "system_admin", "founder"].includes(profile.role)) {
    return { error: "Bu işlem için Akademik Yönetici veya üzeri bir rol gerekir." };
  }

  const { data: kilavuz } = await supabase
    .from("thesis_guidelines")
    .select("id, source_url, analysis_status")
    .eq("id", guidelineId)
    .maybeSingle();

  if (!kilavuz) return { error: "Kılavuz bulunamadı." };
  if (!kilavuz.source_url) return { error: "Bu kılavuzun resmî kaynak adresi yok; önce adresi ekleyin." };
  if (kilavuz.analysis_status === "approved") {
    return { error: "Onaylı kılavuzun kuralları otomatik değiştirilmez. Önce onayı kaldırın." };
  }

  let scan: GuidelineScanResult;
  try {
    scan = await scanGuidelineUrl(kilavuz.source_url);
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Tarama başarısız.";
    // Başarısızlık kayda yazılır: bir sonraki bakan kişi ne olduğunu görsün.
    await supabase
      .from("thesis_guidelines")
      .update({ review_notes: `Elle yeniden tarama başarısız: ${mesaj}`.slice(0, 1000), last_checked_at: new Date().toISOString() })
      .eq("id", guidelineId);
    revalidatePath("/dashboard/guidelines");
    return { error: mesaj };
  }

  const stil = scan.detectedCitationHint?.toLowerCase().replace(" ", "") ?? null;
  const { error } = await supabase
    .from("thesis_guidelines")
    .update({
      source_checksum: scan.sourceChecksum,
      source_content_type: scan.sourceContentType,
      // Koşullu istek doğrulayıcıları: bir sonraki gece turunda dosya
      // değişmemişse hiç indirilmeyecek.
      source_etag: scan.sourceEtag,
      source_last_modified: scan.sourceLastModified,
      ...kunyeYamasi(scan),
      last_checked_at: new Date().toISOString(),
      analysis_status: "needs_review",
      extracted_rules: scan.suggestedRules,
      required_sections: scan.suggestedSections,
      ...(stil ? { citation_style: stil } : {}),
      ai_analysis: {
        scannerVersion: TARAYICI_SURUMU,
        ocrUsed: scan.ocrKullanildi,
        detectedCitationHint: scan.detectedCitationHint,
        suggestedSections: scan.suggestedSections,
        suggestedRules: scan.suggestedRules,
        confidence: scan.confidence,
        warnings: scan.warnings,
        textPreview: scan.textPreview,
        fullTextLength: scan.fullTextLength,
        detectedAt: new Date().toISOString(),
        pendingReview: false,
        pendingChecksum: null,
      },
      reviewed_by: null,
      reviewed_at: null,
      review_notes: `Yönetici isteğiyle yeniden tarandı (güven: %${Math.round(scan.confidence * 100)}).`,
    })
    .eq("id", guidelineId)
    .select("id");

  if (error) return { error: "Kılavuz güncellenemedi." };
  revalidatePath("/dashboard/guidelines");
  return { success: true };
}

/**
 * Bir üniversite için kılavuz keşfini şimdi çalıştırır.
 *
 * Eskiden elle tetikleme yolu yoktu: keşif yalnızca gece çalışan cron'da,
 * günde 2 üniversite hızıyla ilerliyordu (204 üniversite ≈ 100 gün) ve
 * keşfin çalışıp çalışmadığını görmenin tek yolu ertesi sabah veritabanına
 * bakmaktı. Bir düzeltmenin işe yarayıp yaramadığı günlerce belirsiz
 * kalıyordu.
 *
 * İş uzun sürebilir (enstitü alt alan adları taranıyor, HTML sayfalardan
 * gerçek belgeye iniliyor); sayfanın maxDuration değeri buna göre.
 */
export async function universiteKilavuzuKesfet(universityId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["academic_manager", "system_admin", "founder"].includes(profile.role)) {
    return { error: "Bu işlem için Akademik Yönetici veya üzeri bir rol gerekir." };
  }

  if (!universityId) return { error: "Önce bir üniversite seçin." };
  const { data: universite } = await supabase
    .from("universities")
    .select("id, name")
    .eq("id", universityId)
    .maybeSingle();
  if (!universite) return { error: "Üniversite bulunamadı." };

  const sonuc = await discoverGuidelinesForUniversity(universite);
  revalidatePath("/dashboard/guidelines");

  /*
    Sonuç dürüstçe bildirilir. "Bulunamadı" bir hata değil: kurumun sitesinde
    kılavuz olmayabilir ya da taranamayan bir biçimde olabilir. Hata gibi
    göstermek, yöneticiyi olmayan bir arızayı aramaya iterdi.
  */
  if (sonuc.status === "discovered") {
    return { success: true, message: `${universite.name}: ${sonuc.count} kılavuz bulundu (${(sonuc.institutes ?? []).join(", ")}).` };
  }
  if (sonuc.status === "already_known") {
    return { success: true, message: `${universite.name}: bulunan ${sonuc.count} aday zaten kayıtlı.` };
  }
  if (sonuc.status === "failed") {
    return { error: `Keşif başarısız: ${sonuc.error}` };
  }
  return { success: true, message: `${universite.name}: resmî sitesinde taranabilir bir kılavuz bulunamadı.` };
}
