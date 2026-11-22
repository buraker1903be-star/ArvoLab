import type { Metin } from "@/lib/dil";
import type { AnalizTuru } from "@/lib/analiz-turleri";
import type { BetikSecimi } from "@/lib/analiz-betik";

/*
  EKSİYEN SONUÇ (22.11.2026).

  Analiz çalıştıktan sonra kullanıcı grup değişkenini ya da bağımlı
  değişkeni değiştirdiğinde ekrandaki tablo OLDUĞU GİBİ kalıyordu:
  başlık yeni seçimi, sayılar eski seçimi gösteriyordu. Öğrenci o tabloyu
  "Teze ekleme sırasına koy" ile kaydedebiliyor, hangi değişkenlerle
  hesaplandığını sonradan ayırt edemiyordu.

  Burada sonuç SİLİNMİYOR — silmek kullanıcının emeğini atmak olurdu ve
  "neden kayboldu" sorusunu doğururdu. Çalıştırılan seçimin kopyası
  (calisanAnaliz.secim) ekrandaki seçimle karşılaştırılıyor; fark varsa
  sonuç "eskidi" diye işaretlenip hangi alanların değiştiği yazılıyor.

  Karşılaştırma TEK yerde: hesaplamayı başlatan kod da, denetim de aynı
  `secimiKur` çıktısını kullanıyor. İki ayrı kopya olsaydı denetim kendi
  kopyasını doğrulardı ve gerçek farkı kaçırırdı.
*/

/** `BetikSecimi` içinde karşılaştırılan alanlar; sırası mesajdaki sırayı belirler. */
const ALANLAR = [
  "dosyaAdi",
  "varA",
  "varB",
  "varY",
  "groupVar",
  "groupVar2",
  "gruplar",
  "maddeler",
  "yordayicilar",
  "kovaryatlar",
  "aracilar",
  "araciModeli",
  "testDegeri",
  "faktorSayisi",
  "dfaFaktorleri",
  "dfaHataKovaryanslari",
  "olayDegeri",
  "metinBicimi",
] as const satisfies readonly (keyof BetikSecimi)[];

export type SecimAlani = (typeof ALANLAR)[number];

/*
  HER ANALİZ KENDİ ALANLARINI KULLANIR.

  `BetikSecimi` ekrandaki BÜTÜN alanları taşıyor; bir t-testinde
  kullanılmayan "2. değişken" de içinde duruyor çünkü state analizler
  arasında korunuyor. Künyede hepsini yazmak yanlış bilgi verirdi:
  "Bağımsız Örneklem t-Testi … 2. değişken on_test" satırı, o testin
  iki sayısal değişkeni karşılaştırdığını sanmaya yol açar. Aynı
  sebeple tazelik denetimi de yalnızca bu alanlara bakar: kullanılmayan
  bir alanın değişmesi sonucu eskitmemeli.

  Liste data-analyzer.tsx'teki değişken alanlarının koşullarıyla
  birebir; testi (tests/unit/analiz-tazelik.test.ts) her analiz türü
  için bir giriş olmasını zorunlu kılıyor.
*/
const ORTAK: SecimAlani[] = ["dosyaAdi", "metinBicimi"];
const T: Record<AnalizTuru, SecimAlani[]> = {
  descriptives: [],
  ttest: ["groupVar", "varA", "gruplar"],
  pairedttest: ["varA", "varB"],
  tekorneklem: ["varA", "testDegeri"],
  anova: ["groupVar", "varA", "gruplar"],
  ikiyonluanova: ["groupVar", "groupVar2", "varA"],
  tekrarlianova: ["maddeler"],
  karmaanova: ["groupVar", "maddeler", "gruplar"],
  ancova: ["groupVar", "varA", "kovaryatlar", "gruplar"],
  correlation: ["varA", "varB"],
  spearman: ["varA", "varB"],
  kismikorelasyon: ["varA", "varB", "kovaryatlar"],
  regression: ["varA", "yordayicilar"],
  lojistik: ["varA", "olayDegeri", "yordayicilar"],
  mannwhitney: ["groupVar", "varA", "gruplar"],
  kruskalwallis: ["groupVar", "varA", "gruplar"],
  wilcoxon: ["varA", "varB"],
  friedman: ["maddeler"],
  mcnemar: ["varA", "varB"],
  /* Ki-karede birinci değişken groupVar, ikincisi varA (data-analyzer.tsx). */
  chisquare: ["groupVar", "varA"],
  reliability: ["maddeler"],
  faktor: ["maddeler", "faktorSayisi"],
  dfa: ["dfaFaktorleri", "dfaHataKovaryanslari"],
  aracilik: ["varA", "varY", "aracilar", "araciModeli", "kovaryatlar"],
  duzenleyicilik: ["varA", "varB", "varY", "kovaryatlar"],
};

