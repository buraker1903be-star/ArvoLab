// İki metin sürümünü karşılaştırır (tarayıcıda, bağımlılıksız): önce paragraf düzeyinde,
// değişen paragraflarda kelime düzeyinde. Ortak baş/son kısım atılarak LCS yalnızca
// değişen ortada çalışır; çok büyük farklarda (bütçe aşılırsa) paragrafları kaba eşler.

export type WordPart = { type: "same" | "added" | "removed"; text: string };

export type DiffBlock =
  | { kind: "same"; count: number }
  | { kind: "added"; text: string }
  | { kind: "removed"; text: string }
  | { kind: "changed"; parts: WordPart[] };

export interface DiffStats {
  addedWords: number;
  removedWords: number;
  addedParagraphs: number;
  removedParagraphs: number;
  changedParagraphs: number;
}

export interface TextDiff {
  blocks: DiffBlock[];
  stats: DiffStats;
  identical: boolean;
}

/** LCS hücre bütçesi (paragraf ve kelime karşılaştırmaları için ayrı ayrı) */
const MAX_CELLS = 4_000_000;

const paragraphsOf = (text: string) =>
  text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const wordCount = (text: string) => (text.match(/\S+/g) ?? []).length;

type Op = { type: "same" | "added" | "removed"; a?: number; b?: number };

/** a ve b dizileri için LCS düzenleme dizisi (eşitlik: ===) */
function lcsOps<T>(a: T[], b: T[]): Op[] | null {
  const n = a.length;
  const m = b.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "same", a: i++, b: j++ });
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      ops.push({ type: "removed", a: i++ });
    } else {
      ops.push({ type: "added", b: j++ });
    }
  }
  while (i < n) ops.push({ type: "removed", a: i++ });
  while (j < m) ops.push({ type: "added", b: j++ });
  return ops;
}

/** Kelime düzeyi fark (boşluklar korunur) */
export function diffWords(oldText: string, newText: string): WordPart[] {
  const a = oldText.match(/\s+|[^\s]+/g) ?? [];
  const b = newText.match(/\s+|[^\s]+/g) ?? [];
  const ops = lcsOps(a, b);
  if (!ops) {
    return [
      { type: "removed", text: oldText },
      { type: "added", text: newText },
    ];
  }
  const parts: WordPart[] = [];
  for (const op of ops) {
    const text = op.type === "added" ? b[op.b!] : a[op.a!];
    const last = parts[parts.length - 1];
    if (last && last.type === op.type) last.text += text;
    else parts.push({ type: op.type, text });
  }
  return parts;
}

/** İki paragraf aynı paragrafın düzenlenmiş hâli sayılabilecek kadar benzer mi */
function similar(a: string, b: string): boolean {
  const wordsA = new Set(a.toLocaleLowerCase("tr-TR").match(/[\p{L}\d]+/gu) ?? []);
  const wordsB = b.toLocaleLowerCase("tr-TR").match(/[\p{L}\d]+/gu) ?? [];
  if (wordsA.size === 0 || wordsB.length === 0) return false;
  const shared = wordsB.filter((word) => wordsA.has(word)).length;
  return shared / Math.max(wordsA.size, wordsB.length) >= 0.4;
}

export function diffTexts(oldText: string, newText: string): TextDiff {
  const a = paragraphsOf(oldText);
  const b = paragraphsOf(newText);

  // Ortak baş ve son kısım
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  // Orta kısım: LCS; bütçe aşılırsa hepsi silinmiş/eklenmiş sayılır
  const ops: Op[] =
    lcsOps(midA, midB) ?? [...midA.map((_, i) => ({ type: "removed" as const, a: i })), ...midB.map((_, j) => ({ type: "added" as const, b: j }))];

  const raw: DiffBlock[] = [];
  const pushSame = (count: number) => {
    if (count <= 0) return;
    const last = raw[raw.length - 1];
    if (last?.kind === "same") last.count += count;
    else raw.push({ kind: "same", count });
  };
  pushSame(start);

  // Ardışık silinen/eklenen paragrafları benzerlerine göre "değişti" olarak eşle
  for (let index = 0; index < ops.length; ) {
    const op = ops[index];
    if (op.type === "same") {
      pushSame(1);
      index++;
      continue;
    }
    const removed: string[] = [];
    const added: string[] = [];
    while (index < ops.length && ops[index].type !== "same") {
      const current = ops[index];
      if (current.type === "removed") removed.push(midA[current.a!]);
      else added.push(midB[current.b!]);
      index++;
    }
    let r = 0;
    let s = 0;
    while (r < removed.length || s < added.length) {
      if (r < removed.length && s < added.length && similar(removed[r], added[s])) {
        raw.push({ kind: "changed", parts: diffWords(removed[r++], added[s++]) });
      } else if (r < removed.length && (s >= added.length || removed.length - r >= added.length - s)) {
        raw.push({ kind: "removed", text: removed[r++] });
      } else {
        raw.push({ kind: "added", text: added[s++] });
      }
    }
  }
  pushSame(a.length - endA);

  const stats: DiffStats = { addedWords: 0, removedWords: 0, addedParagraphs: 0, removedParagraphs: 0, changedParagraphs: 0 };
  for (const block of raw) {
    if (block.kind === "added") {
      stats.addedParagraphs += 1;
      stats.addedWords += wordCount(block.text);
    } else if (block.kind === "removed") {
      stats.removedParagraphs += 1;
      stats.removedWords += wordCount(block.text);
    } else if (block.kind === "changed") {
      stats.changedParagraphs += 1;
      for (const part of block.parts) {
        if (part.type === "added") stats.addedWords += wordCount(part.text);
        else if (part.type === "removed") stats.removedWords += wordCount(part.text);
      }
    }
  }

  return { blocks: raw, stats, identical: raw.every((block) => block.kind === "same") };
}
