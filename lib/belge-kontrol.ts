/*
  BELGE KONTROL'ÜN SAF KARARLARI (28.10.2026). Testi
  tests/unit/belge-kontrol.test.ts.

  Üç karar burada, çünkü üçü de ekranda kullanıcının "sorun var mı"
  sorusuna verilen cevap ve sunucu işlemi içinde sınanamıyordu:

  1. METİN YETERLİ Mİ. Taranmış bir PDF yüklendiğinde pdf-parse hata
     vermiyor, boş metin dönüyor. Eskiden belge "Denetlendi" görünüyor ve
     tek bulgu "Kaynakça bölümü otomatik bulunamadı" oluyordu; öğrenci
     başlığını düzeltmeye uğraşıyordu, oysa belgede okunacak metin yoktu.

  2. SAYFA SINIRI. Kılavuz en az/en çok sayfa söylüyorsa PDF'in sayfa
     sayısı ona karşı gösteriliyor. HÜKÜM DEĞİL, bilgi: kılavuzların
     çoğu sınırın ön kısmı (özet, içindekiler) ve ekleri sayıp
     saymadığını ayrıca yazıyor; o ayrımı PDF'ten çıkaramıyoruz. Word
     dosyasının sayfa sayısı yazı tipine ve yazıcıya göre değiştiği için
     onda hiç söylenmiyor.

  3. ÖNCEKİ SÜRÜMLE FARK. Öğrenci aynı tezi düzeltip yeniden yüklüyor;
     her sürümün sonucu ayrı ayrı duruyordu ve neyin düzeldiğini iki kartı
     yan yana açıp sayarak bulmak gerekiyordu.
*/

import type { Dil, Metin } from "@/lib/dil";
import { taranmisBelgeMi } from "@/lib/taranmis-belge";

/** Bundan kısa metin "belge okunamadı" sayılır; kapak sayfası bile bunu aşar. */
export const EN_AZ_METIN = 200;

export type MetinDurumu = { durum: "bos" } | { durum: "kismi" } | { durum: "tamam" };

/**
 * Çıkarılan metin denetime yeter mi? `sayfa` yalnızca PDF'te bilinir.
 * "kismi": metin var ama sayfa başına çok az — gövdenin bir kısmı görüntü.
 */
export function metinDurumu(metin: string, sayfa: number | null): MetinDurumu {
  if (metin.replace(/\s+/g, "").length < EN_AZ_METIN) return { durum: "bos" };
  if (sayfa && taranmisBelgeMi(metin, sayfa)) return { durum: "kismi" };
  return { durum: "tamam" };
}

export const BOS_METIN_MESAJI =
  "Dosyada okunabilir metin bulunamadı. PDF taranmış bir görüntü olabilir: tezinizin Word (.docx) dosyasını ya da Word'den \"PDF olarak kaydet\" ile alınmış PDF'i yükleyin.";

export const KISMI_METIN_UYARISI =
  "Belgenin bir kısmı görüntü olarak görünüyor (sayfa başına çok az metin çıktı). Taranmış sayfalardaki başlık ve künyeler denetlenemedi; sonuçlar eksik olabilir.";

/* İki dilli karşılıkları; eski sabitler Türkçe kaldı, çağıranlar onlara dayanıyor. */
export const BOS_METIN_MESAJI_METIN: Metin = {
  tr: BOS_METIN_MESAJI,
  en: "No readable text was found in the file. The PDF may be a scanned image: upload the Word (.docx) file of your thesis or a PDF created with Word's \"Save as PDF\".",
};

export const KISMI_METIN_UYARISI_METIN: Metin = {
  tr: KISMI_METIN_UYARISI,
  en: "Part of the document appears to be images (very little text was extracted per page). Headings and references on scanned pages could not be checked; the results may be incomplete.",
};

export type SayfaSonucu = { ton: "success" | "warning"; metin: string };

