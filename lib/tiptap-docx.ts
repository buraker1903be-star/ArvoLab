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
  AlignmentType,
  convertInchesToTwip,
  convertMillimetersToTwip,
  Footer,
  PageNumber,
} from "docx";

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

// Editördeki "lineSpacing" değeri (ör. "1.5", "2") docx.js'in
// beklediği "line" birimine (240 = tekli aralık) çevrilir.
function spacingFromAttrs(attrs: Record<string, unknown> | undefined) {
  const lineSpacing = attrs?.lineSpacing as string | undefined;
  if (!lineSpacing) return undefined;
  const multiplier = parseFloat(lineSpacing);
  if (!multiplier || Number.isNaN(multiplier)) return undefined;
  return { line: Math.round(240 * multiplier), lineRule: "auto" as const };
}

function indentFromAttrs(attrs: Record<string, unknown> | undefined) {
  const firstLineIndent = attrs?.firstLineIndent as boolean | undefined;
  if (!firstLineIndent) return undefined;
  return { firstLine: convertMillimetersToTwip(12.5) }; // 1.25 cm — yaygın tez girinti standardı
}

interface ConversionContext {
  footnotes: Record<string, { children: Paragraph[] }>;
  nextFootnoteId: number;
  fetchImage: (url: string) => Promise<{ data: Buffer; width: number; height: number } | null>;
}

function textRunsFromInline(nodes: TiptapNode[], ctx: ConversionContext): (TextRun | FootnoteReferenceRun)[] {
  const runs: (TextRun | FootnoteReferenceRun)[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      const marks = node.marks ?? [];
      const markTypes = marks.map((m) => m.type);
      const textStyleMark = marks.find((m) => m.type === "textStyle");
      const fontFamily = textStyleMark?.attrs?.fontFamily as string | undefined;
      const fontSizeRaw = textStyleMark?.attrs?.fontSize as string | undefined;
      // fontSize editörde "12pt" gibi saklanır; docx.js yarım punto (half-point) bekler.
      const fontSizeHalfPoints = fontSizeRaw
        ? Math.round(parseFloat(fontSizeRaw) * 2)
        : undefined;

      runs.push(
        new TextRun({
          text: node.text ?? "",
          bold: markTypes.includes("bold"),
          italics: markTypes.includes("italic"),
          underline: markTypes.includes("underline") ? {} : undefined,
          font: fontFamily || undefined,
          size: fontSizeHalfPoints,
        })
      );
    } else if (node.type === "footnoteReference") {
      const id = ctx.nextFootnoteId++;
      const footnoteText = (node.attrs?.text as string) || "";
      ctx.footnotes[String(id)] = {
        children: [new Paragraph({ children: [new TextRun(footnoteText)] })],
      };
      runs.push(new FootnoteReferenceRun(id));
    } else if (node.content) {
      runs.push(...textRunsFromInline(node.content, ctx));
    }
  }
  return runs;
}

async function blockNodeToDocxElements(
  node: TiptapNode,
  ctx: ConversionContext
): Promise<(Paragraph | Table)[]> {
  switch (node.type) {
    case "heading": {
      const level = Math.min(((node.attrs?.level as number) ?? 1) - 1, HEADING_LEVELS.length - 1);
      return [
        new Paragraph({
          heading: HEADING_LEVELS[Math.max(0, level)],
          spacing: spacingFromAttrs(node.attrs),
          children: textRunsFromInline(node.content ?? [], ctx),
        }),
      ];
    }

    case "paragraph": {
      const align = (node.attrs?.textAlign as string) || "left";
      const alignmentMap: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
        left: AlignmentType.LEFT,
        center: AlignmentType.CENTER,
        right: AlignmentType.RIGHT,
        justify: AlignmentType.JUSTIFIED,
      };
      return [
        new Paragraph({
          alignment: alignmentMap[align] ?? AlignmentType.LEFT,
          spacing: spacingFromAttrs(node.attrs),
          indent: indentFromAttrs(node.attrs),
          children: textRunsFromInline(node.content ?? [], ctx),
        }),
      ];
    }

    case "bulletList":
    case "orderedList": {
      const items: Paragraph[] = [];
      for (const item of node.content ?? []) {
        const itemParagraphs = item.content ?? [];
        for (const p of itemParagraphs) {
          items.push(
            new Paragraph({
              bullet: node.type === "bulletList" ? { level: 0 } : undefined,
              numbering: node.type === "orderedList" ? { reference: "default-numbering", level: 0 } : undefined,
              children: textRunsFromInline(p.content ?? [], ctx),
            })
          );
        }
      }
      return items;
    }

    case "blockquote": {
      const paragraphs: Paragraph[] = [];
      for (const child of node.content ?? []) {
        paragraphs.push(
          new Paragraph({
            indent: { left: convertInchesToTwip(0.4) },
            children: textRunsFromInline(child.content ?? [], ctx),
          })
        );
      }
      return paragraphs;
    }

    case "table": {
      const rows: TableRow[] = [];
      for (const row of node.content ?? []) {
        const cells: TableCell[] = [];
        for (const cell of row.content ?? []) {
          const cellParagraphs: Paragraph[] = [];
          for (const child of cell.content ?? []) {
            cellParagraphs.push(new Paragraph({ children: textRunsFromInline(child.content ?? [], ctx) }));
          }
          cells.push(
            new TableCell({
              width: { size: 2000, type: WidthType.DXA },
              children: cellParagraphs.length > 0 ? cellParagraphs : [new Paragraph({ children: [] })],
            })
          );
        }
        rows.push(new TableRow({ children: cells }));
      }
      const colCount = rows[0]?.CellCount ?? 1;
      return [
        new Table({
          rows,
          columnWidths: Array.from({ length: colCount }, () => 2000),
          width: { size: colCount * 2000, type: WidthType.DXA },
        }),
      ];
    }

    case "image": {
      const src = (node.attrs?.src as string) || "";
      const img = await ctx.fetchImage(src);
      if (!img) return [];
      // En-boy oranını koruyarak makul bir genişliğe (450px) ölçekle
      const maxWidth = 450;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      return [
        new Paragraph({
          children: [
            new ImageRun({
              data: img.data,
              transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
              type: "png",
            }),
          ],
        }),
      ];
    }

    default:
      return [];
  }
}

export interface BuildDocxOptions {
  title: string;
  doc: TiptapDoc;
  fetchImage: ConversionContext["fetchImage"];
  margins?: { top: number; bottom: number; left: number; right: number }; // cm cinsinden
  showPageNumbers?: boolean;
}

export async function buildDocxFromTiptap({
  title,
  doc,
  fetchImage,
  margins,
  showPageNumbers = true,
}: BuildDocxOptions): Promise<Document> {
  const ctx: ConversionContext = { footnotes: {}, nextFootnoteId: 1, fetchImage };

  const bodyElements: (Paragraph | Table)[] = [];
  for (const node of doc.content ?? []) {
    const elements = await blockNodeToDocxElements(node, ctx);
    bodyElements.push(...elements);
  }

  const m = margins ?? { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 };

  return new Document({
    title,
    footnotes: ctx.footnotes,
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: {
              top: convertMillimetersToTwip(m.top * 10),
              bottom: convertMillimetersToTwip(m.bottom * 10),
              left: convertMillimetersToTwip(m.left * 10),
              right: convertMillimetersToTwip(m.right * 10),
            },
          },
        },
        footers: showPageNumbers
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ children: [PageNumber.CURRENT] }),
                    ],
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
