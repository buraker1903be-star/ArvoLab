import type { Dil, Metin } from "@/lib/dil";
import { ANALIZ_ETIKETLERI_METIN, ANALIZ_TURLERI, type AnalizTuru } from "@/lib/analiz-turleri";

/*
  ANALİZ GEZGİNİNİN KATEGORİLERİ (22.11.2026, onaylı "A — Analiz çalışma
  alanı" tasarımı).

  Sol gezginde yöntemler kullanıcının aradığı yerde dursun diye
  kategoriler SPSS/jamovi menülerinin alışıldık başlıklarıyla:
  Betimsel · t-Testleri · ANOVA/ANCOVA · Korelasyon/Regresyon ·
  Parametrik olmayan · Güvenilirlik/Faktör · Aracılık/Düzenleyicilik.

  lib/analiz-turleri.ts'teki ANALIZ_GRUPLARI DURUYOR: o, dosya
  yüklenmeden önce gösterilen "neler yapılabiliyor" özetinin beş geniş
  öbeği. Buradaki yedi kategori gezginin kendi düzeni. İkisi de AYNI
  AnalizTuru listesinden türüyor ve testi (tests/unit/analiz-kategorileri.test.ts)
  her türün tam olarak bir kategoride olmasını zorunlu kılıyor; yeni bir
  tür eklenip buraya yazılmazsa test düşer.

  Burada YENİ YÖNTEM YOK: yalnızca var olan 25 analizin düzeni. Henüz
  yapılamayan bir yöntem listeye konmaz — seçilemeyen bir satır,
  kullanıcıya olmayan bir yeteneği vaat eder.
*/

export type AnalizKategorisi = {
  anahtar: string;
  ad: Metin;
  turler: AnalizTuru[];
};

export const ANALIZ_KATEGORILERI: AnalizKategorisi[] = [
  {
    anahtar: "betimsel",
    ad: { tr: "Betimsel istatistikler", en: "Descriptive statistics" },
    turler: ["descriptives"],
  },
  {
    anahtar: "ttest",
    ad: { tr: "t-Testleri", en: "t-Tests" },
    turler: ["ttest", "pairedttest", "tekorneklem"],
  },
  {
    anahtar: "anova",
    ad: { tr: "ANOVA / ANCOVA", en: "ANOVA / ANCOVA" },
    turler: ["anova", "ikiyonluanova", "tekrarlianova", "karmaanova", "ancova"],
  },
  {
    anahtar: "iliski",
    ad: { tr: "Korelasyon / Regresyon", en: "Correlation / Regression" },
    turler: ["correlation", "spearman", "kismikorelasyon", "regression", "lojistik"],
  },
  {
    anahtar: "parametrikOlmayan",
    ad: { tr: "Parametrik olmayan testler", en: "Non-parametric tests" },
    turler: ["mannwhitney", "kruskalwallis", "wilcoxon", "friedman", "mcnemar", "chisquare"],
  },
  {
    anahtar: "olcek",
    ad: { tr: "Güvenilirlik / Faktör analizi", en: "Reliability / Factor analysis" },
    turler: ["reliability", "faktor", "dfa"],
  },
  {
    anahtar: "model",
    ad: { tr: "Aracılık / Düzenleyicilik", en: "Mediation / Moderation" },
    turler: ["aracilik", "duzenleyicilik"],
  },
];

