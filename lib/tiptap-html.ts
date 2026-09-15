// Tiptap JSON → güvenli HTML (yazdırma/PDF sayfası için, sunucuda).
// Ham HTML hiç geçirilmez: metin kaçışlanır; yazı tipi, boyut, renk, hizalama,
// bağlantı ve resim kaynakları izin listesinden geçer. Dipnotlar sırayla
// numaralanır ve belgenin sonunda listelenir.
import { headingNumberMap } from "@/lib/heading-numbering";
import { chapterBreakSet } from "@/lib/chapter-rules";

interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface Node {
  type?: string;
  text?: string;
  content?: Node[];
  marks?: Mark[];
  attrs?: Record<string, unknown>;
}

const SAFE_FONTS = new Set([
  "Times New Roman", "Arial", "Calibri", "Cambria", "Garamond", "Georgia", "Verdana", "Book Antiqua",
]);
const ALIGNMENTS = new Set(["left", "center", "right", "justify"]);

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

const safeHref = (value: unknown) =>
  typeof value === "string" && /^(https?:|mailto:)/i.test(value.trim()) ? value.trim() : null;

const safeImageSrc = (value: unknown) =>
  typeof value === "string" && (/^https:\/\//i.test(value) || /^data:image\/(png|jpeg|gif);base64,[a-z0-9+/=]+$/i.test(value))
    ? value
    : null;

function textStyle(attrs: Record<string, unknown> = {}) {
  const styles: string[] = [];
  if (typeof attrs.fontFamily === "string" && SAFE_FONTS.has(attrs.fontFamily)) styles.push(`font-family:'${attrs.fontFamily}'`);
  if (typeof attrs.fontSize === "string" && /^\d{1,2}(\.\d)?pt$/.test(attrs.fontSize)) styles.push(`font-size:${attrs.fontSize}`);
  if (typeof attrs.color === "string" && /^#[0-9a-f]{6}$/i.test(attrs.color)) styles.push(`color:${attrs.color}`);
  return styles.join(";");
}

function blockStyle(attrs: Record<string, unknown> = {}) {
  const styles: string[] = [];
  if (typeof attrs.textAlign === "string" && ALIGNMENTS.has(attrs.textAlign)) styles.push(`text-align:${attrs.textAlign}`);
  const spacing = Number(attrs.lineSpacing);
  if (Number.isFinite(spacing) && spacing >= 1 && spacing <= 3) styles.push(`line-height:${spacing}`);
  if (attrs.firstLineIndent) styles.push("text-indent:1.25cm");
  return styles.length ? ` style="${styles.join(";")}"` : "";
}

interface RenderContext {
  footnotes: string[];
  captions: { figure: number; table: number };
  /** Otomatik başlık numaraları (kapalıysa boş) */
  headingNumbers: Map<object, string>;
  /** Yeni sayfadan başlayacak ana bölüm başlıkları (kural kapalıysa boş) */
  chapterBreaks: Set<object>;
}

const CAPTION_LABELS = { figure: "Şekil", table: "Tablo" } as const;

function renderText(node: Node): string {
  let html = escapeHtml(node.text ?? "");
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "underline":
        html = `<u>${html}</u>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "superscript":
        html = `<sup>${html}</sup>`;
        break;
      case "subscript":
        html = `<sub>${html}</sub>`;
        break;
      case "code":
        html = `<code>${html}</code>`;
        break;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`;
        break;
      }
      case "textStyle": {
        const style = textStyle(mark.attrs);
        if (style) html = `<span style="${style}">${html}</span>`;
        break;
      }
    }
  }
  return html;
}

function renderNodes(nodes: Node[] | undefined, ctx: RenderContext): string {
  return (nodes ?? []).map((node) => renderNode(node, ctx)).join("");
}

function renderNode(node: Node, ctx: RenderContext): string {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case "text":
      return renderText(node);
    case "hardBreak":
      return "<br>";
    case "footnoteReference":
      ctx.footnotes.push(String(attrs.text ?? ""));
      return `<sup class="print-fn">${ctx.footnotes.length}</sup>`;
    case "paragraph": {
      if (attrs.caption === "figure" || attrs.caption === "table") {
        const number = ++ctx.captions[attrs.caption];
        return `<p class="print-caption"${blockStyle(attrs)}><strong>${CAPTION_LABELS[attrs.caption]} ${number}.</strong> ${renderNodes(node.content, ctx)}</p>`;
      }
      return `<p${blockStyle(attrs)}>${renderNodes(node.content, ctx) || "&nbsp;"}</p>`;
    }
    case "heading": {
      const level = Math.min(Math.max(Number(attrs.level) || 1, 1), 4);
      const number = ctx.headingNumbers.get(node);
      const newPage = ctx.chapterBreaks.has(node) ? ' class="print-new-page"' : "";
      return `<h${level}${newPage}${blockStyle(attrs)}>${number ? `${escapeHtml(number)} ` : ""}${renderNodes(node.content, ctx)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${renderNodes(node.content, ctx)}</ul>`;
    case "orderedList": {
      const start = Number(attrs.start);
      return `<ol${Number.isInteger(start) && start > 1 ? ` start="${start}"` : ""}>${renderNodes(node.content, ctx)}</ol>`;
    }
    case "listItem":
      return `<li>${renderNodes(node.content, ctx)}</li>`;
    case "blockquote":
      return `<blockquote>${renderNodes(node.content, ctx)}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${escapeHtml((node.content ?? []).map((child) => child.text ?? "").join(""))}</code></pre>`;
    case "horizontalRule":
      return "<hr>";
    case "image": {
      const src = safeImageSrc(attrs.src);
      return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(String(attrs.alt ?? ""))}">` : "";
    }
    case "table":
      return `<table><tbody>${renderNodes(node.content, ctx)}</tbody></table>`;
    case "tableRow":
      return `<tr>${renderNodes(node.content, ctx)}</tr>`;
    case "tableCell":
    case "tableHeader": {
      const tag = node.type === "tableHeader" ? "th" : "td";
      const colspan = Number(attrs.colspan);
      const rowspan = Number(attrs.rowspan);
      const spans = `${colspan > 1 ? ` colspan="${colspan}"` : ""}${rowspan > 1 ? ` rowspan="${rowspan}"` : ""}`;
      return `<${tag}${spans}>${renderNodes(node.content, ctx)}</${tag}>`;
    }
    default:
      return renderNodes(node.content, ctx);
  }
}

export function renderTiptapHtml(
  doc: { content?: Node[] } | null | undefined,
  options: { headingNumbering?: boolean; chapterNewPage?: boolean } = {}
): { html: string; footnotes: string[] } {
  const ctx: RenderContext = {
    footnotes: [],
    captions: { figure: 0, table: 0 },
    headingNumbers: options.headingNumbering ? headingNumberMap(doc) : new Map(),
    chapterBreaks: options.chapterNewPage ? chapterBreakSet(doc) : new Set(),
  };
  return { html: renderNodes(doc?.content, ctx), footnotes: ctx.footnotes };
}
