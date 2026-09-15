// Word (.docx) → editör HTML'i (sunucuda). mammoth başlık, liste, tablo, kalın/italik,
// bağlantı, dipnot ve resimleri HTML'e çevirir; burada editörün anladığı biçime getirilir:
//   - Türkçe Word stil adları (Başlık 1…3, Resim Yazısı) eşlenir
//   - Word dipnotları editör dipnot işaretine çevrilir (metin işaretin içinde saklanır)
//   - "Şekil 2. …" / "Tablo 1: …" başlıkları otomatik numaralı başlığa dönüşür
//   - Word'ün eski içindekiler / tablolar / şekiller listesi kaldırılır (yenisi Word çıktısında oluşur)
//   - resimler yazarın depo klasörüne yüklenir (yükleyici dışarıdan verilir → test edilebilir)
// Çıkan HTML tarayıcıda Tiptap şemasından geçer: şemada olmayan her şey atılır.

export interface ImportedImage {
  contentType: string;
  data: Buffer;
}

/** Resmi depoya yükleyip editörde kullanılacak bağlantıyı döndürür (başarısızsa null) */
export type ImageUploader = (image: ImportedImage, index: number) => Promise<string | null>;

export interface DocxImportStats {
  headings: number;
  tables: number;
  images: number;
  skippedImages: number;
  footnotes: number;
  captions: number;
  /** Kaldırılan eski içindekiler / tablolar / şekiller listesi satırları */
  tocLines: number;
}

export interface DocxImportResult {
  html: string;
  stats: DocxImportStats;
}

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Konu Başlığı'] => h1:fresh",
  "p[style-name='Başlık 1'] => h1:fresh",
  "p[style-name='Başlık 2'] => h2:fresh",
  "p[style-name='Başlık 3'] => h3:fresh",
  "p[style-name='Caption'] => p.docx-caption:fresh",
  "p[style-name='caption'] => p.docx-caption:fresh",
  "p[style-name='Resim Yazısı'] => p.docx-caption:fresh",
];

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 80;

const CAPTION_TAGS = "strong|em|b|i|u|span";
const CAPTION_PREFIX = new RegExp(
  `^((?:<(?:${CAPTION_TAGS})[^>]*>)*)\\s*(Şekil|Sekil|Figure|Tablo|Table)\\s+\\d+(?:[.\\-]\\d+)*\\s*[.:]\\s*((?:</(?:${CAPTION_TAGS})>)*)`,
  "i"
);

const stripTags = (html: string) => html.replace(/<[^>]+>/g, " ");
const decodeEntities = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
const escapeAttribute = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plain = (html: string) => decodeEntities(stripTags(html)).replace(/\s+/g, " ").trim();

// ---------- Eski içindekiler / tablolar / şekiller listesi ----------
const tocKey = (text: string) =>
  text.toLocaleUpperCase("tr-TR").replace(/[İI]/g, "I").replace(/\s+/g, " ").replace(/[:.]+$/, "").trim();
