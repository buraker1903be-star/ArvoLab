import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  FootnoteReferenceRun,
  ExternalHyperlink,
  AlignmentType,
  convertInchesToTwip,
  convertMillimetersToTwip,
  Footer,
  PageNumber,
  PageBreak,
  TableOfContents,
  SequentialIdentifier,
  type ParagraphChild,
} from "docx";
import { CAPTION_LABELS, isCaptionKind, type CaptionKind } from "@/lib/tiptap-caption";
import { headingNumberMap } from "@/lib/heading-numbering";

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  attrs?: Record<string, unknown>;
}

interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
];

const ALIGNMENTS: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;
const TWIP_PER_PIXEL = 15; // 96 dpi
const MAX_LIST_LEVEL = 8;

// Editördeki "lineSpacing" değeri (ör. "1.5", "2") docx.js'in
// beklediği "line" birimine (240 = tekli aralık) çevrilir.
function lineSpacingValue(value: unknown) {
  const multiplier = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!multiplier || Number.isNaN(multiplier)) return undefined;
  return { line: Math.round(240 * multiplier), lineRule: "auto" as const };
}

function indentFromAttrs(attrs: Record<string, unknown> | undefined, quoteDepth: number) {
  const firstLine = attrs?.firstLineIndent ? convertMillimetersToTwip(12.5) : undefined; // 1.25 cm — yaygın tez girinti standardı
  const left = quoteDepth > 0 ? convertInchesToTwip(0.4 * quoteDepth) : undefined;
  if (firstLine === undefined && left === undefined) return undefined;
  return { firstLine, left };
}

export interface CoverPageData {
  university: string;
  institute: string;
  department: string;
  program: string;
  degreeType: string;
  title: string;
  authorName: string;
  advisorName: string;
  city: string;
  year: string;
}

// Türkiye'deki tez yazım kılavuzlarında standart kabul edilen kapak
// sayfası düzeni (üstte kurum bilgileri, ortada başlık, altta
// yazar/danışman/şehir-yıl). Kurumdan kuruma küçük farklar olabilir;
// bu makul bir varsayılan düzendir, kullanıcı alanları kendi
// doldurur.
function buildCoverPageParagraphs(cover: CoverPageData): Paragraph[] {
  const blank = () => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("")] });
  const centered = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: opts.bold ?? false, size: opts.size })],
    });

  const paragraphs: Paragraph[] = [];
  if (cover.university) paragraphs.push(centered(cover.university.toLocaleUpperCase("tr-TR"), { bold: true, size: 28 }));
  if (cover.institute) paragraphs.push(centered(cover.institute.toLocaleUpperCase("tr-TR"), { bold: true, size: 24 }));
  if (cover.department) paragraphs.push(centered(cover.department.toLocaleUpperCase("tr-TR"), { size: 24 }));
  if (cover.program) paragraphs.push(centered(cover.program, { size: 22 }));

  for (let i = 0; i < 6; i++) paragraphs.push(blank());

  paragraphs.push(centered(cover.title.toLocaleUpperCase("tr-TR"), { bold: true, size: 30 }));

  for (let i = 0; i < 4; i++) paragraphs.push(blank());

  paragraphs.push(centered(cover.authorName, { bold: true, size: 24 }));
  paragraphs.push(blank());
  paragraphs.push(centered(cover.degreeType, { size: 22 }));

  if (cover.advisorName) {
    paragraphs.push(blank());
    paragraphs.push(blank());
    paragraphs.push(centered(`Danışman: ${cover.advisorName}`, { size: 22 }));
  }

  for (let i = 0; i < 4; i++) paragraphs.push(blank());

  const cityYear = [cover.city, cover.year].filter(Boolean).join(", ");
  if (cityYear) {
    paragraphs.push(centered(cityYear, { bold: true, size: 22 }));
  }

  // Kapak sayfasından sonra yeni sayfaya geç
  paragraphs.push(new Paragraph({ children: [new PageBreak()] }));

  return paragraphs;
}

export interface DocxImage {
  data: Buffer;
  width: number;
  height: number;
  type: "png" | "jpg" | "gif";
}

interface ConversionContext {
  footnotes: Record<string, { children: Paragraph[] }>;
  nextFootnoteId: number;
  nextListInstance: number;
  contentWidthTwip: number;
  fetchImage: (url: string) => Promise<DocxImage | null>;
  /** Otomatik başlık numaraları (kapalıysa boş) */
  headingNumbers: Map<object, string>;
}

interface BlockOptions {
  quoteDepth: number;
  list?: { level: number; ordered: boolean; instance: number };
}

