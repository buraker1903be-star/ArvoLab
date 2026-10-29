"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { ceviri } from "@/lib/dil-sunucu";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { extractPlainText, countWords, type TiptapDoc } from "@/lib/tiptap-text";
import { splitBodyAndReferences } from "@/lib/text-split";
import { extractInTextCitations, crossCheck, computeComplianceScore, type ParsedReference } from "@/lib/apa7";
import { kunyeleriAyristir, kunyeleriBol } from "@/lib/atif/kunye";
import { atifCikarmaStili, stilTanimi, type AtifTuru } from "@/lib/atif/stiller";
import { checkGuidelineCompliance } from "@/lib/guideline-check";
import { calismaKilavuzuOku } from "@/lib/guideline-rules";
import { AUTO_VERSION_INTERVAL_MS, snapshotManuscript } from "@/lib/manuscript-versions";
import { hasNonPlainAttributes } from "@/lib/format-loss";
import { kontrolSayilari, ozetOku, yapiSorunlariniTemizle, type KontrolKaydiOzeti } from "@/lib/kontrol-gecmisi";
import type { StructureIssue } from "@/lib/structure-check";
import { kagitMi, kagitOku, type KagitBoyutu } from "@/lib/kagit-boyutu";

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface CoverPage {
  university: string;
  institute: string;
  department: string;
  program: string;
  degreeType: string; // "Yüksek Lisans Tezi" | "Doktora Tezi" | "Lisans Bitirme Tezi" | "Makale" vb.
  title: string;
  authorName: string;
  advisorName: string;
  city: string;
  year: string;
}

/** Sayfa ayarlarının (kenar boşlukları, sayfa numarası) hangi kılavuz sürümünden geldiği */
export interface SettingsSource {
  guidelineId: string | null;
  version: string | null;
  /** Kullanıcı ayarları kendisi değiştirdi: yeni kılavuz sürümü kendiliğinden uygulanmaz, önerilir */
  customized: boolean;
}

export interface ManuscriptData {
  content: TiptapDoc;
  wordCount: number;
  updatedAt: string;
  margins: PageMargins;
  /** Kâğıt boyutu (lib/kagit-boyutu.ts); sütun yoksa A4. */
  pageSize: KagitBoyutu;
  showPageNumbers: boolean;
  coverPage: CoverPage | null;
  settingsSource: SettingsSource;
  /** Word çıktısına içindekiler tablosu */
  includeToc: boolean;
  /** Başlıklar otomatik numaralanır ("1.", "1.1.") */
  headingNumbering: boolean;
}

// Veritabanı hatasında null DÖNMEZ, hata fırlatır: önceden hata "henüz metin
// yok" gibi görünüyor, editör boş açılıyor ve ilk kayıt gerçek metnin üzerine
// yazıyordu. Hata artık dashboard/error.tsx ekranına düşer.
export async function getManuscript(projectId: string): Promise<ManuscriptData | null> {
  const supabase = await createClient();
  // "*": kılavuz senkron kolonları henüz eklenmemiş veritabanlarında da çalışır.
  const { data, error } = await supabase
    .from("project_manuscripts")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error(error);
    const t = await ceviri();
    throw new Error(t({ tr: "Çalışma metni yüklenemedi. Lütfen sayfayı yenileyin.", en: "The manuscript could not be loaded. Please refresh the page." }));
  }
  if (!data) return null;

  return {
    content: data.content as TiptapDoc,
    wordCount: data.word_count,
    updatedAt: data.updated_at,
    margins: {
      top: data.margin_top_cm ?? 2.5,
      bottom: data.margin_bottom_cm ?? 2.5,
      left: data.margin_left_cm ?? 2.5,
      right: data.margin_right_cm ?? 2.5,
    },
    pageSize: kagitOku(data.page_size),
    showPageNumbers: data.show_page_numbers ?? true,
    coverPage: (data.cover_page as CoverPage) ?? null,
    settingsSource: {
      guidelineId: data.settings_guideline_id ?? null,
      version: data.settings_guideline_version ?? null,
      customized: data.settings_customized ?? false,
    },
    includeToc: data.include_toc ?? false,
    headingNumbering: data.heading_numbering ?? false,
  };
}

