// Otomatik başlık numaralandırma ("1.", "1.1.", "1.1.1."). Numara metne yazılmaz:
// editörde süsleme olarak, Word ve baskı çıktısında başlığın önüne eklenir. Böylece
// araya bölüm eklenince/silinince numaralar kendiliğinden düzelir.
// Ön ve arka bölümler (Özet, İçindekiler, Kaynakça, Ekler…) ve bunların alt başlıkları
// numarasız kalır. Karşılaştırma section-match ile aynı kuralla yapılır (büyük/küçük harf,
// Türkçe I/İ, baştaki numara ve sondaki noktalama gözetilmez).
import { normalizeHeading } from "@/lib/section-match";
import { adListedeMi } from "@/lib/kilavuz-bicim";

const UNNUMBERED_SECTIONS = new Set(
  [
    "Onay Sayfası",
    "Tez Onay Sayfası",
    "Beyan",
    "Etik Beyan",
    "Bilimsel Etik Bildirimi",
    "Etik Kurul Onayı",
    "Önsöz",
    "Teşekkür",
    "Özet",
    "Abstract",
    "Genişletilmiş Özet",
    "Extended Abstract",
    "İçindekiler",
    "Kısaltmalar",
    "Kısaltmalar Listesi",
    "Simgeler ve Kısaltmalar",
    "Simgeler ve Kısaltmalar Listesi",
    "Tablolar Listesi",
    "Şekiller Listesi",
    "Çizelgeler Listesi",
    "Grafikler Listesi",
    "Sözlük",
    "Kaynakça",
    "Kaynaklar",
    "Ekler",
    "Özgeçmiş",
    /*
      İngilizce karşılıklar (28.10.2026). Arayüz iki dilli oldu ve İngilizce
      tez yazan öğrencinin "References" ya da "List of Figures" başlığı
      "7. References" diye numaralanıyordu. "Summary" bilerek yok: bazı
      tezlerde numaralı bir sonuç bölümünün adı.
    */
    "Approval Page",
    "Declaration",
    "Statement of Originality",
    "Ethics Statement",
    "Dedication",
    "Preface",
    "Foreword",
    "Acknowledgments",
    "Acknowledgements",
    "Table of Contents",
    "Contents",
    "Abbreviations",
    "List of Abbreviations",
    "Symbols and Abbreviations",
    "List of Symbols",
    "List of Symbols and Abbreviations",
    "List of Tables",
    "List of Figures",
    "List of Charts",
    "Glossary",
    "References",
    "Bibliography",
    "Works Cited",
    "Appendices",
    "Curriculum Vitae",
    "Vita",
  ].map(normalizeHeading)
);

/*
  "EK", "EKLER", "EK 1: Anket Formu", "EK-A", "EK A" — "EKONOMİK ETKİLER"
  ve "EK ANALİZLER" değil. "EK"ten sonra bir numara ya da TEK harf
  gelmeli; eskiden boşluk yetiyordu ve "Ek Analizler" başlığı (ile bütün
  alt başlıkları) numarasını editörde, baskıda, Word'de ve içindekilerde
  kaybediyordu.
*/
const APPENDIX = /^(?:EKLER(?=$|[\s:.])|EK(?=$|\s*[-–:.]?\s*(?:\d|[A-Z](?![A-Z]))))/;
// "APPENDIX", "Appendix A: Survey", "APPENDICES" — normalizeHeading İ'yi I'ya indiriyor.
const APPENDIX_EN = /^APPENDI(X|CES)(?=$|[\s\-–:.\d])/;

export function isUnnumberedHeading(text: string): boolean {
  const normalized = normalizeHeading(text);
  return UNNUMBERED_SECTIONS.has(normalized) || APPENDIX.test(normalized) || APPENDIX_EN.test(normalized);
}

/**
 * Her başlığın numarası ("1.2.") ya da numarasızsa null; sıra girişle aynıdır.
 *
 * `ekNumarasiz`: kılavuzun AYRICA numarasız tuttuğu ana başlıklar (02.11.2026,
 * lib/kilavuz-bicim.ts). DEÜ SBE "Giriş ve Sonuç başlıkları ayrı bir bölüm
 * olmadığından numaralandırma yapılmayacaktır" diyor; varsayılan liste ikisini
 * de numaralıyordu ve öğrencinin tezinde "1. GİRİŞ" yazıyordu.
 */
