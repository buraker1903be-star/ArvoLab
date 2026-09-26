import { validIndentCm } from "@/lib/paragraph-format";

/*
  Kılavuzun SÖYLEMEDİĞİ ölçüler için öneri.

  Tarayıcı artık bilmediğini bilmiyor saymıyor: ölçü hangi cümleye aitse
  onun kuralı (lib/kilavuz-olcusu.ts), gövdeden söz eden bir cümle yoksa
  alan boş kalıyor. Doğru davranış — Amasya kılavuzu gövdenin satır
  aralığını gerçekten hiç yazmıyor, eski tarayıcı başlık aralığını alıp
  1,5 yazıyordu ve tesadüfen tutturuyordu — ama pratikte yöneticinin
  önüne boş alan geliyor ve ne yazacağını bilmiyor.

  Buradaki değerler KURAL DEĞİL, başlangıç noktası. Kendiliğinden hiçbir
  yere yazılmazlar; yönetici tek tek seçer. Yazıldıklarında da kılavuzdan
  çıkarılmış gibi görünmezler: hangi alanların elle doldurulduğu
  extracted_rules içinde kalır (YONETICI_VARSAYILANI) ve panelde ayrı
  gösterilir. Kayıt yeniden tarandığında kurallar tamamen değiştiği için
  bu iz de kendiliğinden silinir — değer ve kaynağı hiç ayrışmaz.
*/

/** Elle doldurulan alanların adları; extracted_rules içinde taşınır. */
export const YONETICI_VARSAYILANI = "yonetici_varsayilanlari";

export type OnerilenOlcu = "font_size_pt" | "line_spacing" | "paragraph_indent_cm" | "margins_cm";

export interface Bosluklar {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface OlcuOnerisi {
  anahtar: OnerilenOlcu;
  etiket: string;
  /** Türkçe biçimli gösterim ("1,5" · "üst 3 · alt 2,5 · sol 3,5 · sağ 2,5 cm") */
  gosterim: string;
  /** Değerin nereden geldiği. Yönetici neye dayandığını bilmeden seçmemeli. */
  gerekce: string;
  deger: number | Bosluklar;
}

const sayi = (deger: number) => deger.toLocaleString("tr-TR");

const gecerliSayi = (deger: unknown, enAz: number, enCok: number): boolean => {
  const n = typeof deger === "number" ? deger : Number(String(deger ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= enAz && n <= enCok;
};

const ONERILER: Record<OnerilenOlcu, { etiket: string; deger: number | Bosluklar; gerekce: string }> = {
  font_size_pt: {
    etiket: "Yazı boyutu",
    deger: 12,
    gerekce: "Türkçe tez kılavuzlarının büyük çoğunluğunda gövde 12 punto.",
  },
  line_spacing: {
    etiket: "Satır aralığı",
    deger: 1.5,
    gerekce: "Türkçe tez kılavuzlarının büyük çoğunluğunda gövde 1,5 satır aralıklı.",
  },
  paragraph_indent_cm: {
    etiket: "Paragraf girintisi",
    deger: 1.25,
    gerekce: "APA'nın varsayılan ilk satır girintisi (0,5 inç ≈ 1,25 cm).",
  },
  margins_cm: {
    etiket: "Kenar boşlukları",
    // Sol kenar ciltlenir, bu yüzden diğerlerinden geniştir.
    deger: { top: 3, bottom: 2.5, left: 3.5, right: 2.5 },
    gerekce: "Yaygın cilt payı düzeni; sol kenar ciltlendiği için geniş tutulur.",
  },
};

const gosterimi = (anahtar: OnerilenOlcu, deger: number | Bosluklar): string => {
  if (typeof deger === "number") {
    return anahtar === "font_size_pt" ? `${sayi(deger)} punto` : anahtar === "line_spacing" ? sayi(deger) : `${sayi(deger)} cm`;
  }
  return `üst ${sayi(deger.top)} · alt ${sayi(deger.bottom)} · sol ${sayi(deger.left)} · sağ ${sayi(deger.right)} cm`;
};

/**
 * Kılavuzda bulunamamış ölçüler için öneriler. Zaten doldurulmuş ya da
 * yönetici tarafından elle yazılmış alan için öneri üretilmez.
 */
export function eksikOlcuOnerileri(extractedRules: unknown): OlcuOnerisi[] {
  const kurallar = (extractedRules ?? {}) as Record<string, unknown>;
  const elleYazilan = yoneticiVarsayilanlari(extractedRules);
  const bosluklar = (kurallar.margins_cm ?? {}) as Record<string, unknown>;

  const eksik: OnerilenOlcu[] = [];
  if (!gecerliSayi(kurallar.font_size_pt, 8, 24)) eksik.push("font_size_pt");
  if (!gecerliSayi(kurallar.line_spacing, 1, 3)) eksik.push("line_spacing");
  if (validIndentCm(kurallar.paragraph_indent_cm) === undefined) eksik.push("paragraph_indent_cm");
  /*
    Boşluklar hep birlikte yazılır ya da hiç yazılmaz: tarayıcı dördünden
    biri makul değilse kümenin tamamını düşürüyor (üçü doğru biri saçma bir
    sayfa düzeni, hiç düzen olmamasından kötü). Öneri de aynı kuralı izler.
  */
  if (!(["top", "bottom", "left", "right"] as const).every((yon) => gecerliSayi(bosluklar[yon], 0.5, 8))) {
    eksik.push("margins_cm");
  }

  return eksik
    .filter((anahtar) => !elleYazilan.includes(anahtar))
    .map((anahtar) => {
      const { etiket, deger, gerekce } = ONERILER[anahtar];
      return { anahtar, etiket, deger, gerekce, gosterim: gosterimi(anahtar, deger) };
    });
}

/** Kayıtta elle doldurulmuş ölçülerin adları. */
export function yoneticiVarsayilanlari(extractedRules: unknown): OnerilenOlcu[] {
  const kurallar = (extractedRules ?? {}) as Record<string, unknown>;
  const ham = kurallar[YONETICI_VARSAYILANI];
  if (!Array.isArray(ham)) return [];
  return ham.filter((deger): deger is OnerilenOlcu => typeof deger === "string" && deger in ONERILER);
}

/** "Satır aralığı, Kenar boşlukları" — panelde ve not metninde kullanılır. */
export const olcuEtiketleri = (anahtarlar: OnerilenOlcu[]): string =>
  anahtarlar.map((anahtar) => ONERILER[anahtar].etiket).join(", ");

/** Seçilen ölçünün extracted_rules'a yazılacak hâli. */
export function onerilenDeger(anahtar: OnerilenOlcu): number | Bosluklar {
  return ONERILER[anahtar].deger;
}

/** Geçerli bir ölçü adı mı (sunucuya gelen form verisi için). */
export const onerilebilirOlcu = (deger: unknown): deger is OnerilenOlcu =>
  typeof deger === "string" && deger in ONERILER;
