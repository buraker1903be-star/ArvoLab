"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { validIndentCm } from "@/lib/paragraph-format";
import { revalidatePath } from "next/cache";
import { ayniKurum } from "@/lib/turkce-ad";
import { createClient } from "@/lib/supabase/server";
import { requireRole, type ActionResult } from "@/lib/auth-guards";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/project-labels";

export interface ThesisGuideline {
  id: string;
  university_name: string;
  institute_name: string | null;
  version_label: string | null;
  source_url: string | null;
  citation_style: string;
  required_sections: string[];
  min_pages: number | null;
  max_pages: number | null;
  notes: string | null;
  is_active: boolean;
  last_checked_at: string;
  created_at: string;
  analysis_status: string;
  review_notes: string | null;
  extracted_rules: Record<string, unknown>;
  /* Onay kuyruğu (migration 20260924100007): satırdan türetilir, elle yazılmaz. */
  ready_for_approval: boolean;
  /* NULL = genel/kürasyonlu kayıt; yalnızca iç ekip düzenler (20260924100033). */
  organization_id: string | null;
  /*
    Otomatik çıkarımın kendisi. Eskiden bu alan hiç okunmuyordu: yönetici
    güven puanını, uyarıları ve metin önizlemesini göremeden "Onayla"ya
    basıyordu. Onay, körlemesine tıklanan bir düğmeydi.
    (Ad yanıltıcı: içerik yapay zekâ değil, kural tabanlı çıkarım —
    lib/guideline-scan.ts.)
  */
  ai_analysis: GuidelineCikarimi | null;
}

/** lib/guideline-scan.ts çıktısının panelde kullanılan alanları. */
export interface GuidelineCikarimi {
  detectedCitationHint?: string | null;
  suggestedSections?: string[];
  confidence?: number;
  warnings?: string[];
  textPreview?: string;
  fullTextLength?: number;
  detectedAt?: string;
  /** Onaylı kılavuzun kaynağında yeni sürüm algılandı. */
  pendingReview?: boolean;
  /** Kayıt, çıkarım kuralları düzelmeden önceki bir sürümle onaylandı. */
  scannerOutdated?: boolean;
  /** Metin taranmış görüntüden OCR ile okundu; gürültülü olabilir. */
  ocrUsed?: boolean;
  /* Atıf sistemi seçilemediğinde bile hangi adın kaç kez geçtiği
     (lib/atif-sistemi.ts). Yönetici kararını buna dayandırıyor. */
  citationMentions?: { sistem: string; etiket: string; sayim: number }[];
}

export interface GuidelineMatch {
  id: string;
  university_name: string;
  institute_name: string | null;
  document_title: string | null;
  version_label: string | null;
  citation_style: string;
  match_level: "department" | "academic_unit" | "university";
}

/*
  En özel onaylı kılavuzu seçer; gerekirse üst kuruma geri düşer.

  Eskiden yalnızca `GuidelineMatch | null` dönüyordu ve üç sorgunun da
  `error`'u hiç okunmuyordu: geçici bir arızada ekran "Bu birim için henüz
  onaylı bir kılavuz yok" diyordu. Ürünün en görünür sözü ("kılavuzunuz
  otomatik uygulanır") tam da burada, kullanıcının kurumunu seçtiği anda
  yanlış bir kesinlikle bozuluyordu.

  Bulunan eşleşme yine dönüyor: daha dar bir seviye okunamadıysa bile
  elde olan kılavuz kullanıcıdan saklanmaz, yalnızca "eksik olabilir"
  bilgisi yanına eklenir.
*/
export interface KilavuzEslesmesi {
  eslesme: GuidelineMatch | null;
  /** Sorgulardan biri başarısız; "kılavuz yok" DEMEK DEĞİL. */
  okunamadi: boolean;
}

