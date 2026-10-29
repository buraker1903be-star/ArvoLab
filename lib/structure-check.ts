// Tezin iç tutarlılığı (istemcide, editör içeriği üzerinde anında): jürilerin sık
// yakaladığı ve kılavuz bölüm kontrolünün görmediği hatalar.
//   - boş bölüm başlıkları
//   - başlık düzeyi atlama (H1 → H3)
//   - metinde anılan ama olmayan şekil/tablo; hiç anılmayan şekil/tablo
//   - numaralı atıf stillerinde (IEEE, Vancouver) kaynakçayla uyuşmayan numaralar
//   - metni boş dipnotlar
// Her sorun, metinde bulunup seçilebilecek bir "hedef" metin taşır.

import { headingMatchesSection } from "@/lib/section-match";
import { SOZCUK_BASI } from "@/lib/sozcuk-siniri";
import type { AbstractRules } from "@/lib/guideline-editor-settings";
import { crossCheck, extractInTextCitations } from "@/lib/apa7";
import { kunyeleriAyristir } from "@/lib/atif/kunye";
import { adlaEslesir, atifCikarmaStili, stilTanimi, yilaBakilir } from "@/lib/atif/stiller";
import { baslikNumarasi, numaralandirmaSorunlari } from "@/lib/sekil-tablo-numaralari";
import { kisaltmaMesaji, kisaltmaSorunlari } from "@/lib/kisaltmalar";
import { hasReferencePunctuationIssue } from "@/lib/reference-punctuation";
import { checkParagraphFormat, describeParagraphFormat, hangingIndentCmOf, type ParagraphFormatRules } from "@/lib/paragraph-format";
import { metinBiciminiDenetle, type MetinBicimKurali } from "@/lib/metin-bicimi";
import { baslikYerlesimSorunlari, uzunAlintilar, BLOK_ALINTI_ESIGI } from "@/lib/alinti-ve-baslik";
import type { Dil } from "@/lib/dil";

interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
}

export type StructureIssueTone = "warning" | "danger";

/*
  Sorunun türü (26.10.2026). Pencere sorunları düz bir liste olarak
  gösteriyordu: boş bölüm, eksik künye ve kısaltma uyarısı alt alta,
  öğrenci hangisinin nereyle ilgili olduğunu satırı okuyarak
  çıkarıyordu. Tür, denetimin hangi bloğundan çıktığından gelir
  (aşağıda her bloğun başında atanıyor); mesaj metninden tahmin edilmez.
*/
export type SorunTuru = "bolum" | "sekil" | "kaynakca" | "ozet" | "ek" | "yazim" | "bicim" | "dipnot" | "genel";

export const SORUN_TURLERI: { tur: SorunTuru; baslik: string; neden: string }[] = [
  { tur: "bolum", baslik: "Bölümler ve başlıklar", neden: "Kılavuzun istediği bölümler dolu ve başlık düzeyleri sıralı olmalı." },
  { tur: "kaynakca", baslik: "Atıf ve kaynakça", neden: "Her atıfın kaynakçada, her kaynağın metinde karşılığı olmalı." },
  { tur: "sekil", baslik: "Şekil ve tablolar", neden: "Numaralar sıralı olmalı ve her şekil/tablo metinde anılmalı." },
  { tur: "ozet", baslik: "Özet ve anahtar kelimeler", neden: "Kılavuzun kelime ve anahtar kelime sınırları." },
  { tur: "ek", baslik: "Ekler", neden: "Ekler sıralı numaralanmalı ve metinde anılmalı." },
  { tur: "yazim", baslik: "Kısaltma ve alıntı", neden: "Kısaltma ilk geçtiği yerde açılır; uzun alıntı blok olarak verilir." },
  { tur: "bicim", baslik: "Sayfa ve yazı biçimi", neden: "Yazı tipi, punto, satır aralığı ve paragraf düzeni kılavuza uymalı." },
  { tur: "dipnot", baslik: "Dipnotlar", neden: "Boş dipnot çıktıda yalnızca numara olarak görünür." },
  { tur: "genel", baslik: "Diğer", neden: "" },
];

/* İngilizcesi (28.10.2026); SORUN_TURLERI ile aynı sıra. */
const SORUN_TURLERI_EN: Record<SorunTuru, { baslik: string; neden: string }> = {
  bolum: { baslik: "Sections and headings", neden: "The sections the guideline requires should be filled in and heading levels should be in order." },
  kaynakca: { baslik: "Citations and reference list", neden: "Every citation needs an entry in the reference list, and every reference needs a citation in the text." },
  sekil: { baslik: "Figures and tables", neden: "Numbers should be sequential and every figure/table should be mentioned in the text." },
  ozet: { baslik: "Abstract and keywords", neden: "The guideline's word and keyword limits." },
  ek: { baslik: "Appendices", neden: "Appendices should be numbered in order and mentioned in the text." },
  yazim: { baslik: "Abbreviations and quotations", neden: "Spell out an abbreviation where it first appears; give long quotations as block quotes." },
  bicim: { baslik: "Page and text formatting", neden: "Font, size, line spacing and paragraph layout should follow the guideline." },
  dipnot: { baslik: "Footnotes", neden: "An empty footnote appears in the output as a bare number." },
  genel: { baslik: "Other", neden: "" },
};

/** Sorun türleri, istenen dilde (SORUN_TURLERI ile aynı biçim ve sıra). */
export function sorunTurleri(dil: Dil = "tr"): { tur: SorunTuru; baslik: string; neden: string }[] {
  return dil === "en" ? SORUN_TURLERI.map((t) => ({ tur: t.tur, ...SORUN_TURLERI_EN[t.tur] })) : SORUN_TURLERI;
}

