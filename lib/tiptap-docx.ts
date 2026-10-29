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
  Tab,
  PageBreak,
  TableOfContents,
  SequentialIdentifier,
  type ParagraphChild,
} from "docx";
import { captionLabel, isCaptionKind, type CaptionKind } from "@/lib/tiptap-caption";
import { YEREL, type Dil } from "@/lib/dil";
import { headingNumberMap, icindekilerSatirlari } from "@/lib/heading-numbering";
import { chapterBreakSet } from "@/lib/chapter-rules";
import { hangingIndentCmOf, indentCmOf } from "@/lib/paragraph-format";
import { kagitOlcusu, type KagitBoyutu } from "@/lib/kagit-boyutu";

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
  const indentCm = indentCmOf(attrs); // true (eski kayıt) = 1,25 cm; sayı = kılavuzun ölçüsü
  /*
    Asılı girinti Word'de "hanging": sol kenar içeride, ilk satır o
    kadar dışarıda. Editörde negatif text-indent + padding ile kurulan
    biçimin Word karşılığı bu; taşınmazsa kaynakça çıktıda düz görünür.
  */
  const hangingCm = hangingIndentCmOf(attrs);
  const hanging = hangingCm ? convertMillimetersToTwip(hangingCm * 10) : undefined;
  const firstLine = indentCm ? convertMillimetersToTwip(indentCm * 10) : undefined;
  const quoteLeft = quoteDepth > 0 ? convertInchesToTwip(0.4 * quoteDepth) : undefined;
  const left = hanging !== undefined ? (quoteLeft ?? 0) + hanging : quoteLeft;
  if (firstLine === undefined && left === undefined && hanging === undefined) return undefined;
  return { ...(hanging === undefined ? { firstLine } : {}), left, hanging };
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
function buildCoverPageParagraphs(cover: CoverPageData, dil: Dil): Paragraph[] {
  /* Büyük harf belgenin diliyle: "tr-TR" İngilizce bir başlıktaki "i"yi
     "İ" yapar ("THESİS"). */
  const buyuk = (metin: string) => metin.toLocaleUpperCase(YEREL[dil]);
  const blank = () => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("")] });
  const centered = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: xmlTemiz(text), bold: opts.bold ?? false, size: opts.size })],
    });

  const paragraphs: Paragraph[] = [];
  if (cover.university) paragraphs.push(centered(buyuk(cover.university), { bold: true, size: 28 }));
  if (cover.institute) paragraphs.push(centered(buyuk(cover.institute), { bold: true, size: 24 }));
  if (cover.department) paragraphs.push(centered(buyuk(cover.department), { size: 24 }));
  if (cover.program) paragraphs.push(centered(cover.program, { size: 22 }));

  for (let i = 0; i < 6; i++) paragraphs.push(blank());

  paragraphs.push(centered(buyuk(cover.title), { bold: true, size: 30 }));

  for (let i = 0; i < 4; i++) paragraphs.push(blank());

  paragraphs.push(centered(cover.authorName, { bold: true, size: 24 }));
  paragraphs.push(blank());
  paragraphs.push(centered(cover.degreeType, { size: 22 }));

  if (cover.advisorName) {
    paragraphs.push(blank());
    paragraphs.push(blank());
    paragraphs.push(centered(`${dil === "en" ? "Advisor" : "Danışman"}: ${cover.advisorName}`, { size: 22 }));
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
  /** 1'den farklı başlayan numaralı listelerin başlangıçları (her biri ayrı numaralandırma tanımı) */
  numaraBaslangiclari: Set<number>;
  contentWidthTwip: number;
  fetchImage: (url: string) => Promise<DocxImage | null>;
  /** Otomatik başlık numaraları (kapalıysa boş) */
  headingNumbers: Map<object, string>;
  /** Yeni sayfadan başlayacak ana bölüm başlıkları (kural kapalıysa boş; lib/chapter-rules.ts) */
  chapterBreaks: Set<object>;
  /** Şekil/tablo etiketinin dili (belgenin parçası) */
  dil: Dil;
}

interface BlockOptions {
  quoteDepth: number;
  list?: { level: number; ordered: boolean; instance: number; baslangic: number; devam?: boolean };
}

const numaraReferansi = (baslangic: number) => (baslangic === 1 ? "arvolab-numbering" : `arvolab-numbering-${baslangic}`);

