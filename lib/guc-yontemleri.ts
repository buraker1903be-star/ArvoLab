/*
  GÜÇ ÇÖZÜMLEMESİNDE YÖNTEM TANIMLARI ve YÖNTEM METNİ (23.11.2026).

  Yöntemler ADLARIYLA değil ARAŞTIRMA SORUSUYLA anlatılıyor: öğrenci
  "bağımsız örneklem t-testi" demeyi bilmeden de doğru satırı
  bulabilsin. Etiketler, örnek değerler ve üretilen yöntem metni tek
  yerde; ekran ve testler aynı kaynağı okuyor.

  ÖRNEK DEĞERLER AÇIKÇA ÖRNEKTİR. "Örneği doldur" düğmesi alanları
  doldururken ekran bunun örnek olduğunu ve kullanıcının kendi etki
  büyüklüğünü gerekçelendirmesi gerektiğini yazıyor: önceki araştırma,
  pilot çalışma ya da saptamak istediği en küçük anlamlı fark.

  Saf modül; testi tests/unit/guc-yontemleri.test.ts.
*/
import type { Dil, Metin } from "@/lib/dil";
import type { GucGirdisi, GucSonucu, GucYontemi } from "@/lib/stats-guc";

export interface YontemTanimi {
  anahtar: GucYontemi;
  /** Araştırma sorusu: listede önce bu okunur. */
  soru: Metin;
  /** Testin adı: listede ve başlıkta bu yazılır. */
  testAdi: Metin;
  /**
   * Cümle İÇİNDE geçen biçim. Türkçede cümle ortasında küçük harfle
   * başlar ama "Pearson" özel ad, "ANOVA" kısaltmadır: sezgisel
   * küçültme ikisini de bozuyordu, bu yüzden açıkça yazılıyor.
   */
  cumleIciAd: Metin;
  /** Etki büyüklüğünün simgesi ve adı. */
  etkiSimgesi: string;
  etkiAdi: Metin;
  /** Cohen'in küçük/orta/büyük eşikleri — yalnızca BAŞLANGIÇ noktası. */
  esikler: { kucuk: number; orta: number; buyuk: number };
  /** "Örneği doldur" değerleri. */
  ornek: { etki: number; alfa: number; hedefGuc: number; grupSayisi?: number; yordayiciSayisi?: number };
  /** G*Power'da karşılık gelen aile ve model (kabul raporuna yazılıyor). */
  gpower: string;
  /** Yön seçeneği var mı (F ailesinde yok). */
  yonSecilir: boolean;
}

