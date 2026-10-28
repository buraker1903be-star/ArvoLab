/*
  Analiz türlerinin tek listesi.

  Etiketler eskiden yalnızca data-analyzer.tsx içindeki bir sabitteydi;
  kaydedilen sonuçların geçmişi de aynı adları yazmak zorunda olduğu için
  liste buraya alındı. İki yerde ayrı ayrı tutulsaydı, yeni bir test
  eklendiğinde geçmiş ekranı ham anahtarı ("chisquare") gösterirdi.
*/

import type { Dil, Metin } from "@/lib/dil";

export const ANALIZ_ETIKETLERI = {
  descriptives: "Betimsel İstatistikler",
  ttest: "Bağımsız Örneklem t-Testi",
  anova: "Tek Yönlü ANOVA",
  correlation: "Pearson Korelasyonu",
  chisquare: "Ki-Kare Bağımsızlık Testi",
  reliability: "Güvenilirlik Analizi (Cronbach Alpha)",
  /*
    Parametrik olmayan karşılıklar (25.10.2026). Varsayım şeridi
    bunları öneriyordu ama program yapamıyordu; öneri, karşılığı
    sunulmadığında kullanıcıyı çıkmaza sokuyordu.
  */
  /* Ön test–son test deseni tezlerde en yaygın kurgulardan biri ve
     program bunu hiç yapamıyordu. */
  pairedttest: "Eşleştirilmiş Örneklem t-Testi",
  mannwhitney: "Mann-Whitney U Testi",
  kruskalwallis: "Kruskal-Wallis H Testi",
  spearman: "Spearman Sıra Korelasyonu",
  /* Makalelerin ve tezlerin belkemiği olan analiz programda hiç
     yoktu; korelasyon ilişkinin gücünü söyler, "X bir birim artınca
     Y ne kadar artar" sorusunu yanıtlamaz. */
  regression: "Doğrusal Regresyon",
  /*
    İki yönlü ANOVA (26.10.2026): "cinsiyet VE sınıf düzeyine göre fark
    var mı" sorusu iki ayrı tek yönlü ANOVA'yla yanıtlanamıyor — iki
    ayrı test ETKİLEŞİMİ göremez ve asıl bulgu çoğu zaman odur.
  */
  ikiyonluanova: "İki Yönlü ANOVA",
  /*
    Bağımlı ölçümlerin parametrik olmayan karşılıkları (27.10.2026):
    eşleştirilmiş t-testinde varsayım şeridi farkların normalden uzak
    olduğunu söylüyor ama karşılığını sunamıyordu; üç ve daha çok
    tekrarlı ölçüm (ön test, son test, izleme) için hiçbir test yoktu.
  */
  wilcoxon: "Wilcoxon İşaretli Sıralar Testi",
  friedman: "Friedman Testi",
  /*
    27.10.2026 (kurum sahibinin isteği: "analiz çeşitlerini arttıralım,
    ANOVA ve yapabileceğimiz diğer analiz türleri"). Her biri bağımsız bir
    uygulamaya (SciPy, statsmodels, pingouin) karşı test dosyasında sınanıyor.
  */
  tekorneklem: "Tek Örneklem t-Testi",
  tekrarlianova: "Tekrarlı Ölçümler ANOVA",
  ancova: "Kovaryans Analizi (ANCOVA)",
  kismikorelasyon: "Kısmi Korelasyon",
  mcnemar: "McNemar Testi",
  lojistik: "İkili Lojistik Regresyon",
  faktor: "Açımlayıcı Faktör Analizi",
  /* Deney/kontrol × ön test/son test deseni (27.10.2026): asıl bulgu etkileşim. */
  karmaanova: "Karma ANOVA (Gruplar Arası × Tekrarlı)",
  /* PROCESS Model 4 / Model 1 ve AMOS'un DFA'sı (27.10.2026). */
  aracilik: "Aracılık Analizi (Mediation)",
  duzenleyicilik: "Düzenleyicilik Analizi (Moderation)",
  dfa: "Doğrulayıcı Faktör Analizi (DFA)",
} as const;

export type AnalizTuru = keyof typeof ANALIZ_ETIKETLERI;

export const ANALIZ_TURLERI = Object.keys(ANALIZ_ETIKETLERI) as AnalizTuru[];

/*
  İngilizce adlar (28.10.2026). Türkçe harita `as const` kaldı: çağıranlar
  onun daraltılmış tipine dayanıyor. İngilizce ayrı bir harita olarak
  yazıldı ve `Record<AnalizTuru, …>` tipi her yeni türün İngilizcesinin de
  yazılmasını derleyiciye zorunlu kıldırıyor. Adlar SPSS/jamovi'nin
  İngilizce menülerindeki yerleşik adlar; kullanıcı onları orada arıyor.
*/
const ANALIZ_ETIKETLERI_EN: Record<AnalizTuru, string> = {
  descriptives: "Descriptive Statistics",
  ttest: "Independent Samples t-Test",
  anova: "One-Way ANOVA",
  correlation: "Pearson Correlation",
  chisquare: "Chi-Square Test of Independence",
  reliability: "Reliability Analysis (Cronbach's Alpha)",
  pairedttest: "Paired Samples t-Test",
  mannwhitney: "Mann-Whitney U Test",
  kruskalwallis: "Kruskal-Wallis H Test",
  spearman: "Spearman Rank Correlation",
  regression: "Linear Regression",
  ikiyonluanova: "Two-Way ANOVA",
  wilcoxon: "Wilcoxon Signed-Rank Test",
  friedman: "Friedman Test",
  tekorneklem: "One-Sample t-Test",
  tekrarlianova: "Repeated Measures ANOVA",
  ancova: "Analysis of Covariance (ANCOVA)",
  kismikorelasyon: "Partial Correlation",
  mcnemar: "McNemar Test",
  lojistik: "Binary Logistic Regression",
  faktor: "Exploratory Factor Analysis",
  karmaanova: "Mixed ANOVA (Between × Within)",
  aracilik: "Mediation Analysis",
  duzenleyicilik: "Moderation Analysis",
  dfa: "Confirmatory Factor Analysis (CFA)",
};