export async function findMatchingGuideline(
  universityId: string,
  academicUnitId?: string | null,
  departmentId?: string | null
): Promise<KilavuzEslesmesi> {
  if (!universityId) return { eslesme: null, okunamadi: false };
  let okunamadi = false;

  const supabase = await createClient();
  const select =
    "id, university_name, institute_name, document_title, version_label, citation_style, academic_unit_id";

  for (const candidate of [
    { id: departmentId, level: "department" as const },
    { id: academicUnitId, level: "academic_unit" as const },
  ]) {
    if (!candidate.id) continue;
    const { data, error } = await supabase
      .from("thesis_guidelines")
      .select(select)
      .eq("university_id", universityId)
      .eq("academic_unit_id", candidate.id)
      .eq("is_active", true)
      .not("approved_snapshot", "is", null)
      .order("effective_from", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      okunamadi = true;
      continue;
    }
    if (data) return { eslesme: { ...data, match_level: candidate.level }, okunamadi };
  }

  const { data, error } = await supabase
    .from("thesis_guidelines")
    .select(select)
    .eq("university_id", universityId)
    .is("academic_unit_id", null)
    .eq("is_active", true)
    .not("approved_snapshot", "is", null)
    .order("effective_from", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return { eslesme: null, okunamadi: true };
  }
  return { eslesme: data ? { ...data, match_level: "university" } : null, okunamadi };
}

/* Okunamadı ile "kılavuz kaydı yok" ayrı: ikincisi akademik yöneticiye
   "kayıtlar gitti" gibi okunuyordu. */
export async function getGuidelines(): Promise<ListeSonucu<ThesisGuideline>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("thesis_guidelines")
    .select(
      "id, university_name, institute_name, version_label, source_url, citation_style, required_sections, min_pages, max_pages, notes, is_active, last_checked_at, created_at, analysis_status, review_notes, extracted_rules, ready_for_approval, ai_analysis, organization_id"
    )
    .order("university_name", { ascending: true });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

const REVIEW_FONTS = ["Times New Roman", "Arial", "Calibri", "Cambria", "Garamond", "Georgia", "Verdana", "Book Antiqua"];

