// Teslim hazırlığı (sunucuda, kaydedilmiş metinden): editördeki "Teslim kontrolü" ile aynı
// kontrol listesi; ana sayfada özet olarak gösterilir. Aynı saf fonksiyonlar kullanılır:
// kılavuz bölüm eşleştirmesi, sayfa tahmini, yapı/atıf denetimi, kapak ve numaralandırma.
import { sayfaDuzeniFarklari } from "@/lib/sayfa-duzeni";
import { buildSubmissionChecklist, missingCoverFields, type SubmissionChecklist } from "@/lib/submission-checklist";
import { checkStructure } from "@/lib/structure-check";
import { headingMatchesSection } from "@/lib/section-match";
import { hasManualNumber } from "@/lib/heading-numbering";
import { estimatePages } from "@/lib/page-estimate";
import type { AppliedGuideline } from "@/lib/guideline-rules";
import type { CoverPage } from "@/app/actions/manuscript";

interface JsonNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  content?: JsonNode[];
}

/** project_manuscripts satırının kullanılan alanları */
export interface ReadinessManuscript {
  content?: unknown;
  word_count?: number | null;
  cover_page?: CoverPage | null;
  include_toc?: boolean | null;
  heading_numbering?: boolean | null;
  margin_top_cm?: number | null;
  margin_bottom_cm?: number | null;
  margin_left_cm?: number | null;
  margin_right_cm?: number | null;
  show_page_numbers?: boolean | null;
}

const textOf = (node: JsonNode): string => node.text ?? (node.content ?? []).map(textOf).join("");

/** Belgedeki başlık metinleri (editördeki belge planıyla aynı sıra) */
function headingTexts(nodes: JsonNode[] | undefined, out: string[] = []): string[] {
  for (const node of nodes ?? []) {
    if (node.type === "heading") out.push(textOf(node).trim());
    else if (node.type !== "paragraph") headingTexts(node.content, out);
  }
  return out;
}

export function manuscriptReadiness(input: {
  manuscript: ReadinessManuscript;
  guideline: AppliedGuideline | null;
  projectType: string;
  citationStyle: string;
}): SubmissionChecklist {
  const { manuscript, guideline } = input;
  const doc = (manuscript.content ?? null) as { content?: JsonNode[] } | null;
  const headings = headingTexts(doc?.content);
  const required = guideline?.requiredSections ?? [];
  const missing = required.filter((section) => !headings.some((heading) => headingMatchesSection(heading, section)));
  const issues = checkStructure(doc as never, {
    citationStyle: input.citationStyle,
    abstract: guideline?.settings.abstract,
    paragraphFormat: {
      ...(guideline?.settings.paragraphIndentCm ? { indentCm: guideline.settings.paragraphIndentCm } : {}),
      ...(guideline?.settings.justify ? { justify: true } : {}),
    },
    referenceHangingIndentCm: guideline?.settings.referenceHangingIndentCm,
  });
  const margins = {
    top: manuscript.margin_top_cm ?? 2.5,
    bottom: manuscript.margin_bottom_cm ?? 2.5,
    left: manuscript.margin_left_cm ?? 2.5,
    right: manuscript.margin_right_cm ?? 2.5,
  };
  const pages = estimatePages(manuscript.word_count ?? 0, {
    fontSizePt: guideline?.settings.fontSizePt,
    lineSpacing: guideline?.settings.lineSpacing,
    margins,
  });
  const headingNumbering = manuscript.heading_numbering ?? false;

  return buildSubmissionChecklist({
    isThesis: input.projectType === "thesis",
    hasGuideline: Boolean(guideline),
    sections: { total: required.length, missing },
    pages,
    minPages: guideline?.minPages ?? null,
    maxPages: guideline?.maxPages ?? null,
    issues: {
      danger: issues.filter((issue) => issue.tone === "danger").length,
      warning: issues.filter((issue) => issue.tone === "warning").length,
    },
    cover: {
      enabled: Boolean(manuscript.cover_page),
      missingFields: manuscript.cover_page ? missingCoverFields(manuscript.cover_page) : [],
    },
    includeToc: manuscript.include_toc ?? false,
    headingNumbering: {
      enabled: headingNumbering,
      guidelineRule: guideline?.settings.headingNumbering,
      manualNumbered: headingNumbering ? headings.filter(hasManualNumber).length : 0,
    },
    pageSetup: sayfaDuzeniFarklari({
      margins,
      showPageNumbers: manuscript.show_page_numbers,
      kilavuz: guideline?.settings,
    }),
    // Sunucudaki metin kaydedilmiş hâldir
    saveState: "saved",
  });
}