export function numberHeadings(
  headings: { level: number; text: string }[],
  ekNumarasiz?: readonly string[],
): (string | null)[] {
  const counters = [0, 0, 0, 0, 0, 0];
  // Numarasız bir bölümün altındaki başlıklar da numarasızdır (ör. EKLER > Ek 1).
  let unnumberedParent: number | null = null;
  return headings.map(({ level, text }) => {
    const depth = Math.min(Math.max(Math.round(level), 1), counters.length);
    if (unnumberedParent !== null && depth > unnumberedParent) return null;
    unnumberedParent = null;
    if (isUnnumberedHeading(text) || (depth === 1 && adListedeMi(text, ekNumarasiz))) {
      unnumberedParent = depth;
      return null;
    }
    counters[depth - 1] += 1;
    for (let i = depth; i < counters.length; i++) counters[i] = 0;
    const parts = counters.slice(0, depth);
    // Üst düzey başlık olmadan başlayan alt başlık "0.1." değil "1." olur.
    const first = parts.findIndex((n) => n > 0);
    return `${parts.slice(first).join(".")}.`;
  });
}

interface JsonNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  content?: JsonNode[];
}

const jsonText = (node: JsonNode): string => node.text ?? (node.content ?? []).map(jsonText).join("");

/**
 * Kayıtlı belge (JSON) için başlık → numara eşlemesi. Anahtar düğüm nesnesinin kendisidir;
 * Word ve baskı çıktısı belgeyi hangi sırayla gezerse gezsin doğru numarayı bulur.
 */
export function headingNumberMap(
  doc: { content?: JsonNode[] } | null | undefined,
  ekNumarasiz?: readonly string[],
): Map<JsonNode, string> {
  const headings: JsonNode[] = [];
  const walk = (nodes: JsonNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "heading") headings.push(node);
      else if (node.content && node.type !== "paragraph") walk(node.content);
    }
  };
  walk(doc?.content);
  const numbers = numberHeadings(
    headings.map((node) => ({ level: Number(node.attrs?.level) || 1, text: jsonText(node) })),
    ekNumarasiz,
  );
  const map = new Map<JsonNode, string>();
  headings.forEach((node, index) => {
    const number = numbers[index];
    if (number) map.set(node, number);
  });
  return map;
}

// Elle yazılmış numara: "1. Giriş", "1.2. Amaç", "2.3 Örneklem" — "2023 yılında" değil.
const MANUAL_NUMBER = /^\s*(\d+(\.\d+)*\.|\d+(\.\d+)+)\s+(?=\S)/;

export function hasManualNumber(text: string): boolean {
  return MANUAL_NUMBER.test(text);
}

export function stripManualNumber(text: string): string {
  return text.replace(MANUAL_NUMBER, "");
}

export type IcindekilerSatiri = { level: number; text: string; numara: string | null };

/**
 * İçindekiler satırları (H1–H3), belgedeki sırayla ve çıktıdaki numarasıyla.
 *
 * Word çıktısı (tiptap-docx: içindekiler alanının ÖNCEDEN DOLU içeriği) ve
 * yazdırma/PDF (print-sheet) aynı listeyi kullanıyor. Eskiden Word'de
 * içindekiler yalnızca boş bir alandı — Word açılışta güncelleyene kadar,
 * Google Docs ve LibreOffice'te HİÇ dolmuyordu; PDF'te ise içindekiler
 * yoktu (27.10.2026).
 */
export function icindekilerSatirlari(
  doc: { content?: JsonNode[] } | null | undefined,
  numaralama: boolean,
  ekNumarasiz?: readonly string[],
): IcindekilerSatiri[] {
  const numaralar = numaralama ? headingNumberMap(doc, ekNumarasiz) : new Map<JsonNode, string>();
  const satirlar: IcindekilerSatiri[] = [];
  const walk = (nodes: JsonNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "heading") {
        const level = Number(node.attrs?.level) || 1;
        const text = jsonText(node).trim();
        if (level <= 3 && text) satirlar.push({ level, text, numara: numaralar.get(node) ?? null });
      } else if (node.content && node.type !== "paragraph") walk(node.content);
    }
  };
  walk(doc?.content);
  return satirlar;
}

