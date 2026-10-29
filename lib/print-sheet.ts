import type { CSSProperties } from "react";
import { renderTiptapHtml } from "@/lib/tiptap-html";
import { icindekilerSatirlari, type IcindekilerSatiri } from "@/lib/heading-numbering";
import type { AppliedGuideline } from "@/lib/guideline-rules";
import type { Dil } from "@/lib/dil";
import { kagitOlcusu, type KagitBoyutu } from "@/lib/kagit-boyutu";
import type { CoverPage, PageMargins } from "@/app/actions/manuscript";

// Baskı görünümü (yazdırma sayfası ve danışman paylaşım sayfası aynı çıktıyı kullanır):
// kılavuzun yazı tipi, boyutu, satır aralığı ve metnin kenar boşlukları.
export interface PrintSheetManuscript {
  margins?: PageMargins;
  /** Yoksa A4 (lib/kagit-boyutu.ts). */
  pageSize?: KagitBoyutu;
  showPageNumbers?: boolean;
  coverPage?: CoverPage | null;
  headingNumbering?: boolean;
  /** Sayfa ayarlarındaki "İçindekiler tablosu": Word ile AYNI ayar. */
  includeToc?: boolean;
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
  /*
    İçindekiler (kapaktan sonra). Eskiden PDF çıktısında hiç yoktu; Word'de
    vardı (27.10.2026). Sayfa numarası YOK: tarayıcı baskıda bir başlığın
    hangi sayfaya düştüğünü sayfaya bildirmiyor, tahmini numara yazmak
    tezde yanlış numara demek. Ekranda bunun nedeni söyleniyor.
  */
  toc: IcindekilerSatiri[] | null;
}

const clampCm = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 10 ? number : fallback;
};

export function buildPrintSheet(
  manuscript: PrintSheetManuscript | null,
  guideline: AppliedGuideline | null,
  doc: { content?: unknown[] } | null,
  /** Belgenin dili (şekil/tablo etiketleri; lib/belge-dili.ts) */
  dil: Dil = "tr"
): PrintSheet {
  const { html, footnotes } = renderTiptapHtml(doc as Parameters<typeof renderTiptapHtml>[0], {
    headingNumbering: manuscript?.headingNumbering ?? false,
    chapterNewPage: guideline?.settings.chapterNewPage ?? false,
    // Dipnot sayfa altına inebilsin (sayfalı baskı; app/print/manuscript/sayfali-baski.tsx).
    dipnotSatirIci: true,
    dil,
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
  /* Eskiden `size: A4` sabitti: US Letter seçen öğrencinin PDF'i A4 çıkıyordu. */
  const kagit = kagitOlcusu(manuscript?.pageSize);

  return {
    html,
    footnotes,
    pageRule: `@page { size: ${kagit.css}; margin: ${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm;${
      /* Sayfa numarası Word'deki gibi metnin yazı tipi ve boyutunda (tiptap-docx: Footer). */
      showPageNumbers ? ` @bottom-center { content: counter(page); font-family: '${fontFamily}', 'Times New Roman', serif; font-size: ${fontSize}pt; }` : ""
    } }`,
    style: {
      "--print-font": `'${fontFamily}', 'Times New Roman', serif`,
      "--print-size": `${fontSize}pt`,
      "--print-line": String(lineSpacing),
      "--print-margin-top": `${m.top}cm`,
      "--print-margin-right": `${m.right}cm`,
      "--print-margin-bottom": `${m.bottom}cm`,
      "--print-margin-left": `${m.left}cm`,
      "--print-page-width": `${kagit.genislikCm}cm`,
      "--print-page-height": `${kagit.yukseklikCm}cm`,
    } as CSSProperties,
    chapterCase: guideline?.settings.chapterUppercase ? "upper" : undefined,
    cover: manuscript?.coverPage ?? null,
    hasText: Boolean(manuscript),
    toc: manuscript?.includeToc
      ? icindekilerSatirlari(doc as Parameters<typeof icindekilerSatirlari>[0], manuscript.headingNumbering ?? false)
      : null,
  };
}