const TOC_TITLES = new Set(
  [
    "İçindekiler",
    "İçindekiler Tablosu",
    "Tablolar Listesi",
    "Şekiller Listesi",
    "Çizelgeler Listesi",
    "Grafikler Listesi",
    "Resimler Listesi",
    "Contents",
    "Table of Contents",
    "List of Tables",
    "List of Figures",
  ].map(tocKey)
);
// Word'ün içindekiler alanı satırları başlıklardaki _Toc yer imlerine bağlanır.
const TOC_LINK = /^\s*(?:<(?:strong|em|b|i|u|span)[^>]*>\s*)*<a href="#_Toc/i;
// "GİRİŞ ⇥ 1", "YÖNTEM ........ 5", "ÖNSÖZ … iv": metin + sekme/nokta dizisi + sayfa numarası
const PAGE_ENTRY = /^(.{2,200}?)(?:\t+\s*|\s*(?:\.\s*){3,}|\s*…+\s*)(\d{1,4}|[ivxlcdm]{1,8})$/i;
const BLOCK = /<(p|h[1-6])(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;

/**
 * Word'den gelen eski içindekiler, tablolar ve şekiller listesini kaldırır. Temkinli: yalnızca
 * (a) liste başlığının hemen ardından gelen sayfa numaralı satırlar ya da (b) Word'ün _Toc
 * bağlantılı en az iki ardışık satırı silinir; başlıksız sekmeli gövde verisi ("Erkek ⇥ 45"),
 * tek başına duran iç bağlantı ve ardından gerçek metin gelen başlık korunur.
 */
export function removeWordToc(html: string): { html: string; removedLines: number } {
  const blocks = [...html.matchAll(BLOCK)].map((match) => {
    const inner = match[2];
    const text = decodeEntities(inner.replace(/<[^>]+>/g, "")).trim();
    return { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length, inner, text };
  });
  // Aralarında yalnızca boşluk olan bloklar ardışıktır (tablo, liste araya girerse blok biter).
  const adjacent = (a: number, b: number) => html.slice(blocks[a].end, blocks[b].start).trim() === "";
  const isTitle = (i: number) => TOC_TITLES.has(tocKey(blocks[i].text));
  const isLinkEntry = (i: number) => TOC_LINK.test(blocks[i].inner);
  const isEntry = (i: number) => isLinkEntry(i) || PAGE_ENTRY.test(blocks[i].text);
  const isEmpty = (i: number) => blocks[i].text === "";

  const remove: [number, number][] = [];
  let removedLines = 0;
  for (let i = 0; i < blocks.length; i++) {
    const startsWithTitle = isTitle(i);
    if (!startsWithTitle && !isLinkEntry(i)) continue;
    const accepts = startsWithTitle ? isEntry : isLinkEntry;
    let j = startsWithTitle ? i + 1 : i;
    let entries = 0;
    while (j < blocks.length && (j === i || adjacent(j - 1, j)) && (accepts(j) || isEmpty(j))) {
      if (!isEmpty(j)) entries += 1;
      j += 1;
    }
    // Sondaki boş paragraflar blokta kalmasın
    while (j - 1 > i && isEmpty(j - 1)) j -= 1;
    if (entries >= (startsWithTitle ? 1 : 2)) {
      remove.push([blocks[i].start, blocks[j - 1].end]);
      removedLines += entries;
      i = j - 1;
    }
  }
  if (remove.length === 0) return { html, removedLines: 0 };
  let output = "";
  let cursor = 0;
  for (const [from, to] of remove) {
    output += html.slice(cursor, from);
    cursor = to;
  }
  return { html: output + html.slice(cursor), removedLines };
}

export async function convertDocxToEditorHtml(buffer: Buffer, uploadImage: ImageUploader): Promise<DocxImportResult> {
  const mammoth = (await import("mammoth")).default;
  const stats: DocxImportStats = { headings: 0, tables: 0, images: 0, skippedImages: 0, footnotes: 0, captions: 0, tocLines: 0 };

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: STYLE_MAP,
      convertImage: mammoth.images.imgElement(async (image) => {
        if (!IMAGE_TYPES.has(image.contentType) || stats.images >= MAX_IMAGES) {
          stats.skippedImages += 1;
          return { src: "" };
        }
        const data = await image.read();
        if (data.length > MAX_IMAGE_BYTES) {
          stats.skippedImages += 1;
          return { src: "" };
        }
        const src = await uploadImage({ contentType: image.contentType, data }, stats.images);
        if (!src) {
          stats.skippedImages += 1;
          return { src: "" };
        }
        stats.images += 1;
        return { src };
      }),
    }
  );

  let html = result.value;

  // Dipnot/sonnot metinleri: <li id="footnote-1"><p>Metin <a href="#footnote-ref-1">↑</a></p></li>
  const notes = new Map<string, string>();
  html = html.replace(/<li id="((?:foot|end)note-\d+)">([\s\S]*?)<\/li>/g, (_all, id: string, inner: string) => {
    notes.set(id, plain(inner.replace(/<a href="#(?:foot|end)note-ref-\d+">[\s\S]*?<\/a>/g, "")));
    return "";
  });
  html = html.replace(/<ol>\s*<\/ol>/g, "");
  // Metindeki işaretler: <sup><a href="#footnote-1" id="footnote-ref-1">[1]</a></sup>
  html = html.replace(
    /<sup><a href="#((?:foot|end)note-\d+)" id="(?:foot|end)note-ref-\d+">\[\d+\]<\/a><\/sup>/g,
    (_all, id: string) => {
      stats.footnotes += 1;
      return `<sup data-footnote-id="fn-word-${id}-${stats.footnotes}" data-footnote-text="${escapeAttribute(notes.get(id) ?? "")}"></sup>`;
    }
  );

  // Word'ün eski içindekiler / tablolar / şekiller listesi (başlık dönüştürmeden önce: liste
  // satırları "Tablo 1. … ⇥ 6" sahte tablo başlığına dönüşmesin). Yenisi Word çıktısında oluşur.
  const toc = removeWordToc(html);
  html = toc.html;
  stats.tocLines = toc.removedLines;

  // Şekil/tablo başlıkları: Word "Resim Yazısı" stili ya da kısa "Şekil 2. …" satırları.
  html = html.replace(/<p( class="docx-caption")?>([\s\S]*?)<\/p>/g, (all, styled: string | undefined, inner: string) => {
    const text = plain(inner);
    const match = CAPTION_PREFIX.exec(inner);
    if (!match || (!styled && text.length > 250)) return styled ? `<p>${inner}</p>` : all;
    const kind = /^t/i.test(match[2]) ? "table" : "figure";
    stats.captions += 1;
    return `<p data-caption="${kind}">${inner.replace(CAPTION_PREFIX, `${match[1]}${match[3]}`).trim()}</p>`;
  });

  stats.headings = (html.match(/<h[1-6][\s>]/g) ?? []).length;
  stats.tables = (html.match(/<table[\s>]/g) ?? []).length;
  return { html, stats };
}
