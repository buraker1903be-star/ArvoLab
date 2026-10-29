import type { MetinBicimi } from "@/lib/veri-okuma";
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

import type { Dil, Metin } from "@/lib/dil";
import { ANALIZ_ETIKETLERI, analizEtiketi, type AnalizTuru } from "./analiz-turleri";

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

/*
  Kartların İngilizcesi (28.10.2026). Eski dışa aktarımlar tipleriyle
  birlikte Türkçe kaldı (çağıranlar onlara dayanıyor); dile göre seçim
  aşağıdaki işlevlerle.
*/
const PROGRAM_ACIKLAMASI_EN: Record<ProgramKarti["anahtar"], string> = {
  spss: "Same tests as in SPSS; SPSS syntax comes with the result.",
  r: "Same tests; an R script (readxl, psych) comes with the result.",
  python: "Same tests; a Python script (pandas, SciPy, statsmodels) comes with the result.",
  ansys:
    "Engineering simulation, not data-table analysis. ArvoLab cannot run it — add your simulation result tables as a Document.",
};

export function programKartlari(dil: Dil = "tr"): ProgramKarti[] {
  if (dil === "tr") return PROGRAM_KARTLARI;
  return PROGRAM_KARTLARI.map((k) => ({ ...k, aciklama: PROGRAM_ACIKLAMASI_EN[k.anahtar] }));
}

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
  karmaanova: "Deney–kontrol × ön test–son test; grupların değişimi farklı mı",
  aracilik: "X, Y'yi M üzerinden mi etkiliyor (bootstrap)",
  duzenleyicilik: "X'in Y'ye etkisi W'ye göre değişiyor mu",
  dfa: "Önerilen faktör yapısı veride doğrulanıyor mu (CFI, RMSEA…)",
};

const YONTEM_ACIKLAMASI_EN: Record<AnalizTuru, string> = {
  descriptives: "Mean, standard deviation, minimum–maximum",
  ttest: "Compares the means of two groups",
  anova: "Compares the means of three or more groups",
  correlation: "Relationship between two numeric variables",
  chisquare: "Relationship between two categorical variables",
  reliability: "Internal consistency of a scale (Cronbach's α)",
  pairedttest: "Pretest–posttest comparison",
  mannwhitney: "Two groups, non-normally distributed data",
  kruskalwallis: "Three or more groups, non-normally distributed data",
  spearman: "Two ordinal or non-normally distributed variables",
  regression: "Predicts one variable from the others",
  ikiyonluanova: "Two factors and their interaction",
  wilcoxon: "Pretest–posttest, non-normally distributed differences",
  friedman: "Three or more repeated measurements (pre, post, follow-up)",
  tekorneklem: "Does the mean differ from a given value (e.g., 3)?",
  tekrarlianova: "Three or more measurements of the same people, with sphericity correction",
  ancova: "Compares groups while controlling for the pretest",
  kismikorelasyon: "Relationship controlling for a third variable",
  mcnemar: "Two-category before–after (Yes/No)",
  lojistik: "Predicts a two-category outcome (present/absent)",
  faktor: "Scale structure: KMO, Bartlett, factor loadings",
  karmaanova: "Experimental–control × pretest–posttest; do the groups change differently?",
  aracilik: "Does X affect Y through M? (bootstrap)",
  duzenleyicilik: "Does the effect of X on Y depend on W?",
  dfa: "Is the proposed factor structure confirmed by the data? (CFI, RMSEA…)",
};

/** Yöntem açıklamasının iki dildeki yazımı. */
export const YONTEM_ACIKLAMASI_METIN = Object.fromEntries(
  (Object.keys(YONTEM_ACIKLAMASI) as AnalizTuru[]).map((tur) => [
    tur,
    { tr: YONTEM_ACIKLAMASI[tur], en: YONTEM_ACIKLAMASI_EN[tur] },
  ]),
) as Record<AnalizTuru, Metin>;

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
  { baslik: "Aynı kişilerin ölçümlerini karşılaştır", turler: ["pairedttest", "wilcoxon", "tekrarlianova", "friedman", "karmaanova", "mcnemar"] },
  { baslik: "İlişki ve yordama", turler: ["correlation", "spearman", "kismikorelasyon", "chisquare", "regression", "lojistik", "aracilik", "duzenleyicilik"] },
  { baslik: "Ölçek", turler: ["reliability", "faktor", "dfa"] },
];