/** PDF sayfa sayısını kılavuzun sınırıyla karşılaştırır; söylenecek bir şey yoksa null. */
export function sayfaDenetimi(
  sayfa: number | null | undefined,
  enAz: number | null | undefined,
  enCok: number | null | undefined,
  dil: Dil = "tr",
): SayfaSonucu | null {
  if (!sayfa || (!enAz && !enCok)) return null;
  const disinda = (enAz && sayfa < enAz) || (enCok && sayfa > enCok);
  if (dil === "en") {
    const sinirEn = enAz && enCok ? `${enAz}–${enCok} pages` : enAz ? `at least ${enAz} pages` : `at most ${enCok} pages`;
    return {
      ton: disinda ? "warning" : "success",
      metin: `The PDF has ${sayfa} ${sayfa === 1 ? "page" : "pages"}; the guideline specifies ${sinirEn}.${disinda ? " Check the guideline to see whether front matter and appendices count toward the limit." : ""}`,
    };
  }
  const sinir = enAz && enCok ? `${enAz}–${enCok} sayfa` : enAz ? `en az ${enAz} sayfa` : `en çok ${enCok} sayfa`;
  return {
    ton: disinda ? "warning" : "success",
    metin: `PDF ${sayfa} sayfa; kılavuz ${sinir} öngörüyor.${disinda ? " Sınıra ön kısmın ve eklerin dahil olup olmadığını kılavuzdan kontrol edin." : ""}`,
  };
}

/** Karşılaştırmada kullanılan alanlar (document_uploads.analysis'in alt kümesi). */
export interface KarsilastirilanAnaliz {
  complianceScore: number | null;
  referenceSectionFound: boolean;
  references: { issues: unknown[] }[];
  crossCheck: { citationsWithoutReference: unknown[]; referencesWithoutCitation: unknown[] };
  guidelineCompliance?: { missingSections: string[] } | null;
  kilavuz?: { surum: string } | null;
}

export type Fark = { metin: string; ton: "success" | "warning" };

/**
 * Önceki sürüme göre değişen her ölçü bir satır. Sorun sayısında düşüş
 * iyidir, puanda artış iyidir. Değişmeyen ölçü yazılmaz; hiçbiri
 * değişmediyse boş dizi döner.
 *
 * Kaynakça bölümü bir sürümde bulunup ötekinde bulunamadıysa kaynakça
 * ölçüleri karşılaştırılmaz: "12 sorunlu künye → 0" bir iyileşme değil,
 * bölümün okunamaması olurdu.
 */
export function surumFarki(onceki: KarsilastirilanAnaliz, simdiki: KarsilastirilanAnaliz, dil: Dil = "tr"): Fark[] {
  const y = (metin: Metin) => metin[dil];
  const farklar: Fark[] = [];
  const sorun = (ad: string, a: number, b: number) => {
    if (a !== b) farklar.push({ metin: `${ad}: ${a} → ${b}`, ton: b < a ? "success" : "warning" });
  };

  if (onceki.referenceSectionFound && simdiki.referenceSectionFound) {
    const a = onceki.complianceScore;
    const b = simdiki.complianceScore;
    if (a != null && b != null && a !== b) {
      farklar.push({ metin: `${y({ tr: "Kaynakça uyumu", en: "Reference list compliance" })}: ${a} → ${b}`, ton: b > a ? "success" : "warning" });
    }
    const sorunlu = (x: KarsilastirilanAnaliz) => x.references.filter((r) => r.issues.length > 0).length;
    sorun(y({ tr: "Biçim sorunu olan künye", en: "References with formatting issues" }), sorunlu(onceki), sorunlu(simdiki));
    sorun(y({ tr: "Atıfı olmayan kaynak", en: "References not cited in text" }), onceki.crossCheck.referencesWithoutCitation.length, simdiki.crossCheck.referencesWithoutCitation.length);
    sorun(y({ tr: "Karşılığı olmayan atıf", en: "Citations missing from the reference list" }), onceki.crossCheck.citationsWithoutReference.length, simdiki.crossCheck.citationsWithoutReference.length);
  } else if (onceki.referenceSectionFound !== simdiki.referenceSectionFound) {
    farklar.push(
      simdiki.referenceSectionFound
        ? { metin: y({ tr: "Kaynakça bölümü artık bulunuyor", en: "The reference list section is now found" }), ton: "success" }
        : { metin: y({ tr: "Kaynakça bölümü bu sürümde bulunamadı", en: "The reference list section was not found in this version" }), ton: "warning" },
    );
  }

  /*
    Bölümler yalnızca iki sürüm de AYNI kılavuz sürümüne göre denetlendiyse
    karşılaştırılır: arada kılavuz değiştiyse "eksik bölüm 3 → 1" belgenin
    değil kuralın değişmesi olabilir.
  */
  if (onceki.guidelineCompliance && simdiki.guidelineCompliance && onceki.kilavuz?.surum === simdiki.kilavuz?.surum) {
    sorun(y({ tr: "Eksik zorunlu bölüm", en: "Missing required sections" }), onceki.guidelineCompliance.missingSections.length, simdiki.guidelineCompliance.missingSections.length);
  }
  return farklar;
}