/** Her analiz türünün iki dildeki adı; çağıran `t(...)` ile seçer. */
export const ANALIZ_ETIKETLERI_METIN = Object.fromEntries(
  (Object.keys(ANALIZ_ETIKETLERI) as AnalizTuru[]).map((tur) => [
    tur,
    { tr: ANALIZ_ETIKETLERI[tur], en: ANALIZ_ETIKETLERI_EN[tur] },
  ]),
) as Record<AnalizTuru, Metin>;

export function analizTuruMu(deger: string): deger is AnalizTuru {
  return deger in ANALIZ_ETIKETLERI;
}

/*
  Tanınmayan tür ham haliyle döner. "Bilinmeyen analiz" yazmak, eski bir
  kaydın hangi testten geldiğini kullanıcıdan gizlemek olurdu; anahtarın
  kendisi hiç yoktan iyidir.
*/
export function analizEtiketi(tur: string, dil: Dil = "tr"): string {
  return analizTuruMu(tur) ? ANALIZ_ETIKETLERI_METIN[tur][dil] : tur;
}

export interface AnalizSecimi {
  varA?: string;
  varB?: string;
  /** Aracılık ve düzenleyicilikte sonuç değişkeni (Y). */
  varY?: string;
  groupVar?: string;
  maddeSayisi?: number;
  /** Tek örneklem t-testinin karşılaştırma değeri. */
  testDegeri?: number;
}

const EN_UZUN_BASLIK = 300;

/*
  Kaydedilen sonucun başlığı: hangi testin HANGİ DEĞİŞKENLERLE
  çalıştırıldığı. Yalnızca test adı yazılsaydı ("Pearson Korelasyonu")
  üç ayrı korelasyon geçmişte birbirinin aynısı görünürdü.

  Değişken seçilmemişse uydurulmuyor: eksik parçalar atlanıyor ve geriye
  yalnızca testin adı kalıyor.
*/
export function analizBasligi(tur: string, secim: AnalizSecimi, dil: Dil = "tr"): string {
  const en = dil === "en";
  const yordayici = (n: number) => (en ? `${n} predictor${n === 1 ? "" : "s"}` : `${n} yordayıcı`);
  const madde = (n: number) => (en ? `${n} item${n === 1 ? "" : "s"}` : `${n} madde`);
  const olcum = (n: number) => (en ? `${n} measurement${n === 1 ? "" : "s"}` : `${n} ölçüm`);
  const a = secim.varA?.trim();
  const b = secim.varB?.trim();
  const grup = secim.groupVar?.trim();

  const govde =
    tur === "descriptives"
      ? en ? "all numeric variables" : "tüm sayısal değişkenler"
      : tur === "ttest" || tur === "anova" || tur === "mannwhitney" || tur === "kruskalwallis"
        ? [a, grup].filter(Boolean).join(" ~ ")
        : tur === "correlation" || tur === "spearman" || tur === "pairedttest" || tur === "wilcoxon" || tur === "kismikorelasyon" || tur === "mcnemar"
          ? [a, b].filter(Boolean).join(" — ")
          : tur === "chisquare"
            ? [a, b].filter(Boolean).join(" × ")
            : tur === "regression"
              ? [a, secim.maddeSayisi ? yordayici(secim.maddeSayisi) : ""].filter(Boolean).join(" ~ ")
            : tur === "reliability" && secim.maddeSayisi
              ? madde(secim.maddeSayisi)
            : (tur === "friedman" || tur === "tekrarlianova") && secim.maddeSayisi
              ? olcum(secim.maddeSayisi)
            : tur === "karmaanova"
              ? [secim.maddeSayisi ? olcum(secim.maddeSayisi) : "", grup].filter(Boolean).join(" × ")
            : tur === "faktor" && secim.maddeSayisi
              ? madde(secim.maddeSayisi)
            : tur === "tekorneklem" && a
              ? `${a}${secim.testDegeri !== undefined ? ` (${en ? "test value" : "test değeri"} ${secim.testDegeri})` : ""}`
            : tur === "ancova"
              ? [a, grup].filter(Boolean).join(" ~ ")
            : tur === "aracilik" && a && b && secim.varY
              ? `${a} → ${b} → ${secim.varY}`
            : tur === "duzenleyicilik" && a && b && secim.varY
              ? `${a} → ${secim.varY}, ${en ? "moderator" : "düzenleyici"} ${b}`
            : tur === "dfa" && secim.maddeSayisi
              ? madde(secim.maddeSayisi)
            : tur === "lojistik"
              ? [a, secim.maddeSayisi ? yordayici(secim.maddeSayisi) : ""].filter(Boolean).join(" ~ ")
              : "";

  const ad = analizEtiketi(tur, dil);
  const tam = govde ? `${ad}: ${govde}` : ad;
  return tam.length > EN_UZUN_BASLIK ? `${tam.slice(0, EN_UZUN_BASLIK - 1)}…` : tam;
}