/* Grup başlıklarının İngilizcesi; sıra YONTEM_GRUPLARI ile aynı. */
const YONTEM_GRUP_BASLIKLARI_EN = [
  "Describe the data",
  "Compare a mean with a value",
  "Compare two groups",
  "Compare three or more groups",
  "Compare measurements of the same people",
  "Relationship and prediction",
  "Scale",
];

export function yontemGruplari(dil: Dil = "tr"): { baslik: string; turler: AnalizTuru[] }[] {
  if (dil === "tr") return YONTEM_GRUPLARI;
  return YONTEM_GRUPLARI.map((g, i) => ({ ...g, baslik: YONTEM_GRUP_BASLIKLARI_EN[i] }));
}

export const YONTEM_KARTLARI = (Object.keys(ANALIZ_ETIKETLERI) as AnalizTuru[]).map((tur) => ({
  tur,
  ad: ANALIZ_ETIKETLERI[tur],
  aciklama: YONTEM_ACIKLAMASI[tur],
}));

export function yontemKartlari(dil: Dil = "tr"): { tur: AnalizTuru; ad: string; aciklama: string }[] {
  return YONTEM_KARTLARI.map(({ tur }) => ({
    tur,
    ad: analizEtiketi(tur, dil),
    aciklama: YONTEM_ACIKLAMASI_METIN[tur][dil],
  }));
}

export type BetikSecimi = {
  varA?: string;
  varB?: string;
  groupVar?: string;
  groupVar2?: string;
  maddeler?: string[];
  yordayicilar?: string[];
  dosyaAdi?: string | null;
  /** Metin dosyasında ArvoLab'ın ayırıcı ve ondalık kararı (lib/veri-okuma.ts csvOku). */
  metinBicimi?: MetinBicimi;
  /** İki gruplu testlerde grup değişkeninin verideki iki değeri (SPSS GROUPS= için). */
  gruplar?: string[];
  /** ANCOVA kovaryatları ve kısmi korelasyonun kontrol değişkenleri. */
  kovaryatlar?: string[];
  testDegeri?: number;
  /** Faktör analizinde istenen faktör sayısı; yoksa öz değer > 1. */
  faktorSayisi?: number;
  /** Aracılık/düzenleyicilikte sonuç değişkeni. */
  varY?: string;
  /** DFA modeli: faktör adı ve maddeleri. */
  dfaFaktorleri?: { ad: string; maddeler: string[] }[];
  /** Aracılıkta aracılar (bir ya da daha çok) ve çoklu aracının modeli. */
  aracilar?: string[];
  araciModeli?: "paralel" | "seri";
  /** DFA'da serbest bırakılan hata kovaryansları. */
  dfaHataKovaryanslari?: [string, string][];
};

/*
  Aracılık için lavaan modeli: tek, paralel ya da seri aracı. Etiketler
  a1, d21, b1…; dolaylı yollar ":=" ile tanımlanır, bootstrap lavaan'da.
*/
function aracilikLavaan(s: BetikSecimi): string {
  const x = ad(s.varA, "x");
  const y = ad(s.varY, "sonuc");
  const ms = s.aracilar?.length ? s.aracilar : [ad(s.varB, "araci")];
  const seri = s.araciModeli === "seri" && ms.length > 1;
  const satirlar = ms.map((m, j) => {
    const onceki = seri ? ms.slice(0, j).map((o, i) => ` + d${j + 1}${i + 1}*${o}`).join("") : "";
    return `  ${m} ~ a${j + 1}*${x}${onceki}`;
  });
  satirlar.push(`  ${y} ~ ${ms.map((m, j) => `b${j + 1}*${m}`).join(" + ")} + c*${x}`);
  /* Yollar: paralelde tekli, seride sıralı her alt küme. */
  const kumeler: number[][] = [];
  if (seri) {
    for (let maske = 1; maske < 1 << ms.length; maske += 1) kumeler.push(ms.map((_, j) => j).filter((j) => maske & (1 << j)));
    kumeler.sort((p, q) => p.length - q.length || p.join().localeCompare(q.join()));
  } else ms.forEach((_, j) => kumeler.push([j]));
  const yollar = kumeler.map((km) => [`a${km[0] + 1}`, ...km.slice(1).map((j, t) => `d${j + 1}${km[t] + 1}`), `b${km[km.length - 1] + 1}`].join("*"));
  yollar.forEach((y2, i) => satirlar.push(`  ind${i + 1} := ${y2}`));
  satirlar.push(`  toplam_dolayli := ${yollar.map((_, i) => `ind${i + 1}`).join(" + ")}`);
  return `library(lavaan)\nmodel <- '\n${satirlar.join("\n")}\n'\nfit <- sem(model, data = veri, se = "bootstrap", bootstrap = 5000)\nparameterEstimates(fit, boot.ci.type = "perc")`;
}