export interface SaveManuscriptInput {
  content: TiptapDoc;
  margins?: PageMargins;
  pageSize?: KagitBoyutu;
  showPageNumbers?: boolean;
  coverPage?: CoverPage | null;
  settingsSource?: SettingsSource;
  includeToc?: boolean;
  headingNumbering?: boolean;
  /** Editörün açtığı sürümün zamanı; null = henüz hiç kaydedilmemiş belge */
  expectedUpdatedAt: string | null;
  /** Çakışmada kullanıcı "benim sürümümü kaydet" derse */
  force?: boolean;
  /** Editörün kılavuza göre hesapladığı yazım ilerlemesi (0–100); null = hesaplanamadı */
  progress?: number | null;
}

export type SaveManuscriptResult =
  | { success: true; updatedAt: string; wordCount: number }
  | {
      success?: false;
      error: string;
      conflict?: boolean;
      sessionExpired?: boolean;
      forbidden?: boolean;
      /** Engel abonelikten: kullanıcıya yenileme yolu gösterilmeli, "tekrar dene" değil. */
      abonelik?: boolean;
    };

const isMissingColumn = (error: { code?: string } | null) => error?.code === "PGRST204" || error?.code === "42703";
// RLS reddi: satır yazılamıyor. Yeniden denemek asla başarmaz.
const isForbidden = (error: { code?: string } | null) => error?.code === "42501";

