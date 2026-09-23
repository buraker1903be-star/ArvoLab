/*
  Akademik doğrulama önbelleğinin anahtarı. Saf modül; testi
  tests/unit/kaynak-anahtari.test.ts.

  NEDEN VAR: doğrulama her çalıştırmada aynı kaynakları yeniden soruyordu.
  Öğrenci bir yazım hatasını düzeltip denetimi tekrarladığında aynı 25
  künye için Crossref ve OpenAlex'e yine 50 istek gidiyordu. Üstelik
  120 kaynaklı bir tezde ilk 25'ten sonrası HİÇ bakılamıyordu — sınır
  "nezaket" gereği konmuştu (iki dizin de ücretsiz), ama sınır boşa giden
  isteklerle doluyordu.

  Önbellekle sınır yalnızca DAHA ÖNCE BAKILMAMIŞ künyelere harcanıyor;
  böylece uzun kaynakça birkaç çalıştırmada tamamen kapanıyor ve dizinlere
  giden yük düşüyor.

  ANAHTAR, DİZİNE GİDEN SORGUNUN AYNISINDAN ÜRETİLİYOR. Sorgu
  `title || raw`, puanlama da `title` ve `year` kullanıyor
  (academic-reference-verification.ts); anahtar da tam olarak bu ikisinden
  türüyor. Daha fazlasını katmak (ör. yazarlar) aynı kaynağı farklı
  anahtarlara bölerdi; daha azını katmak (ör. yılı atlamak) farklı
  sonuçları aynı kutuya koyardı.

  ÖĞRENCİNİN HAM METNİ SAKLANMIYOR. Anahtar normalleştirilmiş biçim;
  noktalama, büyük-küçük harf ve Türkçe aksan farkları eleniyor. Aynı
  makaleyi iki öğrenci biraz farklı yazdığında da aynı kutuya düşüyorlar —
  önbelleğin asıl kazancı bu.
*/

const DURAK_KELIMELER = new Set([
  "a", "an", "and", "the", "of", "in", "on", "for", "to", "ve", "ile",
  "bir", "bu", "da", "de", "için", "üzerine",
]);

/** Anahtarın taşıyacağı en fazla kelime; uzun künye anahtarı şişirmesin. */
const EN_COK_KELIME = 24;

function kelimeler(deger: string): string[] {
  return deger
    // Türkçe küçültme: I→ı, İ→i. Genel toLowerCase "I"yı "i" yapar ve
    // "IŞIK" ile "ışık" ayrı anahtarlara düşerdi.
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9çğıöşü]+/gi, " ")
    .split(/\s+/)
    .filter((kelime) => kelime.length > 1 && !DURAK_KELIMELER.has(kelime));
}

/**
 * Künyenin önbellek anahtarı. Anlamlı bir sorgu üretilemiyorsa null:
 * çağıran o künyeyi önbelleğe hiç sokmamalı.
 */
export function dogrulamaAnahtari(kunye: { title: string | null; year: string | null; raw: string }): string | null {
  const temel = kunye.title?.trim() || kunye.raw?.trim() || "";
  const parcalar = kelimeler(temel).slice(0, EN_COK_KELIME);
  /*
    Tek kelimelik bir "başlık" ayrıştırma hatasıdır; onu anahtarlamak
    binlerce ayrı künyeyi aynı kutuda toplardı.
  */
  if (parcalar.length < 2) return null;

  /*
    Yıl anahtarın parçası çünkü puanlamaya giriyor: aynı başlığın 2019 ve
    2020 baskısı farklı sonuç verir. Yıl yoksa boş bırakılıyor — "yılsız"
    da bir durumdur ve kendi kutusunu hak eder.
  */
  const yil = /^\d{4}$/.test(kunye.year?.trim() ?? "") ? kunye.year!.trim() : "";
  return `${parcalar.join(" ")}|${yil}`;
}
