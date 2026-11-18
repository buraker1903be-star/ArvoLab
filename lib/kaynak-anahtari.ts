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

/*
  KİMLİK: DOI (RC06k, 17.11.2026). Anahtar yalnızca "başlık|yıl" idi ve önbellek
  BÜTÜN kullanıcılar için ortak: aynı başlık ve yıldaki iki FARKLI eser (iki
  DOI) aynı kutuya düşüyordu. A'nın künyesi (DOI X) doğrulanınca B'nin künyesi
  (DOI Y) önbellekten X'in kaydını alıyor, PDF satırına X yazılıyor ve atıf
  kesin eşleşmeye ulaşamıyordu (RC06k tam zincir kabulü; gerçekte "Editorial",
  "Introduction" gibi genel başlıklarda). Künye DOI taşıyorsa eserin kimliği
  DOI'dir: anahtar DOI'den üretilir, başlık kutusuna hiç girmez.

  SÜRÜM ÖNEKİ: eski biçimli satırlar Production'da 7–90 gün yaşıyor ve bir
  kısmı yanlış eşleşmeyi taşıyor olabilir. Önek değişince eski anahtarların
  hiçbiri okunmaz; satırlar silinmez, süreleri dolunca temizlik götürür.
  Biçim bir daha değişirse önek artırılır.
*/
export const DOGRULAMA_ANAHTAR_SURUMU = "v2";

const DOI_KALIBI = /^10\.\d{4,9}\/\S+$/;

/**
 * DOI'nin kimlik biçimi: doi.org/ ve "doi:" öneki atılır, sondaki noktalama
 * kesilir, KÜÇÜK HARFE çevrilir (DOI büyük-küçük harf duyarsızdır; eskiden
 * karşılaştırmalar "10.1/ABC" ile "10.1/abc"yi iki eser sayabiliyordu).
 * Gösterim için değil, yalnızca karşılaştırma ve anahtar için.
 */
export function doiKimligi(deger: string | null | undefined): string | null {
  if (typeof deger !== "string") return null;
  let d = deger.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  try {
    d = decodeURIComponent(d);
  } catch {
    /* geçersiz kodlama: olduğu gibi */
  }
  d = d.replace(/[.,;:)\]}>'"#]+$/, "").toLowerCase();
  return DOI_KALIBI.test(d) ? d : null;
}

/** Ham künyede yazılı DOI (doi.org bağlantısı, "doi:" ya da çıplak 10.x/…); yoksa null. */
export function kunyeDoisi(ham: string | null | undefined): string | null {
  const bulunan = String(ham ?? "").match(/10\.\d{4,9}\/[^\s"<>]+/);
  return bulunan ? doiKimligi(bulunan[0]) : null;
}

/**
 * Künyenin önbellek anahtarı. Anlamlı bir sorgu üretilemiyorsa null:
 * çağıran o künyeyi önbelleğe hiç sokmamalı.
 */
/** "Yılmaz, A." → "yılmaz" · "Ali Taş" → "taş". Doğrulamanın yazar kapısı da bunu kullanır: iki yer aynı soyadını görmeli. */
export function soyadKimligi(ad: string): string {
  const temiz = ad.trim();
  const parca = temiz.includes(",") ? temiz.split(",")[0] : temiz.split(/\s+/).at(-1) ?? "";
  return parca.toLocaleLowerCase("tr-TR").replace(/[^\p{L}]/gu, "");
}

export function dogrulamaAnahtari(kunye: { title: string | null; year: string | null; raw: string; authors?: string[] | null }): string | null {
  const doi = kunyeDoisi(kunye.raw);
  if (doi) return `${DOGRULAMA_ANAHTAR_SURUMU}|doi:${doi}`;
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
  /*
    İlk yazarın soyadı da anahtarda (PR #105 incelemesi). Yalnızca
    "başlık|yıl" iken aynı başlık ve yıldaki iki FARKLI eser (farklı
    yazarlar) aynı kutuya düşüyor, birinin "doğrulandı" hükmü ötekinin
    künyesine taşınıyordu. Yazarsız künye boş soyadla kendi kutusunda kalır.
    Sıcak okumada yazar kapısı ayrıca yeniden çalışır
    (academic-reference-verification.ts, sicakHukum): anahtar tek savunma değil.
  */
  const yazar = kunye.authors?.[0] ? soyadKimligi(kunye.authors[0]) : "";
  return `${DOGRULAMA_ANAHTAR_SURUMU}|${yazar}|${parcalar.join(" ")}|${yil}`;
}
