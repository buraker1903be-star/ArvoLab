/*
  ANALİZ YÖNTEMİ KARTLARI VE TEKRAR ÜRETİM BETİĞİ (26.10.2026, kurum
  sahibinin isteği: "hangi analiz yöntemi uygulanacağı kartlar halinde
  sorulmalı: SPSS, Python, R, ANOVA, ANSYS…").

  DÜRÜST SINIR: ArvoLab SPSS'i, R'ı ya da Python'u ÇALIŞTIRMIYOR. Testler
  kendi istatistik motorunda (lib/stats-*.ts, tarayıcıda) hesaplanıyor;
  sonuç bu programların verdiği testlerin aynısı. Program seçilince
  ayrıca o programda AYNI analizi yeniden üreten betik veriliyor:
  danışman ya da jüri "SPSS çıktısı nerede" dediğinde öğrenci kendi
  bilgisayarında çalıştırıp doğrulayabilsin. Betik hesap yapmaz, sonuç
  uydurmaz; yalnızca komutları yazar.

  ANSYS bir mühendislik simülasyon programı (sonlu elemanlar); veri
  tablosundan istatistik testi değil. ArvoLab onu çalıştıramaz — kart
  bunu söyleyerek kapalı duruyor, "yapabiliyormuş gibi" görünmüyor.

  Saf modül; testi tests/unit/analiz-betik.test.ts.
*/

import { ANALIZ_ETIKETLERI, type AnalizTuru } from "./analiz-turleri";

export type AnalizAraci = "spss" | "r" | "python";

export type ProgramKarti = {
  anahtar: AnalizAraci | "ansys";
  ad: string;
  aciklama: string;
  /** Çalıştırılamayan program: kart kapalı, nedeni açıklamada. */
  desteklenmiyor?: boolean;
};

export const PROGRAM_KARTLARI: ProgramKarti[] = [
  { anahtar: "spss", ad: "SPSS", aciklama: "SPSS'teki testlerin aynısı; sonuçla birlikte SPSS sözdizimi (syntax)." },
  { anahtar: "r", ad: "R", aciklama: "Aynı testler; sonuçla birlikte R betiği (readxl, psych)." },
  { anahtar: "python", ad: "Python", aciklama: "Aynı testler; sonuçla birlikte Python betiği (pandas, SciPy, statsmodels)." },
  {
    anahtar: "ansys",
    ad: "ANSYS",
    aciklama:
      "Mühendislik simülasyonu; veri tablosu analizi değil. ArvoLab çalıştıramaz — simülasyon sonuç tablolarınızı Belge olarak ekleyin.",
    desteklenmiyor: true,
  },
];

/** Yöntem kartlarının kısa açıklaması: öğrenci testi adından değil işinden tanısın. */
export const YONTEM_ACIKLAMASI: Record<AnalizTuru, string> = {
  descriptives: "Ortalama, standart sapma, en küçük–en büyük",
  ttest: "İki grubun ortalamasını karşılaştırır",
  anova: "Üç ve daha çok grubun ortalamasını karşılaştırır",
  correlation: "İki sayısal değişken arasındaki ilişki",
  chisquare: "İki kategorik değişken arasındaki ilişki",
  reliability: "Ölçeğin iç tutarlılığı (Cronbach α)",
  pairedttest: "Ön test – son test karşılaştırması",
  mannwhitney: "İki grup, normal dağılmayan veri",
  kruskalwallis: "Üç ve daha çok grup, normal dağılmayan veri",
  spearman: "Sıralı ya da normal dağılmayan iki değişken",
  regression: "Bir değişkeni diğerleriyle yordar",
  ikiyonluanova: "İki faktör ve etkileşimleri",
  wilcoxon: "Ön test – son test, normal dağılmayan farklar",
  friedman: "Üç ve daha çok tekrarlı ölçüm (ön, son, izleme)",
  tekorneklem: "Ortalama belirli bir değerden (ör. 3) farklı mı",
  tekrarlianova: "Aynı kişilerin üç ve daha çok ölçümü, küresellik düzeltmeli",
  ancova: "Ön testi kontrol ederek grupları karşılaştırır",
  kismikorelasyon: "Üçüncü değişken kontrol edilerek ilişki",
  mcnemar: "İki kategorili önce–sonra (Evet/Hayır)",
  lojistik: "İki kategorili sonucu yordar (var/yok)",
  faktor: "Ölçeğin yapısı: KMO, Bartlett, faktör yükleri",
};

