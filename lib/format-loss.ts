// Eski kayıt hatasının izi ve tekrarına karşı koruma.
//
// Geçmişte editör içeriği sunucuya gönderilirken ProseMirror'ın prototipsiz öznitelik
// nesneleri React'in sunucu eylemi kodlayıcısında "geçici referans"a dönüşüyor ve
// kaydedilen metinden tüm öznitelikler (başlık düzeyi, resim adresi, dipnot metni,
// hizalama, şekil/tablo başlığı…) düşüyordu. Düzgün kaydedilmiş belgede bu düğümlerin
// her zaman "attrs" alanı vardır; yoksa belge o hatayla kaydedilmiştir.

interface DocMark {
  type?: string;
  attrs?: unknown;
}

interface DocNode {
  type?: string;
  attrs?: unknown;
  content?: DocNode[];
  marks?: DocMark[];
}

/** Düzgün kayıtta her zaman öznitelik taşıyan düğümler */
const ATTRIBUTE_NODES = new Set(["heading", "paragraph", "image", "footnoteReference", "tableCell", "tableHeader", "orderedList"]);

export interface FormatLossReport {
  affected: boolean;
  /** Özniteliği düşmüş düğüm sayısı (başlık düzeyi, hizalama, şekil/tablo başlığı…) */
  nodesWithoutAttrs: number;
  /** Adresi olmayan (görüntülenemeyen) resimler */
  missingImages: number;
  /** Metni boş dipnotlar */
  emptyFootnotes: number;
}

export function detectFormatLoss(doc: { content?: DocNode[] } | null | undefined): FormatLossReport {
  const report: FormatLossReport = { affected: false, nodesWithoutAttrs: 0, missingImages: 0, emptyFootnotes: 0 };
  const walk = (nodes: DocNode[] | undefined) => {
    for (const node of nodes ?? []) {
      const attrs = (node.attrs ?? {}) as Record<string, unknown>;
      if (node.type && ATTRIBUTE_NODES.has(node.type) && !("attrs" in node)) report.nodesWithoutAttrs += 1;
      if (node.type === "image" && !(typeof attrs.src === "string" && attrs.src)) report.missingImages += 1;
      if (node.type === "footnoteReference" && !(typeof attrs.text === "string" && attrs.text.trim())) report.emptyFootnotes += 1;
      walk(node.content);
    }
  };
  walk(doc?.content);
  report.affected = report.nodesWithoutAttrs > 0 || report.missingImages > 0 || report.emptyFootnotes > 0;
  return report;
}

const isPlainObject = (value: unknown): boolean => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Sunucuya ulaşan içerikte düz nesne olmayan öznitelik (ör. kodlanamayıp geçici
 * referansa dönüşmüş değer) var mı? Varsa kayıt yapılmaz: biçim bilgisi sessizce
 * kaybolmasın, kullanıcı hata görsün ve taslak tarayıcıda kalsın.
 */
export function hasNonPlainAttributes(doc: unknown): boolean {
  const badAttrs = (holder: { attrs?: unknown }) => "attrs" in holder && holder.attrs !== undefined && !isPlainObject(holder.attrs);
  const walk = (nodes: unknown): boolean => {
    if (!Array.isArray(nodes)) return false;
    for (const node of nodes as DocNode[]) {
      if (!node || typeof node !== "object") return true;
      if (badAttrs(node)) return true;
      for (const mark of node.marks ?? []) if (!mark || typeof mark !== "object" || badAttrs(mark)) return true;
      if (walk(node.content)) return true;
    }
    return false;
  };
  /*
    Arızaya kapalı: belge biçiminde OLMAYAN her şey reddedilir. Dizi de
    reddedilir — `[].content` tanımsız olduğu için tarama boş geçip "kuşku
    yok" diyordu. Şu anki tek çağıran (saveManuscript) zaten `type === "doc"`
    denetliyor, yani bu canlı bir açık değildi; ama koruma kendi başına
    doğru olmalı, yoksa ikinci çağıranla birlikte sessizce açığa dönüşür.
  */
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return true;
  return walk((doc as DocNode).content);
}
