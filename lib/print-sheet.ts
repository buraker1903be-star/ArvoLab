import type { CSSProperties } from "react";
import { renderTiptapHtml } from "@/lib/tiptap-html";
import type { AppliedGuideline } from "@/lib/guideline-rules";
import type { CoverPage, PageMargins } from "@/app/actions/manuscript";

// Baskı görünümü (yazdırma sayfası ve danışman paylaşım sayfası aynı çıktıyı kullanır):
// kılavuzun yazı tipi, boyutu, satır aralığı ve metnin kenar boşlukları.
export interface PrintSheetManuscript {
  margins?: PageMargins;
  showPageNumbers?: boolean;
  coverPage?: CoverPage | null;
  headingNumbering?: boolean;
}

export interface PrintSheet {
  html: string;
  footnotes: string[];
  /** @page kuralı (A4, kenar boşlukları, sayfa numarası) */
  pageRule: string;
  style: CSSProperties;
  chapterCase?: "upper";
  cover: CoverPage | null;
  hasText: boolean;
}

const clampCm = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 10 ? number : fallback;
};

export function buildPrintSheet(
  manuscript: PrintSheetManuscript | null,
  guideline: AppliedGuideline | null,
  doc: { content?: unknown[] } | null
): PrintSheet {
  const { html, footnotes } = renderTiptapHtml(doc as Parameters<typeof renderTiptapHtml>[0], {
    headingNumbering: manuscript?.headingNumbering ?? false,
    chapterNewPage: guideline?.settings.chapterNewPage ?? false,
  });

  const margins = manuscript?.margins ?? guideline?.settings.margins ?? { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 };
  const m = {
    top: clampCm(margins.top, 2.5),
    right: clampCm(margins.right, 2.5),
    bottom: clampCm(margins.bottom, 2.5),
    left: clampCm(margins.left, 2.5),
  };
  const fontFamily = guideline?.settings.fontFamily ?? "Times New Roman";
  const fontSize = guideline?.settings.fontSizePt ?? 12;
  const lineSpacing = guideline?.settings.lineSpacing ?? 1.5;
  const showPageNumbers = manuscript?.showPageNumbers ?? true;

  return {
    html,
    footnotes,
    pageRule: `@page { size: A4; margin: ${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm;${
      showPageNumbers ? " @bottom-center { content: counter(page); font-size: 10pt; }" : ""
    } }`,
    style: {
      "--print-font": `'${fontFamily}', 'Times New Roman', serif`,
      "--print-size": `${fontSize}pt`,
      "--print-line": String(lineSpacing),
      "--print-margin-top": `${m.top}cm`,
      "--print-margin-right": `${m.right}cm`,
      "--print-margin-bottom": `${m.bottom}cm`,
      "--print-margin-left": `${m.left}cm`,
    } as CSSProperties,
    chapterCase: guideline?.settings.chapterUppercase ? "upper" : undefined,
    cover: manuscript?.coverPage ?? null,
    hasText: Boolean(manuscript),
  };
}