/*
  YÖNTEM KARTLARI ARAŞTIRMA SORUSUNA GÖRE GRUPLU (27.10.2026). On dört
  kart tek yığındaydı ve öğrenci testi adından seçmek zorundaydı ("Mann-
  Whitney mi Kruskal-Wallis mi?"). Öğrenci sorusunu biliyor, testin adını
  bilmiyor: kartlar "ne yapmak istiyorsunuz" başlıkları altında; her
  grupta önce parametrik test, sonra normal dağılmayan veri için
  karşılığı.
*/
export const YONTEM_GRUPLARI: { baslik: string; turler: AnalizTuru[] }[] = [
  { baslik: "Veriyi betimle", turler: ["descriptives"] },
  { baslik: "Bir ortalamayı değerle karşılaştır", turler: ["tekorneklem"] },
  { baslik: "İki grubu karşılaştır", turler: ["ttest", "mannwhitney"] },
  { baslik: "Üç ve daha çok grubu karşılaştır", turler: ["anova", "kruskalwallis", "ikiyonluanova", "ancova"] },
  { baslik: "Aynı kişilerin ölçümlerini karşılaştır", turler: ["pairedttest", "wilcoxon", "tekrarlianova", "friedman", "mcnemar"] },
  { baslik: "İlişki ve yordama", turler: ["correlation", "spearman", "kismikorelasyon", "chisquare", "regression", "lojistik"] },
  { baslik: "Ölçek", turler: ["reliability", "faktor"] },
];

export const YONTEM_KARTLARI = (Object.keys(ANALIZ_ETIKETLERI) as AnalizTuru[]).map((tur) => ({
  tur,
  ad: ANALIZ_ETIKETLERI[tur],
  aciklama: YONTEM_ACIKLAMASI[tur],
}));

export type BetikSecimi = {
  varA?: string;
  varB?: string;
  groupVar?: string;
  groupVar2?: string;
  maddeler?: string[];
  yordayicilar?: string[];
  dosyaAdi?: string | null;
  /** İki gruplu testlerde grup değişkeninin verideki iki değeri (SPSS GROUPS= için). */
  gruplar?: string[];
  /** ANCOVA kovaryatları ve kısmi korelasyonun kontrol değişkenleri. */
  kovaryatlar?: string[];
  testDegeri?: number;
  /** Faktör analizinde istenen faktör sayısı; yoksa öz değer > 1. */
  faktorSayisi?: number;
};

/* Değişken adı boşluk ya da Türkçe harf taşıyabilir: her dil kendi biçimiyle tırnaklanır. */
const rAd = (ad: string) => (/^[A-Za-z.][A-Za-z0-9._]*$/.test(ad) ? ad : `\`${ad.replace(/`/g, "")}\``);
const pyKolon = (ad: string) => `veri[${JSON.stringify(ad)}]`;
const pyFormul = (ad: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(ad) ? ad : `Q(${JSON.stringify(ad)})`);
const spssAd = (ad: string) => ad.replace(/\s+/g, "_");

const ad = (deger: string | undefined, yedek: string) => (deger?.trim() ? deger.trim() : yedek);

