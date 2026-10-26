/*
  KAYNAK PDF'LERİ: saf yardımcılar (26.10.2026, kurum sahibinin geri
  bildirimi: "kaynakçaların uydurma olmaması önemli; verdiği kaynakların
  PDF'lerini tek tek kontrol edip ulaşılabilir olması gerekli").

  Kaynakça denetimi kaydın dizinde (Crossref, OpenAlex) VAR olduğunu
  gösteriyordu; kaynağın kendisine ulaşılabildiğini göstermiyordu. Burada
  her künye için:
    1. Dizinde kaydı yoksa → "kayıt yok" (uydurma şüphesi; PDF aranmaz).
    2. DOI'si varsa OpenAlex'in açık erişim konumlarından PDF adayları.
    3. Aday gerçekten indirilir ve İLK BAYTLARI "%PDF-" olmalı: yayınevinin
       giriş sayfası ya da "erişiminiz yok" HTML'i PDF sayılmaz.
  Ücretli kaynağın PDF'i otomatik ÇEKİLMEZ (hem teknik hem yayınevi
  kuralları); öğrenci kendi indirdiğini yükler.

  Bilerek "use server" DEĞİL (AGENTS.md). Testi tests/unit/kaynak-pdf.test.ts.
*/

export type PdfDurumu = "indirildi" | "yuklendi" | "bulunamadi" | "erisilemedi" | "kayit_yok";
export type DogrulamaDurumu = "verified" | "possible_match" | "not_found" | "insufficient_data";

/** kaynak_pdfleri satırı (migration 20261026110024). */
export type KaynakPdfSatiri = {
  id: string;
  kunye_anahtari: string;
  kunye: string;
  doi: string | null;
  durum: PdfDurumu;
  depo_yolu: string | null;
  kaynak_adres: string | null;
  baslik_eslesti: boolean | null;
  bakildi: string;
};

/** Depolama kovasının sınırı (project-files, migration 20260924100000) ile aynı. */
export const PDF_EN_FAZLA_BAYT = 20 * 1024 * 1024;

/*
  Künyenin anahtarı: aynı künye denetimden denetime aynı satıra düşsün.
  Büyük-küçük harf, noktalama ve boşluk farkı yok sayılır; Türkçe harfler
  korunur (I→ı, İ→i: genel toLowerCase "IŞIK"ı "ışık"tan ayırırdı).
*/
export function kunyeAnahtari(kunye: string): string {
  return kunye
    .replace(/I/g, "ı")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 400);
}

/*
  Künyedeki başlık: "Yazar (Yıl). Başlık. Dergi…" düzeninde ")." sonrası
  ilk cümle; yıl parantezi yoksa ilk noktadan sonraki cümle. Yazar
  adlarındaki "M. H." kısaltmaları başlık sanılmasın diye önce ")."
  aranır.
*/
export function kunyeBasligi(kunye: string): string {
  const yildanSonra = kunye.match(/\)\.\s*(.+)/)?.[1];
  const kalan = yildanSonra ?? kunye.split(/\.\s+/).slice(1).join(". ");
  return (kalan.split(/\.\s+/)[0] ?? "").trim();
}

/** Dosyanın gerçekten PDF olup olmadığı: ilk 1 KB içinde "%PDF-" imzası. */
export function pdfMi(bayt: Uint8Array): boolean {
  const sinir = Math.min(bayt.length, 1024);
  for (let i = 0; i + 4 < sinir; i++) {
    if (bayt[i] === 0x25 && bayt[i + 1] === 0x50 && bayt[i + 2] === 0x44 && bayt[i + 3] === 0x46 && bayt[i + 4] === 0x2d) return true;
  }
  return false;
}

