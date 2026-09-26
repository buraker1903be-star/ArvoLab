"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { kunyeYamasi, scanGuidelineUrl, taramaOnceligi, TARAYICI_SURUMU, type GuidelineScanResult } from "@/lib/guideline-scan";
import type { ActionResult } from "@/lib/auth-guards";
import { discoverGuidelinesForUniversity } from "@/lib/guideline-discovery";
import { universiteBul } from "@/lib/universite-adi";

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
  TOPLU KILAVUZ EKLEME.

  Otomatik keşfin yapısal bir tavanı var: kılavuz enstitünün sitesinde iki
  üç seviye derinde duruyor, üniversitenin site haritası çoğu kurumda ya
  yok ya HTML döndürüyor ve ana sayfa kılavuza bağlanmıyor. Canlıda
  denenen 125 üniversitenin 100'ü bu yüzden hiç aday üretmedi. Kalanı elle
  eklemek gerekiyor ve tek tek "Yeni kılavuz" formu 160+ üniversite için
  ağır.

  Girdi satır satır: üniversite adı, ardından adres.
    Akdeniz Üniversitesi https://sbe.akdeniz.edu.tr/.../kilavuz.pdf

  Ad EŞLEŞMEZSE satır atlanır ve sebebi yazılır; en yakın adı tahmin
  etmiyoruz — yanlış üniversiteye kılavuz bağlamak, hiç bağlamamaktan
  kötü (öğrencinin editörüne başka kurumun kuralları iner).

  Adres denetimini safe-official-fetch yapıyor: .edu.tr dışına çıkılmıyor.
  Kayıt eklendikten sonra AYNI tarama yolundan geçiyor (taraVeYaz), yani
  kurallar ve ai_analysis tekil taramayla birebir aynı biçimde yazılıyor.
*/
const TOPLU_EKLEME_SINIRI = 10;

type EklemeSatiri = { ad: string; adres: string };

/** "Üniversite adı  https://..." → parçalar. Adres yoksa null. */
function eklemeSatiriCozumle(satir: string): EklemeSatiri | null {
  const yer = satir.search(/https:\/\//);
  if (yer < 0) return null;
  const ad = satir.slice(0, yer).replace(/[\s|,;–—-]+$/, "").trim();
  const adres = satir.slice(yer).trim().split(/\s+/)[0];
  return ad && adres ? { ad, adres } : null;
}

export async function kilavuzlariTopluEkle(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  /*
    İç ekip: eklenen kayıtlar ORTAK KATALOĞA giriyor (organization_id null)
    ve 20260924100033'ten beri onları yalnızca iç ekip yönetebiliyor. Kurum
    yöneticisine açmak, sonra düzenleyemeyeceği kayıtlar üretmesi demekti.
  */
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["system_admin", "founder"].includes(profile.role)) {
    return { error: "Toplu ekleme ortak kataloğu değiştirir; bu işlem Sistem Yöneticisi'ne açıktır." };
  }

  const satirlar = String(formData.get("liste") ?? "")
    .split("\n")
    .map((satir) => satir.trim())
    .filter(Boolean);
  if (!satirlar.length) return { error: "Liste boş. Her satıra bir üniversite adı ve kılavuz adresi yazın." };
  if (satirlar.length > TOPLU_EKLEME_SINIRI) {
    return {
      error: `Tek seferde en fazla ${TOPLU_EKLEME_SINIRI} satır işlenir (her satır bir belge indirip çözümlüyor). ` +
        `Listeyi bölüp tekrar gönderin.`,
    };
  }

  const { data: universiteler, error: universiteHatasi } = await supabase.from("universities").select("id, name");
  if (universiteHatasi) {
    console.error(universiteHatasi);
    return { error: "Üniversite listesi okunamadı; ekleme yapılmadı." };
  }

  let eklenen = 0;
  const sorunlular: string[] = [];

  for (const ham of satirlar) {
    const satir = eklemeSatiriCozumle(ham);
    if (!satir) {
      sorunlular.push(`"${ham.slice(0, 40)}": adres bulunamadı`);
      continue;
    }
    const universite = universiteBul(universiteler ?? [], satir.ad);
    if (!universite) {
      sorunlular.push(`"${satir.ad}": bu adla üniversite yok`);
      continue;
    }

    /* Aynı adres iki kez eklenmesin: keşif de aynı belgeyi bulmuş olabilir. */
    const { data: mevcut } = await supabase
      .from("thesis_guidelines").select("id").eq("source_url", satir.adres).maybeSingle();
    if (mevcut) {
      sorunlular.push(`${universite.name}: bu adres zaten kayıtlı`);
      continue;
    }

    const { data: yeni, error: eklemeHatasi } = await supabase
      .from("thesis_guidelines")
      .insert({
        university_id: universite.id,
        university_name: universite.name,
        source_url: satir.adres,
        citation_style: "apa7",
        required_sections: [],
        analysis_status: "needs_review",
        review_notes: "Toplu eklendi; taranıp onaylanmadan hiçbir çalışmaya uygulanmaz.",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (eklemeHatasi || !yeni) {
      sorunlular.push(`${universite.name}: kaydedilemedi`);
      continue;
    }

    /* Aynı tarama yolu: kurallar ve ai_analysis tekil taramayla birebir aynı. */
    const sonuc = await taraVeYaz(supabase, { id: yeni.id, source_url: satir.adres });
    if (!sonuc.ok) {
      // Kayıt DURUYOR: adres doğru olabilir, tarama geçici olarak düşmüş
      // olabilir. Satırdaki nota sebep yazıldı, "Şimdi yeniden tara" var.
      sorunlular.push(`${universite.name}: eklendi ama taranamadı (${sonuc.mesaj})`);
      eklenen += 1;
      continue;
    }
    eklenen += 1;
  }

  revalidatePath("/dashboard/guidelines");
  const ozet = `${eklenen}/${satirlar.length} kılavuz eklendi.`;
  if (sorunlular.length) {
    return { success: true, warning: `${ozet} Atlanan: ${sorunlular.slice(0, 4).join(" · ")}` };
  }
  return { success: true, message: ozet };
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

  /* Kanıtı eksik olanlar, sonra çıkarımı eskimiş olanlar (lib/guideline-scan.ts). */
  const sirali = (adaylar ?? []).sort(
    (a, b) => taramaOnceligi(a.ai_analysis) - taramaOnceligi(b.ai_analysis),
  );
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