/*
  XML 1.0'da yasak denetim karakterleri. PDF'ten yapıştırılan metinde
  (\u0002 tire yerine sık) ve Word'den gelen metinde (\u000B satır sonu)
  bulunuyor; docx kitaplığı ayıklamıyor. Eskiden olduğu gibi yazılıyor ve
  Word dosyayı "okunamayan içerik" diye açmıyordu (29.10.2026).
*/
const XML_YASAK = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
export const xmlTemiz = (metin: string) => metin.replace(XML_YASAK, "");

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
  /*
    fontSize editörde "12pt" gibi saklanır; docx.js yarım punto bekler.
    Yapıştırılan metin "16px" ya da "0.875em" taşıyabiliyor ve eskiden
    parseFloat bunları punto sayıyordu: 16px Word'de 16pt (doğrusu 12pt),
    0.875em 1pt — neredeyse görünmez metin. pt okunur, px 0,75 ile çevrilir,
    öteki birimler yok sayılır (baskı yolu da onları yok sayıyor).
  */
  const boyutHam = String(textStyle.fontSize ?? "").trim();
  const ptEslesme = /^(\d+(?:\.\d+)?)pt$/i.exec(boyutHam);
  const pxEslesme = /^(\d+(?:\.\d+)?)px$/i.exec(boyutHam);
  const fontSize = ptEslesme ? Number(ptEslesme[1]) : pxEslesme ? Number(pxEslesme[1]) * 0.75 : NaN;
  const color = typeof textStyle.color === "string" && /^#[0-9a-f]{6}$/i.test(textStyle.color)
    ? textStyle.color.slice(1)
    : undefined;

  /*
    Sekme karakteri Word'de gerçek sekme (w:tab). Düz metin içinde "\t"
    bırakılırsa Word onu tek bir boşluk gibi çiziyordu (editörde Tab ile
    yazılan sekmeler, 27.10.2026).
  */
  const metin = xmlTemiz(node.text ?? "");
  const parcalar = metin.split("\t");
  const icerik =
    parcalar.length > 1
      ? { children: parcalar.flatMap((parca, i) => (i === 0 ? [parca] : [new Tab(), parca])).filter((p) => p !== "") }
      : { text: metin };
  return new TextRun({
    ...icerik,
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
      const footnoteText = xmlTemiz(String(node.attrs?.text ?? ""));
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
    const label = captionLabel(caption, ctx.dil);
    /* Hizalama editördeki gibi; yalnızca seçilmemişse ortalı. Eskiden hep
       ortalıydı: APA 7'nin istediği sola dayalı başlık Word'de ortalanıyordu. */
    return new Paragraph({
      alignment: align ? ALIGNMENTS[align] : AlignmentType.CENTER,
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
  /*
    Bir madde birden çok paragraf taşıyabilir; numarayı/imi yalnızca İLKİ
    alır, ötekiler maddenin girintisiyle devam eder. Eskiden her paragraf
    ayrı numaralanıyordu: editörde "3. ilk+devam, 4. ikinci" olan liste
    Word'de "1. ilk, 2. devam, 3. ikinci" oluyordu.
  */
  const devam = list?.devam;
  return new Paragraph({
    alignment: align ? ALIGNMENTS[align] : undefined,
    spacing: lineSpacingValue(node.attrs?.lineSpacing),
    indent: list ? (devam ? { left: convertInchesToTwip(0.35 * (list.level + 1)) } : undefined) : indentFromAttrs(node.attrs, opts.quoteDepth),
    bullet: list && !list.ordered && !devam ? { level: list.level } : undefined,
    numbering: list?.ordered && !devam ? { reference: numaraReferansi(list.baslangic), level: list.level, instance: list.instance } : undefined,
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
      // Ana bölüm yeni sayfadan (baskıyla aynı kural: öncesinde içerik varsa).
      const newPage = ctx.chapterBreaks.has(node);
      return [
        new Paragraph({
          heading: HEADING_LEVELS[level],
          pageBreakBefore: newPage || undefined,
          alignment: align ? ALIGNMENTS[align] : undefined,
          spacing: lineSpacingValue(node.attrs?.lineSpacing),
          // Editör ve baskı başlıktaki ilk satır/asılı girintiyi uyguluyor; Word atlıyordu.
          indent: indentFromAttrs(node.attrs, 0),
          children: [...(number ? [new TextRun({ text: `${number} ` })] : []), ...inlineChildren(node.content ?? [], ctx)],
        }),
      ];
    }

    case "paragraph":
      return [paragraphFrom(node, ctx, opts)];

    case "bulletList":
    case "orderedList": {
      const ordered = node.type === "orderedList";
      // Her numaralı liste kendi başından sayar (önceden tüm listeler tek sayaçtan devam ediyordu).
      const instance = ordered ? ctx.nextListInstance++ : 0;
      /* Editördeki "şuradan başla" (start) Word'e de geçer; eskiden yok sayılıyor, liste 1'den başlıyordu. */
      const baslangic = ordered ? Math.max(1, Math.floor(Number(node.attrs?.start) || 1)) : 1;
      if (baslangic !== 1) ctx.numaraBaslangiclari.add(baslangic);
      const level = opts.list ? Math.min(opts.list.level + 1, MAX_LIST_LEVEL) : 0;
      const out: (Paragraph | Table)[] = [];
      for (const item of node.content ?? []) {
        let ilkParagraf = true;
        for (const child of item.content ?? []) {
          if (child.type === "paragraph") {
            out.push(paragraphFrom(child, ctx, { ...opts, list: { level, ordered, instance, baslangic, devam: !ilkParagraf } }));
            ilkParagraf = false;
          } else {
            out.push(...(await blockToDocx(child, ctx, { ...opts, list: { level, ordered, instance, baslangic } })));
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
      /*
        Editörde elle ayarlanan sütun genişlikleri (colwidth, piksel) oranı
        korunarak yazı alanına yayılır; eskiden Word'de bütün sütunlar eşitti.
        İlk satırın her hücresi genişlik taşımıyorsa eşit bölünür.
      */
      const ilkSatir = rowNodes[0]?.content ?? [];
      const pikseller = ilkSatir.flatMap((cell) => {
        const span = Number(cell.attrs?.colspan) || 1;
        const w = Array.isArray(cell.attrs?.colwidth) ? (cell.attrs.colwidth as unknown[]) : [];
        return Array.from({ length: span }, (_, i) => Number(w[i]) || 0);
      });
      const sutunGenislikleri =
        pikseller.length === colCount && pikseller.every((px) => px > 0)
          ? pikseller.map((px) => Math.floor((px / pikseller.reduce((a, b) => a + b, 0)) * ctx.contentWidthTwip))
          : Array.from({ length: colCount }, () => colWidth);
      const rows: TableRow[] = [];
      for (const [rowIndex, row] of rowNodes.entries()) {
        const cells: TableCell[] = [];
        let isHeaderRow = rowIndex === 0;
        for (const cell of row.content ?? []) {
          if (cell.type !== "tableHeader") isHeaderRow = false;
          const span = Number(cell.attrs?.colspan) || 1;
          /* Dikey birleştirme de taşınıyor. Eskiden yalnızca colspan
             okunuyordu: dikey birleştirilmiş bir hücre Word'de tek
             satıra düşüyor, altındaki satırlar bir hücre kayıyordu.
             Editörde doğru görünen tablo çıktıda bozuluyordu. */
          const rowSpan = Number(cell.attrs?.rowspan) || 1;
          /* Başlık hücresi editörde ve baskıda kalın (<th>); Word'de düz çıkıyordu. */
          const icerik = cell.type === "tableHeader" ? kalinlastir(cell.content ?? []) : cell.content ?? [];
          const children = (await convertAll(icerik, { quoteDepth: 0 })).filter(
            (child): child is Paragraph => child instanceof Paragraph
          );
          cells.push(
            new TableCell({
              width: { size: colWidth * span, type: WidthType.DXA },
              columnSpan: span > 1 ? span : undefined,
              rowSpan: rowSpan > 1 ? rowSpan : undefined,
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
          columnWidths: sutunGenislikleri,
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

function kalinlastir(nodes: TiptapNode[]): TiptapNode[] {
  return nodes.map((n) =>
    n.type === "text"
      ? { ...n, marks: [...(n.marks ?? []).filter((m) => m.type !== "bold"), { type: "bold" }] }
      : n.content
        ? { ...n, content: kalinlastir(n.content) }
        : n,
  );
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
  /** Birinci düzey başlıklar büyük harfle (Word "Tümü büyük harf" biçimi; metin değişmez) */
  chapterUppercase?: boolean;
  /** Her birinci düzey başlık yeni sayfadan (ilki hariç: kapak/içindekiler zaten sayfa sonuyla biter) */
  chapterNewPage?: boolean;
}

export interface BuildDocxOptions {
  title: string;
  doc: TiptapDoc;
  fetchImage: ConversionContext["fetchImage"];
  margins?: { top: number; bottom: number; left: number; right: number }; // cm cinsinden
  /** Kâğıt boyutu; yoksa A4. Eskiden A4 sabitti (lib/kagit-boyutu.ts). */
  pageSize?: KagitBoyutu;
  showPageNumbers?: boolean;
  coverPage?: CoverPageData | null;
  textDefaults?: DocxTextDefaults;
  /** Kapaktan sonra içindekiler tablosu (Word, dosya açılınca alanları günceller) */
  includeToc?: boolean;
  /** Başlıkların önüne otomatik numara ("1.", "1.1.") */
  headingNumbering?: boolean;
  /**
   * Belgeye yazılan sabit metinlerin dili: şekil/tablo etiketi, içindekiler
   * ve listelerin başlığı, kapaktaki "Danışman". Verilmezse Türkçe.
   */
  dil?: Dil;
}

export async function buildDocxFromTiptap({
  title,
  doc,
  fetchImage,
  margins,
  pageSize,
  showPageNumbers = true,
  coverPage,
  textDefaults = {},
  includeToc = false,
  headingNumbering = false,
  dil = "tr",
}: BuildDocxOptions): Promise<Document> {
  const en = dil === "en";
  const m = margins ?? { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 };
  const kagit = kagitOlcusu(pageSize);
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
    numaraBaslangiclari: new Set<number>(),
    contentWidthTwip: Math.max(kagit.genislikTwip - marginTwip.left - marginTwip.right, 2000),
    fetchImage,
    headingNumbers: headingNumbering ? headingNumberMap(doc) : new Map(),
    chapterBreaks: textDefaults.chapterNewPage ? chapterBreakSet(doc) : new Set(),
    dil,
  };

  const bodyElements: (Paragraph | Table | TableOfContents)[] = [];
  if (coverPage) {
    bodyElements.push(...buildCoverPageParagraphs(coverPage, dil));
  }
  if (includeToc) {
    bodyElements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: en ? "TABLE OF CONTENTS" : "İÇİNDEKİLER", bold: true })],
      }),
      /*
        Alan ÖNCEDEN DOLU (cachedEntries). Eskiden yalnızca boş bir alan
        yazılıyordu: Word açılışta "alanlar güncellensin mi" diye soruyor,
        hayır denirse ya da belge Google Docs, LibreOffice veya Mac'te
        açılırsa içindekiler BOŞ görünüyordu. Şimdi başlıklar (numaralarıyla)
        alanın içinde hazır; Word güncelleyince sayfa numaralarını ekler.
        Sayfa numarası önceden yazılmıyor: tahmini numara yanlış olurdu.
      */
      new TableOfContents(en ? "Table of Contents" : "İçindekiler", {
        hyperlink: true,
        headingStyleRange: "1-3",
        cachedEntries: icindekilerSatirlari(doc as Parameters<typeof icindekilerSatirlari>[0], headingNumbering).map((s) => ({
          title: s.numara ? `${s.numara} ${s.text}` : s.text,
          level: s.level,
        })),
      }),
      new Paragraph({ children: [new PageBreak()] })
    );
    // Türk tez kılavuzlarındaki sıra: Tablolar Listesi, ardından Şekiller Listesi (varsa).
    const kinds = captionKinds(doc.content ?? []);
    for (const kind of ["table", "figure"] as CaptionKind[]) {
      if (!kinds.has(kind)) continue;
      const label = captionLabel(kind, dil);
      bodyElements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: en ? (kind === "table" ? "LIST OF TABLES" : "LIST OF FIGURES") : kind === "table" ? "TABLOLAR LİSTESİ" : "ŞEKİLLER LİSTESİ",
              bold: true,
            }),
          ],
        }),
        new TableOfContents(en ? `List of ${label.toLowerCase()}s` : `${label} listesi`, { hyperlink: true, captionLabelIncludingNumbers: label }),
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
    title: xmlTemiz(title),
    footnotes: ctx.footnotes,
    ...(includeToc ? { features: { updateFields: true } } : {}),
    styles: {
      default: {
        document: {
          run: { font, size: baseSize },
          /* Varsayılan 1,5: baskı/PDF yolu da 1,5 kullanıyor (lib/print-sheet.ts).
             Eskiden kılavuzsuz belgede Word tek aralıklı, PDF 1,5 aralıklı
             çıkıyordu; sayfa sayıları birbirini tutmuyordu. */
          paragraph: { spacing: { after: 120, ...lineSpacingValue(textDefaults.lineSpacing ?? 1.5) } },
        },
        heading1: {
          run: { ...headingRun, size: baseSize + 4, ...(textDefaults.chapterUppercase ? { allCaps: true } : {}) },
          paragraph: headingParagraph,
        },
        heading2: { run: { ...headingRun, size: baseSize + 2 }, paragraph: headingParagraph },
        heading3: { run: { ...headingRun, size: baseSize }, paragraph: headingParagraph },
        heading4: { run: { ...headingRun, size: baseSize }, paragraph: headingParagraph },
      },
    },
    numbering: {
      config: [1, ...ctx.numaraBaslangiclari].map((baslangic) => ({
        reference: numaraReferansi(baslangic),
        levels: Array.from({ length: MAX_LIST_LEVEL + 1 }, (_, level) => ({
          level,
          format: level % 3 === 1 ? "lowerLetter" : level % 3 === 2 ? "lowerRoman" : "decimal",
          text: `%${level + 1}.`,
          start: baslangic,
          alignment: AlignmentType.START,
          style: {
            paragraph: { indent: { left: convertInchesToTwip(0.35 * (level + 1)), hanging: convertInchesToTwip(0.25) } },
          },
        })),
      })),
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: kagit.genislikTwip, height: kagit.yukseklikTwip },
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