export async function updateGuidelineRules(guidelineId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["academic_manager", "system_admin", "founder"].includes(profile.role)) {
    return { error: "Bu işlem için Akademik Yönetici veya üzeri bir rol gerekir." };
  }

  const numberInRange = (name: string, min: number, max: number) => {
    const value = Number(String(formData.get(name) ?? "").replace(",", "."));
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  };
  const fontFamily = String(formData.get("fontFamily") ?? "");
  const margins = {
    top: numberInRange("marginTop", 0, 10),
    bottom: numberInRange("marginBottom", 0, 10),
    left: numberInRange("marginLeft", 0, 10),
    right: numberInRange("marginRight", 0, 10),
  };
  const fontSizePt = numberInRange("fontSizePt", 8, 24);
  const lineSpacing = numberInRange("lineSpacing", 1, 3);
  if (Object.values(margins).some((value) => value === null) || !fontSizePt || !lineSpacing || !REVIEW_FONTS.includes(fontFamily)) {
    return { error: "Biçim ayarlarından biri geçersiz." };
  }

  const requiredSections = String(formData.get("requiredSections") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const citationStyle = String(formData.get("citationStyle") ?? "apa7");
  if (!requiredSections.length || !["apa7", "vancouver", "chicago", "ieee"].includes(citationStyle)) {
    return { error: "Kaynakça sistemi ve en az bir zorunlu bölüm gereklidir." };
  }

  // Özet sınırları isteğe bağlı: boş alan = kural yok, geçersiz sayı = hata.
  const optionalInt = (name: string, min: number, max: number) => {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isInteger(value) && value >= min && value <= max ? value : null;
  };
  const abstractMinWords = optionalInt("abstractMinWords", 20, 2000);
  const abstractMaxWords = optionalInt("abstractMaxWords", 20, 2000);
  const keywordsMin = optionalInt("keywordsMin", 1, 20);
  const keywordsMax = optionalInt("keywordsMax", 1, 20);
  if ([abstractMinWords, abstractMaxWords, keywordsMin, keywordsMax].includes(null)) {
    return { error: "Özet kelime sınırları 20–2000, anahtar kelime sınırları 1–20 arasında tam sayı olmalı." };
  }
  if ((abstractMinWords && abstractMaxWords && abstractMinWords > abstractMaxWords) || (keywordsMin && keywordsMax && keywordsMin > keywordsMax)) {
    return { error: "Alt sınır üst sınırdan büyük olamaz." };
  }

  // Paragraf girintisi isteğe bağlı: boş alan = kural yok.
  const indentRaw = String(formData.get("paragraphIndentCm") ?? "").trim();
  const paragraphIndentCm = indentRaw ? validIndentCm(indentRaw) : undefined;
  if (indentRaw && !paragraphIndentCm) {
    return { error: "Paragraf girintisi 0,3–3 cm arasında olmalı." };
  }

  const { data: updated, error } = await supabase.from("thesis_guidelines").update({
    citation_style: citationStyle,
    required_sections: requiredSections,
    extracted_rules: {
      margins_cm: margins,
      font_family: fontFamily,
      font_size_pt: fontSizePt,
      line_spacing: lineSpacing,
      show_page_numbers: formData.get("showPageNumbers") === "on",
      heading_numbering: formData.get("headingNumbering") === "on",
      chapter_uppercase: formData.get("chapterUppercase") === "on",
      chapter_new_page: formData.get("chapterNewPage") === "on",
      justify: formData.get("justify") === "on",
      ...(paragraphIndentCm ? { paragraph_indent_cm: paragraphIndentCm } : {}),
      ...(abstractMinWords ? { abstract_min_words: abstractMinWords } : {}),
      ...(abstractMaxWords ? { abstract_max_words: abstractMaxWords } : {}),
      ...(keywordsMin ? { keywords_min: keywordsMin } : {}),
      ...(keywordsMax ? { keywords_max: keywordsMax } : {}),
    },
    analysis_status: "needs_review",
    reviewed_by: null,
    reviewed_at: null,
    review_notes: String(formData.get("reviewNotes") ?? "").trim() || "Biçim kuralları güncellendi; yeniden onay gerekiyor.",
  }).eq("id", guidelineId).select("id");

  // Satır sayısı okunmazsa silinmiş bir kılavuza yazmak "başarılı" görünür ve
  // yöneticinin düzenlemesi sessizce kaybolur.
  if (error || !updated?.length) {
    console.error(error);
    /* Sıfır satır artık iki şey olabilir: kayıt yok ya da ORTAK KATALOĞA ait
       (20260924100033). "Silinmiş olabilir" demek, duran bir kılavuzu yok
       gibi göstermekti. */
    return { error: "Kurallar kaydedilemedi. Ortak katalogdaki kılavuzları yalnızca Sistem Yöneticisi düzenleyebilir; kendi kurumunuzun eklediği kılavuzları düzenleyebilirsiniz." };
  }
  revalidatePath("/dashboard/guidelines");
  return { success: true };
}

/*
  Üniversiteyi dizinde bulur ve KANONİK adını döndürür.

  Eskiden yalnızca `.ilike("name", ad)` vardı ve tutmazsa university_id
  sessizce NULL kalıyordu. Oysa kılavuzu tezlere bağlayan asıl eşleştirici
  (resync_project_guidelines) university_id'ye bakıyor: id yoksa kılavuz
  HİÇBİR teze bağlanmıyor, ama ekranda "kaydedildi" yazıyordu.

  ilike'ın kendisi de Türkçede tökezliyor: 'IŞIK ÜNİVERSİTESİ' ile 'Işık
  Üniversitesi' eşleşmez (ölçüldü). Bu yüzden arama tümden katlanmış ada
  taşındı (lib/turkce-ad.ts) — dizin birkaç yüz satır, tek geçiş yeter ve
  tek yol tutmak ilike'ın "%" joker sürprizini de ortadan kaldırıyor.

  Kanonik adın saklanması ayrıca yazım kaymasını tümden bitiriyor: fazladan
  boşluk, farklı büyük/küçük yazım ya da "Üniv." kısaltması artık kılavuzu
  kurumundan koparamaz.
*/
async function universiteBul(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ad: string,
): Promise<{ id: string; ad: string } | null> {
  const { data } = await supabase.from("universities").select("id, name");
  const eslesen = (data ?? []).find((satir) => ayniKurum(satir.name, ad));
  return eslesen ? { id: eslesen.id, ad: eslesen.name } : null;
}