// Yalnızca güvenli bağlantı türleri Word'e köprü olarak aktarılır.
function safeHref(marks: TiptapMark[]) {
  const href = marks.find((m) => m.type === "link")?.attrs?.href;
  if (typeof href !== "string") return null;
  return /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : null;
}

function textRun(node: TiptapNode, isLink: boolean) {
  const marks = node.marks ?? [];
  const has = (type: string) => marks.some((m) => m.type === type);
  const textStyle = marks.find((m) => m.type === "textStyle")?.attrs ?? {};
  const fontFamily = textStyle.fontFamily as string | undefined;
  // fontSize editörde "12pt" gibi saklanır; docx.js yarım punto (half-point) bekler.
  const fontSize = parseFloat(String(textStyle.fontSize ?? ""));
  const color = typeof textStyle.color === "string" && /^#[0-9a-f]{6}$/i.test(textStyle.color)
    ? textStyle.color.slice(1)
    : undefined;

  return new TextRun({
    text: node.text ?? "",
    bold: has("bold"),
    italics: has("italic"),
    underline: has("underline") ? {} : undefined,
    strike: has("strike"),
    superScript: has("superscript"),
    subScript: has("subscript"),
    font: has("code") ? "Courier New" : fontFamily || undefined,
    size: Number.isFinite(fontSize) && fontSize > 0 ? Math.round(fontSize * 2) : undefined,
    color,
    style: isLink ? "Hyperlink" : undefined,
  });
}

function inlineChildren(nodes: TiptapNode[], ctx: ConversionContext): ParagraphChild[] {
  const children: ParagraphChild[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      const href = safeHref(node.marks ?? []);
      const run = textRun(node, Boolean(href));
      children.push(href ? new ExternalHyperlink({ link: href, children: [run] }) : run);
    } else if (node.type === "hardBreak") {
      children.push(new TextRun({ break: 1 }));
    } else if (node.type === "footnoteReference") {
      // Numara belge sırasından gelir (editördeki gibi); Word kendisi numaralar.
      const id = ctx.nextFootnoteId++;
      const footnoteText = String(node.attrs?.text ?? "");
      ctx.footnotes[String(id)] = {
        children: [new Paragraph({ children: [new TextRun({ text: footnoteText, size: 20 })] })],
      };
      children.push(new FootnoteReferenceRun(id));
    } else if (node.content) {
      children.push(...inlineChildren(node.content, ctx));
    }
  }
  return children;
}

function paragraphFrom(node: TiptapNode, ctx: ConversionContext, opts: BlockOptions) {
  const align = node.attrs?.textAlign as string | undefined;
  const list = opts.list;
  const caption = node.attrs?.caption;
  if (!list && isCaptionKind(caption)) {
    // "Şekil 3. …" — numara Word'ün SEQ alanıdır; şekil/tablo listeleri bu alanlardan oluşur.
    const label = CAPTION_LABELS[caption];
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: caption === "table",
      spacing: lineSpacingValue(node.attrs?.lineSpacing),
      children: [
        new TextRun({ text: `${label} `, bold: true }),
        new SequentialIdentifier(label),
        new TextRun({ text: ". ", bold: true }),
        ...inlineChildren(node.content ?? [], ctx),
      ],
    });
  }
  return new Paragraph({
    alignment: align ? ALIGNMENTS[align] : undefined,
    spacing: lineSpacingValue(node.attrs?.lineSpacing),
    indent: list ? undefined : indentFromAttrs(node.attrs, opts.quoteDepth),
    bullet: list && !list.ordered ? { level: list.level } : undefined,
    numbering: list?.ordered ? { reference: "arvolab-numbering", level: list.level, instance: list.instance } : undefined,
    children: inlineChildren(node.content ?? [], ctx),
  });
}