export const GUC_YONTEMLERI: YontemTanimi[] = [
  {
    anahtar: "bagimsizT",
    soru: { tr: "İki ayrı grubun puanlarını karşılaştıracağım", en: "I will compare the scores of two separate groups" },
    testAdi: { tr: "Bağımsız örneklem t-testi", en: "Independent-samples t test" },
    cumleIciAd: { tr: "bağımsız örneklem t-testi", en: "independent-samples t test" },
    etkiSimgesi: "d",
    etkiAdi: { tr: "Cohen d (iki grup ortalaması arasındaki standartlaştırılmış fark)", en: "Cohen's d (standardised difference between two group means)" },
    esikler: { kucuk: 0.2, orta: 0.5, buyuk: 0.8 },
    ornek: { etki: 0.5, alfa: 0.05, hedefGuc: 0.8 },
    gpower: "t tests → Means: Difference between two independent means (two groups); Type of power analysis: A priori; Tail(s) seçilebilir; Effect size d; Allocation ratio N2/N1",
    yonSecilir: true,
  },
  {
    anahtar: "eslestirilmisT",
    soru: { tr: "Aynı kişileri önce ve sonra ölçeceğim", en: "I will measure the same people before and after" },
    testAdi: { tr: "Eşleştirilmiş örneklem t-testi", en: "Paired-samples t test" },
    cumleIciAd: { tr: "eşleştirilmiş örneklem t-testi", en: "paired-samples t test" },
    etkiSimgesi: "dz",
    etkiAdi: { tr: "Cohen dz (fark puanlarının standartlaştırılmış ortalaması)", en: "Cohen's dz (standardised mean of the difference scores)" },
    esikler: { kucuk: 0.2, orta: 0.5, buyuk: 0.8 },
    ornek: { etki: 0.4, alfa: 0.05, hedefGuc: 0.8 },
    gpower: "t tests → Means: Difference between two dependent means (matched pairs); A priori; Tail(s) seçilebilir; Effect size dz",
    yonSecilir: true,
  },
  {
    anahtar: "tekYonluAnova",
    soru: { tr: "Üç ya da daha çok grubun ortalamasını karşılaştıracağım", en: "I will compare the means of three or more groups" },
    testAdi: { tr: "Tek yönlü ANOVA (eşit gruplar)", en: "One-way ANOVA (equal groups)" },
    cumleIciAd: { tr: "tek yönlü ANOVA (eşit gruplar)", en: "one-way ANOVA (equal groups)" },
    etkiSimgesi: "f",
    etkiAdi: { tr: "Cohen f (gruplar arası yayılımın grup içi standart sapmaya oranı)", en: "Cohen's f (spread between groups relative to the within-group standard deviation)" },
    esikler: { kucuk: 0.1, orta: 0.25, buyuk: 0.4 },
    ornek: { etki: 0.25, alfa: 0.05, hedefGuc: 0.8, grupSayisi: 3 },
    gpower: "F tests → ANOVA: Fixed effects, omnibus, one-way; A priori; Effect size f; Number of groups",
    yonSecilir: false,
  },
  {
    anahtar: "korelasyon",
    soru: { tr: "İki sayısal değişken arasındaki ilişkiye bakacağım", en: "I will examine the relationship between two numeric variables" },
    testAdi: { tr: "Pearson korelasyonu", en: "Pearson correlation" },
    cumleIciAd: { tr: "Pearson korelasyonu", en: "Pearson correlation" },
    etkiSimgesi: "r",
    etkiAdi: { tr: "Beklenen korelasyon katsayısı r", en: "Expected correlation coefficient r" },
    esikler: { kucuk: 0.1, orta: 0.3, buyuk: 0.5 },
    ornek: { etki: 0.3, alfa: 0.05, hedefGuc: 0.8 },
    gpower: "Exact → Correlation: Bivariate normal model; A priori; Tail(s) seçilebilir; Correlation ρ H1; Correlation ρ H0 = 0",
    yonSecilir: true,
  },
  {
    anahtar: "regresyon",
    soru: { tr: "Birkaç değişkenle bir sonucu yordayacağım", en: "I will predict an outcome from several variables" },
    testAdi: { tr: "Çoklu doğrusal regresyon, modelin genel F testi", en: "Multiple linear regression, overall F test of the model" },
    cumleIciAd: { tr: "çoklu doğrusal regresyon modelinin genel F testi", en: "overall F test of the multiple linear regression model" },
    etkiSimgesi: "f²",
    etkiAdi: { tr: "Cohen f² (modelin açıkladığı varyansın açıklanmayana oranı; f² = R²/(1−R²))", en: "Cohen's f² (explained over unexplained variance; f² = R²/(1−R²))" },
    esikler: { kucuk: 0.02, orta: 0.15, buyuk: 0.35 },
    ornek: { etki: 0.15, alfa: 0.05, hedefGuc: 0.8, yordayiciSayisi: 3 },
    gpower: "F tests → Linear multiple regression: Fixed model, R² deviation from zero; A priori; Effect size f²; Number of predictors",
    yonSecilir: false,
  },
];

export const yontemTanimi = (anahtar: GucYontemi): YontemTanimi => {
  const y = GUC_YONTEMLERI.find((x) => x.anahtar === anahtar);
  if (!y) throw new Error(`Bilinmeyen güç yöntemi: ${anahtar}`);
  return y;
};

const sayi = (x: number, basamak = 2, dil: Dil = "tr") => {
  const metin = x.toFixed(basamak).replace(/\.?0+$/, "");
  return dil === "en" ? metin : metin.replace(".", ",");
};

/**
 * Tez önerisine ya da etik kurul başvurusuna eklenebilecek kısa yöntem
 * metni. Kullanılan VARSAYIMLAR da yazılı: sayı tek başına
 * savunulabilir değil, hangi modelden geldiği savunulabilir.
 */
