// "Her ana bölüm yeni sayfadan başlar": hangi birinci düzey başlıklar sayfa sonuyla başlar.
// Word ve baskı aynı kuralı kullanır: öncesinde içerik olan her üst düzey H1 yeni sayfadan
// başlar. Belgenin başındaki (yalnızca boş paragraflardan sonra gelen) ilk başlık başlamaz;
// yoksa kapak/içindekiler sayfasının ardından ya da en başta boş bir sayfa oluşurdu.
import { anaMetinBaslangici, onSayfaBasligiMi } from "@/lib/heading-numbering";

interface JsonNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  content?: JsonNode[];
}

const hasText = (node: JsonNode): boolean => Boolean(node.text?.trim()) || (node.content ?? []).some(hasText);
const isContent = (node: JsonNode) =>
  node.type === "image" || node.type === "table" || node.type === "horizontalRule" || hasText(node);

export function chapterBreakSet(doc: { content?: JsonNode[] } | null | undefined): Set<JsonNode> {
  const breaks = new Set<JsonNode>();
  let contentSeen = false;
  for (const node of doc?.content ?? []) {
    if (node.type === "heading" && (Number(node.attrs?.level) || 1) === 1 && contentSeen) breaks.add(node);
    if (isContent(node)) contentSeen = true;
  }
  return breaks;
}

/*
  ÖN SAYFALAR HER ZAMAN YENİ SAYFADAN (02.11.2026, kurum sahibinin kararı).
  İç kapak, onay, yemin metni, özet … her biri kendi sayfası; ana metnin
  başı (Giriş) da. Kılavuz "her bölüm yeni sayfadan" demese bile: DEÜ SBE
  kılavuzundan bu kural çıkmıyordu ve iç kapakla onay sayfası aynı sayfada
  basılıyordu. Kural açıksa chapterBreakSet zaten hepsini kapsıyor.
  Başlıktan önce içerik yoksa sayfa sonu konmaz (boş sayfa olmasın).
*/
export function onSayfaKirilimlari(doc: { content?: JsonNode[] } | null | undefined): Set<JsonNode> {
  const breaks = new Set<JsonNode>();
  const dugumler = doc?.content ?? [];
  const ana = anaMetinBaslangici(doc as Parameters<typeof anaMetinBaslangici>[0]);
  let contentSeen = false;
  for (const [sira, node] of dugumler.entries()) {
    const h1 = node.type === "heading" && (Number(node.attrs?.level) || 1) === 1;
    const metin = h1 ? jsonMetni(node) : "";
    if (h1 && contentSeen && (onSayfaBasligiMi(metin) || sira === ana)) breaks.add(node);
    if (isContent(node)) contentSeen = true;
  }
  return breaks;
}

const jsonMetni = (node: JsonNode): string => node.text ?? (node.content ?? []).map(jsonMetni).join("");

/** Çıktının sayfa sonları: kural açıksa her ana bölüm, değilse yalnızca ön sayfalar ve ana metnin başı. */
export function sayfaKirilimlari(doc: { content?: JsonNode[] } | null | undefined, chapterNewPage: boolean): Set<JsonNode> {
  return chapterNewPage ? chapterBreakSet(doc) : onSayfaKirilimlari(doc);
}