async function blockToDocx(node: TiptapNode, ctx: ConversionContext, opts: BlockOptions): Promise<(Paragraph | Table)[]> {
  const convertAll = async (nodes: TiptapNode[], childOpts: BlockOptions) => {
    const out: (Paragraph | Table)[] = [];
    for (const child of nodes) out.push(...(await blockToDocx(child, ctx, childOpts)));
    return out;
  };

  switch (node.type) {
    case "heading": {
      const level = Math.min(Math.max(((node.attrs?.level as number) ?? 1) - 1, 0), HEADING_LEVELS.length - 1);
      const align = node.attrs?.textAlign as string | undefined;
      // Numara başlık metninin parçası olarak yazılır: Word'ün içindekiler tablosunda da görünür.
      const number = ctx.headingNumbers.get(node);
      return [
        new Paragraph({
          heading: HEADING_LEVELS[level],
          alignment: align ? ALIGNMENTS[align] : undefined,
          spacing: lineSpacingValue(node.attrs?.lineSpacing),
          children: [...(number ? [new TextRun({ text: `${number} ` })] : []), ...inlineChildren(node.content ?? [], ctx)],
        }),
      ];
    }

    case "paragraph":
      return [paragraphFrom(node, ctx, opts)];

    case "bulletList":
    case "orderedList": {
      const ordered = node.type === "orderedList";
      // Her numaralı liste 1'den başlar (önceden tüm listeler tek sayaçtan devam ediyordu).
      const instance = ordered ? ctx.nextListInstance++ : 0;
      const level = opts.list ? Math.min(opts.list.level + 1, MAX_LIST_LEVEL) : 0;
      const out: (Paragraph | Table)[] = [];
      for (const item of node.content ?? []) {
        for (const child of item.content ?? []) {
          if (child.type === "paragraph") {
            out.push(paragraphFrom(child, ctx, { ...opts, list: { level, ordered, instance } }));
          } else {
            out.push(...(await blockToDocx(child, ctx, { ...opts, list: { level, ordered, instance } })));
          }
        }
      }
      return out;
    }

    case "blockquote":
      return convertAll(node.content ?? [], { ...opts, quoteDepth: opts.quoteDepth + 1 });

    case "codeBlock": {
      const text = (node.content ?? []).map((child) => child.text ?? "").join("");
      return text.split("\n").map(
        (line) => new Paragraph({ children: [new TextRun({ text: line, font: "Courier New", size: 20 })] })
      );
    }

    case "horizontalRule":
      return [new Paragraph({ thematicBreak: true, children: [] })];

    case "table": {
      const rowNodes = node.content ?? [];
      const colCount = Math.max(
        1,
        ...rowNodes.map((row) =>
          (row.content ?? []).reduce((sum, cell) => sum + (Number(cell.attrs?.colspan) || 1), 0)
        )
      );
      const colWidth = Math.floor(ctx.contentWidthTwip / colCount);
      const rows: TableRow[] = [];
      for (const [rowIndex, row] of rowNodes.entries()) {
        const cells: TableCell[] = [];
        let isHeaderRow = rowIndex === 0;
        for (const cell of row.content ?? []) {
          if (cell.type !== "tableHeader") isHeaderRow = false;
          const span = Number(cell.attrs?.colspan) || 1;
          const children = (await convertAll(cell.content ?? [], { quoteDepth: 0 })).filter(
            (child): child is Paragraph => child instanceof Paragraph
          );
          cells.push(
            new TableCell({
              width: { size: colWidth * span, type: WidthType.DXA },
              columnSpan: span > 1 ? span : undefined,
              children: children.length > 0 ? children : [new Paragraph({ children: [] })],
            })
          );
        }
        rows.push(new TableRow({ children: cells, tableHeader: isHeaderRow }));
      }
      if (rows.length === 0) return [];
      return [
        new Table({
          rows,
          columnWidths: Array.from({ length: colCount }, () => colWidth),
          width: { size: colWidth * colCount, type: WidthType.DXA },
        }),
      ];
    }

    case "image": {
      const src = String(node.attrs?.src ?? "");
      const img = await ctx.fetchImage(src);
      if (!img || !img.width || !img.height) return [];
      // En-boy oranı korunur, sayfa yazı alanını aşmaz.
      const maxWidth = Math.floor(ctx.contentWidthTwip / TWIP_PER_PIXEL);
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: img.data,
              transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
              type: img.type,
            }),
          ],
        }),
      ];
    }

    default:
      // Bilinmeyen kapsayıcılar içeriğini kaybetmesin
      return node.content ? convertAll(node.content, opts) : [];
  }
}

function captionKinds(nodes: TiptapNode[], found = new Set<CaptionKind>()): Set<CaptionKind> {
  for (const node of nodes) {
    if (node.type === "paragraph" && isCaptionKind(node.attrs?.caption)) found.add(node.attrs.caption);
    if (node.content) captionKinds(node.content, found);
  }
  return found;
}

/** Kılavuzdan gelen gövde metni varsayılanları (editördeki görünümle aynı) */
export interface DocxTextDefaults {
  fontFamily?: string;
  fontSizePt?: number;
  lineSpacing?: number;
}

