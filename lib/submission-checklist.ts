// Teslim kontrol listesi: editördeki denetimleri (kılavuz bölümleri, sayfa aralığı, canlı yapı
// denetimi, kapak, içindekiler, başlık numaralandırma, kayıt) tek listede toplar. Her eksiğin
// yanında editörün tek tıkla yapabileceği düzeltme durur. Jüri/danışman kontrolünün yerini tutmaz.

export type ChecklistStatus = "ok" | "warning" | "todo";

export type ChecklistAction =
  | "link-guideline"
  | "insert-sections"
  | "open-issues"
  | "open-cover"
  | "enable-toc"
  | "apply-numbering"
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
  sections: { total: number; missing: string[] };
  pages: number;
  minPages: number | null;
  maxPages: number | null;
  /** Canlı yapı denetimi sonucu; null = henüz denetlenmedi */
  issues: { danger: number; warning: number } | null;
  cover: { enabled: boolean; missingFields: string[] };
  includeToc: boolean;
  headingNumbering: { enabled: boolean; guidelineRule?: boolean; manualNumbered: number };
  saveState: "saved" | "dirty" | "saving" | "error" | "conflict";
}

export function buildSubmissionChecklist(input: ChecklistInput): SubmissionChecklist {
  const items: ChecklistItem[] = [];

  if (input.isThesis) {
    items.push(
      input.hasGuideline
        ? { id: "guideline", label: "Tez yazım kılavuzu", status: "ok", detail: "Kılavuz bağlı; biçim kuralları kendiliğinden uygulanıyor." }
        : {
            id: "guideline",
            label: "Tez yazım kılavuzu",
            status: "todo",
            detail: "Çalışmaya kılavuz bağlı değil; kurumunuzu seçince kurallar kendiliğinden uygulanır.",
            action: { id: "link-guideline", label: "Kurum seç" },
          }
    );
  }

  if (input.sections.total > 0) {
    const { total, missing } = input.sections;
    items.push(
      missing.length === 0
        ? { id: "sections", label: "Zorunlu bölümler", status: "ok", detail: `Kılavuzun ${total} zorunlu bölümünün hepsi var.` }
        : {
            id: "sections",
            label: "Zorunlu bölümler",
            status: "todo",
            detail: `${total - missing.length}/${total} bölüm var. Eksik: ${missing.join(", ")}.`,
            action: { id: "insert-sections", label: "Eksikleri ekle" },
          }
    );
  }

  if (input.minPages || input.maxPages) {
    const { pages, minPages, maxPages } = input;
    const range = [minPages ? `en az ${minPages}` : "", maxPages ? `en fazla ${maxPages}` : ""].filter(Boolean).join(", ");
    items.push(
      maxPages && pages > maxPages
        ? { id: "pages", label: "Sayfa sayısı", status: "todo", detail: `≈ ${pages} sayfa; kılavuz ${range} sayfa istiyor.` }
        : minPages && pages < minPages
          ? { id: "pages", label: "Sayfa sayısı", status: "warning", detail: `≈ ${pages} sayfa; kılavuz ${range} sayfa istiyor.` }
          : { id: "pages", label: "Sayfa sayısı", status: "ok", detail: `≈ ${pages} sayfa; kılavuzun aralığında (${range}).` }
    );
  }

  if (!input.issues) {
    items.push({ id: "structure", label: "Yapı ve atıflar", status: "warning", detail: "Canlı denetim birkaç saniye içinde tamamlanır." });
  } else {
    const { danger, warning } = input.issues;
    const count = [danger ? `${danger} ciddi sorun` : "", warning ? `${warning} uyarı` : ""].filter(Boolean).join(", ");
    items.push(
      danger + warning === 0
        ? { id: "structure", label: "Yapı ve atıflar", status: "ok", detail: "Boş bölüm, başlık, şekil/tablo, atıf–kaynakça ya da özet sorunu yok." }
        : {
            id: "structure",
            label: "Yapı ve atıflar",
            status: danger ? "todo" : "warning",
            detail: `${count} var.`,
            action: { id: "open-issues", label: "Göster" },
          }
    );
  }

  if (input.isThesis) {
    const { enabled, missingFields } = input.cover;
    items.push(
      !enabled
        ? {
            id: "cover",
            label: "Kapak sayfası",
            status: "todo",
            detail: "Word ve PDF çıktısında kapak sayfası yok.",
            action: { id: "open-cover", label: "Kapağı ekle" },
          }
        : missingFields.length > 0
          ? {
              id: "cover",
              label: "Kapak sayfası",
              status: "warning",
              detail: `Boş alanlar: ${missingFields.join(", ")}.`,
              action: { id: "open-cover", label: "Tamamla" },
            }
          : { id: "cover", label: "Kapak sayfası", status: "ok", detail: "Kapak bilgileri tam." }
    );
    items.push(
      input.includeToc
        ? { id: "toc", label: "İçindekiler", status: "ok", detail: "Word çıktısında içindekiler, tablolar ve şekiller listesi var." }
        : {
            id: "toc",
            label: "İçindekiler",
            status: "warning",
            detail: "Word çıktısında içindekiler tablosu yok.",
            action: { id: "enable-toc", label: "Ekle" },
          }
    );
  }

  const { enabled, guidelineRule, manualNumbered } = input.headingNumbering;
  if (guidelineRule !== undefined && enabled !== guidelineRule) {
    items.push({
      id: "numbering",
      label: "Başlık numaralandırma",
      status: "warning",
      detail: guidelineRule ? "Kılavuz başlıkların numaralı olmasını istiyor; numaralandırma kapalı." : "Kılavuz numarasız başlık istiyor; numaralandırma açık.",
      action: { id: "apply-numbering", label: "Kılavuza uy" },
    });
  } else if (enabled && manualNumbered > 0) {
    items.push({
      id: "numbering",
      label: "Başlık numaralandırma",
      status: "warning",
      detail: `${manualNumbered} başlıkta elle yazılmış numara var; çıktıda çift numara görünür.`,
      action: { id: "strip-manual-numbers", label: "Elle yazılanları kaldır" },
    });
  } else if (enabled || guidelineRule !== undefined) {
    items.push({ id: "numbering", label: "Başlık numaralandırma", status: "ok", detail: enabled ? "Başlıklar otomatik numaralanıyor." : "Başlıklar kılavuza uygun biçimde numarasız." });
  }

  items.push(
    input.saveState === "saved"
      ? { id: "save", label: "Kayıt", status: "ok", detail: "Tüm değişiklikler kaydedildi." }
      : input.saveState === "error" || input.saveState === "conflict"
        ? {
            id: "save",
            label: "Kayıt",
            status: "todo",
            detail: input.saveState === "conflict" ? "Başka bir sekmede değişiklik var; önce çakışmayı çözün." : "Kaydedilemeyen değişiklikler var (bu tarayıcıda saklanıyor).",
            ...(input.saveState === "error" ? { action: { id: "save" as const, label: "Yeniden dene" } } : {}),
          }
        : { id: "save", label: "Kayıt", status: "warning", detail: "Değişiklikler kaydediliyor…", action: { id: "save", label: "Şimdi kaydet" } }
  );

  return { items, done: items.filter((item) => item.status === "ok").length, total: items.length };
}
