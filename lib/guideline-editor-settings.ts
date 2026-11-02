import type { PageMargins } from "@/app/actions/manuscript";
import { validHangingCm, validIndentCm } from "@/lib/paragraph-format";
import { kagitMi, type KagitBoyutu } from "@/lib/kagit-boyutu";
import {
  altBaslikGirintisiMi,
  bolumHizasiMi,
  dipnotPuntosuMu,
  paragrafAraligiMi,
  sayfaNumarasiKonumuMu,
  type AltBaslikGirintisi,
  type BolumHizasi,
  type ParagrafAraligi,
  type SayfaNumarasiKonumu,
} from "@/lib/kilavuz-bicim";

export interface GuidelineEditorSettings {
  margins?: PageMargins;
  showPageNumbers?: boolean;
  /** Kılavuz başlıkların ondalık numaralanmasını istiyor ("1.", "1.1.") */
  headingNumbering?: boolean;
  /** Birinci düzey (ana bölüm) başlıkları büyük harfle */
  chapterUppercase?: boolean;
  /** Her ana bölüm yeni sayfadan başlar */
  chapterNewPage?: boolean;
  /** Gövde paragraflarının ilk satır girintisi (cm) */
  paragraphIndentCm?: number;
  /** Kaynakça girdilerinin asılı girintisi (cm); APA ve Chicago zorunlu tutar */
  referenceHangingIndentCm?: number;
  /** Gövde paragrafları iki yana yaslı */
  justify?: boolean;
  /** Özet/Abstract kelime ve anahtar kelime sınırları */
  abstract?: AbstractRules;
  /*
    Tezin BÜTÜNÜNÜN kelime sınırı (29.10.2026). İngiltere ve Avustralya
    kılavuzları sınırı sayfayla değil kelimeyle veriyor ("100,000 words");
    sayfa sınırının sütunu var, bunun yok — kural kümesinde taşınıyor.
  */
  thesisWords?: { min?: number; max?: number };
  /** Kılavuzun açıkça söylediği kâğıt boyutu (lib/kagit-boyutu.ts); söylemiyorsa yok. */
  pageSize?: KagitBoyutu;
  fontFamily?: string;
  fontSizePt?: number;
  lineSpacing?: number;
  /* İnce biçim kuralları (02.11.2026, lib/kilavuz-bicim.ts): editör, baskı ve Word üçü de uygular. */
  /** Dipnot metninin puntosu */
  footnoteSizePt?: number;
  /** Gövde paragraflarının öncesi/sonrası (nk) */
  paragraphSpacing?: ParagrafAraligi;
  /** Birinci düzey başlıkların hizası */
  chapterAlign?: BolumHizasi;
  /** Ortalanan bölümlerin İSTİSNASI: sola yaslanan ana başlıklar ("Giriş", "Kaynakça") */
  chapterLeftSections?: string[];
  /** Sayfa numarasının yeri; yoksa alt orta */
  pageNumberPosition?: SayfaNumarasiKonumu;
  /** Varsayılan numaralandırmada numaralı olup bu kılavuzda numarasız kalan ana başlıklar */
  unnumberedSections?: string[];
  /** Belli düzeyden itibaren alt başlıkların sol girintisi (cm) */
  subheadingIndent?: AltBaslikGirintisi;
  /** Ön sayfalar küçük Romen rakamıyla, ana metin (Giriş) 1'den Arap rakamıyla */
  frontMatterRoman?: boolean;
}

/* Ad listesi: metin, boş olmayan, makul uzunlukta; en çok 12 ad. */
const adListesi = (deger: unknown): string[] | undefined => {
  if (!Array.isArray(deger)) return undefined;
  const adlar = deger.filter((a): a is string => typeof a === "string" && a.trim().length > 0 && a.length <= 60).map((a) => a.trim()).slice(0, 12);
  return adlar.length ? adlar : undefined;
};

const numberValue = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === "number" || (typeof item === "string" && item.trim()));
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export interface AbstractRules {
  minWords?: number;
  maxWords?: number;
  keywordsMin?: number;
  keywordsMax?: number;
}

const intInRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : undefined;