export function yontemMetni(girdi: GucGirdisi, sonuc: GucSonucu, dil: Dil): string {
  const y = yontemTanimi(girdi.yontem);
  const en = dil === "en";
  const test = en ? y.cumleIciAd.en : y.cumleIciAd.tr;
  const yon = girdi.yon === "tek" ? (en ? "one-tailed" : "tek yönlü") : en ? "two-tailed" : "çift yönlü";
  const yonCumlesi = y.yonSecilir ? (en ? `, ${yon}` : `, ${yon}`) : "";
  const parcalar: string[] = [];

  if (en) {
    parcalar.push(
      `An a priori power analysis was carried out for the planned ${test}${yonCumlesi}. ` +
        `Assuming an effect size of ${y.etkiSimgesi} = ${sayi(girdi.etki, 3, dil)}, α = ${sayi(girdi.alfa, 3, dil)} and a target power of ${sayi(girdi.hedefGuc, 2, dil)}, ` +
        `the minimum required sample is ${sonuc.n} ${sonuc.birim === "katilimci" ? "participants" : "observations"}.`,
    );
    if (sonuc.grupBasina) parcalar.push(`This corresponds to ${sonuc.grupBasina.join(" + ")} per group.`);
    parcalar.push(`At this sample size the achieved power is ${sayi(sonuc.ulasilanGuc, 3, dil)}; it exceeds the target because the sample must be a whole number.`);
    if (sonuc.baslangicN !== null) {
      parcalar.push(
        `Allowing for an expected dropout of ${sayi((girdi.kayipOrani ?? 0) * 100, 1, dil)}%, ${sonuc.baslangicN} should be recruited at the start so that ${sonuc.n} remain for the analysis.`,
      );
    }
    parcalar.push(
      `Assumptions: the effect size is a planning assumption, not a result; the model assumes ${
        girdi.yontem === "tekYonluAnova" ? "equal group sizes, " : ""
      }normally distributed outcomes, independent observations${
        girdi.yontem === "bagimsizT" ? " and equal variances in the two groups" : ""
      }. The computation uses the non-central distribution of the test statistic (the same model as G*Power: ${y.gpower.split(";")[0]}). The analysis was run in ArvoLab.`,
    );
    return parcalar.join(" ");
  }

  parcalar.push(
    `Planlanan ${test} için öncül (a priori) güç çözümlemesi yapıldı${yonCumlesi}. ` +
      `${y.etkiSimgesi} = ${sayi(girdi.etki, 3, dil)} etki büyüklüğü, α = ${sayi(girdi.alfa, 3, dil)} ve ${sayi(girdi.hedefGuc, 2, dil)} hedef güç varsayımıyla ` +
      `analiz için gereken en düşük örneklem ${sonuc.n} ${sonuc.birim === "katilimci" ? "katılımcıdır" : "gözlemdir"}.`,
  );
  if (sonuc.grupBasina) parcalar.push(`Bu, grup başına ${sonuc.grupBasina.join(" + ")} kişiye karşılık gelir.`);
  parcalar.push(`Bu örneklemde ulaşılan güç ${sayi(sonuc.ulasilanGuc, 3, dil)}'dir; örneklem tam sayıya yuvarlandığı için hedefin biraz üstündedir.`);
  if (sonuc.baslangicN !== null) {
    parcalar.push(
      `Beklenen %${sayi((girdi.kayipOrani ?? 0) * 100, 1, dil)} katılımcı kaybı hesaba katıldığında, analizde ${sonuc.n} kişinin kalması için başlangıçta ${sonuc.baslangicN} kişi alınmalıdır.`,
    );
  }
  parcalar.push(
    `Varsayımlar: etki büyüklüğü bir sonuç değil, planlama varsayımıdır; model ${
      girdi.yontem === "tekYonluAnova" ? "grupların eşit büyüklükte olduğunu, " : ""
    }bağımlı değişkenin normal dağıldığını ve gözlemlerin bağımsız olduğunu${
      girdi.yontem === "bagimsizT" ? ", iki grubun varyanslarının eşit olduğunu" : ""
    } varsayar. Hesap, test istatistiğinin merkezi olmayan dağılımıyla yapılmıştır (G*Power'daki ${y.gpower.split(";")[0]} ile aynı model). Çözümleme ArvoLab'da yapılmıştır.`,
  );
  return parcalar.join(" ");
}
