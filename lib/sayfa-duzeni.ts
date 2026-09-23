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
const cm = (deger: number) => `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(deger)} cm`;

const KENARLAR: { anahtar: keyof PageMargins; ad: string }[] = [
  { anahtar: "top", ad: "Üst boşluk" },
  { anahtar: "bottom", ad: "Alt boşluk" },
  { anahtar: "left", ad: "Sol boşluk" },
  { anahtar: "right", ad: "Sağ boşluk" },
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
  kilavuz: { margins?: PageMargins; showPageNumbers?: boolean } | null | undefined;
}): SayfaDuzeniFarki[] {
  const kilavuz = girdi.kilavuz;
  if (!kilavuz) return [];
  const farklar: SayfaDuzeniFarki[] = [];

  if (kilavuz.margins && girdi.margins) {
    for (const kenar of KENARLAR) {
      const simdi = sayi(girdi.margins[kenar.anahtar]);
      const beklenen = sayi(kilavuz.margins[kenar.anahtar]);
      if (beklenen === null || simdi === null || esit(simdi, beklenen)) continue;
      farklar.push({ alan: kenar.ad, simdi: cm(simdi), kilavuz: cm(beklenen) });
    }
  }

  if (typeof kilavuz.showPageNumbers === "boolean" && typeof girdi.showPageNumbers === "boolean"
    && kilavuz.showPageNumbers !== girdi.showPageNumbers) {
    farklar.push({
      alan: "Sayfa numarası",
      simdi: girdi.showPageNumbers ? "açık" : "kapalı",
      kilavuz: kilavuz.showPageNumbers ? "açık" : "kapalı",
    });
  }

  return farklar;
}

/** "Üst boşluk 3 cm olmalı (şu an 2,5 cm)" — listede tek satırda okunur. */
export const farkMetni = (fark: SayfaDuzeniFarki) =>
  `${fark.alan} ${fark.kilavuz} olmalı (şu an ${fark.simdi})`;

/** Kontrol listesi satırının açıklaması; en çok üç fark yazılır. */
export function sayfaDuzeniOzeti(farklar: SayfaDuzeniFarki[]): string {
  const yazilan = farklar.slice(0, 3).map(farkMetni).join("; ");
  return farklar.length > 3 ? `${yazilan} ve ${farklar.length - 3} fark daha.` : `${yazilan}.`;
}