/*
  OpenAlex kaydından PDF adayları, güven sırasıyla: önce en iyi açık
  erişim konumunun PDF'i, sonra diğer konumların PDF'leri, en son
  oa_url (çoğu zaman PDF'in kendisi değil, açılış sayfası; yine de
  denenir — ilk bayt denetimi HTML'i eler). Tekrarlar atılır.
*/
export function pdfAdaylari(kayit: unknown): string[] {
  const w = (kayit ?? {}) as Record<string, unknown>;
  const adres = (deger: unknown) => (typeof deger === "string" && /^https?:\/\//i.test(deger) ? deger : null);
  const konumPdf = (konum: unknown) => adres((konum as { pdf_url?: unknown } | null)?.pdf_url);
  const adaylar = [
    konumPdf(w.best_oa_location),
    ...(Array.isArray(w.oa_locations) ? w.oa_locations.map(konumPdf) : []),
    adres((w.open_access as { oa_url?: unknown } | null)?.oa_url),
  ];
  return [...new Set(adaylar.filter((a): a is string => Boolean(a)))].slice(0, 5);
}

/*
  Doğrulama sonucundan başlangıç durumu: dizinde kaydı olmayan künye için
  PDF aranmaz, "kayıt yok" yazılır. Bu "sahte" demek DEĞİL (Türkçe tez,
  kurum raporu dizinde olmayabilir); öğrencinin bakması gereken künye.
*/
export function aranacakMi(durum: DogrulamaDurumu | null | undefined, doi: string | null | undefined): boolean {
  if (durum === "not_found") return false;
  return Boolean(doi);
}

/*
  ZIP'teki dosya adı: "Soyad_Yil_Baslik-ilk-kelimeleri.pdf". Türkçe
  harfler ASCII'ye çevrilir (bazı arşiv araçları ve e-posta istemcileri
  bozuyor). Aynı ad çıkarsa çağıran numaralandırır.
*/
const ASCII: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" };

export function pdfDosyaAdi(kunye: string): string {
  const sade = kunye.replace(/[çğıöşüÇĞİÖŞÜ]/g, (h) => ASCII[h] ?? h).normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const soyad = sade.match(/^\s*([A-Za-z][A-Za-z'-]+)/)?.[1] ?? "Kaynak";
  const yil = sade.match(/\((\d{4}[a-z]?)\)|\b(19|20)\d{2}\b/)?.[0]?.replace(/[()]/g, "") ?? "";
  const baslik = kunyeBasligi(sade)
    .split(/\s+/)
    .map((k) => k.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 6)
    .join("-");
  return [soyad, yil, baslik].filter(Boolean).join("_").slice(0, 90) + ".pdf";
}

/** Aynı adlar numaralandırılır: "Yilmaz_2020.pdf", "Yilmaz_2020-2.pdf". */
export function tekilAdlar(adlar: string[]): string[] {
  const sayac = new Map<string, number>();
  return adlar.map((ad) => {
    const n = (sayac.get(ad) ?? 0) + 1;
    sayac.set(ad, n);
    return n === 1 ? ad : ad.replace(/\.pdf$/, `-${n}.pdf`);
  });
}

/*
  Yüklenen PDF bu künyeye mi ait? Künyedeki başlığın anlamlı kelimelerinin
  çoğu PDF'in ilk sayfalarında geçmeli. Kesin bir kanıt değil — yanlış
  dosya yüklendiğinde öğrenciyi uyarmak için.
*/
export function baslikPdfteGeciyor(kunye: string, pdfMetni: string): boolean {
  /* Gevşek karşılaştırma: İngilizce büyük harfli başlıkta "I" Türkçe
     kuralla "ı" olur ve "RELATIONSHIPS" ile "relationships" ayrışırdı. */
  const gevsek = (metin: string) => kunyeAnahtari(metin).replace(/ı/g, "i");
  const kelimeler = gevsek(kunyeBasligi(kunye))
    .split(" ")
    .filter((k) => k.length >= 4)
    .slice(0, 8);
  if (kelimeler.length < 2) return true;
  const metin = gevsek(pdfMetni.slice(0, 20000));
  const gecen = kelimeler.filter((k) => metin.includes(k)).length;
  return gecen / kelimeler.length >= 0.6;
}