/* lavaan / semopy model metni: "F1 =~ m1 + m2 + m3" satırları. */
const dfaModelMetni = (s: BetikSecimi) =>
  (s.dfaFaktorleri?.length ? s.dfaFaktorleri : [{ ad: "F1", maddeler: ["m1", "m2", "m3"] }])
    .map((f) => `${f.ad.replace(/\s+/g, "_")} =~ ${f.maddeler.join(" + ")}`)
    .concat((s.dfaHataKovaryanslari ?? []).map(([a, b]) => `${a} ~~ ${b}`))
    .join("\n");

/* Değişken adı boşluk ya da Türkçe harf taşıyabilir: her dil kendi biçimiyle tırnaklanır. */
const rAd = (ad: string) => (/^[A-Za-z.][A-Za-z0-9._]*$/.test(ad) ? ad : `\`${ad.replace(/`/g, "")}\``);
const pyKolon = (ad: string) => `veri[${JSON.stringify(ad)}]`;
const pyFormul = (ad: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(ad) ? ad : `Q(${JSON.stringify(ad)})`);
const spssAd = (ad: string) => ad.replace(/\s+/g, "_");

const ad = (deger: string | undefined, yedek: string) => (deger?.trim() ? deger.trim() : yedek);

/*
  Betiğin KODU dile göre değişmez (değişken yedek adları dahil): yalnızca
  insanın okuduğu yorum satırları çevrilir. Komutları dile göre değiştirmek
  iki dilde iki ayrı betiği sınamak demek olurdu.
*/
function spss(tur: AnalizTuru, s: BetikSecimi, en: boolean): string {
  const y = (tr: string, ing: string) => (en ? ing : tr);
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
  const grupNotu = ikiGrup
    ? y("* Grup değerleri verinizden alındı.", "* Group values were taken from your data.")
    : y("* Grup kodlarını (1 2) kendi verinizdeki değerlerle değiştirin.", "* Replace the group codes (1 2) with the values in your own data.");
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
      return `${y("* Grup aralığını (1 3) kendi verinizdeki en küçük ve en büyük kodla değiştirin.", "* Replace the group range (1 3) with the smallest and largest codes in your own data.")}\nNPAR TESTS\n  /K-W=${a} BY ${g}(1 3).`;
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
    case "aracilik":
      return `${y("* Hayes PROCESS makrosu gerekir (processmacro.org). Model 4, 5000 bootstrap.", "* Requires the Hayes PROCESS macro (processmacro.org). Model 4, 5000 bootstrap samples.")}\nPROCESS y=${spssAd(ad(s.varY, "sonuc"))} /x=${a} /m=${s.aracilar?.length ? s.aracilar.map(spssAd).join(" ") : b}${s.kovaryatlar?.length ? ` /cov=${kovaryatlar}` : ""} /model=${s.araciModeli === "seri" && (s.aracilar?.length ?? 0) > 1 ? 6 : 4} /boot=5000 /total=1${(s.aracilar?.length ?? 0) > 1 ? " /contrast=1" : " /effsize=1"}.`;
    case "duzenleyicilik":
      return `${y("* Hayes PROCESS makrosu gerekir (processmacro.org). Model 1, merkezlenmiş, Johnson-Neyman.", "* Requires the Hayes PROCESS macro (processmacro.org). Model 1, mean-centered, Johnson-Neyman.")}\nPROCESS y=${spssAd(ad(s.varY, "sonuc"))} /x=${a} /w=${b}${s.kovaryatlar?.length ? ` /cov=${kovaryatlar}` : ""} /model=1 /center=1 /jn=1 /plot=1.`;
    case "dfa":
      return `${y("* SPSS'in kendisinde DFA yok; AMOS'ta yol şemasıyla kurulur.\n* Model (her satır bir faktör ve maddeleri):", "* SPSS itself has no CFA; it is built as a path diagram in AMOS.\n* Model (each line is a factor and its items):")}\n${dfaModelMetni(s).split("\n").map((l) => `*   ${l}`).join("\n")}\n* AMOS: Analysis Properties > Output > Standardized estimates, Modification indices.\n${y(`* "~~" satırları iki maddenin hataları arasına çizilen çift yönlü oktur.`, `* "~~" lines are double-headed arrows drawn between the error terms of two items.`)}`;
    case "karmaanova":
      return `GLM ${maddeler} BY ${g}\n  /WSFACTOR=olcum ${s.maddeler?.length || 3} Polynomial\n  /PRINT=DESCRIPTIVE ETASQ HOMOGENEITY\n  /PLOT=PROFILE(olcum*${g})\n  /EMMEANS=TABLES(${g}*olcum) COMPARE(${g}) ADJ(BONFERRONI)\n  /WSDESIGN=olcum\n  /DESIGN=${g}.`;
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

/*
  Betik dosyayı ArvoLab'ın okuduğu gibi okumalı. Eskiden her CSV için
  read.csv / pd.read_csv öntanımlıları (virgül ayırıcı, nokta ondalık)
  yazılıyordu: Türkçe Excel'in noktalı virgüllü dosyası tek sütun okunup
  betik düşüyordu; .tsv ve .txt de read_excel'e gidiyordu.
*/
const METIN_DOSYASI = /\.(csv|tsv|txt)$/i;

function metinVarsayilan(dosya: string): MetinBicimi {
  return { ayirici: /\.tsv$/i.test(dosya) ? "\t" : ",", ondalik: "nokta", kodlama: "utf-8" };
}

function rOkuma(dosya: string, bicim?: MetinBicimi): string {
  const yol = JSON.stringify(dosya);
  if (!METIN_DOSYASI.test(dosya)) return `library(readxl)\nveri <- read_excel(${yol})`;
  const { ayirici, ondalik, kodlama } = bicim ?? metinVarsayilan(dosya);
  /* read.table'da sep = "" BOŞLUKTA böler; tek sütunlu dosyaya bölmeyeceği bir ayırıcı verilir. */
  const sep = JSON.stringify(ayirici || "\x1f");
  const dec = JSON.stringify(ondalik === "virgul" ? "," : ".");
  const enc = kodlama === "windows-1254" ? "windows-1254" : "UTF-8-BOM";
  return `veri <- read.table(${yol}, header = TRUE, sep = ${sep}, dec = ${dec}, quote = "\\"", fileEncoding = "${enc}", check.names = FALSE)`;
}

function pyOkuma(dosya: string, bicim?: MetinBicimi): string {
  const yol = JSON.stringify(dosya);
  if (!METIN_DOSYASI.test(dosya)) return `veri = pd.read_excel(${yol})`;
  const { ayirici, ondalik, kodlama } = bicim ?? metinVarsayilan(dosya);
  const ek = ondalik === "virgul" ? `, decimal=",", thousands="."` : "";
  /* Tek sütunlu dosyada ayırıcı yok: pandas'a bölmeyeceği bir ayırıcı verilir. */
  const sep = JSON.stringify(ayirici || "\x1f");
  return `veri = pd.read_csv(${yol}, sep=${sep}${ek}, encoding="${kodlama === "windows-1254" ? "cp1254" : "utf-8-sig"}")`;
}

function r(tur: AnalizTuru, s: BetikSecimi, en: boolean): string {
  const y = (tr: string, ing: string) => (en ? ing : tr);
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
  const okuma = rOkuma(dosya, s.metinBicimi);
  const govde: Record<AnalizTuru, string> = {
    descriptives: "summary(veri)\nsapply(veri[sapply(veri, is.numeric)], sd, na.rm = TRUE)",
    ttest: `t.test(${a} ~ ${g}, data = veri, var.equal = TRUE)\n# ${y("Levene için", "For Levene's test")}: car::leveneTest(${a} ~ factor(${g}), data = veri)`,
    anova: `model <- aov(${a} ~ factor(${g}), data = veri)\nsummary(model)\nTukeyHSD(model)`,
    correlation: `cor.test(veri$${a}, veri$${b}, method = "pearson")`,
    spearman: `cor.test(veri$${a}, veri$${b}, method = "spearman")`,
    /* correct = FALSE: ArvoLab düzeltmesiz Pearson χ² veriyor; R 2×2 tabloda öntanımlı olarak Yates uyguluyordu ve p değerleri uyuşmuyordu. */
    chisquare: `chisq.test(table(veri$${a}, veri$${b}), correct = FALSE)`,
    reliability: `library(psych)\nalpha(veri[, c(${maddeler})])`,
    pairedttest: `t.test(veri$${a}, veri$${b}, paired = TRUE)`,
    /* ArvoLab normal yaklaşımı süreklilik düzeltmesi olmadan kullanıyor (bağ düzeltmeli); Wilcoxon satırı gibi buna eşlendi. */
    mannwhitney: `wilcox.test(${a} ~ ${g}, data = veri, exact = FALSE, correct = FALSE)`,
    kruskalwallis: `kruskal.test(${a} ~ factor(${g}), data = veri)`,
    regression: `model <- lm(${a} ~ ${yordayicilar}, data = veri)\nsummary(model)`,
    ikiyonluanova: `model <- aov(${a} ~ factor(${g}) * factor(${g2}), data = veri)\nsummary(model)`,
    wilcoxon: `wilcox.test(veri$${a}, veri$${b}, paired = TRUE, exact = FALSE, correct = FALSE)`,
    friedman: `olcumler <- na.omit(veri[, c(${maddeler})])\nfriedman.test(as.matrix(olcumler))`,
    tekorneklem: `t.test(veri$${a}, mu = ${s.testDegeri ?? 0})`,
    tekrarlianova: `library(rstatix)\nlibrary(tidyr)\nveri$id <- seq_len(nrow(veri))\nuzun <- pivot_longer(veri[, c("id", ${maddeler})], -id, names_to = "olcum", values_to = "puan")\nanova_test(uzun, dv = puan, wid = id, within = olcum)  # ${y("Mauchly ve GG/HF düzeltmesi dahil", "includes Mauchly's test and the GG/HF correction")}\npairwise_t_test(uzun, puan ~ olcum, paired = TRUE, p.adjust.method = "bonferroni")`,
    aracilik: aracilikLavaan(s),
    duzenleyicilik: `veri$x_m <- veri$${a} - mean(veri$${a}, na.rm = TRUE)\nveri$w_m <- veri$${b} - mean(veri$${b}, na.rm = TRUE)\nmodel <- lm(${rAd(ad(s.varY, "sonuc"))} ~ x_m * w_m, data = veri)\nsummary(model)\nlibrary(interactions)\nsim_slopes(model, pred = x_m, modx = w_m, johnson_neyman = TRUE)`,
    dfa: `library(lavaan)\nmodel <- '\n${dfaModelMetni(s)}\n'\nfit <- cfa(model, data = veri, std.lv = TRUE)\nsummary(fit, fit.measures = TRUE, standardized = TRUE)\n# ${y("Not: lavaan χ²'yi N ile, ArvoLab AMOS gibi N − 1 ile hesaplar; fark çok küçüktür.", "Note: lavaan computes χ² with N, ArvoLab (like AMOS) with N − 1; the difference is very small.")}`,
    karmaanova: `library(rstatix)\nlibrary(tidyr)\nveri$id <- seq_len(nrow(veri))\nuzun <- pivot_longer(veri[, c("id", ${JSON.stringify(ad(s.groupVar, "grup"))}, ${maddeler})], -c(id, ${g}), names_to = "olcum", values_to = "puan")\nanova_test(uzun, dv = puan, wid = id, within = olcum, between = ${g})`,
    ancova: `model <- lm(${a} ~ ${kovaryatlarR} + factor(${g}), data = veri)\ncar::Anova(model, type = 2)\nemmeans::emmeans(model, ~ ${g})  # ${y("düzeltilmiş ortalamalar", "adjusted means")}`,
    kismikorelasyon: `library(ppcor)\ntemiz <- na.omit(veri[, c(${JSON.stringify(ad(s.varA, "degisken1"))}, ${JSON.stringify(ad(s.varB, "degisken2"))}, ${kovaryatlarListe})])\npcor.test(temiz[[1]], temiz[[2]], temiz[, -(1:2)])`,
    mcnemar: `mcnemar.test(table(veri$${a}, veri$${b}))`,
    lojistik: `model <- glm(${a} ~ ${yordayicilar}, data = veri, family = binomial)\nsummary(model)\nexp(cbind(OR = coef(model), confint.default(model)))`,
    faktor: `library(psych)\nmaddeler <- na.omit(veri[, c(${maddeler})])\nKMO(maddeler)\ncortest.bartlett(cor(maddeler), n = nrow(maddeler))\nprincipal(maddeler, nfactors = ${s.faktorSayisi ?? "sum(eigen(cor(maddeler))$values > 1)"}, rotate = "varimax")`,
  };
  return `${okuma}\n\n${govde[tur]}`;
}

function python(tur: AnalizTuru, s: BetikSecimi, en: boolean): string {
  const y = (tr: string, ing: string) => (en ? ing : tr);
  const aAd = ad(s.varA, "degisken1");
  const bAd = ad(s.varB, "degisken2");
  const gAd = ad(s.groupVar, "grup");
  const g2Ad = ad(s.groupVar2, "grup2");
  const a = pyKolon(aAd);
  const b = pyKolon(bAd);
  const dosya = s.dosyaAdi?.trim() || "veriniz.xlsx";
  const okuma = pyOkuma(dosya, s.metinBicimi);
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
    chisquare: `tablo = pd.crosstab(${a}, ${b})\nprint(stats.chi2_contingency(tablo, correction=False))`,
    reliability: `maddeler = veri[${maddeler}].dropna()\nk = maddeler.shape[1]\nalfa = k / (k - 1) * (1 - maddeler.var(ddof=1).sum() / maddeler.sum(axis=1).var(ddof=1))\nprint("Cronbach alfa:", round(alfa, 3))`,
    pairedttest: `temiz = veri[[${JSON.stringify(aAd)}, ${JSON.stringify(bAd)}]].dropna()\nprint(stats.ttest_rel(temiz[${JSON.stringify(aAd)}], temiz[${JSON.stringify(bAd)}]))`,
    mannwhitney: `${gruplar}\nprint(stats.mannwhitneyu(gruplar[0], gruplar[1], alternative="two-sided", use_continuity=False, method="asymptotic"))`,
    kruskalwallis: `${gruplar}\nprint(stats.kruskal(*gruplar))`,
    regression: `import statsmodels.formula.api as smf\nmodel = smf.ols(${JSON.stringify(`${pyFormul(aAd)} ~ ${yordayicilar}`)}, data=veri).fit()\nprint(model.summary())`,
    wilcoxon: `temiz = veri[[${JSON.stringify(aAd)}, ${JSON.stringify(bAd)}]].dropna()\nprint(stats.wilcoxon(temiz[${JSON.stringify(bAd)}], temiz[${JSON.stringify(aAd)}], correction=False, method="approx"))`,
    friedman: `olcumler = veri[${maddeler}].dropna()\nprint(stats.friedmanchisquare(*[olcumler[m] for m in olcumler.columns]))`,
    tekorneklem: `print(stats.ttest_1samp(${a}.dropna(), ${s.testDegeri ?? 0}))`,
    tekrarlianova: `import pingouin as pg\nuzun = veri[${maddeler}].dropna().reset_index().melt(id_vars="index", var_name="olcum", value_name="puan")\nprint(pg.rm_anova(uzun, dv="puan", within="olcum", subject="index", correction=True))\nprint(pg.pairwise_tests(uzun, dv="puan", within="olcum", subject="index", padjust="bonf"))`,
    aracilik: s.araciModeli === "seri" && (s.aracilar?.length ?? 0) > 1
      ? `# ${y("Seri aracılığın bootstrap'lı çözümü için R betiğini (lavaan) kullanın; pingouin yalnızca paralel modeli destekler.", "For a bootstrapped serial mediation solution use the R script (lavaan); pingouin supports only the parallel model.")}\nimport statsmodels.formula.api as smf\n${s.aracilar!.map((m, j) => `print(smf.ols(${JSON.stringify(`${pyFormul(m)} ~ ${[aAd, ...s.aracilar!.slice(0, j)].map(pyFormul).join(" + ")}`)}, data=veri).fit().params)`).join("\n")}\nprint(smf.ols(${JSON.stringify(`${pyFormul(ad(s.varY, "sonuc"))} ~ ${[aAd, ...s.aracilar!].map(pyFormul).join(" + ")}`)}, data=veri).fit().params)`
      : `import pingouin as pg\nprint(pg.mediation_analysis(data=veri, x=${JSON.stringify(aAd)}, m=${JSON.stringify(s.aracilar?.length ? (s.aracilar.length > 1 ? s.aracilar : s.aracilar[0]) : bAd)}, y=${JSON.stringify(ad(s.varY, "sonuc"))}${s.kovaryatlar?.length ? `, covar=${kovaryatlarPy}` : ""}, n_boot=5000))`,
    duzenleyicilik: `import statsmodels.formula.api as smf\nveri["x_m"] = ${a} - ${a}.mean()\nveri["w_m"] = ${b} - ${b}.mean()\nmodel = smf.ols(${JSON.stringify(`${pyFormul(ad(s.varY, "sonuc"))} ~ x_m * w_m`)}, data=veri).fit()\nprint(model.summary())`,
    dfa: `import semopy\nmodel = semopy.Model("""\n${dfaModelMetni(s)}\n""")\nmodel.fit(veri)\nprint(model.inspect(std_est=True))\nprint(semopy.calc_stats(model).T)`,
    karmaanova: `import pingouin as pg\nuzun = veri[[${JSON.stringify(gAd)}] + ${maddeler}].dropna().reset_index().melt(id_vars=["index", ${JSON.stringify(gAd)}], var_name="olcum", value_name="puan")\nprint(pg.mixed_anova(uzun, dv="puan", within="olcum", between=${JSON.stringify(gAd)}, subject="index", correction=True))`,
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
export function analizBetigi(arac: AnalizAraci, tur: AnalizTuru, secim: BetikSecimi, dil: Dil = "tr"): string {
  const en = dil === "en";
  const etiket = analizEtiketi(tur, dil);
  const programAdi = arac === "r" ? "R" : "Python";
  const baslik =
    arac === "spss"
      ? en
        ? `* ${etiket} — SPSS syntax for the analysis computed by ArvoLab.\n* Open your data in SPSS and run this syntax.\n`
        : `* ${etiket} — ArvoLab'ın hesapladığı analizin SPSS sözdizimi.\n* Verinizi SPSS'te açıp bu sözdizimini çalıştırın.\n`
      : en
        ? `# ${etiket} — ${programAdi} script for the analysis computed by ArvoLab.\n`
        : `# ${etiket} — ArvoLab'ın hesapladığı analizin ${programAdi} betiği.\n`;
  const govde = arac === "spss" ? spss(tur, secim, en) : arac === "r" ? r(tur, secim, en) : python(tur, secim, en);
  return `${baslik}${govde}\n`;
}

export const ARAC_ADI: Record<AnalizAraci, string> = { spss: "SPSS sözdizimi", r: "R betiği", python: "Python betiği" };

export const ARAC_ADI_METIN: Record<AnalizAraci, Metin> = {
  spss: { tr: ARAC_ADI.spss, en: "SPSS syntax" },
  r: { tr: ARAC_ADI.r, en: "R script" },
  python: { tr: ARAC_ADI.python, en: "Python script" },
};
