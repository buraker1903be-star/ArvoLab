// Kullanım geri bildirimi: kime, ne zaman sorulur ve cevap nasıl okunur.
//
// Kural tek yerde duruyor ki hem soruyu gösteren ekran hem testi aynı şeye
// baksın. Soru KULLANDIKTAN SONRA sorulur: yeni açılmış, içi boş bir hesaba
// "nasıl buldunuz" diye sormak hem cevapsız kalır hem rahatsız eder.

import type { Dil, Metin } from "@/lib/dil";

export const YETERLI_KELIME = 300;
export const ERTELEME_GUN = 14;

export type GeriBildirimDurumu = "answered" | "postponed" | "declined";

export interface GeriBildirimKaydi {
  status: GeriBildirimDurumu;
  updatedAt: string;
}

/** Kullanıcının bugüne kadarki kullanımı (sorunun hangi işten sonra sorulacağını da belirler) */
export interface KullanimIzi {
  /** Kendi çalışmalarındaki en uzun metnin kelime sayısı */
  enUzunMetin: number;
  atifKontrolu: number;
  belgeKontrolu: number;
}

/*
  Etiketlerin iki dilli kaynağı *_METIN; eski dışa aktarımlar (BAGLAM_METNI,
  BOLUM_SECENEKLERI, PUAN_ETIKETLERI) Türkçe değerleri buradan türetiyor —
  iki ayrı liste yazılsaydı biri güncellenip öteki unutulurdu.
  Bağlam metni "… sonra" biçiminde: ekran "<bağlam> soruldu" diye kuruyor.
*/
export const BAGLAM_METNI_METIN: Record<string, Metin> = {
  yazma: { tr: "panelde yazdıktan sonra", en: "after writing in the panel" },
  atif: { tr: "kaynakça denetiminden sonra", en: "after a reference list check" },
  belge: { tr: "belge kontrolünden sonra", en: "after a document check" },
};

export const BAGLAM_METNI: Record<string, string> = Object.fromEntries(
  Object.entries(BAGLAM_METNI_METIN).map(([anahtar, metin]) => [anahtar, metin.tr]),
);

export const BOLUM_SECENEKLERI_METIN: { deger: string; etiket: Metin }[] = [
  { deger: "editor", etiket: { tr: "Belge Editörü (panelde yazma)", en: "Document Editor (writing in the panel)" } },
  { deger: "documents", etiket: { tr: "Belge Kontrol", en: "Document Check" } },
  { deger: "citations", etiket: { tr: "Kaynakça/Atıf Denetimi", en: "Reference/Citation Check" } },
  { deger: "literature", etiket: { tr: "Literatür Taraması", en: "Literature Search" } },
  { deger: "analysis", etiket: { tr: "Analiz Merkezi", en: "Analysis Center" } },
  { deger: "asistan", etiket: { tr: "Asistan", en: "Assistant" } },
];

export const BOLUM_SECENEKLERI: { deger: string; etiket: string }[] = BOLUM_SECENEKLERI_METIN.map((secenek) => ({
  deger: secenek.deger,
  etiket: secenek.etiket.tr,
}));

export const bolumEtiketi = (deger: string | null | undefined, dil: Dil = "tr") =>
  BOLUM_SECENEKLERI_METIN.find((secenek) => secenek.deger === deger)?.etiket[dil] ??
  (dil === "en" ? "Not specified" : "Belirtilmedi");

export const PUAN_ETIKETLERI_METIN: Record<number, Metin> = {
  1: { tr: "Hiç yaramadı", en: "Not helpful at all" },
  2: { tr: "Az yaradı", en: "Slightly helpful" },
  3: { tr: "İdare eder", en: "It was okay" },
  4: { tr: "İşimi kolaylaştırdı", en: "Made my work easier" },
  5: { tr: "Çok işime yaradı", en: "Very helpful" },
};

export const PUAN_ETIKETLERI: Record<number, string> = Object.fromEntries(
  Object.entries(PUAN_ETIKETLERI_METIN).map(([puan, metin]) => [puan, metin.tr]),
);

/**
 * Soru şimdi sorulsun mu? Sorulacaksa hangi kullanımdan sonra sorulduğunu da
 * döndürür — cevabı okuyan kişi "neyi kullanırken böyle dedi" bilsin.
 */
export function soruSorulsunMu(
  kayit: GeriBildirimKaydi | null,
  kullanim: KullanimIzi,
  simdi: number = Date.now()
): { sorulsun: boolean; baglam: string | null } {
  const hayir = { sorulsun: false, baglam: null };
  // Cevap verdi ya da "istemiyorum" dedi: bir daha sorulmaz.
  if (kayit?.status === "answered" || kayit?.status === "declined") return hayir;
  if (kayit?.status === "postponed") {
    const gecen = simdi - new Date(kayit.updatedAt).getTime();
    // Geçersiz tarih: sormamak, yanlış zamanda sormaktan iyidir.
    if (!Number.isFinite(gecen) || gecen < ERTELEME_GUN * 24 * 60 * 60 * 1000) return hayir;
  }

  // En taze kullanım hangisiyse soru onun ardından sorulmuş sayılır.
  if (kullanim.belgeKontrolu > 0) return { sorulsun: true, baglam: "belge" };
  if (kullanim.atifKontrolu > 0) return { sorulsun: true, baglam: "atif" };
  if (kullanim.enUzunMetin >= YETERLI_KELIME) return { sorulsun: true, baglam: "yazma" };
  return hayir;
}