function spss(tur: AnalizTuru, s: BetikSecimi): string {
  const a = spssAd(ad(s.varA, "degisken1"));
  const b = spssAd(ad(s.varB, "degisken2"));
  const g = spssAd(ad(s.groupVar, "grup"));
  const g2 = spssAd(ad(s.groupVar2, "grup2"));
  const maddeler = (s.maddeler?.length ? s.maddeler : ["madde1", "madde2", "madde3"]).map(spssAd).join(" ");
  const yordayicilar = (s.yordayicilar?.length ? s.yordayicilar : ["yordayici1"]).map(spssAd).join(" ");
  const kovaryatlar = (s.kovaryatlar?.length ? s.kovaryatlar : ["kovaryat1"]).map(spssAd).join(" ");
  /*
    SPSS iki gruplu testte grup DEĞERLERİNİ ister. Veride iki değer
    biliniyorsa onlar yazılır (metin değer tırnaklı); bilinmiyorsa
    (1 2) kalır ve öğrenciye değiştirmesi söylenir — eskiden hep (1 2)
    yazılıyordu, "A/B" kodlu veride SPSS boş sonuç veriyordu.
  */
  const ikiGrup = s.gruplar?.length === 2 ? s.gruplar : null;
  const spssDeger = (d: string) => (/^-?\d+(\.\d+)?$/.test(d) ? d : `'${d.replace(/'/g, "''")}'`);
  const kodlar = ikiGrup ? `(${ikiGrup.map(spssDeger).join(" ")})` : "(1 2)";
  const grupNotu = ikiGrup ? "* Grup değerleri verinizden alındı." : "* Grup kodlarını (1 2) kendi verinizdeki değerlerle değiştirin.";
  switch (tur) {
    case "descriptives":
      return "DESCRIPTIVES VARIABLES=ALL\n  /STATISTICS=MEAN STDDEV MIN MAX.";
    case "ttest":
      return `${grupNotu}\nT-TEST GROUPS=${g}${kodlar}\n  /VARIABLES=${a}\n  /CRITERIA=CI(.95).`;
    case "anova":
      return `ONEWAY ${a} BY ${g}\n  /STATISTICS DESCRIPTIVES HOMOGENEITY\n  /POSTHOC=TUKEY ALPHA(0.05).`;
    case "correlation":
      return `CORRELATIONS\n  /VARIABLES=${a} ${b}\n  /PRINT=TWOTAIL NOSIG.`;
    case "spearman":
      return `NONPAR CORR\n  /VARIABLES=${a} ${b}\n  /PRINT=SPEARMAN TWOTAIL.`;
    case "chisquare":
      return `CROSSTABS\n  /TABLES=${a} BY ${b}\n  /STATISTICS=CHISQ PHI\n  /CELLS=COUNT EXPECTED.`;
    case "reliability":
      return `RELIABILITY\n  /VARIABLES=${maddeler}\n  /MODEL=ALPHA\n  /SUMMARY=TOTAL.`;
    case "pairedttest":
      return `T-TEST PAIRS=${a} WITH ${b} (PAIRED)\n  /CRITERIA=CI(.95).`;
    case "mannwhitney":
      return `${grupNotu}\nNPAR TESTS\n  /M-W=${a} BY ${g}${kodlar}.`;
    case "kruskalwallis":
      return `* Grup aralığını (1 3) kendi verinizdeki en küçük ve en büyük kodla değiştirin.\nNPAR TESTS\n  /K-W=${a} BY ${g}(1 3).`;
    case "regression":
      return `REGRESSION\n  /STATISTICS COEFF OUTS R ANOVA COLLIN TOL\n  /DEPENDENT ${a}\n  /METHOD=ENTER ${yordayicilar}.`;
    case "wilcoxon":
      return `NPAR TESTS\n  /WILCOXON=${a} WITH ${b} (PAIRED).`;
    case "friedman":
      return `NPAR TESTS\n  /FRIEDMAN=${maddeler}\n  /KENDALL=${maddeler}.`;
    case "tekorneklem":
      return `T-TEST\n  /TESTVAL=${s.testDegeri ?? 0}\n  /VARIABLES=${a}\n  /CRITERIA=CI(.95).`;
    case "tekrarlianova":
      return `GLM ${maddeler}\n  /WSFACTOR=olcum ${s.maddeler?.length || 3} Polynomial\n  /PRINT=DESCRIPTIVE ETASQ\n  /EMMEANS=TABLES(olcum) COMPARE ADJ(BONFERRONI)\n  /WSDESIGN=olcum.`;
    case "ancova":
      return `UNIANOVA ${a} BY ${g} WITH ${kovaryatlar}\n  /PRINT=ETASQ DESCRIPTIVE HOMOGENEITY\n  /EMMEANS=TABLES(${g}) WITH(${kovaryatlar.split(" ").map((k) => `${k}=MEAN`).join(" ")}) COMPARE ADJ(BONFERRONI)\n  /DESIGN=${kovaryatlar} ${g}.`;
    case "kismikorelasyon":
      return `PARTIAL CORR\n  /VARIABLES=${a} ${b} BY ${kovaryatlar}\n  /SIGNIFICANCE=TWOTAIL.`;
    case "mcnemar":
      return `NPAR TESTS\n  /MCNEMAR=${a} WITH ${b} (PAIRED).`;
    case "lojistik":
      return `LOGISTIC REGRESSION VARIABLES ${a}\n  /METHOD=ENTER ${yordayicilar}\n  /PRINT=CI(95)\n  /CRITERIA=ITERATE(20) CUT(.5).`;
    case "faktor":
      return `FACTOR\n  /VARIABLES ${maddeler}\n  /PRINT INITIAL KMO EXTRACTION ROTATION\n  /CRITERIA ${s.faktorSayisi ? `FACTORS(${s.faktorSayisi})` : "MINEIGEN(1)"} ITERATE(25)\n  /EXTRACTION PC\n  /ROTATION VARIMAX.`;
    case "ikiyonluanova":
      return `UNIANOVA ${a} BY ${g} ${g2}\n  /PRINT=ETASQ DESCRIPTIVE HOMOGENEITY\n  /DESIGN=${g} ${g2} ${g}*${g2}.`;
  }
}