// İyimser eşzamanlılık: kayıt yalnızca veritabanındaki sürüm editörün
// açtığı sürümle aynıysa yapılır. Başka sekme/kişi arada kaydettiyse
// sessizce üzerine yazmak yerine "conflict" döner.
//
// Hata metinleri "yazdıklarınız bu tarayıcıda saklanıyor" DEMEZ: sunucu
// taslağın tarayıcıya yazılıp yazılmadığını göremez ve depolama dolu ya da
// kapalıyken bu söz yalan oluyordu. Cümleyi editör ekliyor, gerçek duruma
// bakarak (manuscript-editor.tsx, hataYaz).
export async function saveManuscript(projectId: string, input: SaveManuscriptInput): Promise<SaveManuscriptResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return {
      error: await oturumYokMesaji(),
      sessionExpired: true,
    };
  }
  const t = await ceviri();
  /*
    Abonelik kapısı burada da gerekli: paneldeki kapı yalnızca ekran çizimini
    engelliyor. Deneme süresi biterken editör sekmesi açık kalan kullanıcının
    otomatik kaydı kesintisiz sürüyordu.
  */
  /*
    forbidden + abonelik: bu engel yeniden denemeyle geçmez. İşaretsiz
    dönüyordu ve editör bunu geçici bir arıza sanıp 10 saniyede bir
    sonsuza kadar yeniden deniyordu — üstelik ekranda "Şimdi dene"
    düğmesi vardı, yani kullanıcı asla başaramayacak bir düğmeye
    basıyordu. Aboneliği biten kişinin görmesi gereken şey yenileme yolu.
  */
  if (await isSubscriptionBlocked()) {
    return { error: (await abonelikKapaliMesaji()), forbidden: true, abonelik: true };
  }

  const { content, margins, pageSize, showPageNumbers, coverPage, settingsSource, includeToc, headingNumbering } = input;
  // Biçim bilgisi (başlık düzeyi, resim adresi, dipnot metni…) sunucuya eksik ulaştıysa
  // kaydetme: eksik metni üzerine yazmak yerine hata göster, taslak tarayıcıda kalır.
  if (!content || content.type !== "doc" || hasNonPlainAttributes(content)) {
    console.error("saveManuscript: içerik biçim bilgisi eksik ulaştı, kayıt durduruldu");
    return {
      error: t({
        tr: "Metnin biçim bilgisi sunucuya eksik ulaştı; üzerine yazmamak için kaydı durdurduk. Sayfayı yenileyin.",
        en: "The text's formatting reached the server incomplete; we stopped the save so nothing is overwritten. Refresh the page.",
      }),
    };
  }
  const wordCount = countWords(content);
  const baseRow = {
    content,
    plain_text: extractPlainText(content),
    word_count: wordCount,
    updated_by: ctx.user.id,
    updated_at: new Date().toISOString(),
    ...(margins
      ? {
          margin_top_cm: margins.top,
          margin_bottom_cm: margins.bottom,
          margin_left_cm: margins.left,
          margin_right_cm: margins.right,
        }
      : {}),
    ...(showPageNumbers !== undefined ? { show_page_numbers: showPageNumbers } : {}),
    ...(coverPage !== undefined ? { cover_page: coverPage } : {}),
  };
  // Sonradan eklenen kolonlar: migration henüz çalıştırılmadıysa bunlar olmadan yeniden denenir.
  const optionalColumns = {
    ...(settingsSource
      ? {
          settings_guideline_id: settingsSource.guidelineId,
          settings_guideline_version: settingsSource.version,
          settings_customized: settingsSource.customized,
        }
      : {}),
    ...(includeToc !== undefined ? { include_toc: includeToc } : {}),
    ...(headingNumbering !== undefined ? { heading_numbering: headingNumbering } : {}),
    /* Bilinmeyen değer sunucuya yazılmaz (kısıt da reddeder; kayıt düşmesin). */
    ...(kagitMi(pageSize) ? { page_size: pageSize } : {}),
  };
  const fullRow = { ...baseRow, ...optionalColumns };
  const hasOptionalColumns = Object.keys(optionalColumns).length > 0;

  const failed = { error: t({ tr: "Kaydedilirken bir hata oluştu.", en: "Something went wrong while saving." }) } as const;
  const conflict = {
    error: t({
      tr: "Bu belge başka bir sekmede ya da başka biri tarafından değiştirildi.",
      en: "This document was changed in another tab or by someone else.",
    }),
    conflict: true,
  } as const;
  const forbidden = {
    error: t({ tr: "Bu çalışmada değişiklik kaydetme yetkiniz yok.", en: "You do not have permission to save changes to this work." }),
    forbidden: true,
  } as const;
  /*
    Abonelik tetikleyicisi de 42501 ile reddediyor (20260924100003) ve kendi
    açıklamasını taşıyor; "yetkiniz yok" demek yanlış yönlendirirdi. Buraya
    normalde gelinmez (kapı yukarıda da var), ama uygulama ile veritabanı
    ayrı ayrı karar verdiği için ikisi ayrışabilir.
  */
  const rlsReddi = (error: { code?: string; message?: string } | null) => {
    if (!isForbidden(error)) return null;
    const mesaj = error?.message ?? "";
    // Tetikleyicinin açıklaması Türkçe; İngilizcede aynı anlamı taşıyan ortak mesaj gösteriliyor.
    return /abonelik/i.test(mesaj)
      ? ({
          error: t({
            tr: mesaj,
            en: "Your subscription is not active, so changes cannot be saved. Renew your subscription to continue.",
          }),
          forbidden: true,
          abonelik: true,
        } as const)
      : forbidden;
  };

  /*
    Güncelleme hiçbir satıra değmediğinde iki ayrı sebep var ve ikisi de
    PostgREST'ten aynı şekilde dönüyor: satır ARADA DEĞİŞTİ (çakışma) ya da
    RLS satırı yazmaya kapalı (yetki). Ayırt etmeden "başka biri değiştirdi"
    demek bir hatayı haftalarca gizledi: denetim rolleri başkasının tezini
    okuyup yazabiliyor ama kaydedemiyordu, kullanıcı çakışma sanıyordu
    (23.09.2026). Okuma açık olduğu için satırı yeniden okumak ayrımı kesin
    yapıyor: zaman damgası hâlâ aynıysa kimse değiştirmemiş, demek ki yetki.
  */
  const cakismaMi = async (expectedUpdatedAt: string) => {
    const { data } = await ctx.supabase
      .from("project_manuscripts")
      .select("updated_at")
      .eq("project_id", projectId)
      .maybeSingle();
    if (!data) return conflict; // satır silinmiş ya da okunamıyor
    return data.updated_at === expectedUpdatedAt ? forbidden : conflict;
  };

  const write = async (row: Record<string, unknown>): Promise<SaveManuscriptResult | "missing-column"> => {
    if (input.force) {
      const { data, error } = await ctx.supabase
        .from("project_manuscripts")
        .upsert({ project_id: projectId, ...row }, { onConflict: "project_id" })
        .select("updated_at")
        .single();
      if (isMissingColumn(error)) return "missing-column";
      const reddedildi = rlsReddi(error);
      if (reddedildi) return reddedildi;
      if (error || !data) {
        console.error(error);
        return failed;
      }
      return { success: true, updatedAt: data.updated_at, wordCount };
    }

    if (input.expectedUpdatedAt) {
      const { data, error } = await ctx.supabase
        .from("project_manuscripts")
        .update(row)
        .eq("project_id", projectId)
        .eq("updated_at", input.expectedUpdatedAt)
        .select("updated_at");
      if (isMissingColumn(error)) return "missing-column";
      const reddedildi = rlsReddi(error);
      if (reddedildi) return reddedildi;
      if (error) {
        console.error(error);
        return failed;
      }
      if (!data?.length) return cakismaMi(input.expectedUpdatedAt);
      return { success: true, updatedAt: data[0].updated_at, wordCount };
    }

    const { data, error } = await ctx.supabase
      .from("project_manuscripts")
      .insert({ project_id: projectId, ...row })
      .select("updated_at")
      .single();
    if (isMissingColumn(error)) return "missing-column";
    const reddedildi = rlsReddi(error);
    if (reddedildi) return reddedildi;
    if (error?.code === "23505") return conflict;
    if (error || !data) {
      console.error(error);
      return failed;
    }
    return { success: true, updatedAt: data.updated_at, wordCount };
  };

  // Kılavuz senkron migration'ı henüz çalıştırılmadıysa metin yine kaydedilsin.
  let result = await write(fullRow);
  if (result === "missing-column" && hasOptionalColumns) result = await write(baseRow);
  if (result === "missing-column") return failed;

  // Sürüm geçmişi: en fazla 10 dakikada bir otomatik anlık görüntü (başarısızlığı kaydı etkilemez).
  if (result.success) {
    await snapshotManuscript(ctx.supabase, projectId, ctx.user.id, {
      kind: "auto",
      onlyIfOlderThanMs: AUTO_VERSION_INTERVAL_MS,
    });
    // Kartlardaki ilerleme çubuğu yazdıkça kendiliğinden güncellenir. Yalnızca değer değiştiyse
    // yazılır; teslime hazır/teslim edilmiş/arşivlenmiş çalışmalarda elle verilen değer korunur.
    const { progress } = input;
    if (typeof progress === "number" && Number.isInteger(progress) && progress >= 0 && progress <= 100) {
      const { error: progressError } = await ctx.supabase
        .from("academic_projects")
        .update({ progress })
        .eq("id", projectId)
        .neq("progress", progress)
        .not("status", "in", "(ready,delivered,archived)");
      if (progressError) console.error(progressError);
    }
  }
  return result;
}