/** Sorunları SORUN_TURLERI sırasıyla gruplar; boş grup dönmez. */
export function sorunlariGrupla<T extends { kategori?: SorunTuru }>(sorunlar: T[], dil: Dil = "tr") {
  return sorunTurleri(dil).map((t) => ({ ...t, sorunlar: sorunlar.filter((s) => (s.kategori ?? "genel") === t.tur) })).filter(
    (g) => g.sorunlar.length > 0,
  );
}

export interface StructureIssue {
  tone: StructureIssueTone;
  message: string;
  /** Metinde aranıp seçilecek ifade (başlık, şekil başlığı, atıf) */
  target?: string;
  /** Pencerede hangi grupta gösterileceği (SORUN_TURLERI) */
  kategori?: SorunTuru;
  /** Editörün tek tıkla yapabileceği düzeltme */
  action?:
    | "sort-references"
    | "fix-reference-punctuation"
    | "convert-reference-lists"
    | "apply-paragraph-format"
    | "apply-hanging-indent"
    | "clear-manual-text-format";
}

const MAX_ISSUES = 60;
/** Atıf–kaynakça uyuşmazlıklarından her türde en fazla bu kadarı tek tek listelenir */
const CITATION_ISSUE_LIMIT = 10;
// İngilizce tezler için "Reference List" ve "Works Cited" (MLA) de kaynakça sayılır (28.10.2026).
const REFERENCE_SECTIONS = ["Kaynakça", "Kaynaklar", "References", "Bibliography", "Bibliyografya", "Reference List", "Works Cited"];
/*
  Belgedeki şekil/tablo etiketi. İngilizce yazılan tezde başlıklar
  "Figure 1. …" diye yazılıyor; yalnızca "Şekil" aranırsa her başlık
  "numarayla başlamıyor" uyarısı alırdı. Hangisinin kullanıldığı
  başlıklardan okunuyor (belgeEtiketi), arayüz dilinden değil.
*/
const CAPTION_LABEL = { figure: "Şekil", table: "Tablo" } as const;
const CAPTION_LABEL_EN = { figure: "Figure", table: "Table" } as const;
const ABSTRACT_SECTIONS = ["Özet", "Öz", "Abstract"];
// "EK 1. …", "Ek-2 …", "EK 3 – …" — numarasız "EKLER" ve harfli "Ek A" dışarıda.
// İngilizcesi "Appendix 1 …"; harfli "Appendix A" aynı sebeple dışarıda.
const EK_BASLIGI = /^(?:ek|appendix)\s*[-–.]?\s*\d/iu;

/** Başlıkların çoğunluğu hangi etiketle numaralanmışsa o; eşitlikte (ya da hiç yoksa) Türkçe. */
function belgeEtiketi(tr: string, en: string, basliklar: string[]): string {
  const say = (etiket: string) => basliklar.filter((baslik) => baslikNumarasi(etiket, baslik)).length;
  return say(en) > say(tr) ? en : tr;
}
// "Anahtar Kelimeler: a, b, c" / "Keywords: a; b"
const KEYWORDS_LINE = /^(?:anahtar\s+(?:kelime|sözcük)\p{L}*|keywords?|key\s+words)\s*[:：]\s*(.*)$/iu;
const countWords = (text: string) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

const textOf = (node: DocNode): string =>
  node.type === "text" ? (node.text ?? "") : (node.content ?? []).map(textOf).join("");

const hasContent = (node: DocNode): boolean =>
  node.type === "image" || node.type === "table" || node.type === "horizontalRule" || textOf(node).trim().length > 0;

/** "[1, 3–5]" / "(2-4)" içindeki numaralar */
function expandNumbers(list: string): number[] {
  const numbers: number[] = [];
  for (const part of list.split(",")) {
    const [start, end] = part.split(/[–-]/).map((value) => Number.parseInt(value.trim(), 10));
    if (!Number.isFinite(start)) continue;
    if (Number.isFinite(end) && end >= start && end - start < 200) for (let n = start; n <= end; n++) numbers.push(n);
    else numbers.push(start);
  }
  return numbers;
}

const quote = (text: string) => `“${text.length > 60 ? `${text.slice(0, 57)}…` : text}”`;