export interface BuildDocxOptions {
  title: string;
  doc: TiptapDoc;
  fetchImage: ConversionContext["fetchImage"];
  margins?: { top: number; bottom: number; left: number; right: number }; // cm cinsinden
  showPageNumbers?: boolean;
  coverPage?: CoverPageData | null;
  textDefaults?: DocxTextDefaults;
  /** Kapaktan sonra içindekiler tablosu (Word, dosya açılınca alanları günceller) */
  includeToc?: boolean;
  /** Başlıkların önüne otomatik numara ("1.", "1.1.") */
  headingNumbering?: boolean;
}

export async function buildDocxFromTiptap({
  title,
  doc,
  fetchImage,
  margins,
  showPageNumbers = true,
  coverPage,
  textDefaults = {},
  includeToc = false,
  headingNumbering = false,
}: BuildDocxOptions): Promise<Document> {
  const m = margins ?? { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 };
  const marginTwip = {
    top: convertMillimetersToTwip(m.top * 10),
    bottom: convertMillimetersToTwip(m.bottom * 10),
    left: convertMillimetersToTwip(m.left * 10),
    right: convertMillimetersToTwip(m.right * 10),
  };
  const ctx: ConversionContext = {
    footnotes: {},
    nextFootnoteId: 1,
    nextListInstance: 1,
    contentWidthTwip: Math.max(A4_WIDTH_TWIP - marginTwip.left - marginTwip.right, 2000),
    fetchImage,
    headingNumbers: headingNumbering ? headingNumberMap(doc) : new Map(),
  };

  const bodyElements: (Paragraph | Table | TableOfContents)[] = [];
  if (coverPage) {
    bodyElements.push(...buildCoverPageParagraphs(coverPage));
  }
  if (includeToc) {
    bodyElements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: "İÇİNDEKİLER", bold: true })],
      }),
      new TableOfContents("İçindekiler", { hyperlink: true, headingStyleRange: "1-3" }),
      new Paragraph({ children: [new PageBreak()] })
    );
    // Türk tez kılavuzlarındaki sıra: Tablolar Listesi, ardından Şekiller Listesi (varsa).
    const kinds = captionKinds(doc.content ?? []);
    for (const kind of ["table", "figure"] as CaptionKind[]) {
      if (!kinds.has(kind)) continue;
      const label = CAPTION_LABELS[kind];
      bodyElements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new TextRun({ text: kind === "table" ? "TABLOLAR LİSTESİ" : "ŞEKİLLER LİSTESİ", bold: true })],
        }),
        new TableOfContents(`${label} listesi`, { hyperlink: true, captionLabelIncludingNumbers: label }),
        new Paragraph({ children: [new PageBreak()] })
      );
    }
  }
  for (const node of doc.content ?? []) {
    bodyElements.push(...(await blockToDocx(node, ctx, { quoteDepth: 0 })));
  }

  const font = textDefaults.fontFamily ?? "Times New Roman";
  const baseSize = Math.round((textDefaults.fontSizePt ?? 12) * 2);
  const headingRun = { font, bold: true, italics: false, color: "000000" };
  const headingParagraph = { spacing: { before: 240, after: 120 }, keepNext: true };

  return new Document({
    title,
    footnotes: ctx.footnotes,
    ...(includeToc ? { features: { updateFields: true } } : {}),
    styles: {
      default: {
        document: {
          run: { font, size: baseSize },
          paragraph: { spacing: { after: 120, ...lineSpacingValue(textDefaults.lineSpacing) } },
        },
        heading1: { run: { ...headingRun, size: baseSize + 4 }, paragraph: headingParagraph },
        heading2: { run: { ...headingRun, size: baseSize + 2 }, paragraph: headingParagraph },
        heading3: { run: { ...headingRun, size: baseSize }, paragraph: headingParagraph },
        heading4: { run: { ...headingRun, size: baseSize }, paragraph: headingParagraph },
      },
    },
    numbering: {
      config: [
        {
          reference: "arvolab-numbering",
          levels: Array.from({ length: MAX_LIST_LEVEL + 1 }, (_, level) => ({
            level,
            format: level % 3 === 1 ? "lowerLetter" : level % 3 === 2 ? "lowerRoman" : "decimal",
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: {
              paragraph: { indent: { left: convertInchesToTwip(0.35 * (level + 1)), hanging: convertInchesToTwip(0.25) } },
            },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIP, height: A4_HEIGHT_TWIP },
            margin: marginTwip,
          },
        },
        footers: showPageNumbers
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ children: [PageNumber.CURRENT] })],
                  }),
                ],
              }),
            }
          : undefined,
        children: bodyElements.length > 0 ? bodyElements : [new Paragraph({ children: [] })],
      },
    ],
  });
}