// NOT: Resim yükleme artık burada değil, doğrudan tarayıcıda
// (manuscript-editor.tsx) yapılıyor — Vercel'in sunucu fonksiyonu
// istek boyutu sınırını (~4.5 MB, aşılamaz) atlamak için. Bkz.
// document-upload.ts'teki aynı mimari not.

export interface ManuscriptCheckResult {
  wordCount: number;
  citationStyle: string;
  /** Denetimin yapıldığı stil; ekran "APA 7" yerine gerçekte bakılanı yazsın. */
  stil: { id: string; ad: string; tur: AtifTuru };
  guidelineCompliance: ReturnType<typeof checkGuidelineCompliance> | null;
  missingSections: string[];
  atif: {
    referenceSectionFound: boolean;
    complianceScore: number | null;
    references: ParsedReference[];
    crossCheck: ReturnType<typeof crossCheck>;
  };
}

/**
 * Kontrolü çalıştırır ve sonucu geçmişe yazar (yazim_kontrolleri).
 * `yapi`: tarayıcıda o an hesaplanan yapı sorunları; kayda birlikte girer.
 * Kayıt yazılamazsa kontrol yine döner — geçmiş, sonucun kendisinden
 * önemli değil; yalnızca log'a gider.
 */
export async function runManuscriptCheck(
  projectId: string,
  yapi: unknown = [],
): Promise<{ error?: string; result?: ManuscriptCheckResult; kayit?: KontrolKaydiOzeti }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const { supabase } = ctx;
  const t = await ceviri();

  const { data: manuscript, error: manuscriptError } = await supabase
    .from("project_manuscripts")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle();

  if (manuscriptError) {
    console.error(manuscriptError);
    return { error: t({ tr: "Metin okunamadı; bu çalışmaya erişiminizi kontrol edin.", en: "The text could not be read; check your access to this work." }) };
  }
  if (!manuscript) return { error: t({ tr: "Kontrol için önce biraz metin yazın.", en: "Write some text before running a check." }) };

  const { data: project } = await supabase
    .from("academic_projects")
    .select("guideline_id, citation_style")
    .eq("id", projectId)
    .single();

  const content = manuscript.content as TiptapDoc;
  const fullText = extractPlainText(content);
  const split = splitBodyAndReferences(fullText);
  const citationStyle = project?.citation_style ?? "apa7";

  /*
    Editör, yazdırma ve Word çıktısıyla aynı kaynak: calismaKilavuzu (katalogda
    onaylı sürüm, yoksa öğrencinin yüklediği kılavuz). Eskiden yalnızca
    katalog okunuyordu; kılavuz çalışma başına yüklenmeye başladığından
    (26.10.2026) bu kontrol yeni çalışmalarda zorunlu bölümlere HİÇ bakmıyor
    ve geçmişe "eksik bölüm 0" yazıyordu — editör aynı bölümü eksik derken.
  */
  const { kilavuz: guideline, okunamadi: kilavuzOkunamadi } = await calismaKilavuzuOku(supabase, projectId, project?.guideline_id);
  /* Kılavuz okunamadıysa kontrol eksik kalır ve geçmişe "eksik bölüm 0" yazılırdı: çalıştırılmıyor. */
  if (kilavuzOkunamadi) {
    return {
      error: t({
        tr: "Kılavuzunuz şu anda okunamadı; kontrol eksik kalacağı için çalıştırılmadı. Sayfayı yenileyip tekrar deneyin.",
        en: "Your guideline could not be read right now, so the check was not run (it would have been incomplete). Refresh the page and try again.",
      }),
    };
  }
  // Tam metinde aranır: gövde metni "Kaynakça" başlığından önce biter, o bölüm hep eksik görünüyordu.
  const guidelineCompliance = guideline
    ? checkGuidelineCompliance(fullText, guideline.requiredSections, guideline.citationStyle, citationStyle)
    : null;

  /*
    Kaynakça denetimi eskiden YALNIZCA APA 7'de çalışıyordu; başka stil
    seçen öğrenci burada "otomatik denetim yapılamıyor" yazısı görüyordu.
    Artık Atıf Kontrolü ekranıyla aynı motor kullanılıyor (lib/atif/kunye.ts):
    künyeler stilin kendi kurallarına göre okunuyor.

    Numara stillerinde (IEEE, Vancouver) atıf ile künye ADLA değil SIRAYLA
    eşleşir; çapraz kontrol orada anlamsız olduğu için boş bırakılıyor —
    numara eşleşmesini "Yapı ve bütünlük" bölümü (lib/structure-check.ts)
    zaten denetliyor.
  */
  const stil = stilTanimi(citationStyle);
  let atifSonucu: ManuscriptCheckResult["atif"] = {
    referenceSectionFound: false,
    complianceScore: null,
    references: [],
    crossCheck: { citationsWithoutReference: [], referencesWithoutCitation: [] },
  };
  if (split.referenceText.trim().length > 0) {
    const references = kunyeleriAyristir(kunyeleriBol(split.referenceText), stil.id);
    // Tek kaynak (lib/atif/stiller.ts): elle yazılmış eşleme Harvard'ı APA sanardı.
    const atifStili = atifCikarmaStili(stil);
    const citations = stil.tur === "numara" ? [] : extractInTextCitations(split.bodyText, { style: atifStili });
    const cross =
      stil.tur === "numara"
        ? { citationsWithoutReference: [], referencesWithoutCitation: [] }
        : crossCheck(citations, references, { yilaBak: stil.tur === "yazar-tarih" });
    atifSonucu = {
      referenceSectionFound: true,
      complianceScore: computeComplianceScore(references, cross),
      references,
      crossCheck: cross,
    };
  }

  const result: ManuscriptCheckResult = {
    wordCount: countWords(content),
    citationStyle,
    stil: { id: stil.id, ad: stil.ad, tur: stil.tur },
    guidelineCompliance,
    missingSections: guidelineCompliance?.sections.filter((s) => !s.found).map((s) => s.section) ?? [],
    atif: atifSonucu,
  };

  /*
    Geçmişe yazma yeni kayıt üretiyor: abonelik kapısından geçiyor
    (lib/access.ts). Kontrolün kendisi kapısız kalıyor; engellenen
    kullanıcı sonucunu görür, yalnızca geçmişe yazılmaz.
  */
  let kayit: KontrolKaydiOzeti | undefined;
  if (!(await isSubscriptionBlocked())) {
    const temizYapi = yapiSorunlariniTemizle(yapi);
    const { data: satir, error: kayitHatasi } = await supabase
      .from("yazim_kontrolleri")
      .insert({
        project_id: projectId,
        owner_id: ctx.user.id,
        ...kontrolSayilari(temizYapi, result.missingSections.length, result.wordCount),
        sonuc: result,
        yapi: temizYapi,
      })
      .select("id, created_at, hata, uyari, eksik_bolum, kelime")
      .single();
    if (kayitHatasi) console.error("[kontrol] geçmişe yazılamadı", kayitHatasi.message);
    else if (satir) kayit = ozetOku(satir);
  }

  return { result, kayit };
}

/** Geçmişteki bir kontrolün tamamı (pencerede önceki bir kayda geçmek için). RLS okumayı sınırlar. */
export async function kontrolKaydiniOku(
  projectId: string,
  id: string,
): Promise<{ error?: string; sonuc?: ManuscriptCheckResult; yapi?: StructureIssue[] }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const { data, error } = await ctx.supabase
    .from("yazim_kontrolleri")
    .select("sonuc, yapi")
    .eq("project_id", projectId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[kontrol] kayıt okunamadı", error.message);
    return { error: t({ tr: "Kontrol kaydı okunamadı; biraz sonra tekrar deneyin.", en: "The check record could not be read; try again shortly." }) };
  }
  if (!data) return { error: t({ tr: "Kontrol kaydı bulunamadı.", en: "Check record not found." }) };
  return { sonuc: data.sonuc as ManuscriptCheckResult, yapi: yapiSorunlariniTemizle(data.yapi) };
}

