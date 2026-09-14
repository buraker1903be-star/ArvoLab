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

export interface GuidelineSyncResolution {
  mode: GuidelineSyncMode;
  margins: PageMargins;
  showPageNumbers: boolean;
  source: SettingsSource;
}

interface ManuscriptSettings {
  margins: PageMargins;
  showPageNumbers: boolean;
  settingsSource: SettingsSource;
}

const DEFAULT_MARGINS: PageMargins = { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 };

const sameMargins = (a: PageMargins, b: PageMargins) =>
  (["top", "bottom", "left", "right"] as const).every((side) => Math.abs(a[side] - b[side]) < 0.01);

// Metnin sayfa ayarlarını kılavuzun son onaylı sürümüyle karşılaştırır.
// Yazı tipi, boyut, satır aralığı, zorunlu bölümler ve kaynakça sistemi her
// zaman canlı olarak kılavuzdan gelir; burada yalnızca metne kaydedilen
// ayarlar (kenar boşlukları, sayfa numarası) için karar verilir.
export function resolveGuidelineSync(
  guideline: AppliedGuideline | null,
  manuscript: ManuscriptSettings | null
): GuidelineSyncResolution {
  if (!guideline) {
    return {
      mode: "none",
      margins: manuscript?.margins ?? DEFAULT_MARGINS,
      showPageNumbers: manuscript?.showPageNumbers ?? true,
      source: manuscript?.settingsSource ?? { guidelineId: null, version: null, customized: false },
    };
  }

  const stamp: SettingsSource = { guidelineId: guideline.id, version: guideline.version, customized: false };
  const fromGuideline = {
    margins: guideline.settings.margins ?? manuscript?.margins ?? DEFAULT_MARGINS,
    showPageNumbers: guideline.settings.showPageNumbers ?? manuscript?.showPageNumbers ?? true,
  };
  if (!manuscript) return { mode: "fresh", ...fromGuideline, source: stamp };

  const current = { margins: manuscript.margins, showPageNumbers: manuscript.showPageNumbers };
  const source = manuscript.settingsSource;
  if (source.guidelineId === guideline.id && source.version === guideline.version) {
    return { mode: "current", ...current, source };
  }

  // Ayarlar zaten yeni sürümle aynıysa sormaya gerek yok (bir sonraki kayıtta sürüm işlenir).
  if (sameMargins(current.margins, fromGuideline.margins) && current.showPageNumbers === fromGuideline.showPageNumbers) {
    return { mode: "current", ...current, source: stamp };
  }

  // Ayarlar önceki bir kılavuz sürümünden geldi ve kullanıcı dokunmadı: kendiliğinden uygula.
  if (!source.customized && source.version) {
    return { mode: "auto-applied", ...fromGuideline, source: stamp };
  }

  return { mode: "offer", ...current, source };
}
