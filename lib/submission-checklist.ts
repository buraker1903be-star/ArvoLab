// Teslim kontrol listesi: editördeki denetimleri (kılavuz bölümleri, sayfa aralığı, canlı yapı
// denetimi, kapak, içindekiler, başlık numaralandırma, kayıt) tek listede toplar. Her eksiğin
// yanında editörün tek tıkla yapabileceği düzeltme durur. Jüri/danışman kontrolünün yerini tutmaz.

import { sayfaDuzeniOzeti, type SayfaDuzeniFarki } from "@/lib/sayfa-duzeni";
import type { CoverPage } from "@/app/actions/manuscript";
import type { Dil, Metin } from "@/lib/dil";

/** Kapak alanlarının adı iki dilde (28.10.2026); eski liste Türkçe değerle kalıyor. */
export const COVER_FIELD_LABELS: [keyof CoverPage, Metin][] = [
  ["university", { tr: "Üniversite", en: "University" }],
  ["title", { tr: "Tez başlığı", en: "Thesis title" }],
  ["authorName", { tr: "Yazar", en: "Author" }],
  ["advisorName", { tr: "Danışman", en: "Advisor" }],
  ["city", { tr: "Şehir", en: "City" }],
  ["year", { tr: "Yıl", en: "Year" }],
];

/** Teslim kontrolünde kapakta dolu olması beklenen alanlar (editör ve ana sayfa ortak) */
export const COVER_REQUIRED_FIELDS: [keyof CoverPage, string][] = COVER_FIELD_LABELS.map(([key, label]) => [key, label.tr]);

export function missingCoverFields(cover: Partial<CoverPage>, dil: Dil = "tr"): string[] {
  return COVER_FIELD_LABELS.filter(([key]) => !String(cover[key] ?? "").trim()).map(([, label]) => label[dil]);
}

export type ChecklistStatus = "ok" | "warning" | "todo";

export type ChecklistAction =
  | "link-guideline"
  /* Kurum seçili ama katalogda karşılığı yok: öğrenci kendi kılavuzunu
     yükleyebiliyor (app/actions/calisma-kilavuzu.ts). */
  | "upload-guideline"
  | "insert-sections"
  | "open-issues"
  | "open-cover"
  | "enable-toc"
  | "apply-numbering"
  | "apply-page-setup"
  | "strip-manual-numbers"
  | "save";

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
  action?: { id: ChecklistAction; label: string };
}

export interface SubmissionChecklist {
  items: ChecklistItem[];
  done: number;
  total: number;
}

export interface ChecklistInput {
  isThesis: boolean;
  hasGuideline: boolean;
  /*
    Çalışmada kurum bilgisi girili mi. "Kılavuz yok" iki ayrı durum ve
    çözümleri FARKLI: kurum girilmemişse kurumu seçmek yeter, kurum
    girilmiş ama katalogda karşılığı yoksa seçmek hiçbir şey
    değiştirmez — orada tek yol kendi kılavuzunu yüklemek. İkisine
    aynı şeyi söylemek, öğrenciyi işe yaramayan bir ekrana
    göndermekti.
  */
  hasInstitution?: boolean;
  /** Uygulanan kurallar insan onayından geçti mi (lib/guideline-rules.ts). */
  guidelineVerified?: boolean;
  sections: { total: number; missing: string[] };
  pages: number;
  minPages: number | null;
  maxPages: number | null;
  /** Belgedeki kelime sayısı ve kılavuzun tez kelime sınırı (settings.thesisWords). */
  words?: number;
  wordLimit?: { min?: number; max?: number };
  /** Canlı yapı denetimi sonucu; null = henüz denetlenmedi */
  issues: { danger: number; warning: number } | null;
  cover: { enabled: boolean; missingFields: string[] };
  includeToc: boolean;
  headingNumbering: { enabled: boolean; guidelineRule?: boolean; manualNumbered: number };
  /** Kılavuzla çalışma arasındaki sayfa düzeni farkları (lib/sayfa-duzeni.ts) */
  pageSetup: SayfaDuzeniFarki[];
  saveState: "saved" | "dirty" | "saving" | "error" | "conflict";
}

