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

import type { Dil, Metin } from "@/lib/dil";

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

/*
  TESLİM PAKETİ (ZIP) İÇERİĞİ: kaynak PDF'lerinin ZIP'teki adları ve
  "Kaynak raporu.txt". Rapor danışmana/jüriye hangi kaynağın PDF'inin
  pakette olduğunu, hangisinin eksik olduğunu ve neden eksik olduğunu
  söylüyor — eksik PDF sessizce kaybolmasın.
*/
export const DURUM_ACIKLAMASI: Record<PdfDurumu, string> = {
  indirildi: "PDF pakette (açık erişim sürümü indirildi)",
  yuklendi: "PDF pakette (öğrenci yükledi)",
  bulunamadi: "PDF yok: açık erişimli sürüm bulunamadı",
  erisilemedi: "PDF yok: adres var ama indirilemedi",
  kayit_yok: "PDF yok: kaynak Crossref/OpenAlex'te bulunamadı, künye kontrol edilmeli",
};

export const DURUM_ACIKLAMASI_METIN: Record<PdfDurumu, Metin> = {
  indirildi: { tr: DURUM_ACIKLAMASI.indirildi, en: "PDF in the package (open-access version downloaded)" },
  yuklendi: { tr: DURUM_ACIKLAMASI.yuklendi, en: "PDF in the package (uploaded by the student)" },
  bulunamadi: { tr: DURUM_ACIKLAMASI.bulunamadi, en: "No PDF: no open-access version found" },
  erisilemedi: { tr: DURUM_ACIKLAMASI.erisilemedi, en: "No PDF: an address exists but it could not be downloaded" },
  kayit_yok: {
    tr: DURUM_ACIKLAMASI.kayit_yok,
    en: "No PDF: the source was not found in Crossref/OpenAlex; the reference should be checked",
  },
};

/*
  Paketteki klasör ve rapor dosyasının adı (28.10.2026). Rapor PDF'lerin
  yerini klasör adıyla söylüyor; ZIP'i kuran ekran da aynı adı buradan
  almalı, yoksa İngilizce raporda yazan klasör pakette bulunmaz.
*/
export const KAYNAK_KLASORU: Metin = { tr: "Kaynaklar", en: "Sources" };
export const RAPOR_DOSYASI: Metin = { tr: "Kaynak raporu.txt", en: "Source report.txt" };

export type PaketDosyasi = { satir: KaynakPdfSatiri; ad: string | null };

/** PDF'i olan satırlara ZIP'teki benzersiz adı verir; olmayanlarda ad null. */
export function paketDosyalari(satirlar: KaynakPdfSatiri[]): PaketDosyasi[] {
  const sirali = [...satirlar].sort((a, b) => a.kunye.localeCompare(b.kunye, "tr"));
  const dosyali = sirali.filter((s) => s.depo_yolu);
  const adlar = tekilAdlar(dosyali.map((s) => pdfDosyaAdi(s.kunye)));
  const adHaritasi = new Map(dosyali.map((s, i) => [s.id, adlar[i]]));
  return sirali.map((satir) => ({ satir, ad: adHaritasi.get(satir.id) ?? null }));
}

export function kaynakRaporu(baslik: string, dosyalar: PaketDosyasi[], tarih: string, dil: Dil = "tr"): string {
  const hazir = dosyalar.filter((d) => d.ad).length;
  if (dil === "en") return kaynakRaporuEn(baslik, dosyalar, tarih, hazir);
  const satirlar = [
    `KAYNAK RAPORU — ${baslik}`,
    `Oluşturulma: ${tarih}`,
    `${dosyalar.length} kaynak · ${hazir} kaynağın PDF'i pakette · ${dosyalar.length - hazir} eksik`,
    "",
    "PDF'ler 'Kaynaklar' klasöründe. Durumlar ArvoLab'ın otomatik kontrolüdür;",
    "kaynağın içeriğinin metindeki iddiayı desteklediği anlamına gelmez.",
    "",
  ];
  dosyalar.forEach(({ satir, ad }, i) => {
    satirlar.push(`${i + 1}. ${satir.kunye}`);
    satirlar.push(`   Durum: ${DURUM_ACIKLAMASI[satir.durum]}`);
    if (ad) satirlar.push(`   Dosya: Kaynaklar/${ad}`);
    if (satir.durum === "yuklendi" && satir.baslik_eslesti === false) satirlar.push("   Uyarı: künyenin başlığı PDF'te bulunamadı; doğru dosya olduğu kontrol edilmeli.");
    if (satir.doi) satirlar.push(`   DOI: ${satir.doi}`);
    satirlar.push("");
  });
  // Windows'un Not Defteri de doğru göstersin.
  return satirlar.join("\r\n");
}

/* Raporun İngilizcesi; satır düzeni Türkçesiyle aynı. */
function kaynakRaporuEn(baslik: string, dosyalar: PaketDosyasi[], tarih: string, hazir: number): string {
  const klasor = KAYNAK_KLASORU.en;
  const satirlar = [
    `SOURCE REPORT — ${baslik}`,
    `Created: ${tarih}`,
    `${dosyalar.length} ${dosyalar.length === 1 ? "source" : "sources"} · PDF in the package for ${hazir} · ${dosyalar.length - hazir} missing`,
    "",
    `The PDFs are in the '${klasor}' folder. The statuses are ArvoLab's automatic check;`,
    "they do not mean that the source's content supports the claim in the text.",
    "",
  ];
  dosyalar.forEach(({ satir, ad }, i) => {
    satirlar.push(`${i + 1}. ${satir.kunye}`);
    satirlar.push(`   Status: ${DURUM_ACIKLAMASI_METIN[satir.durum].en}`);
    if (ad) satirlar.push(`   File: ${klasor}/${ad}`);
    if (satir.durum === "yuklendi" && satir.baslik_eslesti === false) {
      satirlar.push("   Warning: the reference's title was not found in the PDF; check that it is the right file.");
    }
    if (satir.doi) satirlar.push(`   DOI: ${satir.doi}`);
    satirlar.push("");
  });
  return satirlar.join("\r\n");
}

/** ZIP'in adı: çalışmanın başlığından, dosya sistemine uygun. */
export function paketAdi(baslik: string, dil: Dil = "tr"): string {
  const sade = baslik.replace(/[çğıöşüÇĞİÖŞÜ]/g, (h) => ASCII[h] ?? h).normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const en = dil === "en";
  const kok = sade.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || (en ? "project" : "calisma");
  return `${kok}-${en ? "submission-package" : "teslim-paketi"}.zip`;
}