export function checkStructure(
  doc: { content?: DocNode[] } | null | undefined,
  options: {
    citationStyle?: string;
    abstract?: AbstractRules;
    paragraphFormat?: ParagraphFormatRules;
    referenceHangingIndentCm?: number;
    /** Kılavuzun yazı tipi, punto ve satır aralığı */
    textFormat?: MetinBicimKurali;
    /** Belgenin dili (lib/belge-dili.ts): şekil/tablo etiketi "Tablo" mu "Table" mı. Verilmezse metinden tahmin edilir. */
    belgeDili?: Dil;
  } = {},
  /** Mesajların dili (arayüz). Belgenin dili ayrı: etiketler başlıklardan okunur. */
  dil: Dil = "tr",
): StructureIssue[] {
  const en = dil === "en";
  const t = (tr: string, ing: string) => (en ? ing : tr);
  const issues: StructureIssue[] = [];
  /*
    Sınıra takılıp ATILAN sorunlar sayılıyor.

    Eskiden sessizce düşüyorlardı: 200 sorunu olan bir tezde öğrenci 60
    tanesini görüyor ve "hepsi bu" sanıyordu. Daha kötüsü, denetimler
    sırayla çalıştığı için üst sıradakiler (başlıklar) sınırı doldurunca
    ALT SIRADAKİLER hiç görünmüyordu — atıf ve biçim denetimi çalışmış
    ama tek bir satır bile yazamamış oluyordu. Öğrenci o denetimlerin
    "temiz" olduğunu sanıyordu; oysa hiç raporlanmamışlardı.

    Sayı, listenin sonunda söyleniyor (aşağıda). Eksiksiz göstermek
    istemiyoruz — 200 satırlık bir liste de okunmaz — ama eksik olduğunu
    söylemek zorundayız.
  */
  let atlananSorun = 0;
  let kategori: SorunTuru = "bolum";
  const add = (issue: StructureIssue) => {
    if (issues.length < MAX_ISSUES) issues.push({ kategori, ...issue });
    else atlananSorun += 1;
  };
  const blocks = doc?.content ?? [];

  // ---------- Başlıklar: boş bölüm ve düzey atlama ----------
  let previousLevel = 0;
  let referencesIndex = -1;
  /*
    Numaralı ek başlıkları ("EK 1. Görüşme Formu"). Yalnızca numaralı
    olanlar: "EKLER" bölüm başlığıdır, "Ek A" harfli düzendir ve ikisini
    de numaralandırma denetimine sokmak kusursuz bir teze uyarı basardı.
  */
  const ekBasliklari: string[] = [];
  blocks.forEach((block, index) => {
    if (block.type !== "heading") return;
    const level = Number(block.attrs?.level) || 1;
    const text = textOf(block).trim();
    if (EK_BASLIGI.test(text)) ekBasliklari.push(text);
    if (referencesIndex < 0 && REFERENCE_SECTIONS.some((name) => headingMatchesSection(text, name))) referencesIndex = index;

    if (!text) {
      add({ tone: "warning", message: t("Metni olmayan bir başlık var.", "There is a heading with no text.") });
    } else if (previousLevel && level > previousLevel + 1) {
      add({
        tone: "warning",
        message: en
          ? `The heading ${quote(text)} is H${level}, but there is no H${level - 1} above it (skips from H${previousLevel} to H${level}).`
          : `${quote(text)} başlığı H${level}; üstünde H${level - 1} yok (H${previousLevel}'den H${level}'e atlanmış).`,
        target: text,
      });
    }
    previousLevel = level;

    // Sonraki aynı ya da üst düzey başlığa (ya da belge sonuna) kadar içerik var mı?
    let filled = false;
    for (let next = index + 1; next < blocks.length; next++) {
      const candidate = blocks[next];
      if (candidate.type === "heading" && (Number(candidate.attrs?.level) || 1) <= level) break;
      if (candidate.type !== "heading" && hasContent(candidate)) {
        filled = true;
        break;
      }
      if (candidate.type === "heading") filled = true; // alt bölümler var; boşlukları kendi başlıklarında raporlanır
      if (filled) break;
    }
    if (text && !filled) add({ tone: "warning", message: en ? `The section ${quote(text)} is still empty.` : `${quote(text)} bölümü henüz boş.`, target: text });
  });

  // Kaynakça bölümü: başlığından sonraki, aynı ya da üst düzey ilk başlığa (ör. "EKLER") kadar.
  // Sonrasındaki ekler yine gövde metnidir: eklerde anılan şekil/tablo "anılmıyor" sayılmaz.
  let referencesEnd = blocks.length;
  if (referencesIndex >= 0) {
    const referencesLevel = Number(blocks[referencesIndex].attrs?.level) || 1;
    for (let next = referencesIndex + 1; next < blocks.length; next++) {
      const block = blocks[next];
      if (block.type === "heading" && (Number(block.attrs?.level) || 1) <= referencesLevel) {
        referencesEnd = next;
        break;
      }
    }
  }
  const inReferences = (index: number) => referencesIndex >= 0 && index > referencesIndex && index < referencesEnd;

  kategori = "sekil";
  // ---------- Şekil/tablo başlıkları ve metindeki anılmaları ----------
  const captions = { figure: [] as string[], table: [] as string[] };
  const bodyTexts: string[] = [];
  const footnoteProblems: number[] = [];
  let footnoteIndex = 0;
  const walk = (nodes: DocNode[] | undefined, inReferences: boolean) => {
    for (const node of nodes ?? []) {
      if (node.type === "footnoteReference") {
        footnoteIndex += 1;
        if (!String(node.attrs?.text ?? "").trim()) footnoteProblems.push(footnoteIndex);
        continue;
      }
      if (node.type === "paragraph" && (node.attrs?.caption === "figure" || node.attrs?.caption === "table")) {
        captions[node.attrs.caption].push(textOf(node).trim());
        continue;
      }
      if (node.type === "paragraph" || node.type === "heading") {
        if (!inReferences) bodyTexts.push(textOf(node));
        walk(node.content, inReferences);
        continue;
      }
      walk(node.content, inReferences);
    }
  };
  blocks.forEach((block, index) => walk([block], inReferences(index)));
  const body = bodyTexts.join("\n");

  for (const kind of ["table", "figure"] as const) {
    const label = options.belgeDili
      ? options.belgeDili === "en" ? CAPTION_LABEL_EN[kind] : CAPTION_LABEL[kind]
      : belgeEtiketi(CAPTION_LABEL[kind], CAPTION_LABEL_EN[kind], [...captions[kind], ...body.split("\n")]);
    const count = captions[kind].length;
    const kucuk = en ? label.toLowerCase() : label.toLocaleLowerCase("tr-TR");

    /*
      Şekil/tablo başlığının NUMARASI BELGEDE SAKLANMIYOR: editör (CSS
      sayacı), baskı (lib/tiptap-html.ts) ve Word (SEQ alanı) başlıkları
      sırayla kendisi numaralıyor; başlık düğmesi ve Word aktarımı elle
      yazılmış "Tablo 1." önekini siliyor. Denetim ise numarayı başlık
      METNİNDE arıyordu (29.10.2026'ya kadar): doğru kurulmuş her başlık
      "numarayla başlamıyor" uyarısı, her "Tablo 1'de" anışı da "o
      numarada başlık yok" tehlikesi alıyordu. Öğrenci numarayı elle
      yazmaya itiliyor, çıktıda "Tablo 1. Tablo 1." basılıyordu.

      Artık numara belgedeki sıradır. Elle yazılmış numara ise çift
      basılacağı için ayrıca uyarılır.
    */
    captions[kind].forEach((caption) => {
      const elle = baslikNumarasi(CAPTION_LABEL[kind], caption) ?? baslikNumarasi(CAPTION_LABEL_EN[kind], caption);
      if (!elle) return;
      add({
        tone: "warning",
        message: en
          ? `A ${kucuk} caption starts with a typed number (“${caption.slice(0, 40)}”). Captions are numbered automatically, so it will print twice (“${label} 1. ${label} 1. …”); delete the typed number.`
          : `Bir ${kucuk} başlığı elle yazılmış numarayla başlıyor (“${caption.slice(0, 40)}”). Başlıklar otomatik numaralanır, çıktıda iki kez basılır (“${label} 1. ${label} 1. …”); elle yazılan numarayı silin.`,
        target: caption,
      });
    });

    const mentioned = new Set<string>();
    // \b ASCII dışı harfleri (Ş) tanımaz; sınır lib/sozcuk-siniri.ts'te tek tanım.
    // Bölüme göre numaralandırma ("Tablo 3.1") da eşleşmeli.
    for (const match of body.matchAll(new RegExp(`${SOZCUK_BASI}${label}\\s+(\\d+(?:\\.\\d+)*)`, "gu"))) mentioned.add(match[1]);

    const numaralar = captions[kind].map((_, i) => String(i + 1));
    const mevcut = new Set(numaralar.filter((numara): numara is string => Boolean(numara)));
    for (const number of [...mentioned].sort()) {
      if (!mevcut.has(number)) {
        add({
          tone: "danger",
          message: en
            ? `The text mentions “${label} ${number}”, but there is no ${kucuk} caption with that number (the document has ${count ? `${count} ${kucuk} ${count === 1 ? "caption" : "captions"}` : `no ${kucuk} captions`}).`
            : `Metinde “${label} ${number}” geçiyor ama o numarada bir ${kucuk} başlığı yok (belgede ${count ? `${count} ${kucuk} başlığı var` : `hiç ${kucuk} başlığı yok`}).`,
          target: `${label} ${number}`,
        });
      }
    }
    captions[kind].forEach((caption, index) => {
      const numara = numaralar[index];
      // Numarası okunamayan başlık için ayrı uyarı zaten verildi.
      if (!numara || mentioned.has(numara)) return;
      add({
        tone: "warning",
        message: en
          ? `${label} ${numara}${caption ? ` (${quote(caption)})` : ""} is not mentioned in the text; guidelines usually require every ${kind === "figure" ? "figure" : "table"} to be mentioned in the text.`
          : `${label} ${numara}${caption ? ` (${quote(caption)})` : ""} metinde anılmıyor; kılavuzlar genellikle her ${kind === "figure" ? "şeklin" : "tablonun"} metinde anılmasını ister.`,
        target: caption || undefined,
      });
    });
  }

  kategori = "kaynakca";
  // Kaynakça girdileri: Kaynakça bölümündeki (gövde metniyle aynı sınır) dolu paragraflar ve
  // liste maddeleri. Word'de kaynakça sık sık numaralı/madde işaretli liste olarak yazılır;
  // önceden bunlar "0 kaynak" sayılıyordu. İç içe liste maddeleri ayrı girdidir.
  const referenceEntries: string[] = [];
  let referencesInList = false;
  /* Asılı girintisi olmayan kaynakça paragrafı sayısı; kılavuz asılı
     girinti istiyorsa aşağıda raporlanır. */
  let hangingMissing = 0;
  const collectEntries = (node: DocNode) => {
    if (node.type === "paragraph") {
      const text = textOf(node).trim();
      if (text) {
        referenceEntries.push(text);
        if (!hangingIndentCmOf(node.attrs)) hangingMissing += 1;
      }
      return;
    }
    if (node.type !== "bulletList" && node.type !== "orderedList") return;
    referencesInList = true;
    for (const item of node.content ?? []) {
      const children = item.content ?? [];
      const text = children
        .filter((child) => child.type === "paragraph")
        .map(textOf)
        .join(" ")
        .trim();
      if (text) referenceEntries.push(text);
      for (const child of children) collectEntries(child.type === "paragraph" ? {} : child);
    }
  };
  blocks.forEach((block, index) => {
    if (inReferences(index)) collectEntries(block);
  });

  // ---------- Kaynakça noktalaması: çift nokta, noktalamadan önce boşluk (tüm stiller) ----------
  const punctuationProblems = referenceEntries.filter(hasReferencePunctuationIssue);
  if (punctuationProblems.length > 0) {
    add({
      tone: "warning",
      message: en
        ? `${punctuationProblems.length} ${punctuationProblems.length === 1 ? "entry" : "entries"} in the reference list ${punctuationProblems.length === 1 ? "has" : "have"} punctuation errors (double periods or a space before punctuation).`
        : `Kaynakçada ${punctuationProblems.length} girdide noktalama hatası var (çift nokta ya da noktalama işaretinden önce boşluk).`,
      target: punctuationProblems[0].slice(0, 40),
      action: "fix-reference-punctuation",
    });
  }

  /* ---------- Kaynakça asılı girintisi ----------
     APA ve Chicago kaynakçada asılı girintiyi zorunlu tutar; kılavuzlar
     da ister. Editörde ve Word çıktısında karşılığı yoktu: öğrenci
     kaynakçayı doğru yazsa bile biçim yanlış çıkıyordu. Kural yalnızca
     kılavuz istediğinde uygulanıyor. */
  if (options.referenceHangingIndentCm && hangingMissing > 0 && !referencesInList) {
    add({
      tone: "warning",
      message: en
        ? `${hangingMissing} ${hangingMissing === 1 ? "entry" : "entries"} in the reference list ${hangingMissing === 1 ? "has" : "have"} no hanging indent; the guideline requires a ${String(options.referenceHangingIndentCm)} cm hanging indent (first line at the margin, following lines indented).`
        : `Kaynakçada ${hangingMissing} girdide asılı girinti yok; kılavuz ${String(options.referenceHangingIndentCm).replace(".", ",")} cm asılı girinti istiyor (ilk satır kenarda, sonraki satırlar içeride).`,
      action: "apply-hanging-indent",
    });
  }

  // ---------- Yazar-tarih stilleri: kaynakça alfabetik mi ----------
  const style = options.citationStyle;
  const stil = stilTanimi(style);
  /* Kaynakçanın sırası stilin işi: numara stillerinde kaynaklar ATIF
     SIRASINDA dizilir, alfabetik değildir. Eskiden bu ayrım koda
     gömülüydü ve yalnızca APA/Chicago adı yazılıydı. */
  if (stil.kaynakcaSirasi === "alfabetik" && referenceEntries.length > 1) {
    const unsorted = referenceEntries.some(
      (entry, index) => index > 0 && referenceEntries[index - 1].localeCompare(entry, "tr", { sensitivity: "base" }) > 0
    );
    if (unsorted) {
      // Editörün tek tık sıralaması yalnızca ardışık paragraflarda çalışır (listede düğme gösterilmez).
      add(
        referencesInList
          ? {
              tone: "warning",
              message: t(
                "Kaynakça yazar soyadına göre alfabetik sırada değil (önce listeyi paragraflara çevirin; ardından tek tıkla sıralanır).",
                "The reference list is not in alphabetical order by author surname (convert the list to paragraphs first; then it can be sorted in one click).",
              ),
            }
          : {
              tone: "warning",
              message: t("Kaynakça yazar soyadına göre alfabetik sırada değil.", "The reference list is not in alphabetical order by author surname."),
              action: "sort-references",
            }
      );
    }
  }

  // Numara dışı stillerde (APA, Chicago, MLA) kaynakça girdileri madde
  // işareti ya da numara taşımaz: tek tıkla paragraflara çevrilir.
  if (!stil.listeIsaretiSerbest && stil.tur !== "numara" && referencesInList) {
    add({
      tone: "warning",
      message: en
        ? `The reference list is formatted as a list (bullets/numbers); in a ${stil.ad} reference list, entries are written as separate paragraphs without list markers.`
        : `Kaynakça liste biçiminde (madde işareti/numara); ${stil.ad} kaynakçasında kaynaklar liste işareti olmadan, ayrı paragraflar olarak yazılır.`,
      action: "convert-reference-lists",
    });
  }

  /* ---------- Künye biçimi: HER stilde ----------
     Eskiden künyeler yalnızca APA'da denetleniyordu. Chicago ayrıştırıcısı
     hiç sorun üretmiyor, IEEE ve Vancouver künyeleri hiç okunmuyordu:
     öğrenci Vancouver seçtiğinde belge kontrolü "sorun yok" diyordu, çünkü
     bakmamıştı. Sessiz bir "temiz" raporu, hiç rapor vermemekten kötü. */
  const kunyeler = kunyeleriAyristir(referenceEntries, style, dil);
  const bicimSorunlari = kunyeler.flatMap((kunye) =>
    kunye.issues.filter((konu) => konu.severity === "error").map((konu) => ({ kunye, konu })),
  );
  bicimSorunlari.slice(0, CITATION_ISSUE_LIMIT).forEach(({ kunye, konu }) =>
    add({ tone: "danger", message: `${quote(kunye.raw)} — ${konu.message}`, target: kunye.raw.slice(0, 40) }),
  );
  if (bicimSorunlari.length > CITATION_ISSUE_LIMIT) {
    add({
      tone: "danger",
      message: en
        ? `…and ${bicimSorunlari.length - CITATION_ISSUE_LIMIT} more reference formatting ${bicimSorunlari.length - CITATION_ISSUE_LIMIT === 1 ? "issue" : "issues"}.`
        : `…ve künye biçiminde ${bicimSorunlari.length - CITATION_ISSUE_LIMIT} sorun daha.`,
    });
  }

  /* ---------- Adla eşleşen stiller (APA 7, Chicago, MLA): metin içi atıf ↔ kaynakça ----------
     MLA'da atıfta yıl yoktur ("Yılmaz 45"), o yüzden eşleştirme yalnızca
     yazara bakar; yıl şart koşulsaydı MLA yazan öğrenci doğru yazdığı her
     kaynak için "metinde anılmıyor" uyarısı alırdı. (lib/apa7.ts ile aynı
     eşleştirme.) */
  if (adlaEslesir(stil) && referenceEntries.length > 0) {
    const yilaBak = yilaBakilir(stil);
    // Yazarı (ve yıla bakılan stillerde yılı) ayrıştırılamayan girdiler eşleştirilmez;
    // biçim hatası yukarıda zaten raporlandı.
    const references = kunyeler.filter((reference) => reference.authors?.length && (!yilaBak || reference.year));
    if (references.length > 0) {
      const { citationsWithoutReference, referencesWithoutCitation } = crossCheck(
        extractInTextCitations(body, { style: atifCikarmaStili(stil) }),
        references,
        { yilaBak },
      );
      citationsWithoutReference.slice(0, CITATION_ISSUE_LIMIT).forEach((citation) =>
        add({
          tone: "danger",
          message: en ? `The in-text citation ${quote(citation.raw)} has no matching entry in the reference list.` : `Metindeki ${quote(citation.raw)} atfının kaynakçada karşılığı yok.`,
          target: citation.raw,
        })
      );
      if (citationsWithoutReference.length > CITATION_ISSUE_LIMIT) {
        add({
          tone: "danger",
          message: en
            ? `…and ${citationsWithoutReference.length - CITATION_ISSUE_LIMIT} more ${citationsWithoutReference.length - CITATION_ISSUE_LIMIT === 1 ? "citation" : "citations"} with no matching reference.`
            : `…ve kaynakçada karşılığı olmayan ${citationsWithoutReference.length - CITATION_ISSUE_LIMIT} atıf daha.`,
        });
      }
      referencesWithoutCitation.slice(0, CITATION_ISSUE_LIMIT).forEach((reference) =>
        add({
          tone: "warning",
          message: en ? `The reference ${quote(reference.raw)} is not cited in the text.` : `Kaynakçadaki ${quote(reference.raw)} metinde anılmıyor.`,
          target: reference.raw.slice(0, 40),
        })
      );
      if (referencesWithoutCitation.length > CITATION_ISSUE_LIMIT) {
        add({
          tone: "warning",
          message: en
            ? `…and ${referencesWithoutCitation.length - CITATION_ISSUE_LIMIT} more ${referencesWithoutCitation.length - CITATION_ISSUE_LIMIT === 1 ? "reference" : "references"} not cited in the text.`
            : `…ve metinde anılmayan ${referencesWithoutCitation.length - CITATION_ISSUE_LIMIT} kaynak daha.`,
        });
      }
    }
  }

  // ---------- Numaralı atıf stilleri: metin ↔ kaynakça ----------
  if (stil.tur === "numara" && stil.numara) {
    const references = referenceEntries.length;
    const pattern = new RegExp(stil.numara.metinKalibi.source, "g");
    const cited = new Set<number>();
    for (const match of body.matchAll(pattern)) for (const number of expandNumbers(match[1])) cited.add(number);
    const citeLabel = stil.numara.etiket;
    for (const number of [...cited].sort((a, b) => a - b)) {
      if (number > references) {
        add({
          tone: "danger",
          message: en
            ? `The text cites ${citeLabel(number)}, but the reference list has ${references} ${references === 1 ? "entry" : "entries"}.`
            : `Metinde ${citeLabel(number)} atfı var ama kaynakçada ${references} kaynak var.`,
          target: citeLabel(number),
        });
      }
    }
    for (let n = 1; n <= references; n++) {
      if (!cited.has(n))
        add({ tone: "warning", message: en ? `Reference ${n} in the reference list is not cited in the text.` : `Kaynakçadaki ${n}. kaynağa metinde atıf yapılmamış.` });
    }
  }

  kategori = "ozet";
  // ---------- Özet / Abstract: kılavuzun kelime ve anahtar kelime sınırları ----------
  const abstract = options.abstract;
  if (abstract && (abstract.minWords || abstract.maxWords || abstract.keywordsMin || abstract.keywordsMax)) {
    const keywordRange =
      abstract.keywordsMin && abstract.keywordsMax
        ? `${abstract.keywordsMin}–${abstract.keywordsMax}`
        : abstract.keywordsMin
          ? t(`en az ${abstract.keywordsMin}`, `at least ${abstract.keywordsMin}`)
          : t(`en fazla ${abstract.keywordsMax}`, `at most ${abstract.keywordsMax}`);
    blocks.forEach((block, index) => {
      if (block.type !== "heading") return;
      const title = textOf(block).trim();
      if (!ABSTRACT_SECTIONS.some((name) => headingMatchesSection(title, name))) return;
      const level = Number(block.attrs?.level) || 1;
      let words = 0;
      let keywords: string[] | null = null;
      for (let next = index + 1; next < blocks.length; next++) {
        const candidate = blocks[next];
        if (candidate.type === "heading" && (Number(candidate.attrs?.level) || 1) <= level) break;
        const text = textOf(candidate).trim();
        const keywordLine = KEYWORDS_LINE.exec(text);
        if (keywordLine) {
          keywords = keywordLine[1]
            .split(/[,;]/)
            .map((keyword) => keyword.replace(/[.\s]+$/, "").trim())
            .filter(Boolean);
          continue;
        }
        words += countWords(text);
      }
      if (words === 0) return; // boş bölüm yukarıda raporlanır
      if (abstract.maxWords && words > abstract.maxWords) {
        add({
          tone: "danger",
          message: en
            ? `${quote(title)} is ${words} words; the guideline allows at most ${abstract.maxWords} words.`
            : `${quote(title)} ${words} kelime; kılavuz en fazla ${abstract.maxWords} kelime istiyor.`,
          target: title,
        });
      } else if (abstract.minWords && words < abstract.minWords) {
        add({
          tone: "warning",
          message: en
            ? `${quote(title)} is ${words} words; the guideline requires at least ${abstract.minWords} words.`
            : `${quote(title)} ${words} kelime; kılavuz en az ${abstract.minWords} kelime istiyor.`,
          target: title,
        });
      }
      if (abstract.keywordsMin || abstract.keywordsMax) {
        if (!keywords) {
          add({
            tone: "warning",
            message: en
              ? `${quote(title)} has no keywords line (“Keywords: …”); the guideline requires ${keywordRange} keywords.`
              : `${quote(title)} bölümünde anahtar kelime satırı yok (“Anahtar Kelimeler: …”); kılavuz ${keywordRange} anahtar kelime istiyor.`,
            target: title,
          });
        } else if (
          (abstract.keywordsMin && keywords.length < abstract.keywordsMin) ||
          (abstract.keywordsMax && keywords.length > abstract.keywordsMax)
        ) {
          add({
            tone: "warning",
            message: en
              ? `${quote(title)} has ${keywords.length} ${keywords.length === 1 ? "keyword" : "keywords"}; the guideline requires ${keywordRange}.`
              : `${quote(title)} bölümünde ${keywords.length} anahtar kelime var; kılavuz ${keywordRange} istiyor.`,
            target: title,
          });
        }
      }
    });
  }

  // ---------- Paragraf düzeni (kılavuzda girinti/yaslama kuralı varsa) ----------
  kategori = "ek";
  /* ---------- Ekler: numaralandırma ve metinde anılma ----------
     Kılavuzlar ekleri sırayla numaralandırmayı ve her ekin metinde
     anılmasını ister ("… görüşme formu Ek 1'de verilmiştir"). Şekil ve
     tablo için yapılan denetimin aynısı; ekler dışarıda kalmıştı. */
  if (ekBasliklari.length > 0) {
    // "Ek" ya da "Appendix": başlıkların çoğunluğu hangisini kullanıyorsa (yukarıdaki gerekçe).
    const ekEtiketi = belgeEtiketi("Ek", "Appendix", ekBasliklari);
    numaralandirmaSorunlari(ekEtiketi, ekBasliklari, dil).forEach((sorun) => add(sorun));

    /*
      Ekin KENDİ başlığı gövde metninin içinde: onu "anılmış" saymak
      her eki anılmış gösterirdi. Başlık metni gövdeden bir kez
      çıkarılıyor; metinde ayrıca geçiyorsa geriye o kalıyor.
    */
    const ekGovdesi = ekBasliklari.reduce((metin, baslik) => metin.replace(baslik, " "), body);
    const ekNumaralari = ekBasliklari.map((baslik) => baslikNumarasi(ekEtiketi, baslik));
    const mevcut = new Set(ekNumaralari.filter((numara): numara is string => Boolean(numara)));

    ekBasliklari.forEach((baslik, sira) => {
      const numara = ekNumaralari[sira];
      if (!numara) return;
      // \b ASCII: "Şek. 3"teki "ek"i Ek 3 sayıyordu; sınır Unicode harfe göre (lib/sozcuk-siniri.ts).
      if (!new RegExp(`${SOZCUK_BASI}${ekEtiketi}\\s*[-–.]?\\s*${numara.replace(".", "\\.")}(?![\\p{L}\\p{N}])`, "iu").test(ekGovdesi)) {
        add({
          tone: "warning",
          message: en
            ? `${ekEtiketi} ${numara}${baslik ? ` (${quote(baslik.slice(0, 40))})` : ""} is not mentioned in the text; guidelines require every appendix to be referred to in the text.`
            : `${ekEtiketi} ${numara}${baslik ? ` (${quote(baslik.slice(0, 40))})` : ""} metinde anılmıyor; kılavuzlar her ekin metinde gönderme almasını ister.`,
          target: baslik.slice(0, 40),
        });
      }
    });

    for (const eslesme of ekGovdesi.matchAll(new RegExp(`${SOZCUK_BASI}${ekEtiketi}\\s*[-–.]?\\s*(\\d+(?:\\.\\d+)*)(?![\\p{L}\\p{N}])`, "giu"))) {
      if (!mevcut.has(eslesme[1])) {
        add({
          tone: "danger",
          message: en
            ? `The text mentions “${ekEtiketi} ${eslesme[1]}”, but there is no appendix heading with that number (the document has ${mevcut.size} numbered ${mevcut.size === 1 ? "appendix" : "appendices"}).`
            : `Metinde “${ekEtiketi} ${eslesme[1]}” geçiyor ama o numarada bir ek başlığı yok (belgede ${mevcut.size} numaralı ek var).`,
          target: eslesme[0],
        });
      }
    }
  }

  kategori = "yazim";
  /* ---------- Kısaltmalar ----------
     Denetim yalnızca yazarın KENDİ tanımlarına dayanıyor; gerekçesi
     lib/kisaltmalar.ts'te. */
  for (const sorun of kisaltmaSorunlari(body).slice(0, CITATION_ISSUE_LIMIT)) {
    add({ tone: "warning", message: kisaltmaMesaji(sorun, dil), target: sorun.hedef });
  }

  /* ---------- Uzun doğrudan alıntı ----------
     APA 7 ve Türkçe kılavuzların çoğu 40 kelimeyi aşan alıntının tırnak
     içinde değil, girintili blok alıntı olarak yazılmasını ister. Jüri
     bunu her seferinde yakalıyor, denetim hiç yakalamıyordu. */
  for (const alinti of uzunAlintilar(doc).slice(0, CITATION_ISSUE_LIMIT)) {
    add({
      tone: "warning",
      message: en
        ? `A ${alinti.kelime}-word direct quotation is written in quotation marks inside a paragraph; quotations longer than ${BLOK_ALINTI_ESIGI} words are set as indented block quotes (“Quote” on the toolbar).`
        : `${alinti.kelime} kelimelik doğrudan alıntı paragrafın içinde tırnakla yazılmış; ${BLOK_ALINTI_ESIGI} kelimeyi aşan alıntılar girintili blok alıntı olarak yazılır (araç çubuğundaki “Alıntı”).`,
      target: alinti.metin,
    });
  }

  kategori = "sekil";
  /* ---------- Şekil/tablo başlığının tarafı ----------
     Tablo başlığı tablonun üstünde, şekil başlığı şeklin altında olur.
     Word çıktısı bunu zaten varsayıyordu; metinde tersi yazılmışsa kimse
     söylemiyordu. */
  for (const yerlesim of baslikYerlesimSorunlari(doc)) {
    add({
      tone: "warning",
      message:
        yerlesim.tur === "table"
          ? en
            ? `The table caption ${quote(yerlesim.baslik)} is below the table; table captions go ABOVE the table.`
            : `${quote(yerlesim.baslik)} tablo başlığı tablonun altında; tablo başlığı tablonun ÜSTÜNDE yazılır.`
          : en
            ? `The figure caption ${quote(yerlesim.baslik)} is above the figure; figure captions go BELOW the figure.`
            : `${quote(yerlesim.baslik)} şekil başlığı şeklin üstünde; şekil başlığı şeklin ALTINDA yazılır.`,
      target: yerlesim.baslik,
    });
  }

  kategori = "bicim";
  /* ---------- Yazı tipi, punto, satır aralığı ----------
     Kılavuzun ilk maddesi budur ("Times New Roman, 12 punto, 1,5 satır
     aralığı") ve denetlenmiyordu: kılavuz değerleri editörün varsayılanı
     olarak uygulanıyordu ama metne elle verilmiş biçim varsayılanı
     eziyordu. Öğrenci ekranda tek tip bir belge görüyor, jüriye giden
     dosyada üç ayrı yazı tipi oluyordu. */
  if (options.textFormat) {
    const rapor = metinBiciminiDenetle(doc, options.textFormat);
    const yaz = (baslik: string, sapmalar: { deger: string; sayi: number; ornek: string }[], beklenen: string) => {
      if (sapmalar.length === 0) return;
      const ilk = sapmalar[0];
      const yer = sapmalar.reduce((toplam, sapma) => toplam + sapma.sayi, 0);
      const kalan = sapmalar.length - 1;
      const digerleri = kalan > 0 ? (en ? ` (and ${kalan} other ${kalan === 1 ? "value" : "values"})` : ` (ve ${kalan} farklı değer daha)`) : "";
      add({
        tone: "warning",
        message: en
          ? `${baslik}: ${ilk.deger}${digerleri} used in ${yer} ${yer === 1 ? "place" : "places"}; the guideline requires ${beklenen}.`
          : `${baslik}: ${yer} yerde ${ilk.deger}${digerleri} kullanılmış; kılavuz ${beklenen} istiyor.`,
        target: ilk.ornek,
        action: "clear-manual-text-format",
      });
    };
    if (rapor) {
      yaz(t("Yazı tipi", "Font"), rapor.yaziTipi, options.textFormat.fontFamily ?? "");
      yaz(t("Punto", "Font size"), rapor.punto, options.textFormat.fontSizePt ? `${options.textFormat.fontSizePt} pt` : "");
      const aralik = options.textFormat.lineSpacing;
      yaz(t("Satır aralığı", "Line spacing"), rapor.satirAraligi, aralik ? (en ? String(aralik) : String(aralik).replace(".", ",")) : "");
    }
  }

  if (options.paragraphFormat) {
    const report = checkParagraphFormat(doc, options.paragraphFormat);
    const off = report ? Math.max(report.wrongIndent, report.notJustified) : 0;
    if (report && off > 0) {
      const parts = (
        en
          ? [
              report.wrongIndent ? `${report.wrongIndent} ${report.wrongIndent === 1 ? "paragraph has" : "paragraphs have"} an indent that differs from the guideline` : "",
              report.notJustified ? `${report.notJustified} ${report.notJustified === 1 ? "paragraph is" : "paragraphs are"} not justified` : "",
            ]
          : [
              report.wrongIndent ? `${report.wrongIndent} paragrafta girinti kılavuzdaki gibi değil` : "",
              report.notJustified ? `${report.notJustified} paragraf iki yana yaslı değil` : "",
            ]
      ).filter(Boolean);
      add({
        tone: "warning",
        message: en
          ? `${parts.join(", ")} (guideline: ${describeParagraphFormat(options.paragraphFormat, dil)}). ${report.total} body ${report.total === 1 ? "paragraph" : "paragraphs"} in total.`
          : `${parts.join(", ")} (kılavuz: ${describeParagraphFormat(options.paragraphFormat)}). Toplam ${report.total} gövde paragrafı.`,
        target: report.firstTarget,
        action: "apply-paragraph-format",
      });
    }
  }

  kategori = "dipnot";
  // ---------- Dipnotlar ----------
  for (const number of footnoteProblems) {
    add({
      tone: "warning",
      message: en ? `Footnote ${number} is empty; click the footnote marker and write its text.` : `${number}. dipnotun metni boş; dipnot işaretine tıklayıp metnini yazın.`,
    });
  }

  /*
    Kırpma her zaman SÖYLENİYOR. "Liste bitti" ile "liste doldu" aynı şey
    değil; ikincisini birincisi gibi göstermek, öğrenciye düzeltecek bir
    şeyi kalmadığını söylemek olur.
  */
  if (atlananSorun > 0) {
    issues.push({
      tone: "warning",
      message: en
        ? `…and ${atlananSorun} more ${atlananSorun === 1 ? "issue" : "issues"}. The list stops at the first ${MAX_ISSUES} issues; `
          + "some checks may not have been able to report at all. Fix the ones above and the rest will appear."
        : `…ve ${atlananSorun} sorun daha. Liste ilk ${MAX_ISSUES} sorunda kesiliyor; `
          + "bazı denetimlerin sonucu hiç yazılamamış olabilir. Üsttekileri düzeltince kalanlar görünür.",
    });
  }

  return issues;
}