/*
  ÖN SAYFALAR VE ANA METİN (02.11.2026). Türk tez kılavuzlarının ortak
  kuralı: ön sayfalar (Özet, İçindekiler, Kısaltmalar …) küçük Romen
  rakamıyla, Giriş'ten itibaren 1'den başlayan Arap rakamıyla numaralanır
  (DEÜ SBE 1.6). Ana metin, numarasız ÖN bölüm OLMAYAN ilk birinci düzey
  başlıkta başlar: Giriş kılavuz gereği numarasız olsa da (lib/kilavuz-bicim.ts)
  bir ön sayfa değildir. Arka bölümler (Kaynakça, Ekler, Özgeçmiş) ön
  sayfa sayılmaz — yalnızca onlardan oluşan bir belge "ana metin yok"
  demek değil.
*/
const ARKA_BOLUMLER = new Set(
  [
    "Kaynakça", "Kaynaklar", "Ekler", "Özgeçmiş", "Sözlük",
    "References", "Bibliography", "Works Cited", "Appendices", "Curriculum Vitae", "Vita", "Glossary",
  ].map(normalizeHeading),
);

/** Başlık bir ÖN sayfanın başlığı mı (Özet, Önsöz, İçindekiler, Kısaltmalar …)? */
export function onSayfaBasligiMi(text: string): boolean {
  const n = normalizeHeading(text);
  if (APPENDIX.test(n) || APPENDIX_EN.test(n) || ARKA_BOLUMLER.has(n)) return false;
  return UNNUMBERED_SECTIONS.has(n);
}

/**
 * Belgenin üst düzey düğümleri içinde ana metnin başladığı yer: ön sayfa
 * olmayan ilk H1'in sırası. Hiç H1 yoksa 0 (her şey ana metin); H1'lerin
 * hepsi ön sayfaysa düğüm sayısı (ana metin yok).
 */
export function anaMetinBaslangici(doc: { content?: JsonNode[] } | null | undefined): number {
  const dugumler = doc?.content ?? [];
  for (const [sira, dugum] of dugumler.entries()) {
    if (dugum.type === "heading" && (Number(dugum.attrs?.level) || 1) === 1 && !onSayfaBasligiMi(jsonText(dugum))) return sira;
  }
  return dugumler.some((d) => d.type === "heading" && (Number(d.attrs?.level) || 1) === 1) ? dugumler.length : 0;
}

/** Küçük Romen rakamı (i, ii, iii …); ön sayfa numarası. */
export function romen(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  const tablo: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let kalan = n;
  let sonuc = "";
  for (const [deger, harf] of tablo) {
    while (kalan >= deger) {
      sonuc += harf;
      kalan -= deger;
    }
  }
  return sonuc;
}

/**
 * Sayfalı baskıda her sayfanın numara etiketi (app/print/manuscript/sayfali-baski.tsx).
 * Kapak (varsa) numarasız; ana metinden önceki sayfalar i, ii, iii …
 * (kapak da sayılır, yazılmaz); ana metin 1'den. `anaSayfa` ana metnin
 * başladığı sayfanın sırası; yoksa (-1) her sayfa ön sayfadır.
 *
 * Paged.js'in kendi sayacına bırakılmadı: sayfa sayacını bir sayfada
 * sıfırlamak yalnızca O sayfayı etkiliyordu (Chromium'da ölçüldü: Giriş 1,
 * sonraki sayfa yine 4).
 */
export function sayfaEtiketleri(sayfaSayisi: number, anaSayfa: number, kapakVar: boolean): string[] {
  return Array.from({ length: Math.max(0, sayfaSayisi) }, (_, i) => {
    if (kapakVar && i === 0) return "";
    if (anaSayfa >= 0 && i >= anaSayfa) return String(i - anaSayfa + 1);
    return romen(i + 1);
  });
}