/** Bir analizin gerçekten kullandığı alanlar, ALANLAR sırasında. */
export function turunAlanlari(tur: AnalizTuru): SecimAlani[] {
  const kume = new Set<SecimAlani>([...ORTAK, ...(T[tur] ?? [])]);
  return ALANLAR.filter((a) => kume.has(a));
}

/*
  Derin eşitlik: diziler sırayla, nesneler anahtarlarıyla. JSON'a
  çevirip karşılaştırmak anahtar sırası değişince yanlış alarm verirdi;
  yanlış alarm kaçırılan farktan sinsidir (kullanıcı uyarıyı susturmayı
  öğrenir). undefined ile "" aynı sayılıyor: seçilmemiş alan iki biçimde
  de geliyor ve ikisi de "boş" demek.
*/
function esit(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const bos = (x: unknown) => x === undefined || x === null || x === "";
  if (bos(a) && bos(b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => esit(x, b[i]));
  if (typeof a === "object" && typeof b === "object" && a && b) {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => esit((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

export type Tazelik = {
  /** Sonuç, ekrandaki seçimle artık uyuşmuyor. */
  eskidi: boolean;
  /** Analiz türü değişti: sonuç tamamen başka bir testin çıktısı. */
  turDegisti: boolean;
  /** Dosya değişti: sonuç başka veriden. */
  veriDegisti: boolean;
  /** Değişen alanlar (tür ve dosya dışındakiler), ALANLAR sırasında. */
  degisenAlanlar: SecimAlani[];
};

export const TAZE: Tazelik = { eskidi: false, turDegisti: false, veriDegisti: false, degisenAlanlar: [] };

/**
 * Çalıştırılan analizle ekrandaki yapılandırmayı karşılaştırır.
 * Saf fonksiyon: yalnızca iki kopyaya bakar, hesap yapmaz.
 */
export function tazelikDenetle(
  calisan: { tur: AnalizTuru; secim: BetikSecimi } | null,
  guncel: { tur: AnalizTuru; secim: BetikSecimi },
): Tazelik {
  if (!calisan) return TAZE;
  const turDegisti = calisan.tur !== guncel.tur;
  const veriDegisti = !esit(calisan.secim.dosyaAdi, guncel.secim.dosyaAdi);
  /* Yalnızca ÇALIŞTIRILAN analizin kullandığı alanlar: ekranda görünmeyen
     bir alanın değişmesi yanlış alarm verirdi. */
  const degisenAlanlar = turunAlanlari(calisan.tur).filter(
    (alan) => alan !== "dosyaAdi" && !esit(calisan.secim[alan], guncel.secim[alan]),
  );
  return {
    eskidi: turDegisti || veriDegisti || degisenAlanlar.length > 0,
    turDegisti,
    veriDegisti,
    degisenAlanlar,
  };
}

/*
  Değişen alanın kullanıcıya görünen adı. Ham anahtar ("groupVar2")
  uyarıyı anlaşılmaz kılardı; uyarı anlaşılmazsa kapatılır.
*/
export const ALAN_ADLARI: Record<SecimAlani, { tr: string; en: string }> = {
  dosyaAdi: { tr: "veri dosyası", en: "data file" },
  varA: { tr: "1. değişken", en: "variable 1" },
  varB: { tr: "2. değişken", en: "variable 2" },
  varY: { tr: "bağımlı değişken", en: "dependent variable" },
  groupVar: { tr: "grup değişkeni", en: "grouping variable" },
  groupVar2: { tr: "2. faktör", en: "factor 2" },
  gruplar: { tr: "karşılaştırılan gruplar", en: "compared groups" },
  maddeler: { tr: "madde/ölçüm listesi", en: "item/measurement list" },
  yordayicilar: { tr: "yordayıcılar", en: "predictors" },
  kovaryatlar: { tr: "kovaryatlar", en: "covariates" },
  aracilar: { tr: "aracı değişkenler", en: "mediators" },
  araciModeli: { tr: "aracılık modeli", en: "mediation model" },
  testDegeri: { tr: "test değeri", en: "test value" },
  faktorSayisi: { tr: "faktör sayısı", en: "number of factors" },
  dfaFaktorleri: { tr: "faktör yapısı", en: "factor structure" },
  dfaHataKovaryanslari: { tr: "hata kovaryansları", en: "error covariances" },
  olayDegeri: { tr: "olay (1) kategorisi", en: "event (1) category" },
  metinBicimi: { tr: "sayı biçimi", en: "number format" },
};

/*
  ALANIN EKRANDAKİ ADI ANALİZE GÖRE DEĞİŞİYOR. Aynı `varA` bir
  t-testinde "Sayısal değişken", korelasyonda "Değişken 1",
  regresyonda "Bağımlı değişken (Y)" olarak yazılı. Uyarıda ve künyede
  genel adı ("1. değişken") kullanmak, kullanıcının ekranda o adı
  aramasına ve bulamamasına yol açıyordu; anlaşılmayan uyarı kapatılır.

  Buradaki karşılıklar data-analyzer.tsx'teki form etiketlerinden
  birebir alındı.
*/
const OZEL_ADLAR: Partial<Record<AnalizTuru, Partial<Record<SecimAlani, Metin>>>> = {
  correlation: { varA: { tr: "değişken 1", en: "variable 1" }, varB: { tr: "değişken 2", en: "variable 2" } },
  spearman: { varA: { tr: "değişken 1", en: "variable 1" }, varB: { tr: "değişken 2", en: "variable 2" } },
  kismikorelasyon: {
    varA: { tr: "değişken 1", en: "variable 1" },
    varB: { tr: "değişken 2", en: "variable 2" },
    kovaryatlar: { tr: "kontrol değişkenleri", en: "control variables" },
  },
  pairedttest: { varA: { tr: "önceki ölçüm", en: "earlier measurement" }, varB: { tr: "sonraki ölçüm", en: "later measurement" } },
  wilcoxon: { varA: { tr: "önceki ölçüm", en: "earlier measurement" }, varB: { tr: "sonraki ölçüm", en: "later measurement" } },
  mcnemar: { varA: { tr: "önceki ölçüm", en: "earlier measurement" }, varB: { tr: "sonraki ölçüm", en: "later measurement" } },
  regression: { varA: { tr: "bağımlı değişken (Y)", en: "dependent variable (Y)" } },
  lojistik: { varA: { tr: "bağımlı değişken", en: "dependent variable" } },
  ancova: { varA: { tr: "bağımlı değişken", en: "dependent variable" } },
  chisquare: {
    groupVar: { tr: "birinci kategorik değişken", en: "first categorical variable" },
    varA: { tr: "ikinci kategorik değişken", en: "second categorical variable" },
  },
  ikiyonluanova: { groupVar: { tr: "1. faktör", en: "factor 1" }, varA: { tr: "sayısal değişken", en: "numeric variable" } },
  ttest: { varA: { tr: "sayısal değişken", en: "numeric variable" } },
  anova: { varA: { tr: "sayısal değişken", en: "numeric variable" } },
  mannwhitney: { varA: { tr: "sayısal değişken", en: "numeric variable" } },
  kruskalwallis: { varA: { tr: "sayısal değişken", en: "numeric variable" } },
  tekorneklem: { varA: { tr: "sayısal değişken", en: "numeric variable" }, testDegeri: { tr: "karşılaştırılacak değer", en: "test value" } },
  tekrarlianova: { maddeler: { tr: "ölçümler", en: "measurements" } },
  friedman: { maddeler: { tr: "ölçümler", en: "measurements" } },
  karmaanova: { maddeler: { tr: "ölçümler", en: "measurements" } },
  reliability: { maddeler: { tr: "maddeler", en: "items" } },
  faktor: { maddeler: { tr: "maddeler", en: "items" } },
  aracilik: { varA: { tr: "bağımsız değişken (X)", en: "predictor (X)" }, varY: { tr: "sonuç değişkeni (Y)", en: "outcome variable (Y)" }, kovaryatlar: { tr: "kontrol değişkenleri", en: "control variables" } },
  duzenleyicilik: {
    varA: { tr: "bağımsız değişken (X)", en: "predictor (X)" },
    varB: { tr: "düzenleyici değişken (W)", en: "moderator (W)" },
    varY: { tr: "sonuç değişkeni (Y)", en: "outcome variable (Y)" },
    kovaryatlar: { tr: "kontrol değişkenleri", en: "control variables" },
  },
};

/** Alanın o analizdeki ekran adı; özel karşılığı yoksa genel ad. */
export function alanAdi(alan: SecimAlani, dil: "tr" | "en", tur?: AnalizTuru): string {
  const ozel = tur ? OZEL_ADLAR[tur]?.[alan] : undefined;
  return (ozel ?? ALAN_ADLARI[alan])[dil];
}

/** Uyarı metni: hangi alan değiştiği için sonucun artık geçerli olmadığı. */
export function tazelikMetni(tazelik: Tazelik, dil: "tr" | "en", tur?: AnalizTuru): string | null {
  if (!tazelik.eskidi) return null;
  if (tazelik.turDegisti) {
    return dil === "tr"
      ? "Aşağıdaki sonuç BAŞKA bir analize ait. Yeni analizi çalıştırana kadar ekranda eski hesap duruyor."
      : "The result below belongs to a DIFFERENT analysis. The earlier computation stays on screen until you run the new one.";
  }
  if (tazelik.veriDegisti) {
    return dil === "tr"
      ? "Aşağıdaki sonuç başka bir veri dosyasından hesaplandı; şu anki veriye ait değil."
      : "The result below was computed from a different data file and does not belong to the current data.";
  }
  const adlar = tazelik.degisenAlanlar.map((a) => alanAdi(a, dil, tur)).join(", ");
  return dil === "tr"
    ? `Seçiminiz değişti (${adlar}); aşağıdaki sonuç önceki seçimle hesaplandı. Analizi yeniden çalıştırın.`
    : `Your selection changed (${adlar}); the result below was computed with the previous selection. Run the analysis again.`;
}

/*
  SONUÇ KÜNYESİ (22.11.2026). Sonuç tablosunun hangi analiz, hangi
  değişkenler ve hangi ayarlarla üretildiği ekranda yazılı olmalı:
  öğrenci tabloyu tezine koyarken yöntem bölümünü ondan yazıyor.
  Eskiden yalnızca başlık vardı ("Bağımsız Örneklem t-Testi: puan"),
  kovaryatlar ve madde listesi hiç görünmüyordu.

  Aynı ALAN_ADLARI haritasından besleniyor: eskiyen sonuç uyarısıyla
  künye aynı adları kullanmalı, yoksa uyarıda "grup değişkeni" diyip
  künyede başka bir ad yazmak kullanıcıyı şaşırtır.
*/
export function secimKunyesi(secim: BetikSecimi, dil: "tr" | "en", tur?: AnalizTuru): { ad: string; deger: string }[] {
  const yaz = (deger: unknown): string | null => {
    if (deger === undefined || deger === null || deger === "") return null;
    if (Array.isArray(deger)) {
      if (!deger.length) return null;
      return deger
        .map((x) => (typeof x === "object" && x && "ad" in x ? String((x as { ad: unknown }).ad) : Array.isArray(x) ? x.join("–") : String(x)))
        .join(", ");
    }
    if (typeof deger === "number") return Number.isFinite(deger) ? String(deger) : null;
    if (typeof deger === "object") return null;
    return String(deger);
  };
  const alanlar = tur ? turunAlanlari(tur) : ALANLAR;
  return alanlar.flatMap((alan) => {
    /* Sayı biçimi bir ayar değil, çalışmanın kılavuzundan geliyor. */
    if (alan === "metinBicimi") return [];
    const deger = yaz(secim[alan]);
    return deger === null ? [] : [{ ad: alanAdi(alan, dil, tur), deger }];
  });
}
