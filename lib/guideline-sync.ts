import type { PageMargins, SettingsSource } from "@/app/actions/manuscript";
import type { AppliedGuideline } from "@/lib/guideline-rules";

export type GuidelineSyncMode =
  /** Çalışmaya bağlı onaylı kılavuz yok */
  | "none"
  /** Henüz metin yok: sayfa ayarları kılavuzdan */
  | "fresh"
  /** Metnin ayarları kılavuzun güncel sürümüyle uyumlu */
  | "current"
  /** Kılavuzun yeni sürümü kendiliğinden uygulandı (kullanıcı ayarları değiştirmemişti) */
  | "auto-applied"
  /** Yeni sürüm var ama kullanıcı ayarları kendisi değiştirmiş: tek tıkla uygulama önerilir */
  | "offer";

/** Kılavuzla metin arasındaki tek bir ayar farkı (kullanıcıya gösterilecek hâliyle) */
export interface GuidelineSyncChange {
  /** Ayarın adı, ör. "Üst kenar boşluğu" */
  label: string;
  /** Metnin önceki/şu anki değeri */
  from: string;
  /** Kılavuzun istediği değer */
  to: string;
}

export interface GuidelineSyncResolution {
  mode: GuidelineSyncMode;
  margins: PageMargins;
  showPageNumbers: boolean;
  headingNumbering: boolean;
  source: SettingsSource;
  /**
   * "auto-applied" için neyin değiştiği, "offer" için kabul edilirse neyin değişeceği.
   * Diğer durumlarda boştur.
   */
  changes: GuidelineSyncChange[];
}

interface ManuscriptSettings {
  margins: PageMargins;
  showPageNumbers: boolean;
  /** Eski kayıtlarda (migration öncesi) olmayabilir */
  headingNumbering?: boolean;
  settingsSource: SettingsSource;
}

const DEFAULT_MARGINS: PageMargins = { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 };

const sameMargins = (a: PageMargins, b: PageMargins) =>
  (["top", "bottom", "left", "right"] as const).every((side) => Math.abs(a[side] - b[side]) < 0.01);

const MARGIN_LABELS: Record<keyof PageMargins, string> = {
  top: "Üst kenar boşluğu",
  bottom: "Alt kenar boşluğu",
  left: "Sol kenar boşluğu",
  right: "Sağ kenar boşluğu",
};

// Ondalık ayırıcı virgül: 2.5 → "2,5 cm"
const cm = (value: number) => `${String(Math.round(value * 100) / 100).replace(".", ",")} cm`;
const onOff = (value: boolean) => (value ? "Açık" : "Kapalı");

interface SyncSettings {
  margins: PageMargins;
  showPageNumbers: boolean;
  headingNumbering: boolean;
}

/** Metnin ayarlarıyla kılavuzun istediği ayarlar arasındaki farklar */
function diffSettings(current: SyncSettings, wanted: SyncSettings): GuidelineSyncChange[] {
  const changes: GuidelineSyncChange[] = [];
  for (const side of ["top", "bottom", "left", "right"] as const) {
    if (Math.abs(current.margins[side] - wanted.margins[side]) >= 0.01) {
      changes.push({ label: MARGIN_LABELS[side], from: cm(current.margins[side]), to: cm(wanted.margins[side]) });
    }
  }
  if (current.showPageNumbers !== wanted.showPageNumbers) {
    changes.push({ label: "Sayfa numarası", from: onOff(current.showPageNumbers), to: onOff(wanted.showPageNumbers) });
  }
  if (current.headingNumbering !== wanted.headingNumbering) {
    changes.push({ label: "Başlık numaralandırma", from: onOff(current.headingNumbering), to: onOff(wanted.headingNumbering) });
  }
  return changes;
}

// Metnin sayfa ayarlarını kılavuzun son onaylı sürümüyle karşılaştırır.
// Yazı tipi, boyut, satır aralığı, zorunlu bölümler ve kaynakça sistemi her
// zaman canlı olarak kılavuzdan gelir; burada yalnızca metne kaydedilen
// ayarlar (kenar boşlukları, sayfa numarası, başlık numaralandırma) için karar verilir.
export function resolveGuidelineSync(
  guideline: AppliedGuideline | null,
  manuscript: ManuscriptSettings | null
): GuidelineSyncResolution {
  if (!guideline) {
    return {
      mode: "none",
      margins: manuscript?.margins ?? DEFAULT_MARGINS,
      showPageNumbers: manuscript?.showPageNumbers ?? true,
      headingNumbering: manuscript?.headingNumbering ?? false,
      source: manuscript?.settingsSource ?? { guidelineId: null, version: null, customized: false },
      changes: [],
    };
  }

  const stamp: SettingsSource = { guidelineId: guideline.id, version: guideline.version, customized: false };
  const fromGuideline = {
    margins: guideline.settings.margins ?? manuscript?.margins ?? DEFAULT_MARGINS,
    showPageNumbers: guideline.settings.showPageNumbers ?? manuscript?.showPageNumbers ?? true,
    headingNumbering: guideline.settings.headingNumbering ?? manuscript?.headingNumbering ?? false,
  };
  if (!manuscript) return { mode: "fresh", ...fromGuideline, source: stamp, changes: [] };

  const current = {
    margins: manuscript.margins,
    showPageNumbers: manuscript.showPageNumbers,
    headingNumbering: manuscript.headingNumbering ?? false,
  };
  const source = manuscript.settingsSource;
  if (source.guidelineId === guideline.id && source.version === guideline.version) {
    return { mode: "current", ...current, source, changes: [] };
  }

  // Ayarlar zaten yeni sürümle aynıysa sormaya gerek yok (bir sonraki kayıtta sürüm işlenir).
  if (
    sameMargins(current.margins, fromGuideline.margins) &&
    current.showPageNumbers === fromGuideline.showPageNumbers &&
    current.headingNumbering === fromGuideline.headingNumbering
  ) {
    return { mode: "current", ...current, source: stamp, changes: [] };
  }

  const changes = diffSettings(current, fromGuideline);

  // Ayarlar önceki bir kılavuz sürümünden geldi ve kullanıcı dokunmadı: kendiliğinden uygula.
  if (!source.customized && source.version) {
    return { mode: "auto-applied", ...fromGuideline, source: stamp, changes };
  }

  return { mode: "offer", ...current, source, changes };
}
