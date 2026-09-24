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

  const sonuc = await taraVeYaz(supabase, { id: kilavuz.id, source_url: kilavuz.source_url });
  revalidatePath("/dashboard/guidelines");
  if (!sonuc.ok) return { error: sonuc.mesaj };
  return { success: true };
}

/*
  Bir kılavuzu tarayıp kaydı güncelleyen tek yol.

  Tekil ("Şimdi yeniden tara") ve toplu tarama aynı gövdeyi kullanıyor:
  ikisi ayrı yazılsaydı ai_analysis alanları zamanla ayrışırdı — nitekim
  citationMentions eklendiğinde üç ayrı yazma noktasının üçüne de elle
  eklemek gerekti.
*/
type Tarayici = Awaited<ReturnType<typeof createClient>>;

async function taraVeYaz(
  supabase: Tarayici,
  kilavuz: { id: string; source_url: string },
): Promise<{ ok: true } | { ok: false; mesaj: string }> {
  let scan: GuidelineScanResult;
  try {
    scan = await scanGuidelineUrl(kilavuz.source_url);
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Tarama başarısız.";
    // Başarısızlık kayda yazılır: bir sonraki bakan kişi ne olduğunu görsün.
    await supabase
      .from("thesis_guidelines")
      .update({ review_notes: `Elle yeniden tarama başarısız: ${mesaj}`.slice(0, 1000), last_checked_at: new Date().toISOString() })
      .eq("id", kilavuz.id);
    return { ok: false, mesaj };
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
        citationMentions: scan.citationMentions,
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
    .eq("id", kilavuz.id)
    .select("id");

  if (error) return { ok: false, mesaj: "Kayıt güncellenemedi." };
  return { ok: true };
}

/*
  Toplu yeniden tarama.

  Katalogdaki 47 kaydın çoğu, tarayıcıya sonradan eklenen alanları (en son
  citationMentions) taşımıyor: kayıt en son tarandığı sürümün çıktısını
  saklıyor. Tek tek "Şimdi yeniden tara" ile ilerlemek 47 tıklamaydı.

  PARTİ PARTİ çalışıyor. Her tarama bir ağ isteği ve çoğu zaman bir PDF
  ayrıştırması; hepsini tek istekte denemek zaman aşımına girer ve yarıda
  kalan iş kullanıcıya "bitti" diye görünürdü. Kalan sayısı geri
  döndürülüyor, düğmeye yeniden basılabiliyor.

  KAPSAM: yalnızca çağıranın YAZABİLDİĞİ kayıtlar. Ortak katalog artık iç
  ekibe ait (20260924100033); kurum yöneticisi için aday listesi kendi
  kurumunun kılavuzlarıyla sınırlı, yoksa her parti boşa ağ isteği olurdu.

  Onaylı kayıtlara dokunulmuyor — tekil taramanın kuralıyla aynı: onaylı
  kılavuzun kuralları arkadan değişmemeli.
*/
const TOPLU_PARTI = 8;

export async function kilavuzlariTopluTara(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase
    .from("profiles").select("role, organization_id").eq("id", user.id).single();
  if (!profile || !["academic_manager", "system_admin", "founder"].includes(profile.role)) {
    return { error: "Bu işlem için Akademik Yönetici veya üzeri bir rol gerekir." };
  }
  const icEkip = ["system_admin", "founder"].includes(profile.role);

  let sorgu = supabase
    .from("thesis_guidelines")
    .select("id, source_url, ai_analysis")
    .neq("analysis_status", "approved")
    .not("source_url", "is", null);
  if (!icEkip) {
    if (!profile.organization_id) {
      return { error: "Ortak katalogdaki kılavuzları yalnızca Sistem Yöneticisi tarayabilir." };
    }
    sorgu = sorgu.eq("organization_id", profile.organization_id);
  }

  const { data: adaylar, error: okumaHatasi } = await sorgu;
  if (okumaHatasi) {
    console.error(okumaHatasi);
    return { error: "Kılavuz listesi okunamadı; tarama başlatılmadı." };
  }

  /* Kanıtı eksik olanlar önce: sıradaki kararı asıl onlar bekletiyor. */
  const sirali = (adaylar ?? []).sort((a, b) => {
    const eksik = (k: typeof a) =>
      (k.ai_analysis as { citationMentions?: unknown } | null)?.citationMentions === undefined ? 0 : 1;
    return eksik(a) - eksik(b);
  });
  if (sirali.length === 0) return { success: true, message: "Taranacak kılavuz kalmadı." };

  const parti = sirali.slice(0, TOPLU_PARTI);
  let basarili = 0;
  const hatalar: string[] = [];
  for (const kilavuz of parti) {
    const sonuc = await taraVeYaz(supabase, { id: kilavuz.id, source_url: kilavuz.source_url! });
    if (sonuc.ok) basarili += 1;
    else hatalar.push(sonuc.mesaj);
  }

  revalidatePath("/dashboard/guidelines");
  const kalan = sirali.length - parti.length;
  const kuyruk = kalan > 0 ? ` ${kalan} kılavuz kaldı; düğmeye yeniden basın.` : " Sıra bitti.";

  /*
    Başarısızlar SAYIYLA söyleniyor ve kayda da yazıldı (taraVeYaz
    review_notes'a not düşüyor). "8 tarandı" deyip 3'ünün düştüğünü
    gizlemek, bitmiş bir iş izlenimi verirdi.
  */
  if (hatalar.length) {
    return {
      success: true,
      warning: `${basarili} kılavuz tarandı, ${hatalar.length} tanesi başarısız (sebebi kayıtların notunda).${kuyruk}`,
    };
  }
  return { success: true, message: `${basarili} kılavuz tarandı.${kuyruk}` };
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

  /*
    Keşif İÇ EKİBE AİT bir işlem. Ürettiği kayıtları service_role yazıyor
    (lib/guideline-discovery.ts) ve organization_id NULL kalıyor, yani genel
    kataloğa girer. 20260924100033'ten sonra genel kayıtları yalnızca iç ekip
    düzenleyebiliyor; bir kurum yöneticisinin keşfi tetiklemesi, sonra
    onaylayamadığı kayıtlar üretmesi demekti.

    Zaten doğru yeri burası: bir üniversitenin resmî sitesini taramak ortak
    kataloğu büyüten bir platform işi, tek bir müşterinin işi değil.
  */
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["system_admin", "founder"].includes(profile.role)) {
    return { error: "Kılavuz keşfi ortak kataloğu değiştirir; bu işlem Sistem Yöneticisi'ne açıktır." };
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
