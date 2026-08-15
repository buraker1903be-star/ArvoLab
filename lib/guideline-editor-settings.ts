import type { PageMargins } from "@/app/actions/manuscript";

export interface GuidelineEditorSettings {
  margins?: PageMargins;
  showPageNumbers?: boolean;
  fontFamily?: string;
  fontSizePt?: number;
  lineSpacing?: number;
}

const numberValue = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === "number" || (typeof item === "string" && item.trim()));
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const ALLOWED_FONTS = new Set([
  "Times New Roman", "Arial", "Calibri", "Cambria", "Garamond", "Georgia", "Verdana", "Book Antiqua",
]);

/** Farklı çıkarım sürümlerindeki anahtarları tek editör modeline dönüştürür. */
export function normalizeGuidelineEditorSettings(raw: unknown): GuidelineEditorSettings {
  if (!raw || typeof raw !== "object") return {};
  const rules = raw as Record<string, unknown>;
  const marginRules = (rules.margins_cm ?? rules.margins ?? {}) as Record<string, unknown>;
  const top = numberValue(marginRules.top, rules.margin_top_cm);
  const bottom = numberValue(marginRules.bottom, rules.margin_bottom_cm);
  const left = numberValue(marginRules.left, rules.margin_left_cm);
  const right = numberValue(marginRules.right, rules.margin_right_cm);
  const fontSizePt = numberValue(rules.font_size_pt, rules.font_size);
  const lineSpacing = numberValue(rules.line_spacing);
  const fontFamily = typeof rules.font_family === "string" && ALLOWED_FONTS.has(rules.font_family)
    ? rules.font_family
    : undefined;

  return {
    ...(top && bottom && left && right ? { margins: { top, bottom, left, right } } : {}),
    ...(typeof rules.show_page_numbers === "boolean"
      ? { showPageNumbers: rules.show_page_numbers }
      : typeof rules.page_numbers === "boolean"
        ? { showPageNumbers: rules.page_numbers }
        : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...(fontSizePt && fontSizePt >= 8 && fontSizePt <= 24 ? { fontSizePt } : {}),
    ...(lineSpacing && lineSpacing >= 1 && lineSpacing <= 3 ? { lineSpacing } : {}),
  };
}
