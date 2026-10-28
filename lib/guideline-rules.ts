import type { KilavuzSayiKurali, OndalikAyirici } from "@/lib/sayi-bicimi";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeGuidelineEditorSettings, type GuidelineEditorSettings } from "@/lib/guideline-editor-settings";

// Bir çalışmaya uygulanan kılavuzun SON ONAYLI sürümü. Editör, kontrol ve
// Word çıktısı hep buradan okur; böylece üçü aynı kuralları kullanır.
// Yönetici kuralları yeniden düzenlerken (needs_review) müşteri son onaylı
// sürümle çalışmaya devam eder (approved_snapshot).
export interface AppliedGuideline {
  id: string;
  /** Onaylı sürümün kimliği (onay zamanı); editör sayfa ayarlarının kaynağını bununla izler */
  version: string;
  label: string;
  universityName: string;
  instituteName: string | null;
  versionLabel: string | null;
  sourceUrl: string | null;
  citationStyle: string;
  /*
    Sayının yazılışı (lib/sayi-bicimi). İki alan da NULL olabilir:
    kılavuz bu kuralı söylemiyorsa uydurmuyoruz, atıf sisteminin
    geleneğine düşülüyor. Varsayılan yazmak, hiç incelenmemiş bir
    kılavuzu "incelendi" gibi gösterirdi.
  */
  numberFormat: KilavuzSayiKurali;
  requiredSections: string[];
  minPages: number | null;
  maxPages: number | null;
  settings: GuidelineEditorSettings;
  lastCheckedAt: string | null;
  /** Kaynakta yeni bir sürüm algılandı ya da kurallar yeniden inceleniyor */
  updatePending: boolean;
  /*
    Kurallar İNSAN ONAYINDAN geçti mi.

    Katalogdaki kılavuzlar Yönetici onayıyla yayımlanıyor;
    öğrencinin kendi yüklediği PDF'ten çıkarılanlar geçmiyor. Ayrım
    ekranda görünmek ZORUNDA: yanlış bir kural sessizdir ve program
    "teslime hazır görünüyor" derken hangi kurala dayandığını
    söylemelidir.
  */
  dogrulandi: boolean;
}

interface Snapshot {
  citation_style?: string;
  number_decimal_separator?: string | null;
  number_leading_zero?: boolean | null;
  required_sections?: string[];
  extracted_rules?: unknown;
  min_pages?: number | null;
  max_pages?: number | null;
  version_label?: string | null;
  document_title?: string | null;
  source_url?: string | null;
  approved_at?: string;
}

/** thesis_guidelines satırının kullanılan alanları */
/*
  Veritabanı metin tutuyor; tip daraltması burada yapılıyor. Kısıt
  yalnızca 'comma'/'period'a izin veriyor ama okuma tarafı buna
  GÜVENMEZ: eski bir satır ya da elle yazılmış bir değer tanınmazsa
  "bilinmiyor" sayılır, uydurma bir biçim uygulanmaz.
*/
function ondalikAyirici(deger: string | null | undefined): OndalikAyirici | null {
  return deger === "comma" || deger === "period" ? deger : null;
}

export interface GuidelineRow {
  id: string;
  university_name: string;
  institute_name?: string | null;
  citation_style?: string | null;
  number_decimal_separator?: string | null;
  number_leading_zero?: boolean | null;
  required_sections?: string[] | null;
  extracted_rules?: unknown;
  min_pages?: number | null;
  max_pages?: number | null;
  version_label?: string | null;
  document_title?: string | null;
  source_url?: string | null;
  approved_snapshot?: unknown;
  analysis_status?: string | null;
  reviewed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  last_checked_at?: string | null;
  ai_analysis?: unknown;
}