function r(tur: AnalizTuru, s: BetikSecimi): string {
  const a = rAd(ad(s.varA, "degisken1"));
  const b = rAd(ad(s.varB, "degisken2"));
  const g = rAd(ad(s.groupVar, "grup"));
  const g2 = rAd(ad(s.groupVar2, "grup2"));
  const maddeler = (s.maddeler?.length ? s.maddeler : ["madde1", "madde2", "madde3"]).map((m) => JSON.stringify(m)).join(", ");
  const yordayicilar = (s.yordayicilar?.length ? s.yordayicilar : ["yordayici1"]).map(rAd).join(" + ");
  const kovListe = s.kovaryatlar?.length ? s.kovaryatlar : ["kovaryat1"];
  const kovaryatlarR = kovListe.map(rAd).join(" + ");
  const kovaryatlarListe = kovListe.map((k) => JSON.stringify(k)).join(", ");
  const dosya = s.dosyaAdi?.trim() || "veriniz.xlsx";
  const okuma = /\.csv$/i.test(dosya)
    ? `veri <- read.csv(${JSON.stringify(dosya)})`
    : `library(readxl)\nveri <- read_excel(${JSON.stringify(dosya)})`;
  const govde: Record<AnalizTuru, string> = {
    descriptives: "summary(veri)\nsapply(veri[sapply(veri, is.numeric)], sd, na.rm = TRUE)",
    ttest: `t.test(${a} ~ ${g}, data = veri, var.equal = TRUE)\n# Levene için: car::leveneTest(${a} ~ factor(${g}), data = veri)`,
    anova: `model <- aov(${a} ~ factor(${g}), data = veri)\nsummary(model)\nTukeyHSD(model)`,
    correlation: `cor.test(veri$${a}, veri$${b}, method = "pearson")`,
    spearman: `cor.test(veri$${a}, veri$${b}, method = "spearman")`,
    chisquare: `chisq.test(table(veri$${a}, veri$${b}))`,
    reliability: `library(psych)\nalpha(veri[, c(${maddeler})])`,
    pairedttest: `t.test(veri$${a}, veri$${b}, paired = TRUE)`,
    mannwhitney: `wilcox.test(${a} ~ ${g}, data = veri)`,
    kruskalwallis: `kruskal.test(${a} ~ factor(${g}), data = veri)`,
    regression: `model <- lm(${a} ~ ${yordayicilar}, data = veri)\nsummary(model)`,
    ikiyonluanova: `model <- aov(${a} ~ factor(${g}) * factor(${g2}), data = veri)\nsummary(model)`,
    wilcoxon: `wilcox.test(veri$${a}, veri$${b}, paired = TRUE, exact = FALSE, correct = FALSE)`,
    friedman: `olcumler <- na.omit(veri[, c(${maddeler})])\nfriedman.test(as.matrix(olcumler))`,
    tekorneklem: `t.test(veri$${a}, mu = ${s.testDegeri ?? 0})`,
    tekrarlianova: `library(rstatix)\nlibrary(tidyr)\nveri$id <- seq_len(nrow(veri))\nuzun <- pivot_longer(veri[, c("id", ${maddeler})], -id, names_to = "olcum", values_to = "puan")\nanova_test(uzun, dv = puan, wid = id, within = olcum)  # Mauchly ve GG/HF düzeltmesi dahil\npairwise_t_test(uzun, puan ~ olcum, paired = TRUE, p.adjust.method = "bonferroni")`,
    ancova: `model <- lm(${a} ~ ${kovaryatlarR} + factor(${g}), data = veri)\ncar::Anova(model, type = 2)\nemmeans::emmeans(model, ~ ${g})  # düzeltilmiş ortalamalar`,
    kismikorelasyon: `library(ppcor)\ntemiz <- na.omit(veri[, c(${JSON.stringify(ad(s.varA, "degisken1"))}, ${JSON.stringify(ad(s.varB, "degisken2"))}, ${kovaryatlarListe})])\npcor.test(temiz[[1]], temiz[[2]], temiz[, -(1:2)])`,
    mcnemar: `mcnemar.test(table(veri$${a}, veri$${b}))`,
    lojistik: `model <- glm(${a} ~ ${yordayicilar}, data = veri, family = binomial)\nsummary(model)\nexp(cbind(OR = coef(model), confint.default(model)))`,
    faktor: `library(psych)\nmaddeler <- na.omit(veri[, c(${maddeler})])\nKMO(maddeler)\ncortest.bartlett(cor(maddeler), n = nrow(maddeler))\nprincipal(maddeler, nfactors = ${s.faktorSayisi ?? "sum(eigen(cor(maddeler))$values > 1)"}, rotate = "varimax")`,
  };
  return `${okuma}\n\n${govde[tur]}`;
}

