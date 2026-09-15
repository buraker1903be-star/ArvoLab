// "Her ana bölüm yeni sayfadan başlar": hangi birinci düzey başlıklar sayfa sonuyla başlar.
// Word ve baskı aynı kuralı kullanır: öncesinde içerik olan her üst düzey H1 yeni sayfadan
// başlar. Belgenin başındaki (yalnızca boş paragraflardan sonra gelen) ilk başlık başlamaz;
// yoksa kapak/içindekiler sayfasının ardından ya da en başta boş bir sayfa oluşurdu.
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
