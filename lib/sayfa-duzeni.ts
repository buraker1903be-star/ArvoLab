/*
  Sayfa düzeninin kılavuza uygunluğu.

  Kılavuz bağlanınca kenar boşlukları ve sayfa numarası ayarı çalışmaya
  KENDİLİĞİNDEN uygulanıyor (manuscript-editor.tsx). Ama öğrenci sonradan
  Sayfa Ayarları'ndan değiştirebiliyor ve o andan sonra hiçbir ekran bunu
  söylemiyordu: teslim kontrol listesi başlık numaralandırmasını kılavuzla
  karşılaştırıyor, kenar boşluğunu karşılaştırmıyordu.

  Sonuç, jüriden dönen en sık biçim hatasıydı ve araç sessizdi — üstelik
  ayarın elle değiştirildiği bilgisi veritabanında zaten duruyor
  (settings_source.customized). Bilip söylememek, bilmemekten kötüdür.

  Saf modül; testi tests/unit/sayfa-duzeni.test.ts.
*/

import type { PageMargins } from "@/app/actions/manuscript";
import { YEREL, type Dil, type Metin } from "@/lib/dil";
import { KAGITLAR, kagitOku, type KagitBoyutu } from "@/lib/kagit-boyutu";

export type SayfaDuzeniFarki = {
  /** Kullanıcıya gösterilen alan adı ("Üst boşluk"). */
  alan: string;
  simdi: string;
  kilavuz: string;
};

/*
  Kenar boşlukları veritabanında `numeric`; PostgREST kimi sürümlerde
  bunları metin olarak döndürüyor ve 2.5 ile "2.50" eşit sayılmalı.
  Ayrıca kayan nokta karşılaştırması tam eşitlikle yapılmaz.
*/
const YAKIN = 0.01;
const sayi = (deger: unknown): number | null => {
  const cevrilen = typeof deger === "number" ? deger : Number(String(deger ?? "").replace(",", "."));
  return Number.isFinite(cevrilen) ? cevrilen : null;
};
const esit = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) < YAKIN;
// Ondalık ayırıcı arayüz diline göre: Türkçede "2,5 cm", İngilizcede "2.5 cm".
const cm = (deger: number, dil: Dil) => `${new Intl.NumberFormat(YEREL[dil], { maximumFractionDigits: 2 }).format(deger)} cm`;

const KENARLAR: { anahtar: keyof PageMargins; ad: Metin }[] = [
  { anahtar: "top", ad: { tr: "Üst boşluk", en: "Top margin" } },
  { anahtar: "bottom", ad: { tr: "Alt boşluk", en: "Bottom margin" } },
  { anahtar: "left", ad: { tr: "Sol boşluk", en: "Left margin" } },
  { anahtar: "right", ad: { tr: "Sağ boşluk", en: "Right margin" } },
];

/**
 * Çalışmanın sayfa düzeni ile kılavuzun istediği arasındaki farklar.
 *
 * Kılavuzda TANIMLI OLMAYAN alan karşılaştırılmaz: kılavuz sayfa
 * numarası hakkında bir şey söylemiyorsa, öğrencinin tercihi hata
 * değildir. "Bilmiyorum" ile "yanlış" aynı şey değil.
 */
export function sayfaDuzeniFarklari(girdi: {
  margins: PageMargins | null | undefined;
  showPageNumbers: boolean | null | undefined;
  /** Yoksa A4 sayılır (bütün eski belgeler A4). */
  pageSize?: KagitBoyutu | null;
  kilavuz: { margins?: PageMargins; showPageNumbers?: boolean; pageSize?: KagitBoyutu } | null | undefined;
}, dil: Dil = "tr"): SayfaDuzeniFarki[] {
  const kilavuz = girdi.kilavuz;
  if (!kilavuz) return [];
  const farklar: SayfaDuzeniFarki[] = [];

  /* Kâğıt boyutu en başta: farklıysa kenar boşluklarının da anlamı değişir. */
  const kagit = kagitOku(girdi.pageSize);
  if (kilavuz.pageSize && kilavuz.pageSize !== kagit) {
    farklar.push({ alan: dil === "en" ? "Paper size" : "Kâğıt boyutu", simdi: KAGITLAR[kagit].ad[dil], kilavuz: KAGITLAR[kilavuz.pageSize].ad[dil] });
  }

  if (kilavuz.margins && girdi.margins) {
    for (const kenar of KENARLAR) {
      const simdi = sayi(girdi.margins[kenar.anahtar]);
      const beklenen = sayi(kilavuz.margins[kenar.anahtar]);
      if (beklenen === null || simdi === null || esit(simdi, beklenen)) continue;
      farklar.push({ alan: kenar.ad[dil], simdi: cm(simdi, dil), kilavuz: cm(beklenen, dil) });
    }
  }

  if (typeof kilavuz.showPageNumbers === "boolean" && typeof girdi.showPageNumbers === "boolean"
    && kilavuz.showPageNumbers !== girdi.showPageNumbers) {
    const durum = (acik: boolean) => (dil === "en" ? (acik ? "on" : "off") : acik ? "açık" : "kapalı");
    farklar.push({
      alan: dil === "en" ? "Page numbers" : "Sayfa numarası",
      simdi: durum(girdi.showPageNumbers),
      kilavuz: durum(kilavuz.showPageNumbers),
    });
  }

  return farklar;
}

/**
 * "Üst boşluk 3 cm olmalı (şu an 2,5 cm)" — listede tek satırda okunur.
 * Fark aynı dilde üretilmiş olmalı (sayfaDuzeniFarklari'na aynı dil).
 */
export const farkMetni = (fark: SayfaDuzeniFarki, dil: Dil = "tr") =>
  dil === "en" ? `${fark.alan} should be ${fark.kilavuz} (currently ${fark.simdi})` : `${fark.alan} ${fark.kilavuz} olmalı (şu an ${fark.simdi})`;

/** Kontrol listesi satırının açıklaması; en çok üç fark yazılır. */
export function sayfaDuzeniOzeti(farklar: SayfaDuzeniFarki[], dil: Dil = "tr"): string {
  const yazilan = farklar.slice(0, 3).map((f) => farkMetni(f, dil)).join("; ");
  const kalan = farklar.length - 3;
  if (kalan <= 0) return `${yazilan}.`;
  return dil === "en" ? `${yazilan} and ${kalan} more ${kalan === 1 ? "difference" : "differences"}.` : `${yazilan} ve ${kalan} fark daha.`;
}