/** Kılavuz satırından uygulanan (son onaylı) sürüm; hiç onaylı sürüm yoksa null */
export function appliedGuidelineFromRow(g: GuidelineRow): AppliedGuideline | null {
  // Migration öncesi kayıtlar: anlık görüntü yoksa yalnızca şu an onaylıysa canlı alanlar kullanılır.
  const snapshot: Snapshot | null =
    (g.approved_snapshot as Snapshot | null | undefined) ??
    (g.analysis_status === "approved"
      ? {
          citation_style: g.citation_style ?? undefined,
          number_decimal_separator: g.number_decimal_separator,
          number_leading_zero: g.number_leading_zero,
          required_sections: g.required_sections ?? undefined,
          extracted_rules: g.extracted_rules,
          min_pages: g.min_pages,
          max_pages: g.max_pages,
          version_label: g.version_label,
          document_title: g.document_title,
          source_url: g.source_url,
          approved_at: g.reviewed_at ?? g.updated_at ?? g.created_at ?? undefined,
        }
      : null);
  if (!snapshot) return null;

  const versionLabel = snapshot.version_label ?? null;
  const label =
    snapshot.document_title ??
    `${g.university_name}${g.institute_name ? ` — ${g.institute_name}` : ""}${versionLabel ? ` (${versionLabel})` : ""}`;
  const analysis = (g.ai_analysis ?? {}) as { pendingReview?: boolean };

  return {
    id: g.id,
    version: String(snapshot.approved_at ?? ""),
    label,
    universityName: g.university_name,
    instituteName: g.institute_name ?? null,
    versionLabel,
    sourceUrl: snapshot.source_url ?? g.source_url ?? null,
    citationStyle: snapshot.citation_style ?? g.citation_style ?? "apa7",
    /* Anlık görüntü kazanır: kılavuz onaylandıktan sonra değiştirilen
       bir kural öğrencinin çalışmasına sızmamalı (migration
       20261025131500'ün gerekçesi). */
    numberFormat: {
      ayirici: ondalikAyirici(snapshot.number_decimal_separator ?? g.number_decimal_separator),
      bastakiSifir: snapshot.number_leading_zero ?? g.number_leading_zero ?? null,
    },
    requiredSections: snapshot.required_sections ?? [],
    minPages: snapshot.min_pages ?? null,
    maxPages: snapshot.max_pages ?? null,
    settings: normalizeGuidelineEditorSettings(snapshot.extracted_rules),
    lastCheckedAt: g.last_checked_at ?? null,
    updatePending: g.analysis_status !== "approved" || Boolean(analysis.pendingReview),
    // Katalogdan gelen her şey onay akışından geçmiştir.
    dogrulandi: true,
  };
}

/*
  ÖĞRENCİNİN KENDİ YÜKLEDİĞİ KILAVUZ (calisma_kilavuzu).

  Katalogda eşleşme yoksa devreye giriyor. Aynı AppliedGuideline
  biçimini döndürüyor, çünkü editör, teslim kontrolü ve yapı denetimi
  kuralları TEK yerden okuyor; ikinci bir biçim, kuralların okunduğu
  yeri ikiye ayırırdı.

  Tek fark `dogrulandi: false` — ve bu fark ekranda görünüyor.
*/
export interface CalismaKilavuzuRow {
  project_id: string;
  kaynak_adres: string | null;
  belge_basligi: string | null;
  kurallar: unknown;
  olusturuldu?: string | null;
}

export function appliedGuidelineFromCalisma(row: CalismaKilavuzuRow): AppliedGuideline | null {
  const kurallar = (row.kurallar ?? {}) as Snapshot;
  /*
    Atıf stili olmayan bir kayıt uygulanmıyor: doğrulama ekranı onu
    zorunlu tutuyor, yani stilsiz bir satır ancak elle ya da eski bir
    yoldan gelmiş olabilir. Yarım kuralı uygulamak, olmayan bir kurala
    uyuyormuş gibi göstermekten kötü.
  */
  if (!kurallar.citation_style) return null;

  return {
    id: `calisma:${row.project_id}`,
    version: String(row.olusturuldu ?? ""),
    label: row.belge_basligi ?? "Yüklediğiniz kılavuz",
    universityName: "",
    instituteName: null,
    versionLabel: null,
    sourceUrl: kurallar.source_url ?? row.kaynak_adres ?? null,
    citationStyle: kurallar.citation_style,
    numberFormat: {
      ayirici: ondalikAyirici(kurallar.number_decimal_separator),
      bastakiSifir: kurallar.number_leading_zero ?? null,
    },
    requiredSections: kurallar.required_sections ?? [],
    minPages: kurallar.min_pages ?? null,
    maxPages: kurallar.max_pages ?? null,
    settings: normalizeGuidelineEditorSettings(kurallar.extracted_rules),
    lastCheckedAt: row.olusturuldu ?? null,
    updatePending: false,
    dogrulandi: false,
  };
}