function python(tur: AnalizTuru, s: BetikSecimi): string {
  const aAd = ad(s.varA, "degisken1");
  const bAd = ad(s.varB, "degisken2");
  const gAd = ad(s.groupVar, "grup");
  const g2Ad = ad(s.groupVar2, "grup2");
  const a = pyKolon(aAd);
  const b = pyKolon(bAd);
  const dosya = s.dosyaAdi?.trim() || "veriniz.xlsx";
  const okuma = /\.csv$/i.test(dosya) ? `veri = pd.read_csv(${JSON.stringify(dosya)})` : `veri = pd.read_excel(${JSON.stringify(dosya)})`;
  const gruplar = `gruplar = [g[${JSON.stringify(aAd)}].dropna() for _, g in veri.groupby(${JSON.stringify(gAd)})]`;
  const maddeler = JSON.stringify(s.maddeler?.length ? s.maddeler : ["madde1", "madde2", "madde3"]);
  const yordayicilar = (s.yordayicilar?.length ? s.yordayicilar : ["yordayici1"]).map(pyFormul).join(" + ");
  const kovaryatlarPy = JSON.stringify(s.kovaryatlar?.length ? s.kovaryatlar : ["kovaryat1"]);
  const govde: Record<AnalizTuru, string> = {
    descriptives: "print(veri.describe())",
    ttest: `${gruplar}\nprint(stats.ttest_ind(gruplar[0], gruplar[1]))\nprint(stats.levene(gruplar[0], gruplar[1]))`,
    anova: `${gruplar}\nprint(stats.f_oneway(*gruplar))\nfrom statsmodels.stats.multicomp import pairwise_tukeyhsd\ntemiz = veri[[${JSON.stringify(aAd)}, ${JSON.stringify(gAd)}]].dropna()\nprint(pairwise_tukeyhsd(temiz[${JSON.stringify(aAd)}], temiz[${JSON.stringify(gAd)}]))`,
    correlation: `temiz = veri[[${JSON.stringify(aAd)}, ${JSON.stringify(bAd)}]].dropna()\nprint(stats.pearsonr(temiz[${JSON.stringify(aAd)}], temiz[${JSON.stringify(bAd)}]))`,
    spearman: `temiz = veri[[${JSON.stringify(aAd)}, ${JSON.stringify(bAd)}]].dropna()\nprint(stats.spearmanr(temiz[${JSON.stringify(aAd)}], temiz[${JSON.stringify(bAd)}]))`,
    chisquare: `tablo = pd.crosstab(${a}, ${b})\nprint(stats.chi2_contingency(tablo))`,
    reliability: `maddeler = veri[${maddeler}].dropna()\nk = maddeler.shape[1]\nalfa = k / (k - 1) * (1 - maddeler.var(ddof=1).sum() / maddeler.sum(axis=1).var(ddof=1))\nprint("Cronbach alfa:", round(alfa, 3))`,
    pairedttest: `temiz = veri[[${JSON.stringify(aAd)}, ${JSON.stringify(bAd)}]].dropna()\nprint(stats.ttest_rel(temiz[${JSON.stringify(aAd)}], temiz[${JSON.stringify(bAd)}]))`,
    mannwhitney: `${gruplar}\nprint(stats.mannwhitneyu(gruplar[0], gruplar[1], alternative="two-sided"))`,
    kruskalwallis: `${gruplar}\nprint(stats.kruskal(*gruplar))`,
    regression: `import statsmodels.formula.api as smf\nmodel = smf.ols(${JSON.stringify(`${pyFormul(aAd)} ~ ${yordayicilar}`)}, data=veri).fit()\nprint(model.summary())`,
    wilcoxon: `temiz = veri[[${JSON.stringify(aAd)}, ${JSON.stringify(bAd)}]].dropna()\nprint(stats.wilcoxon(temiz[${JSON.stringify(bAd)}], temiz[${JSON.stringify(aAd)}], correction=False, method="approx"))`,
    friedman: `olcumler = veri[${maddeler}].dropna()\nprint(stats.friedmanchisquare(*[olcumler[m] for m in olcumler.columns]))`,
    tekorneklem: `print(stats.ttest_1samp(${a}.dropna(), ${s.testDegeri ?? 0}))`,
    tekrarlianova: `import pingouin as pg\nuzun = veri[${maddeler}].dropna().reset_index().melt(id_vars="index", var_name="olcum", value_name="puan")\nprint(pg.rm_anova(uzun, dv="puan", within="olcum", subject="index", correction=True))\nprint(pg.pairwise_tests(uzun, dv="puan", within="olcum", subject="index", padjust="bonf"))`,
    ancova: `import pingouin as pg\nprint(pg.ancova(veri, dv=${JSON.stringify(aAd)}, between=${JSON.stringify(gAd)}, covar=${kovaryatlarPy}))`,
    kismikorelasyon: `import pingouin as pg\nprint(pg.partial_corr(veri, x=${JSON.stringify(aAd)}, y=${JSON.stringify(bAd)}, covar=${kovaryatlarPy}))`,
    mcnemar: `from statsmodels.stats.contingency_tables import mcnemar\nprint(mcnemar(pd.crosstab(${a}, ${b}), exact=True))`,
    lojistik: `import numpy as np\nimport statsmodels.formula.api as smf\nmodel = smf.logit(${JSON.stringify(`${pyFormul(aAd)} ~ ${yordayicilar}`)}, data=veri).fit()\nprint(model.summary())\nprint(np.exp(model.params))  # Exp(B)`,
    faktor: `from factor_analyzer import FactorAnalyzer\nfrom factor_analyzer.factor_analyzer import calculate_bartlett_sphericity, calculate_kmo\nmaddeler = veri[${maddeler}].dropna()\nprint("KMO:", calculate_kmo(maddeler)[1])\nprint("Bartlett:", calculate_bartlett_sphericity(maddeler))\nfa = FactorAnalyzer(n_factors=${s.faktorSayisi ?? 2}, rotation="varimax", method="principal")\nfa.fit(maddeler)\nprint(fa.loadings_)`,
    ikiyonluanova: `import statsmodels.api as sm\nimport statsmodels.formula.api as smf\nmodel = smf.ols(${JSON.stringify(`${pyFormul(aAd)} ~ C(${pyFormul(gAd)}) * C(${pyFormul(g2Ad)})`)}, data=veri).fit()\nprint(sm.stats.anova_lm(model, typ=2))`,
  };
  return `import pandas as pd\nfrom scipy import stats\n\n${okuma}\n\n${govde[tur]}`;
}

/** Seçilen programda aynı analizi yeniden üreten betik. */
export function analizBetigi(arac: AnalizAraci, tur: AnalizTuru, secim: BetikSecimi): string {
  const baslik =
    arac === "spss"
      ? `* ${ANALIZ_ETIKETLERI[tur]} — ArvoLab'ın hesapladığı analizin SPSS sözdizimi.\n* Verinizi SPSS'te açıp bu sözdizimini çalıştırın.\n`
      : `# ${ANALIZ_ETIKETLERI[tur]} — ArvoLab'ın hesapladığı analizin ${arac === "r" ? "R" : "Python"} betiği.\n`;
  const govde = arac === "spss" ? spss(tur, secim) : arac === "r" ? r(tur, secim) : python(tur, secim);
  return `${baslik}${govde}\n`;
}

export const ARAC_ADI: Record<AnalizAraci, string> = { spss: "SPSS sözdizimi", r: "R betiği", python: "Python betiği" };