/** Enstitü/fakülte için aynısı; kurum bulunduysa onun altında aranır. */
async function birimBul(
  supabase: Awaited<ReturnType<typeof createClient>>,
  universiteId: string,
  ad: string,
): Promise<{ id: string; ad: string } | null> {
  const { data } = await supabase
    .from("academic_units")
    .select("id, name")
    .eq("university_id", universiteId);
  const eslesen = (data ?? []).find((satir) => ayniKurum(satir.name, ad));
  return eslesen ? { id: eslesen.id, ad: eslesen.name } : null;
}

/** Dizinde bulunamayan kurum: kılavuz kaydedilir ama kendiliğinden bağlanmaz. */
const DIZINDE_YOK =
  "Kılavuz kaydedildi ama bu üniversite dizinde bulunamadı: tezlere kendiliğinden bağlanmayacak. Üniversite adını dizindeki yazımıyla girin ya da önce dizine ekleyin.";


export async function createGuideline(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kılavuz eklemek için Akademik Yönetici veya üzeri bir rol gerekir.");
  if ("error" in auth) return { error: auth.error };
  const { supabase, user } = auth;

  const universityName = String(formData.get("universityName") ?? "").trim();
  if (!universityName) return { error: "Üniversite adı zorunludur." };

  const citationStyle = String(formData.get("citationStyle") ?? "apa7");
  if (!["apa7", "vancouver", "chicago", "ieee"].includes(citationStyle)) return { error: "Geçersiz kaynakça sistemi." };

  const requiredSectionsRaw = String(formData.get("requiredSections") ?? "");
  const requiredSections = requiredSectionsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const minPagesRaw = String(formData.get("minPages") ?? "").trim();
  const maxPagesRaw = String(formData.get("maxPages") ?? "").trim();
  const instituteName = String(formData.get("instituteName") ?? "").trim();

  const universite = await universiteBul(supabase, universityName);
  const birim = universite && instituteName ? await birimBul(supabase, universite.id, instituteName) : null;

  /*
    Kılavuzun KAPSAMI (migration 20260924100033): tablo eskiden tekti ve
    herhangi bir kurumun Akademik Yöneticisi başka bir üniversitenin
    kılavuzunu değiştirebiliyor, silebiliyordu.

    Kurum yöneticisi kendi kurumuna ekler; iç ekip genel (kürasyonlu) kayıt
    açar. OKUMA değişmedi: kılavuzlar üniversiteye göre düzenlenmiş referans
    kayıtları, herkes görmeye devam ediyor.
  */
  const icEkip = auth.role !== null && ADMIN_ROLES.includes(auth.role);
  const { data: profil } = await supabase
    .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const kurum = icEkip ? null : profil?.organization_id ?? null;
  if (!icEkip && !kurum) {
    return { error: "Kurumunuz tanımlı değil. Kılavuz ekleyebilmek için Sistem Yöneticisi'nden kurum ataması isteyin." };
  }

  const { error } = await supabase.from("thesis_guidelines").insert({
    organization_id: kurum,
    // Kanonik ad saklanıyor; yazım kayması kılavuzu kurumundan koparmasın.
    university_name: universite?.ad ?? universityName,
    institute_name: birim?.ad ?? (instituteName || null),
    university_id: universite?.id ?? null,
    academic_unit_id: birim?.id ?? null,
    version_label: String(formData.get("versionLabel") ?? "").trim() || null,
    source_url: String(formData.get("sourceUrl") ?? "").trim() || null,
    citation_style: citationStyle,
    required_sections: requiredSections,
    min_pages: minPagesRaw ? Number(minPagesRaw) : null,
    max_pages: maxPagesRaw ? Number(maxPagesRaw) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: user.id,
    analysis_status: "needs_review",
    review_notes: "Yeni kayıt; müşteri projelerinde kullanılmadan önce akademik onay gerekiyor.",
  });

  if (error) {
    console.error(error);
    return { error: "Kılavuz kaydedilirken bir hata oluştu." };
  }

  revalidatePath("/dashboard/guidelines");
  // Bağlanamayacak bir kılavuzu "kaydedildi" deyip geçmek, sessiz kalmaktır.
  return universite ? { success: true } : { success: true, warning: DIZINDE_YOK };
}