/*
  ARAMA EŞANLAMLILARI. Öğrenci yöntemi hocasından ya da bir makaleden
  duyduğu adla arıyor: "U testi", "RM ANOVA", "AFA", "ki kare", "alpha".
  Ekrandaki ad tek başına yetmiyordu; arama yalnızca görünen etikete
  bakarsa "Mann-Whitney U" yazan bulur, "U testi" yazan bulamazdı.

  Türkçe ve İngilizce adların kendisi ayrıca aranıyor (etiket
  haritasından); burada yalnızca KISALTMALAR ve yaygın takma adlar var.
  Uydurma ad yok: hepsi SPSS/jamovi menülerinde ya da yöntem
  literatüründe geçen karşılıklar.
*/
export const ANALIZ_ESANLAMLILARI: Record<AnalizTuru, string[]> = {
  descriptives: ["betimsel", "tanımlayıcı", "frekans", "ortalama", "standart sapma", "descriptives", "frequencies", "mean", "sd"],
  ttest: ["bağımsız örneklem", "independent samples", "student t", "t test", "welch"],
  pairedttest: ["eşleştirilmiş", "bağımlı örneklem", "paired", "dependent samples", "ön test son test", "pretest posttest"],
  tekorneklem: ["tek örneklem", "one sample", "one-sample t"],
  anova: ["tek yönlü", "one-way", "f testi", "varyans analizi", "tukey", "games-howell", "post hoc", "welch anova"],
  ikiyonluanova: ["iki yönlü", "two-way", "faktöriyel", "factorial", "etkileşim", "interaction"],
  tekrarlianova: ["tekrarlı ölçümler", "repeated measures", "rm anova", "within subjects", "denek içi"],
  karmaanova: ["karma", "mixed", "split plot", "gruplar arası x tekrarlı", "between within"],
  ancova: ["kovaryans", "covariance", "kovaryat", "covariate", "ancova"],
  correlation: ["pearson", "korelasyon", "correlation", "r"],
  spearman: ["spearman", "sıra korelasyonu", "rank correlation", "rho"],
  kismikorelasyon: ["kısmi", "partial", "kontrol değişkeni", "control variable"],
  regression: ["doğrusal", "linear", "çoklu regresyon", "multiple regression", "ols", "en küçük kareler"],
  lojistik: ["lojistik", "logistic", "odds", "odds oranı", "odds ratio", "ikili sonuç", "binary"],
  mannwhitney: ["mann whitney", "mann-whitney", "u testi", "u test", "wilcoxon rank sum"],
  kruskalwallis: ["kruskal wallis", "kruskal-wallis", "h testi", "h test"],
  wilcoxon: ["wilcoxon", "işaretli sıralar", "signed rank"],
  friedman: ["friedman", "tekrarlı sıra", "repeated ranks"],
  mcnemar: ["mcnemar", "eşleştirilmiş kategorik", "paired nominal"],
  chisquare: ["ki kare", "ki-kare", "chi square", "chi-square", "çapraz tablo", "crosstab", "bağımsızlık testi", "fisher"],
  reliability: ["cronbach", "alpha", "alfa", "güvenilirlik", "reliability", "iç tutarlılık", "internal consistency"],
  faktor: ["afa", "efa", "açımlayıcı", "exploratory", "faktör", "factor", "kmo", "varimax", "bartlett"],
  dfa: ["dfa", "cfa", "doğrulayıcı", "confirmatory", "uyum iyiliği", "fit indices", "cfi", "rmsea"],
  aracilik: ["aracılık", "mediation", "mediator", "dolaylı etki", "indirect effect", "process model 4", "sobel", "bootstrap"],
  duzenleyicilik: ["düzenleyicilik", "moderation", "moderator", "etkileşim terimi", "process model 1"],
};

/** Kategori sırasına göre düzleştirilmiş tür listesi (gezginin çizim sırası). */
export const KATEGORILI_TURLER: AnalizTuru[] = ANALIZ_KATEGORILERI.flatMap((k) => k.turler);

/** Bir türün kategorisi; yoksa null (test bunu engelliyor, çalışma zamanında emniyet). */
export function turunKategorisi(tur: AnalizTuru): AnalizKategorisi | null {
  return ANALIZ_KATEGORILERI.find((k) => k.turler.includes(tur)) ?? null;
}

const normalize = (metin: string) =>
  metin
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ıçğöşü ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/*
  Bir analizin aranabilir metni: iki dildeki adı ve eşanlamlıları.
  Harf aksanları ve noktalama düşürülüyor: "ki-kare", "ki kare" ve
  "kikare" aynı sonucu vermeli.
*/
export function aranabilirMetin(tur: AnalizTuru): string {
  const etiket = ANALIZ_ETIKETLERI_METIN[tur];
  return normalize([etiket.tr, etiket.en, ...(ANALIZ_ESANLAMLILARI[tur] ?? [])].join(" "));
}

const ARANABILIR = new Map<AnalizTuru, string>(ANALIZ_TURLERI.map((tur) => [tur, aranabilirMetin(tur)]));

/*
  Her parça bir KELİMENİN BAŞINDA eşleşmeli, metnin herhangi bir yerinde
  değil. "rm anova" araması alt dizi eşleşmesiyle "ka-RM-a ANOVA"yı da
  buluyordu; kullanıcı RM ANOVA ararken karşısına karma ANOVA çıkıyor ve
  hangisini seçeceğini anlamıyordu. Kelime başı kuralı yazarken devam
  eden yazımı da bozmaz: "korel" → "korelasyon" (kelimenin başı).
*/
const kelimeBasi = (metin: string, parca: string) =>
  metin.startsWith(parca) || metin.includes(` ${parca}`);

/**
 * Arama: boşluğa göre ayrılan her parça bir kelimenin başında eşleşmeli
 * ("iki yönlü anova"). Boş terim bütün listeyi döndürür.
 */
export function analizAra(terim: string, turler: AnalizTuru[] = KATEGORILI_TURLER): AnalizTuru[] {
  const parcalar = normalize(terim).split(" ").filter(Boolean);
  if (!parcalar.length) return turler;
  return turler.filter((tur) => {
    const metin = ARANABILIR.get(tur) ?? "";
    return parcalar.every((p) => kelimeBasi(metin, p));
  });
}

/** Arama sonucuna göre kategorileri süzer; boş kategoriler düşer. */
export function kategorileriSuz(terim: string): { kategori: AnalizKategorisi; turler: AnalizTuru[] }[] {
  const bulunan = new Set(analizAra(terim));
  return ANALIZ_KATEGORILERI.map((kategori) => ({ kategori, turler: kategori.turler.filter((t) => bulunan.has(t)) })).filter(
    (x) => x.turler.length > 0,
  );
}

/** Kategori adı (dile göre). */
export const kategoriAdi = (kategori: AnalizKategorisi, dil: Dil) => kategori.ad[dil];
