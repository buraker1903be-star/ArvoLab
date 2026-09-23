// Kullanım geri bildirimi: kime, ne zaman sorulur ve cevap nasıl okunur.
//
// Kural tek yerde duruyor ki hem soruyu gösteren ekran hem testi aynı şeye
// baksın. Soru KULLANDIKTAN SONRA sorulur: yeni açılmış, içi boş bir hesaba
// "nasıl buldunuz" diye sormak hem cevapsız kalır hem rahatsız eder.

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

export const BAGLAM_METNI: Record<string, string> = {
  yazma: "panelde yazdıktan sonra",
  atif: "kaynakça denetiminden sonra",
  belge: "belge kontrolünden sonra",
};

export const BOLUM_SECENEKLERI: { deger: string; etiket: string }[] = [
  { deger: "editor", etiket: "Belge Editörü (panelde yazma)" },
  { deger: "documents", etiket: "Belge Kontrol" },
  { deger: "citations", etiket: "Kaynakça/Atıf Denetimi" },
  { deger: "literature", etiket: "Literatür Taraması" },
  { deger: "analysis", etiket: "Analiz Merkezi" },
  { deger: "asistan", etiket: "Asistan" },
];

export const bolumEtiketi = (deger: string | null | undefined) =>
  BOLUM_SECENEKLERI.find((secenek) => secenek.deger === deger)?.etiket ?? "Belirtilmedi";

export const PUAN_ETIKETLERI: Record<number, string> = {
  1: "Hiç yaramadı",
  2: "Az yaradı",
  3: "İdare eder",
  4: "İşimi kolaylaştırdı",
  5: "Çok işime yaradı",
};

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