// Kılavuzun kimlik bilgileri (üniversite, enstitü, sürüm, kaynak, sayfa aralığı).
// Üniversite ya da enstitü değişirse kılavuz yanlış kuruma uygulanmasın diye
// yeniden akademik onaya düşer.
export async function updateGuidelineDetails(guidelineId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kılavuzları yalnızca Akademik Yönetici ve üzeri roller düzenleyebilir.");
  if ("error" in auth) return { error: auth.error };

  const universityName = String(formData.get("universityName") ?? "").trim();
  if (!universityName) return { error: "Üniversite adı zorunludur." };
  const instituteName = String(formData.get("instituteName") ?? "").trim();

  const parsePages = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : Number.NaN;
  };
  const minPages = parsePages("minPages");
  const maxPages = parsePages("maxPages");
  if (Number.isNaN(minPages) || Number.isNaN(maxPages)) return { error: "Sayfa sayıları 0 veya daha büyük tam sayı olmalı." };
  if (minPages !== null && maxPages !== null && minPages > maxPages) {
    return { error: "Minimum sayfa, maksimum sayfadan büyük olamaz." };
  }

  const { data: current } = await auth.supabase
    .from("thesis_guidelines")
    .select("university_name, institute_name")
    .eq("id", guidelineId)
    .maybeSingle();
  if (!current) return { error: "Kılavuz bulunamadı." };

  const institutionChanged =
    current.university_name !== universityName || (current.institute_name ?? "") !== instituteName;

  const universite = await universiteBul(auth.supabase, universityName);
  const birim = universite && instituteName ? await birimBul(auth.supabase, universite.id, instituteName) : null;
  const academicUnitId = birim?.id ?? null;

  const { error } = await auth.supabase
    .from("thesis_guidelines")
    .update({
      // Kanonik ad saklanıyor (bkz. universiteBul).
      university_name: universite?.ad ?? universityName,
      institute_name: birim?.ad ?? (instituteName || null),
      university_id: universite?.id ?? null,
      academic_unit_id: academicUnitId,
      version_label: String(formData.get("versionLabel") ?? "").trim() || null,
      source_url: String(formData.get("sourceUrl") ?? "").trim() || null,
      min_pages: minPages,
      max_pages: maxPages,
      notes: String(formData.get("notes") ?? "").trim() || null,
      ...(institutionChanged
        ? {
            analysis_status: "needs_review",
            reviewed_by: null,
            reviewed_at: null,
            // Eski kuruma verilmiş onay yeni kuruma taşınmaz.
            approved_snapshot: null,
            review_notes: "Kurum bilgisi değişti; yeniden akademik onay gerekiyor.",
          }
        : {}),
    })
    .eq("id", guidelineId);

  if (error) {
    console.error(error);
    return { error: "Kılavuz güncellenirken bir hata oluştu." };
  }

  if (institutionChanged) {
    // Bu kılavuza bağlı tezler kurumlarına uygun başka bir onaylı kılavuza geçer.
    const { error: resyncError } = await auth.supabase.rpc("resync_project_guidelines", { p_guideline_id: guidelineId });
    if (resyncError) console.error(resyncError);
  }

  revalidatePath("/dashboard/guidelines");
  return universite ? { success: true } : { success: true, warning: DIZINDE_YOK };
}