/*
  Çalışmaya UYGULANAN kılavuz: önce katalog, yoksa öğrencinin kendi
  yüklediği. Sıra tartışmalı değil — onaydan geçmiş kural, geçmemiş
  olanı her zaman yener.
*/
export async function calismaKilavuzu(
  supabase: SupabaseClient,
  projectId: string,
  guidelineId: string | null | undefined,
): Promise<AppliedGuideline | null> {
  const katalog = await loadAppliedGuideline(supabase, guidelineId);
  if (katalog) return katalog;

  const { data, error } = await supabase
    .from("calisma_kilavuzu")
    .select("project_id, kaynak_adres, belge_basligi, kurallar, olusturuldu")
    .eq("project_id", projectId)
    .maybeSingle();
  /*
    Okuma hatası "kılavuz yok" DEĞİL. Geçici bir arızada öğrencinin
    kuralları sessizce kaybolur ve editör kılavuzsuz çalışmaya başlar;
    yazdığı tez biçim denetiminden geçmemiş olur.
  */
  if (error) {
    console.error("[kilavuz] çalışma kılavuzu okunamadı:", error.message);
    return null;
  }
  return data ? appliedGuidelineFromCalisma(data as CalismaKilavuzuRow) : null;
}

export async function loadAppliedGuideline(
  supabase: SupabaseClient,
  guidelineId: string | null | undefined
): Promise<AppliedGuideline | null> {
  if (!guidelineId) return null;
  const { data: g, error } = await supabase
    .from("thesis_guidelines")
    .select("*")
    .eq("id", guidelineId)
    .maybeSingle();
  if (error || !g) {
    if (error) console.error(error);
    return null;
  }
  return appliedGuidelineFromRow(g as GuidelineRow);
}

/** Birden çok çalışmanın kılavuzu tek sorguda (panel ve çalışma kartları için) */
export async function loadAppliedGuidelines(
  supabase: SupabaseClient,
  guidelineIds: (string | null | undefined)[]
): Promise<Map<string, AppliedGuideline>> {
  const result = new Map<string, AppliedGuideline>();
  const ids = [...new Set(guidelineIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return result;
  const { data, error } = await supabase.from("thesis_guidelines").select("*").in("id", ids);
  if (error) {
    console.error(error);
    return result;
  }
  for (const row of (data ?? []) as GuidelineRow[]) {
    const applied = appliedGuidelineFromRow(row);
    if (applied) result.set(applied.id, applied);
  }
  return result;
}

/*
  Birden çok çalışmanın UYGULANAN kılavuzu, çalışma kimliğine göre
  (Çalışmalarım listesi). calismaKilavuzu'nun toplu karşılığı: önce katalog,
  katalogda onaylı sürümü olmayan çalışmalar için öğrencinin yüklediği.

  Eskiden liste loadAppliedGuidelines ile yalnızca kataloğu okuyordu; kılavuz
  çalışma başına yüklenmeye başlayınca (26.10.2026) yeni çalışmaların
  kartında tempo ve hedef kayboldu, ana sayfa aynı çalışma için ikisini de
  gösteriyordu.
*/
export async function calismaKilavuzlari(
  supabase: SupabaseClient,
  calismalar: { id: string; guideline_id: string | null | undefined }[],
): Promise<Map<string, AppliedGuideline>> {
  const katalog = await loadAppliedGuidelines(supabase, calismalar.map((c) => c.guideline_id));
  const sonuc = new Map<string, AppliedGuideline>();
  const kalan: string[] = [];
  for (const c of calismalar) {
    const k = c.guideline_id ? katalog.get(c.guideline_id) : undefined;
    if (k) sonuc.set(c.id, k);
    else kalan.push(c.id);
  }
  if (!kalan.length) return sonuc;

  const { data, error } = await supabase
    .from("calisma_kilavuzu")
    .select("project_id, kaynak_adres, belge_basligi, kurallar, olusturuldu")
    .in("project_id", kalan);
  if (error) {
    console.error("[kilavuz] çalışma kılavuzları okunamadı:", error.message);
    return sonuc;
  }
  for (const row of (data ?? []) as CalismaKilavuzuRow[]) {
    const uygulanan = appliedGuidelineFromCalisma(row);
    if (uygulanan) sonuc.set(row.project_id, uygulanan);
  }
  return sonuc;
}