/*
  dil: arayüz dili (28.10.2026). input.sections.missing ve
  input.cover.missingFields çağıranın verdiği metinlerdir (kılavuzdaki
  bölüm adları, missingCoverFields) — onları aynı dilde üretmek
  çağıranın işi; burada olduğu gibi yazılıyor.
*/
export function buildSubmissionChecklist(input: ChecklistInput, dil: Dil = "tr"): SubmissionChecklist {
  const en = dil === "en";
  const t = (tr: string, ing: string) => (en ? ing : tr);
  const items: ChecklistItem[] = [];

  if (input.isThesis) {
    items.push(
      input.hasGuideline
        ? {
            id: "guideline",
            label: t("Tez yazım kılavuzu", "Thesis writing guideline"),
            status: "ok",
            detail:
              input.guidelineVerified === false
                ? t("Kendi yüklediğiniz kılavuz uygulanıyor; kurumunuzun onayından geçmedi.", "The guideline you uploaded is being applied; it has not been approved by your institution.")
                : t("Kılavuz bağlı; biçim kuralları kendiliğinden uygulanıyor.", "A guideline is linked; its formatting rules are applied automatically."),
          }
        : input.hasInstitution
          ? {
              id: "guideline",
              label: t("Tez yazım kılavuzu", "Thesis writing guideline"),
              status: "todo",
              detail: t("Kurumunuzun kılavuzu katalogda yok. Kendi kılavuzunuzu yükleyin; kuralları okuyup size onaylatalım.", "Your institution's guideline is not in the catalog. Upload your own guideline; we will read the rules and ask you to confirm them."),
              action: { id: "upload-guideline", label: t("Kılavuzumu yükle", "Upload my guideline") },
            }
          : {
              id: "guideline",
              label: t("Tez yazım kılavuzu", "Thesis writing guideline"),
              status: "todo",
              detail: t("Çalışmaya kılavuz bağlı değil; kurumunuzu seçince kurallar kendiliğinden uygulanır.", "No guideline is linked to this work; once you select your institution, its rules are applied automatically."),
              action: { id: "link-guideline", label: t("Kurum seç", "Select institution") },
            }
    );
  }

  if (input.sections.total > 0) {
    const { total, missing } = input.sections;
    items.push(
      missing.length === 0
        ? { id: "sections", label: t("Zorunlu bölümler", "Required sections"), status: "ok", detail: (en ? `All ${total} required sections of the guideline are present.` : `Kılavuzun ${total} zorunlu bölümünün hepsi var.`) }
        : {
            id: "sections",
            label: t("Zorunlu bölümler", "Required sections"),
            status: "todo",
            detail: (en ? `${total - missing.length}/${total} sections present. Missing: ${missing.join(", ")}.` : `${total - missing.length}/${total} bölüm var. Eksik: ${missing.join(", ")}.`),
            action: { id: "insert-sections", label: t("Eksikleri ekle", "Add missing sections") },
          }
    );
  }

  if (input.minPages || input.maxPages) {
    const { pages, minPages, maxPages } = input;
    const range = [minPages ? t(`en az ${minPages}`, `at least ${minPages}`) : "", maxPages ? t(`en fazla ${maxPages}`, `at most ${maxPages}`) : ""].filter(Boolean).join(", ");
    const istiyor = en ? `≈ ${pages} pages; the guideline requires ${range} pages.` : `≈ ${pages} sayfa; kılavuz ${range} sayfa istiyor.`;
    items.push(
      maxPages && pages > maxPages
        ? { id: "pages", label: t("Sayfa sayısı", "Page count"), status: "todo", detail: istiyor }
        : minPages && pages < minPages
          ? { id: "pages", label: t("Sayfa sayısı", "Page count"), status: "warning", detail: istiyor }
          : { id: "pages", label: t("Sayfa sayısı", "Page count"), status: "ok", detail: (en ? `≈ ${pages} pages; within the guideline's range (${range}).` : `≈ ${pages} sayfa; kılavuzun aralığında (${range}).`) }
    );
  }

  /*
    TEZ KELİME SINIRI (29.10.2026). Sayılan, belgenin TAMAMI: kaynakça ve
    ekler de içinde. Kılavuzların çoğu onları sınırın dışında tutuyor;
    bölüm bölüm ayırmak tahmin olurdu. Bu yüzden aşım "yapılacak" değil
    UYARI ve cümle bunu açıkça söylüyor — öğrenci kaynakçası yüzünden
    gereksiz yere metin silmesin.
  */
  if (input.wordLimit && (input.wordLimit.min || input.wordLimit.max) && input.words !== undefined) {
    const { min, max } = input.wordLimit;
    const sayi = (n: number) => n.toLocaleString(en ? "en-US" : "tr-TR");
    const w = sayi(input.words);
    const aralik = [min ? t(`en az ${sayi(min)}`, `at least ${sayi(min)}`) : "", max ? t(`en fazla ${sayi(max)}`, `at most ${sayi(max)}`) : ""]
      .filter(Boolean)
      .join(", ");
    const kapsam = t("kaynakça ve ekler dahil sayıldı", "references and appendices included in the count");
    items.push(
      max && input.words > max
        ? {
            id: "words",
            label: t("Kelime sayısı", "Word count"),
            status: "warning",
            detail: en
              ? `${w} words (${kapsam}); the guideline allows ${aralik}. If your guideline excludes references and appendices, the count that matters is lower.`
              : `${w} kelime (${kapsam}); kılavuz ${aralik} kelimeye izin veriyor. Kılavuzunuz kaynakça ve ekleri saymıyorsa geçerli sayı daha düşüktür.`,
          }
        : min && input.words < min
          ? {
              id: "words",
              label: t("Kelime sayısı", "Word count"),
              status: "warning",
              detail: en ? `${w} words; the guideline requires ${aralik}.` : `${w} kelime; kılavuz ${aralik} kelime istiyor.`,
            }
          : {
              id: "words",
              label: t("Kelime sayısı", "Word count"),
              status: "ok",
              detail: en ? `${w} words; within the guideline's limit (${aralik}).` : `${w} kelime; kılavuzun sınırında (${aralik}).`,
            },
    );
  }

  if (!input.issues) {
    items.push({ id: "structure", label: t("Yapı ve atıflar", "Structure and citations"), status: "warning", detail: t("Canlı denetim birkaç saniye içinde tamamlanır.", "The live check completes in a few seconds.") });
  } else {
    const { danger, warning } = input.issues;
    const count = [
      danger ? (en ? `${danger} serious ${danger === 1 ? "issue" : "issues"}` : `${danger} ciddi sorun`) : "",
      warning ? (en ? `${warning} ${warning === 1 ? "warning" : "warnings"}` : `${warning} uyarı`) : "",
    ]
      .filter(Boolean)
      .join(", ");
    items.push(
      danger + warning === 0
        ? { id: "structure", label: t("Yapı ve atıflar", "Structure and citations"), status: "ok", detail: t("Boş bölüm, başlık, şekil/tablo, atıf–kaynakça ya da özet sorunu yok.", "No issues with empty sections, headings, figures/tables, citations vs. reference list, or the abstract.") }
        : {
            id: "structure",
            label: t("Yapı ve atıflar", "Structure and citations"),
            status: danger ? "todo" : "warning",
            detail: en ? `${count} found.` : `${count} var.`,
            action: { id: "open-issues", label: t("Göster", "Show") },
          }
    );
  }

  if (input.isThesis) {
    const { enabled, missingFields } = input.cover;
    items.push(
      !enabled
        ? {
            id: "cover",
            label: t("Kapak sayfası", "Title page"),
            status: "todo",
            detail: t("Word ve PDF çıktısında kapak sayfası yok.", "The Word and PDF output has no title page."),
            action: { id: "open-cover", label: t("Kapağı ekle", "Add title page") },
          }
        : missingFields.length > 0
          ? {
              id: "cover",
              label: t("Kapak sayfası", "Title page"),
              status: "warning",
              detail: en ? `Empty fields: ${missingFields.join(", ")}.` : `Boş alanlar: ${missingFields.join(", ")}.`,
              action: { id: "open-cover", label: t("Tamamla", "Complete") },
            }
          : { id: "cover", label: t("Kapak sayfası", "Title page"), status: "ok", detail: t("Kapak bilgileri tam.", "Title page details are complete.") }
    );
    items.push(
      input.includeToc
        ? { id: "toc", label: t("İçindekiler", "Table of contents"), status: "ok", detail: t("Word ve PDF çıktısında içindekiler var; Word'de tablolar ve şekiller listesi de.", "The Word and PDF output includes a table of contents; Word also includes lists of tables and figures.") }
        : {
            id: "toc",
            label: t("İçindekiler", "Table of contents"),
            status: "warning",
            detail: t("Word ve PDF çıktısında içindekiler yok.", "The Word and PDF output has no table of contents."),
            action: { id: "enable-toc", label: t("Ekle", "Add") },
          }
    );
  }

  const { enabled, guidelineRule, manualNumbered } = input.headingNumbering;
  if (guidelineRule !== undefined && enabled !== guidelineRule) {
    items.push({
      id: "numbering",
      label: t("Başlık numaralandırma", "Heading numbering"),
      status: "warning",
      detail: guidelineRule ? t("Kılavuz başlıkların numaralı olmasını istiyor; numaralandırma kapalı.", "The guideline requires numbered headings; numbering is off.") : t("Kılavuz numarasız başlık istiyor; numaralandırma açık.", "The guideline requires unnumbered headings; numbering is on."),
      action: { id: "apply-numbering", label: t("Kılavuza uy", "Follow guideline") },
    });
  } else if (enabled && manualNumbered > 0) {
    items.push({
      id: "numbering",
      label: t("Başlık numaralandırma", "Heading numbering"),
      status: "warning",
      detail: en
        ? `${manualNumbered} ${manualNumbered === 1 ? "heading has a manually typed number" : "headings have manually typed numbers"}; the output will show double numbering.`
        : `${manualNumbered} başlıkta elle yazılmış numara var; çıktıda çift numara görünür.`,
      action: { id: "strip-manual-numbers", label: t("Elle yazılanları kaldır", "Remove manual numbers") },
    });
  } else if (enabled || guidelineRule !== undefined) {
    items.push({ id: "numbering", label: t("Başlık numaralandırma", "Heading numbering"), status: "ok", detail: enabled ? t("Başlıklar otomatik numaralanıyor.", "Headings are numbered automatically.") : t("Başlıklar kılavuza uygun biçimde numarasız.", "Headings are unnumbered, as the guideline requires.") });
  }

  /*
    Sayfa düzeni: kılavuz bağlanınca kenar boşlukları ve sayfa numarası
    kendiliğinden uygulanıyor ama öğrenci sonradan değiştirebiliyor ve
    bunu hiçbir ekran söylemiyordu — jüriden dönen en sık biçim hatası.
    Kılavuzda tanımlı olmayan alan karşılaştırılmaz: "bilmiyorum" ile
    "yanlış" aynı şey değil (lib/sayfa-duzeni.ts).
  */
  if (input.pageSetup.length) {
    items.push({
      id: "page-setup",
      label: t("Sayfa düzeni", "Page layout"),
      status: "warning",
      detail: sayfaDuzeniOzeti(input.pageSetup, dil),
      action: { id: "apply-page-setup", label: t("Kılavuza uy", "Follow guideline") },
    });
  } else if (input.hasGuideline) {
    items.push({ id: "page-setup", label: t("Sayfa düzeni", "Page layout"), status: "ok", detail: t("Kenar boşlukları ve sayfa numarası kılavuza uygun.", "Margins and page numbers match the guideline.") });
  }

  items.push(
    input.saveState === "saved"
      ? { id: "save", label: t("Kayıt", "Save status"), status: "ok", detail: t("Tüm değişiklikler kaydedildi.", "All changes saved.") }
      : input.saveState === "error" || input.saveState === "conflict"
        ? {
            id: "save",
            label: t("Kayıt", "Save status"),
            status: "todo",
            detail: input.saveState === "conflict" ? t("Başka bir sekmede değişiklik var; önce çakışmayı çözün.", "There are changes in another tab; resolve the conflict first.") : t("Kaydedilemeyen değişiklikler var (bu tarayıcıda saklanıyor).", "Some changes could not be saved (they are kept in this browser)."),
            ...(input.saveState === "error" ? { action: { id: "save" as const, label: t("Yeniden dene", "Try again") } } : {}),
          }
        : { id: "save", label: t("Kayıt", "Save status"), status: "warning", detail: t("Değişiklikler kaydediliyor…", "Saving changes…"), action: { id: "save", label: t("Şimdi kaydet", "Save now") } }
  );

  return { items, done: items.filter((item) => item.status === "ok").length, total: items.length };
}