export async function approveGuideline(guidelineId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["academic_manager", "system_admin", "founder"].includes(profile.role)) {
    return { error: "Bu işlem için Akademik Yönetici veya üzeri bir rol gerekir." };
  }

  const { data: guideline, error: guidelineError } = await supabase
    .from("thesis_guidelines")
    .select(
      "citation_style, required_sections, extracted_rules, min_pages, max_pages, version_label, document_title, source_url, source_checksum, ai_analysis"
    )
    .eq("id", guidelineId)
    .single();
  if (guidelineError || !guideline) return { error: "Kılavuz bulunamadı." };
  if (!guideline.required_sections?.length || !guideline.extracted_rules || Object.keys(guideline.extracted_rules).length === 0) {
    return { error: "Onaylamadan önce biçim kurallarını ve zorunlu bölümleri kaydedin." };
  }

  const approvedAt = new Date().toISOString();
  // Kaynakta algılanan yeni sürüm incelenip onaylandıysa onun imzası artık onaylı sürümdür.
  const analysis = (guideline.ai_analysis ?? null) as Record<string, unknown> | null;
  const pendingChecksum = typeof analysis?.pendingChecksum === "string" ? analysis.pendingChecksum : null;

  const { data: approved, error } = await supabase
    .from("thesis_guidelines")
    .update({
      analysis_status: "approved",
      reviewed_by: user.id,
      reviewed_at: approvedAt,
      review_notes: "Akademik yönetici tarafından onaylandı.",
      // Müşteri editörleri bu sürümü kullanır; yeni onayda kendiliğinden güncellenir.
      approved_snapshot: {
        citation_style: guideline.citation_style,
        required_sections: guideline.required_sections,
        extracted_rules: guideline.extracted_rules,
        min_pages: guideline.min_pages,
        max_pages: guideline.max_pages,
        version_label: guideline.version_label,
        document_title: guideline.document_title,
        source_url: guideline.source_url,
        approved_at: approvedAt,
      },
      ...(pendingChecksum
        ? {
            source_checksum: pendingChecksum,
            ai_analysis: { ...analysis, pendingReview: false, pendingChecksum: null },
          }
        : {}),
    })
    .eq("id", guidelineId)
    .select("id");

  if (error || !approved?.length) {
    console.error(error);
    return { error: "Kılavuz onaylanamadı. Ortak katalogdaki kılavuzları yalnızca Sistem Yöneticisi düzenleyebilir; kendi kurumunuzun eklediği kılavuzları düzenleyebilirsiniz." };
  }

  // Aynı kurumdaki tezler en özel onaylı kılavuza yeniden bağlanır (veritabanı eşleştirir).
  const { error: resyncError } = await supabase.rpc("resync_project_guidelines", { p_guideline_id: guidelineId });
  if (resyncError) console.error(resyncError);

  revalidatePath("/dashboard/guidelines");
  revalidatePath("/dashboard/editor");
  return { success: true };
}

/**
 * Kılavuzun onayını geri alır; kurallar müşteri tarafında uygulanmaz olur.
 *
 * Neden gerekli: onaylı bir kılavuzun kuralları hiçbir zaman otomatik
 * değişmiyor (doğru bir değişmez — müşterinin editörü ayağının altından
 * kaymasın). Ama çıkarımın YANLIŞ olduğu sonradan anlaşılırsa geri dönüş
 * yolu yoktu. Canlıda tam olarak bu oldu: atıf sistemi algılamasındaki
 * hata yüzünden Gazi kılavuzu "Chicago" olarak onaylanmıştı; belgede APA
 * 5, Chicago 1 kez geçiyor.
 *
 * Yeniden tarama da onaylı kayda dokunmuyor ve "önce onayı kaldırın"
 * diyordu — kaldırmanın bir yolu olmadığı için çıkmaz sokaktı.
 *
 * approved_snapshot silinir: uygulanan sürüm odur (lib/guideline-rules.ts).
 * Çalışmalar yeniden eşleştirilir, varsa daha üst kurumun onaylı kılavuzuna
 * düşerler.
 */