/** "150–250 kelime · 3–5 anahtar kelime" */
export function describeAbstractRules(rules: AbstractRules, dil: "tr" | "en" = "tr"): string {
  const en = dil === "en";
  const range = (min?: number, max?: number) =>
    min && max ? `${min}–${max}` : min ? (en ? `at least ${min}` : `en az ${min}`) : max ? (en ? `at most ${max}` : `en fazla ${max}`) : "";
  return [
    range(rules.minWords, rules.maxWords) ? `${range(rules.minWords, rules.maxWords)} ${en ? "words" : "kelime"}` : "",
    range(rules.keywordsMin, rules.keywordsMax) ? `${range(rules.keywordsMin, rules.keywordsMax)} ${en ? "keywords" : "anahtar kelime"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

const ALLOWED_FONTS = new Set([
  "Times New Roman", "Arial", "Calibri", "Cambria", "Garamond", "Georgia", "Verdana", "Book Antiqua",
]);

function abstractRulesFrom(rules: Record<string, unknown>): { abstract?: AbstractRules } {
  let minWords = intInRange(rules.abstract_min_words, 20, 2000);
  const maxWords = intInRange(rules.abstract_max_words, 20, 2000);
  let keywordsMin = intInRange(rules.keywords_min, 1, 20);
  const keywordsMax = intInRange(rules.keywords_max, 1, 20);
  // Çelişkili aralıkta alt sınır yok sayılır (üst sınır kılavuzun asıl şartıdır)
  if (minWords && maxWords && minWords > maxWords) minWords = undefined;
  if (keywordsMin && keywordsMax && keywordsMin > keywordsMax) keywordsMin = undefined;
  const abstract: AbstractRules = {
    ...(minWords ? { minWords } : {}),
    ...(maxWords ? { maxWords } : {}),
    ...(keywordsMin ? { keywordsMin } : {}),
    ...(keywordsMax ? { keywordsMax } : {}),
  };
  return Object.keys(abstract).length ? { abstract } : {};
}

function tezKelimeSiniri(rules: Record<string, unknown>): { thesisWords?: { min?: number; max?: number } } {
  let min = intInRange(rules.thesis_min_words, 1000, 300000);
  const max = intInRange(rules.thesis_max_words, 1000, 300000);
  if (min && max && min >= max) min = undefined;
  if (!min && !max) return {};
  return { thesisWords: { ...(min ? { min } : {}), ...(max ? { max } : {}) } };
}

/** Farklı çıkarım sürümlerindeki anahtarları tek editör modeline dönüştürür. */
export function normalizeGuidelineEditorSettings(raw: unknown): GuidelineEditorSettings {
  if (!raw || typeof raw !== "object") return {};
  const rules = raw as Record<string, unknown>;
  const marginRules = (rules.margins_cm ?? rules.margins ?? {}) as Record<string, unknown>;
  const top = numberValue(marginRules.top, rules.margin_top_cm);
  const bottom = numberValue(marginRules.bottom, rules.margin_bottom_cm);
  const left = numberValue(marginRules.left, rules.margin_left_cm);
  const right = numberValue(marginRules.right, rules.margin_right_cm);
  const fontSizePt = numberValue(rules.font_size_pt, rules.font_size);
  const lineSpacing = numberValue(rules.line_spacing);
  const fontFamily = typeof rules.font_family === "string" && ALLOWED_FONTS.has(rules.font_family)
    ? rules.font_family
    : undefined;

  /*
    Son savunma: ONAYLANMIŞ anlık görüntülerde de saçma boşluk olabilir.
    Canlıda oldu — Burdur Fen Bilimleri kılavuzu "üst 29,7 cm" ile onaylandı
    (A4'ün tam yüksekliği, sayfa ölçüsünden kaçmış). Tarayıcı artık böyle
    bir değeri almıyor ama eski kayıtlar yeniden taranana kadar duruyor ve
    onlar öğrencinin editörüne İNİYOR.

    Aralık dışı tek bir değer bütün kümeyi düşürüyor: üçü doğru biri saçma
    bir sayfa düzeni, hiç düzen olmamasından kötüdür.
  */
  const makulBosluk = (deger?: number) => deger !== undefined && deger >= 0.5 && deger <= 8;
  const bosluklarMakul = [top, bottom, left, right].every(makulBosluk);

  return {
    ...(bosluklarMakul ? { margins: { top: top!, bottom: bottom!, left: left!, right: right! } } : {}),
    ...(typeof rules.show_page_numbers === "boolean"
      ? { showPageNumbers: rules.show_page_numbers }
      : typeof rules.page_numbers === "boolean"
        ? { showPageNumbers: rules.page_numbers }
        : {}),
    ...(typeof rules.heading_numbering === "boolean" ? { headingNumbering: rules.heading_numbering } : {}),
    ...(typeof rules.chapter_uppercase === "boolean" ? { chapterUppercase: rules.chapter_uppercase } : {}),
    ...(typeof rules.chapter_new_page === "boolean" ? { chapterNewPage: rules.chapter_new_page } : {}),
    ...(validIndentCm(rules.paragraph_indent_cm) ? { paragraphIndentCm: validIndentCm(rules.paragraph_indent_cm) } : {}),
    ...(validHangingCm(rules.reference_hanging_indent_cm ?? rules.hanging_indent_cm)
      ? { referenceHangingIndentCm: validHangingCm(rules.reference_hanging_indent_cm ?? rules.hanging_indent_cm) }
      : {}),
    ...(typeof rules.justify === "boolean" ? { justify: rules.justify } : {}),
    ...abstractRulesFrom(rules),
    ...tezKelimeSiniri(rules),
    ...(kagitMi(rules.page_size) ? { pageSize: rules.page_size } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...(fontSizePt && fontSizePt >= 8 && fontSizePt <= 24 ? { fontSizePt } : {}),
    ...(lineSpacing && lineSpacing >= 1 && lineSpacing <= 3 ? { lineSpacing } : {}),
    ...(dipnotPuntosuMu(rules.footnote_size_pt) ? { footnoteSizePt: rules.footnote_size_pt } : {}),
    ...(paragrafAraligiMi(rules.paragraph_spacing_pt) ? { paragraphSpacing: rules.paragraph_spacing_pt } : {}),
    ...(bolumHizasiMi(rules.chapter_align) ? { chapterAlign: rules.chapter_align } : {}),
    ...(bolumHizasiMi(rules.chapter_align) && adListesi(rules.chapter_left_sections)
      ? { chapterLeftSections: adListesi(rules.chapter_left_sections) }
      : {}),
    ...(sayfaNumarasiKonumuMu(rules.page_number_position) ? { pageNumberPosition: rules.page_number_position } : {}),
    ...(adListesi(rules.unnumbered_sections) ? { unnumberedSections: adListesi(rules.unnumbered_sections) } : {}),
    ...(altBaslikGirintisiMi(rules.subheading_indent) ? { subheadingIndent: rules.subheading_indent } : {}),
    ...(rules.front_matter_roman === true ? { frontMatterRoman: true } : {}),
  };
}