export async function kilavuzOnayiniGeriAl(guidelineId: string): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kılavuz onayını yalnızca Akademik Yönetici ve üzeri roller geri alabilir.");
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const { data: geriAlinan, error } = await supabase
    .from("thesis_guidelines")
    .update({
      analysis_status: "needs_review",
      approved_snapshot: null,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: "Onay geri alındı; kurallar yeniden inceleniyor.",
    })
    .eq("id", guidelineId)
    .eq("analysis_status", "approved")
    // Satır dönmezse RLS engellemiş ya da kayıt zaten onaysız demektir.
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Onay geri alınamadı. Ortak katalogdaki kılavuzları yalnızca Sistem Yöneticisi düzenleyebilir; kendi kurumunuzun eklediği kılavuzları düzenleyebilirsiniz." };
  }
  if (!geriAlinan?.length) return { error: "Kılavuz zaten onaysız ya da bulunamadı." };

  // Bu kılavuza bağlı çalışmalar yeniden eşleştirilir.
  const { error: resyncError } = await supabase.rpc("resync_project_guidelines", { p_guideline_id: guidelineId });
  if (resyncError) console.error(resyncError);

  revalidatePath("/dashboard/guidelines");
  revalidatePath("/dashboard/editor");
  return { success: true };
}

export async function deleteGuideline(guidelineId: string): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kılavuzları yalnızca Akademik Yönetici ve üzeri roller silebilir.");
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase.from("thesis_guidelines").delete().eq("id", guidelineId).select("id");
  if (error?.code === "23503") {
    return {
      error: "Bu kılavuza bağlı çalışmalar var, bu yüzden silinemez. Kuralları güncelleyerek yeni sürümü onaylayabilirsiniz.",
    };
  }
  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kılavuz silinemedi. Ortak katalogdaki kılavuzları yalnızca Sistem Yöneticisi düzenleyebilir; kendi kurumunuzun eklediği kılavuzları düzenleyebilirsiniz." };

  revalidatePath("/dashboard/guidelines");
  return { success: true };
}

/*
  Çalışmanın kurum ADIYLA eşleşen kılavuz. findMatchingGuideline üniversite
  KİMLİĞİ istiyor; academic_projects'te ise kurum serbest metin olarak
  tutuluyor (kullanıcı elle yazıyor). Çalışma merkezinin kılavuzu
  gösterebilmesi için ad üzerinden eşleştirme gerekti.

  Eşleşme kaba bilerek: kullanıcı "Ankara Üniv." ya da "ANKARA ÜNİVERSİTESİ"
  yazmış olabilir. Yanlış kılavuzu göstermemek için yalnızca onaylı ve etkin
  kayıtlara bakılır.

  "Bulunamadı" ile "bakamadım" ayrı dönüyor: çalışma merkezi eskiden ikisine
  de "<üniversite> için onaylı kılavuz bulunamadı" yazıyordu — kullanıcının
  kurumu hakkında, geçici bir arızadan üretilmiş bir kesinlik.
*/
export async function calismaKilavuzu(
  universite: string | null,
  enstitu: string | null,
): Promise<{ kilavuz: (GuidelineMatch & { institute_name: string | null }) | null; okunamadi: boolean }> {
  const ad = (universite ?? "").trim();
  if (ad.length < 3) return { kilavuz: null, okunamadi: false };

  const supabase = await createClient();
  const select =
    "id, university_name, institute_name, document_title, version_label, citation_style, academic_unit_id";

  const { data, error } = await supabase
    .from("thesis_guidelines")
    .select(select)
    .ilike("university_name", `%${ad}%`)
    .eq("is_active", true)
    .not("approved_snapshot", "is", null)
    .order("effective_from", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[merkez] kılavuz aranamadı:", error.message);
    return { kilavuz: null, okunamadi: true };
  }
  if (!data?.length) return { kilavuz: null, okunamadi: false };

  // Enstitü de yazılmışsa ona uyan kayıt öncelikli.
  const enstituAdi = (enstitu ?? "").trim().toLocaleLowerCase("tr-TR");
  const secilen =
    (enstituAdi &&
      data.find((satir) => (satir.institute_name ?? "").toLocaleLowerCase("tr-TR").includes(enstituAdi))) ||
    data[0];

  return { kilavuz: { ...secilen, match_level: "university" as const }, okunamadi: false };
}
