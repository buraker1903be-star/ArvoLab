import type { Metin } from "@/lib/dil";
import type { AnalizTuru } from "@/lib/analiz-turleri";

/*
  "HANGİ ANALİZİ SEÇMELİYİM?" — KARAR KURALLARI (22.11.2026).

  Analiz adını bilmeyen öğrenci gezgindeki 25 başlığa bakıp hangisinin
  kendi verisine uyduğunu çıkaramıyor; hocasından duyduğu "fark testi"
  ile ekrandaki "Bağımsız Örneklem t-Testi" arasındaki yolu kendisi
  kuramıyor. Bu dosya o yolu kuruyor.

  BURADA MODEL YOK, HESAP YOK. Kurallar yazılı ve test edilebilir
  (tests/unit/analiz-onerisi.test.ts); ücretli bir çağrı yapılmaz, veri
  okunmaz, hiçbir analiz çalıştırılmaz. Akış yalnızca kullanıcının
  cevaplarına bakar.

  ÜÇ KURAL YAPISAL:

  1. HİÇBİR ÖNERİ "KESİN DOĞRU" DEĞİL. Araştırma düzenini (örnekleme,
     atama, ölçüm sırası) bilmeden doğru testi ilan etmek, uydurma
     sayıdan farksız bir hatadır: öğrenci onu savunmak zorunda kalır.
     Çıktı her zaman ADAY listesidir ve `guven` alanı en iyi durumda
     "aday"dır — "kesin" diye bir değer yok.

  2. EKSİK BİLGİ SAKLANMAZ. "Bilmiyorum" her soruda var ve seçildiğinde
     aday listesi DARALTILMAZ, genişler; `sinirlar` o bilginin neden
     gerektiğini yazar. Normallik testi sonucuna bakıp yöntem seçen bir
     kısayol yok: bağımsız mı tekrarlı mı olduğu bilinmeden parametrik
     kararı verilemez.

  3. DESTEKLENMEYEN DESEN BENZERİNE YÖNLENDİRİLMEZ. Üç tekrarlı
     ölçümde kategorik sonuç Cochran Q ister; ArvoLab'da yok. Buna
     McNemar önermek sessizce yanlış analiz yaptırmak olur —
     `desteklenmeyen` alanı doldurulur ve aday listesi BOŞ kalır.
*/

export type SoruAnahtari =
  | "amac"
  | "sonucTuru"
  | "dagilim"
  | "kategoriSayisi"
  | "olcumDuzeni"
  | "grupSayisi"
  | "faktorSayisi"
  | "kovaryat"
  | "cokluSonuc"
  | "kontrolDegiskeni"
  | "olcekAmaci"
  | "modelTuru";

export const BILMIYORUM = "bilmiyorum";

export type SoruSecenegi = { anahtar: string; etiket: Metin; aciklama?: Metin };
export type Soru = { anahtar: SoruAnahtari; baslik: Metin; secenekler: SoruSecenegi[] };
export type Yanitlar = Partial<Record<SoruAnahtari, string>>;

export type Aday = { tur: AnalizTuru; gerekce: Metin; kontrol: Metin };

export type Oneri = {
  /** Sırayla gösterilecek sorular; sonraki soru ancak öncekine cevap verilince eklenir. */
  sorular: Soru[];
  /** Gerekli soruların hepsi cevaplandı mı (aday listesi yine de boş olabilir). */
  tamam: boolean;
  adaylar: Aday[];
  /** "kesin" YOK: araştırma düzeni bilinmeden kesin hüküm verilmez. */
  guven: "aday" | "belirsiz";
  /** Önerinin sınırları: eksik bilgi, kontrol edilmesi gerekenler. */
  sinirlar: Metin[];
  /** Desteklenmeyen desen: aday verilmez, ne gerektiği yazılır. */
  desteklenmeyen: Metin | null;
};

const bilmiyorumSecenegi: SoruSecenegi = {
  anahtar: BILMIYORUM,
  etiket: { tr: "Bilmiyorum", en: "I don't know" },
  aciklama: {
    tr: "Seçmezseniz aday listesi daralmaz, genişler ve neyin eksik olduğunu yazarız.",
    en: "If you skip it the candidate list widens rather than narrows, and we state what is missing.",
  },
};

const SORULAR: Record<SoruAnahtari, Soru> = {
  amac: {
    anahtar: "amac",
    baslik: { tr: "Veriyle ne yapmak istiyorsunuz?", en: "What do you want to do with your data?" },
    secenekler: [
      { anahtar: "betimle", etiket: { tr: "Veriyi özetlemek", en: "Summarise the data" }, aciklama: { tr: "Ortalama, standart sapma, frekans.", en: "Means, standard deviations, frequencies." } },
      { anahtar: "fark", etiket: { tr: "Gruplar ya da ölçümler arasında fark var mı bakmak", en: "Check for a difference between groups or measurements" } },
      { anahtar: "iliski", etiket: { tr: "İki değişken birlikte değişiyor mu bakmak", en: "Check whether two variables vary together" } },
      { anahtar: "yordama", etiket: { tr: "Bir değişkeni başka değişkenlerle yordamak", en: "Predict one variable from others" } },
      { anahtar: "olcek", etiket: { tr: "Ölçeğimin güvenilirliğine ya da yapısına bakmak", en: "Examine my scale's reliability or structure" } },
      { anahtar: "model", etiket: { tr: "Araya giren ya da etkiyi değiştiren bir değişkeni sınamak", en: "Test a mediating or moderating variable" } },
      bilmiyorumSecenegi,
    ],
  },
  /*
    SONUÇ TÜRÜ = ÖLÇÜM DÜZEYİ, dağılım değil (22.11.2026 düzeltmesi).
    Eskiden "Sıralı ya da çarpık dağılan" tek seçenekti ve açıklaması
    "küçük örneklem, uç değerli dağılım" diyordu: çarpık dağılan bir
    SÜREKLİ değişkeni sıralı ilan ediyordu. İkisi ayrı şeydir —
    puan sürekli kalır, çarpıklık yalnızca hangi testin varsayımının
    kuşkulu olduğunu söyler. Karıştırmak, yöntem bölümünde ölçüm
    düzeyini yanlış yazdırır.
  */
  sonucTuru: {
    anahtar: "sonucTuru",
    baslik: { tr: "Sonuç (bağımlı) değişkeniniz hangi ÖLÇÜM DÜZEYİNDE?", en: "What is your outcome (dependent) variable's MEASUREMENT LEVEL?" },
    secenekler: [
      {
        anahtar: "surekli",
        etiket: { tr: "Sürekli", en: "Continuous" },
        aciklama: {
          tr: "Aralıkları eşit sayı: puan, süre, ağırlık, ölçek toplamı. Dağılımı çarpık olsa da sürekli sayılır.",
          en: "A number with equal intervals: score, duration, weight, scale total. It stays continuous even when its distribution is skewed.",
        },
      },
      {
        anahtar: "sirali",
        etiket: { tr: "Sıralı", en: "Ordinal" },
        aciklama: {
          tr: "Sıra bildirir ama aralıkları eşit değildir: tek bir Likert maddesi, derece, az/orta/çok.",
          en: "It ranks but the intervals are not equal: a single Likert item, a grade, low/medium/high.",
        },
      },
      {
        anahtar: "kategorik",
        etiket: { tr: "Kategorik", en: "Categorical" },
        aciklama: { tr: "Sıra bildirmeyen etiket: evet/hayır, başarılı/başarısız, tercih edilen seçenek.", en: "An unordered label: yes/no, pass/fail, the option chosen." },
      },
      bilmiyorumSecenegi,
    ],
  },
  /*
    DAĞILIM AYRI SORU. Çarpıklık ve küçük örneklem ölçüm düzeyini
    değiştirmez; yalnızca parametrik testin varsayımını kuşkulu kılar ve
    sıra temelli karşılığı AYRICA aday yapar. Bu soru olmadan kullanıcı
    "çarpık" demek için değişkenini sıralı işaretliyordu.
  */
  dagilim: {
    anahtar: "dagilim",
    baslik: { tr: "Dağılım ve örneklem hakkında ne biliyorsunuz?", en: "What do you know about the distribution and the sample?" },
    secenekler: [
      { anahtar: "uygun", etiket: { tr: "Dağılım normale yakın, örneklem yeterli", en: "Roughly normal, sample large enough" } },
      {
        anahtar: "sorunlu",
        etiket: { tr: "Çarpık, uç değerli ya da küçük örneklem", en: "Skewed, has outliers, or a small sample" },
        aciklama: {
          tr: "Değişkeniniz sürekli olmaya devam eder; bu yalnızca sıra temelli karşılığı da aday yapar.",
          en: "Your variable stays continuous; this only adds the rank-based counterpart as a candidate.",
        },
      },
      bilmiyorumSecenegi,
    ],
  },
  /*
    KATEGORİ SAYISI. McNemar, Cochran Q ve ikili lojistik regresyon
    İKİ kategorili sonuç ister; üç kategoride bunları önermek sessizce
    yanlış analiz yaptırır.
  */
  kategoriSayisi: {
    anahtar: "kategoriSayisi",
    baslik: { tr: "Sonuç değişkeninin kaç kategorisi var?", en: "How many categories does the outcome have?" },
    secenekler: [
      { anahtar: "iki", etiket: { tr: "İki", en: "Two" }, aciklama: { tr: "Evet/hayır, geçti/kaldı.", en: "Yes/no, pass/fail." } },
      { anahtar: "ucDahaCok", etiket: { tr: "Üç ya da daha çok", en: "Three or more" } },
      bilmiyorumSecenegi,
    ],
  },
  olcumDuzeni: {
    anahtar: "olcumDuzeni",
    baslik: { tr: "Karşılaştırdığınız ölçümler kimlerden geliyor?", en: "Where do the measurements you compare come from?" },
    secenekler: [
      { anahtar: "bagimsiz", etiket: { tr: "Farklı kişilerden", en: "From different people" }, aciklama: { tr: "Deney ve kontrol grubu ayrı kişiler; her kişi bir kez ölçüldü.", en: "The experimental and control groups are different people; each person measured once." } },
      { anahtar: "tekrarli", etiket: { tr: "Aynı kişilerin tekrarlı ölçümlerinden", en: "From repeated measurements of the same people" }, aciklama: { tr: "Ön test–son test, aynı kişilere üç farklı zamanda uygulanan ölçüm.", en: "Pre-test/post-test, or the same people measured at three time points." } },
      { anahtar: "karma", etiket: { tr: "İkisi birden", en: "Both" }, aciklama: { tr: "Farklı gruplar VE her gruptan tekrarlı ölçüm (deney/kontrol × ön test/son test).", en: "Different groups AND repeated measurements within each (experimental/control × pre/post)." } },
      bilmiyorumSecenegi,
    ],
  },
  grupSayisi: {
    anahtar: "grupSayisi",
    baslik: { tr: "Kaç grup ya da kaç ölçüm karşılaştırılıyor?", en: "How many groups or measurements are compared?" },
    secenekler: [
      { anahtar: "tek", etiket: { tr: "Tek grup, bilinen bir değerle", en: "One group, against a known value" }, aciklama: { tr: "Örneğin sınıf ortalamasını 50 puanlık ölçüt değerle karşılaştırmak.", en: "For example comparing a class mean against a cut-off of 50." } },
      { anahtar: "iki", etiket: { tr: "İki", en: "Two" } },
      { anahtar: "ucDahaCok", etiket: { tr: "Üç ya da daha çok", en: "Three or more" } },
      bilmiyorumSecenegi,
    ],
  },
  faktorSayisi: {
    anahtar: "faktorSayisi",
    baslik: { tr: "Grupları kaç ayrı değişken belirliyor?", en: "How many variables define the groups?" },
    secenekler: [
      { anahtar: "tek", etiket: { tr: "Bir", en: "One" }, aciklama: { tr: "Yalnızca sınıf düzeyi ya da yalnızca yöntem.", en: "Only grade level, or only method." } },
      { anahtar: "iki", etiket: { tr: "İki", en: "Two" }, aciklama: { tr: "Cinsiyet VE sınıf düzeyi; etkileşimi de görmek istiyorsunuz.", en: "Gender AND grade level; you also want the interaction." } },
      bilmiyorumSecenegi,
    ],
  },
  kovaryat: {
    anahtar: "kovaryat",
    baslik: { tr: "Etkisini istatistiksel olarak kontrol etmek istediğiniz sürekli bir değişken var mı?", en: "Is there a continuous variable whose effect you want to control for?" },
    secenekler: [
      { anahtar: "yok", etiket: { tr: "Yok", en: "No" } },
      { anahtar: "var", etiket: { tr: "Var", en: "Yes" }, aciklama: { tr: "Örneğin ön test puanı ya da yaş.", en: "For example a pre-test score or age." } },
      bilmiyorumSecenegi,
    ],
  },
  cokluSonuc: {
    anahtar: "cokluSonuc",
    baslik: { tr: "Kaç sonuç değişkenini aynı analizde sınamak istiyorsunuz?", en: "How many outcome variables do you want to test in one analysis?" },
    secenekler: [
      { anahtar: "tek", etiket: { tr: "Bir", en: "One" } },
      { anahtar: "cok", etiket: { tr: "Birden çok, hep birlikte", en: "Several, together" }, aciklama: { tr: "Örneğin kaygı ve motivasyonu tek bir çok değişkenli testte.", en: "For example anxiety and motivation in a single multivariate test." } },
      bilmiyorumSecenegi,
    ],
  },
  kontrolDegiskeni: {
    anahtar: "kontrolDegiskeni",
    baslik: { tr: "Üçüncü bir değişkenin etkisini dışarıda tutmak istiyor musunuz?", en: "Do you want to hold a third variable's effect out?" },
    secenekler: [
      { anahtar: "yok", etiket: { tr: "Hayır", en: "No" } },
      { anahtar: "var", etiket: { tr: "Evet", en: "Yes" }, aciklama: { tr: "Örneğin yaşın etkisini sabit tutarak ilişkiye bakmak.", en: "For example looking at the relationship while holding age constant." } },
      bilmiyorumSecenegi,
    ],
  },
  olcekAmaci: {
    anahtar: "olcekAmaci",
    baslik: { tr: "Ölçek için neye bakıyorsunuz?", en: "What are you examining about the scale?" },
    secenekler: [
      { anahtar: "guvenilirlik", etiket: { tr: "İç tutarlılık (güvenilirlik)", en: "Internal consistency (reliability)" } },
      { anahtar: "yapiKesfet", etiket: { tr: "Yapıyı keşfetmek", en: "Explore the structure" }, aciklama: { tr: "Maddeler kaç faktöre toplanıyor, henüz bir modeliniz yok.", en: "How many factors the items form; you have no model yet." } },
      { anahtar: "yapiDogrula", etiket: { tr: "Var olan bir yapıyı doğrulamak", en: "Confirm an existing structure" }, aciklama: { tr: "Hangi maddenin hangi faktöre ait olduğunu önceden biliyorsunuz.", en: "You already know which item belongs to which factor." } },
      bilmiyorumSecenegi,
    ],
  },
  modelTuru: {
    anahtar: "modelTuru",
    baslik: { tr: "Üçüncü değişkenin rolü ne?", en: "What is the third variable's role?" },
    secenekler: [
      { anahtar: "araci", etiket: { tr: "Aracı: etki onun üzerinden geçiyor", en: "Mediator: the effect passes through it" }, aciklama: { tr: "X → M → Y.", en: "X → M → Y." } },
      { anahtar: "duzenleyici", etiket: { tr: "Düzenleyici: etkinin gücünü değiştiriyor", en: "Moderator: it changes the effect's strength" }, aciklama: { tr: "X'in Y üzerindeki etkisi M'nin düzeyine göre değişiyor.", en: "X's effect on Y differs by the level of M." } },
      bilmiyorumSecenegi,
    ],
  },
};

/* Kullanıcıya gösterilen her soru buradan geliyor; sıra akışın kendisi. */
export const soruyuGetir = (anahtar: SoruAnahtari): Soru => SORULAR[anahtar];

const aday = (tur: AnalizTuru, gerekce: Metin, kontrol: Metin): Aday => ({ tur, gerekce, kontrol });

/* Sık yinelenen "ne kontrol edilmeli" notları. */
const K = {
  normallik: {
    tr: "Normallik ve varyans homojenliği: analiz çalıştığında varsayım şeridi sonucu yazar; uymazsa parametrik olmayan karşılığı önerilir.",
    en: "Normality and homogeneity of variance: the assumption strip reports these when the analysis runs, and suggests a non-parametric alternative when they fail.",
  },
  bagimsizlik: {
    tr: "Gözlemlerin bağımsızlığı: aynı kişiden birden çok satır varsa bu test uygun değildir.",
    en: "Independence of observations: this test is not appropriate when one person contributes more than one row.",
  },
  esleme: {
    tr: "Satırların eşleşmesi: aynı kişinin ölçümleri aynı satırda, ayrı sütunlarda olmalı.",
    en: "Row matching: one person's measurements must sit in the same row, in separate columns.",
  },
  gozeSayisi: {
    tr: "Göze sayıları: beklenen değeri 5'in altında göze varsa ArvoLab Fisher kesin testini de yazar.",
    en: "Cell counts: when an expected count falls below 5, ArvoLab also reports Fisher's exact test.",
  },
  dogrusallik: {
    tr: "Doğrusallık ve uç değerler: ilişki eğriyse korelasyon katsayısı yanıltır; dağılım grafiğine bakın.",
    en: "Linearity and outliers: a curved relationship makes the correlation coefficient misleading; inspect the scatter plot.",
  },
  orneklem: {
    tr: "Örneklem büyüklüğü: madde başına yeterli gözlem yoksa faktör çözümü kararsız olur (KMO değeri çıktıda yazılı).",
    en: "Sample size: without enough observations per item the factor solution is unstable (the KMO value is reported in the output).",
  },
  olcum: {
    tr: "Ölçüm düzeyi: sürekli sanılan bir değişken aslında sıralıysa sonuç yanıltır.",
    en: "Measurement level: a variable taken as continuous that is really ordinal makes the result misleading.",
  },
} satisfies Record<string, Metin>;

const ADAYLAR: Record<AnalizTuru, Aday> = {
  descriptives: aday("descriptives", { tr: "Veriyi özetlemek istediğinizi söylediniz.", en: "You said you want to summarise the data." }, K.olcum),
  ttest: aday("ttest", { tr: "İki bağımsız grubun sürekli puan ortalamasını karşılaştırıyorsunuz.", en: "You are comparing the means of two independent groups on a continuous score." }, K.normallik),
  pairedttest: aday("pairedttest", { tr: "Aynı kişilerin iki ölçümünü karşılaştırıyorsunuz.", en: "You are comparing two measurements of the same people." }, K.esleme),
  tekorneklem: aday("tekorneklem", { tr: "Tek grubun ortalamasını bilinen bir değerle karşılaştırıyorsunuz.", en: "You are comparing one group's mean against a known value." }, K.normallik),
  anova: aday("anova", { tr: "Üç ya da daha çok bağımsız grubu tek bir değişkene göre karşılaştırıyorsunuz.", en: "You are comparing three or more independent groups on one variable." }, K.normallik),
  ikiyonluanova: aday("ikiyonluanova", { tr: "Grupları iki değişken birlikte belirliyor; iki yönlü ANOVA iki ana etkiyi ve aralarındaki etkileşimi aynı modelde kestirir.", en: "Two variables define the groups together; two-way ANOVA estimates both main effects and their interaction in one model." }, K.normallik),
  tekrarlianova: aday("tekrarlianova", { tr: "Aynı kişilerin üç ya da daha çok ölçümünü karşılaştırıyorsunuz.", en: "You are comparing three or more measurements of the same people." }, K.esleme),
  karmaanova: aday("karmaanova", { tr: "Hem farklı gruplar hem tekrarlı ölçümler var (deney/kontrol × ön test/son test).", en: "There are both different groups and repeated measurements (experimental/control × pre/post)." }, K.esleme),
  ancova: aday("ancova", { tr: "Grupları karşılaştırırken sürekli bir değişkenin etkisini kontrol etmek istiyorsunuz.", en: "You want to control for a continuous variable while comparing groups." }, {
    tr: "Kovaryatın gruplardan etkilenmemesi ve regresyon eğimlerinin benzer olması gerekir.",
    en: "The covariate must not be affected by the grouping, and the regression slopes must be similar.",
  }),
  correlation: aday("correlation", { tr: "İki sürekli değişkenin birlikte değişimine bakıyorsunuz.", en: "You are looking at how two continuous variables vary together." }, K.dogrusallik),
  spearman: aday("spearman", { tr: "Sıralı değişkende ya da dağılım varsayımı kuşkuluyken ilişkiye sıralar üzerinden bakılır.", en: "With an ordinal variable, or when the distributional assumption is doubtful, the relationship is examined through ranks." }, K.olcum),
  kismikorelasyon: aday("kismikorelasyon", { tr: "Üçüncü bir değişkenin etkisini sabit tutarak ilişkiye bakıyorsunuz.", en: "You are examining the relationship while holding a third variable constant." }, K.dogrusallik),
  regression: aday("regression", { tr: "Sürekli bir sonucu bir ya da daha çok değişkenle yorduyorsunuz.", en: "You are predicting a continuous outcome from one or more variables." }, {
    tr: "Çoklu bağlantı (VIF) ve artıkların dağılımı: ikisi de çıktıda yazılı.",
    en: "Multicollinearity (VIF) and the distribution of residuals: both are reported in the output.",
  }),
  lojistik: aday("lojistik", { tr: "Sonuç değişkeniniz iki kategorili; lojistik regresyon bu sonuç türü için kurulmuş bir modeldir.", en: "Your outcome has two categories; logistic regression is a model built for this outcome type." }, {
    tr: "Her sonuç kategorisinde yeterli gözlem olmalı; nadir olayda katsayılar kararsızdır.",
    en: "Each outcome category needs enough observations; with a rare event the coefficients are unstable.",
  }),
  mannwhitney: aday("mannwhitney", { tr: "İki bağımsız grubu sıralar üzerinden karşılaştırıyorsunuz.", en: "You are comparing two independent groups through ranks." }, K.bagimsizlik),
  kruskalwallis: aday("kruskalwallis", { tr: "Üç ya da daha çok bağımsız grubu sıralar üzerinden karşılaştırıyorsunuz.", en: "You are comparing three or more independent groups through ranks." }, K.bagimsizlik),
  wilcoxon: aday("wilcoxon", { tr: "Aynı kişilerin iki ölçümünü sıralar üzerinden karşılaştırıyorsunuz.", en: "You are comparing two measurements of the same people through ranks." }, K.esleme),
  friedman: aday("friedman", { tr: "Aynı kişilerin üç ya da daha çok ölçümünü sıralar üzerinden karşılaştırıyorsunuz.", en: "You are comparing three or more measurements of the same people through ranks." }, K.esleme),
  mcnemar: aday("mcnemar", { tr: "Aynı kişilerin iki ölçümünde İKİ kategorili bir sonucun değişip değişmediğine bakıyorsunuz.", en: "You are checking whether a TWO-category outcome changes across two measurements of the same people." }, {
    tr: "Sonuç iki kategorili olmalı ve iki ölçüm aynı satırda eşleşmeli; üç kategoride McNemar uygulanamaz.",
    en: "The outcome must have two categories and the two measurements must be matched in one row; McNemar does not apply with three categories.",
  }),
  chisquare: aday("chisquare", { tr: "İki kategorik değişkenin birlikte dağılımına bakıyorsunuz.", en: "You are examining the joint distribution of two categorical variables." }, K.gozeSayisi),
  reliability: aday("reliability", { tr: "Ölçeğin iç tutarlılığına bakıyorsunuz.", en: "You are examining the scale's internal consistency." }, {
    tr: "Ters kodlanmış maddeleri çevirmeden alpha düşük çıkar; madde-toplam korelasyonları çıktıda yazılı.",
    en: "Without reversing reverse-coded items alpha comes out low; item-total correlations are reported in the output.",
  }),
  faktor: aday("faktor", { tr: "Maddelerin kaç faktöre toplandığını keşfetmek istiyorsunuz.", en: "You want to explore how many factors the items form." }, K.orneklem),
  dfa: aday("dfa", { tr: "Önceden bildiğiniz madde-faktör yapısını sınıyorsunuz.", en: "You are testing a known item-to-factor structure." }, {
    tr: "Modeli veriden sonra kurmak doğrulama değildir; yapıyı önce yazın.",
    en: "Building the model after seeing the data is not confirmation; state the structure first.",
  }),
  aracilik: aday("aracilik", { tr: "Etkinin araya giren bir değişken üzerinden geçtiğini sınıyorsunuz.", en: "You are testing that the effect passes through an intervening variable." }, {
    tr: "Aracılık nedensellik kanıtlamaz: ölçüm sırası ve kuramsal gerekçe gerekir.",
    en: "Mediation does not prove causality: the measurement order and a theoretical rationale are required.",
  }),
  duzenleyicilik: aday("duzenleyicilik", { tr: "Etkinin gücünün üçüncü değişkene göre değiştiğini sınıyorsunuz.", en: "You are testing that the effect's strength varies with a third variable." }, {
    tr: "Etkileşim terimi için değişkenleri merkezleme gerekir; ArvoLab bunu kendisi yapar.",
    en: "The interaction term requires centring the variables; ArvoLab does this itself.",
  }),
};

const al = (...turler: AnalizTuru[]): Aday[] => turler.map((t) => ADAYLAR[t]);

const SINIR = {
  duzenBilinmiyor: {
    tr: "Ölçümlerin bağımsız mı tekrarlı mı olduğu belirlenmeden test seçilemez: aynı sayılarla iki ayrı test iki ayrı sonuç verir. Veri toplama biçiminize bakın — her kişi bir kez mi ölçüldü?",
    en: "No test can be chosen before it is settled whether the measurements are independent or repeated: the same numbers give two different results in the two tests. Look at how you collected the data — was each person measured once?",
  },
  dagilimSorunlu: {
    tr: "Çarpıklık, uç değer ya da küçük örneklem değişkeninizin ÖLÇÜM DÜZEYİNİ değiştirmez: sürekli kalır. Bunlar parametrik testin varsayımını kuşkulu kılar; bu yüzden sıra temelli karşılığı da listede. Hangisini raporlayacağınıza analiz çalışınca çıkan varsayım şeridine bakarak karar verin — dönüştürme de bir seçenektir.",
    en: "Skewness, outliers or a small sample do not change your variable's MEASUREMENT LEVEL: it stays continuous. They cast doubt on the parametric test's assumption, which is why the rank-based counterpart is also listed. Decide which to report from the assumption strip the analysis produces — a transformation is also an option.",
  },
  dagilimBilinmiyor: {
    tr: "Dağılım hakkında bilgi verilmedi; listede hem parametrik hem sıra temelli aday var. Dağılım bilgisi ölçüm düzeyini değiştirmez, yalnızca hangisinin savunulabilir olduğunu belirler.",
    en: "No information was given about the distribution, so both the parametric and the rank-based candidate are listed. Distributional information does not change the measurement level; it only tells you which choice is defensible.",
  },
  kategoriBilinmiyor: {
    tr: "Sonucun kaç kategorili olduğu bilinmiyor. Aşağıdaki aday YALNIZCA iki kategorili sonuç için geçerlidir; üç ve daha çok kategoride uygun değildir.",
    en: "The number of outcome categories is unknown. The candidate below is valid ONLY for a two-category outcome; it is not appropriate with three or more.",
  },
  olcumBilinmiyor: {
    tr: "Sonuç değişkeninin türü bilinmediği için hem parametrik hem parametrik olmayan adaylar listede. Dağılım testinin sonucu tek başına yöntem seçmeye yetmez; önce değişkenin ölçüm düzeyine karar verin.",
    en: "Because the outcome's type is unknown, both parametric and non-parametric candidates are listed. A distribution test's result alone is not enough to choose a method; first decide the variable's measurement level.",
  },
  grupBilinmiyor: {
    tr: "Karşılaştırılan grup/ölçüm sayısı bilinmediği için birden çok aday listede.",
    en: "Because the number of compared groups or measurements is unknown, several candidates are listed.",
  },
  amacBilinmiyor: {
    tr: "Amaç seçilmeden aday verilemez: aynı veriyle fark testi, ilişki ve regresyon farklı soruları yanıtlar. Tez sorunuzun yüklemine bakın — \"fark var mı\", \"ilişki var mı\", \"yordar mı\".",
    en: "No candidate can be given without a purpose: on the same data a difference test, a correlation and a regression answer different questions. Look at the verb in your research question — \"is there a difference\", \"is there a relationship\", \"does it predict\".",
  },
  hepAday: {
    tr: "Bu liste bir öneridir, hüküm değil: araştırma düzeninizi (örnekleme, atama, ölçüm sırası) ArvoLab görmüyor. Son kararı danışmanınızla verin.",
    en: "This list is a suggestion, not a verdict: ArvoLab cannot see your research design (sampling, assignment, measurement order). Settle the final choice with your supervisor.",
  },
} satisfies Record<string, Metin>;

const DESTEKLENMEYEN = {
  manova: {
    tr: "Birden çok sonuç değişkenini TEK testte sınamak çok değişkenli varyans analizi (MANOVA) ister; ArvoLab'da henüz yok. Sonuçları tek tek sınamak aynı şey değildir: çoklu test hata oranını yükseltir ve değişkenler arası örüntüyü göstermez. Şimdilik her sonuç için ayrı analiz çalıştırıp çoklu karşılaştırma düzeltmesini raporlayabilirsiniz.",
    en: "Testing several outcomes in ONE analysis requires multivariate analysis of variance (MANOVA), which ArvoLab does not have yet. Testing the outcomes one by one is not the same thing: it inflates the error rate and does not show the pattern across variables. For now you can run a separate analysis per outcome and report a multiple-comparison correction.",
  },
  cochran: {
    tr: "Aynı kişilerin ÜÇ ya da daha çok ölçümünde kategorik sonuç, iki kategorili sonuçta Cochran Q testini ister; ArvoLab'da yok (üçten çok kategoride ise genelleştirilmiş karma model gerekir). McNemar yalnızca iki ölçüm içindir — üç ölçümü ikili parçalara bölerek McNemar uygulamak hata oranını yükseltir, bu yüzden aday olarak sunulmuyor.",
    en: "A categorical outcome across THREE or more measurements of the same people requires Cochran's Q test for a two-category outcome, which ArvoLab does not have (with more than two categories a generalised mixed model is needed). McNemar is for two measurements only — splitting three measurements into pairs and applying McNemar inflates the error rate, so it is not offered as a candidate.",
  },
  karmaKategorik: {
    tr: "Hem farklı gruplar hem tekrarlı ölçüm içeren desende kategorik sonuç, genelleştirilmiş karma modeller (GEE/GLMM) ister; ArvoLab'da yok. Ki-kare bu desende satırların bağımsızlığı varsayımını çiğner.",
    en: "A categorical outcome in a design with both different groups and repeated measurements requires generalised mixed models (GEE/GLMM), which ArvoLab does not have. Chi-square would violate the independence-of-rows assumption in this design.",
  },
  karmaSirali: {
    tr: "Hem farklı gruplar hem tekrarlı ölçüm içeren desenin parametrik olmayan karşılığı ArvoLab'da yok. Karma ANOVA parametrik bir testtir; varsayımlar uymuyorsa dönüştürme ya da karma etkili model gerekir.",
    en: "There is no non-parametric counterpart in ArvoLab for a design with both different groups and repeated measurements. Mixed ANOVA is a parametric test; when assumptions fail, a transformation or a mixed-effects model is needed.",
  },
  tekOrneklemSirali: {
    tr: "Tek grubu bilinen bir değerle sıralar üzerinden karşılaştırmak tek örneklem Wilcoxon işaretli sıralar testini ister; ArvoLab'da yok. Tek örneklem t-testi parametriktir, dağılım çarpıkken onu önermek yanlış olur.",
    en: "Comparing one group against a known value through ranks requires the one-sample Wilcoxon signed-rank test, which ArvoLab does not have. The one-sample t-test is parametric, and suggesting it for a skewed distribution would be wrong.",
  },
  siraliYordama: {
    tr: "Sıralı bir sonucu yordamak sıralı (ordinal) lojistik regresyon ister; ArvoLab'da yok. Sıralı sonucu sürekli sayarak doğrusal regresyon çalıştırmak sık yapılan ama savunulması zor bir tercihtir.",
    en: "Predicting an ordinal outcome requires ordinal logistic regression, which ArvoLab does not have. Treating an ordinal outcome as continuous and running linear regression is common but hard to defend.",
  },
  cokKategoriliYordama: {
    tr: "İkiden çok kategorili bir sonucu yordamak çok kategorili (multinom) lojistik regresyon ister; ArvoLab'da yalnızca İKİLİ lojistik regresyon var. Kategorileri ikiye indirip ikili lojistik çalıştırmak bilgi atar ve hangi kategorinin ayrıştığını gizler; bu yüzden aday olarak sunulmuyor.",
    en: "Predicting an outcome with more than two categories requires multinomial logistic regression; ArvoLab has only BINARY logistic regression. Collapsing the categories into two throws information away and hides which category separates, so it is not offered as a candidate.",
  },
  cokKategoriliTekrarli: {
    tr: "Aynı kişilerin iki ölçümünde İKİDEN ÇOK kategorili sonuç, McNemar–Bowker ya da marjinal homojenlik testini ister; ArvoLab'da yok. McNemar yalnızca iki kategori içindir — kategorileri birleştirerek uygulamak, hangi kategoriler arasında geçiş olduğunu gizler.",
    en: "A categorical outcome with MORE THAN TWO categories across two measurements of the same people requires the McNemar–Bowker or marginal homogeneity test, which ArvoLab does not have. McNemar is for two categories only — collapsing categories to apply it hides which categories the transitions occur between.",
  },
} satisfies Record<string, Metin>;

/* Cevaplanmış mı (bilmiyorum da bir cevaptır: "bu bilgi yok" demek). */
const verildi = (deger: string | undefined) => deger !== undefined && deger !== "";
const bilinmiyor = (deger: string | undefined) => deger === BILMIYORUM;

/**
 * Kullanıcının cevaplarından soru akışını ve aday listesini üretir.
 * Saf fonksiyon: ağ yok, hesap yok, veri okumaz.
 */
export function analizOnerisi(yanitlar: Yanitlar): Oneri {
  const sorular: Soru[] = [SORULAR.amac];
  const sinirlar: Metin[] = [];
  let adaylar: Aday[] = [];
  let desteklenmeyen: Metin | null = null;
  let tamam = false;

  const amac = yanitlar.amac;
  if (!verildi(amac)) return { sorular, tamam: false, adaylar: [], guven: "belirsiz", sinirlar: [], desteklenmeyen: null };

  if (bilinmiyor(amac)) {
    sinirlar.push(SINIR.amacBilinmiyor);
    return { sorular, tamam: false, adaylar: [], guven: "belirsiz", sinirlar, desteklenmeyen: null };
  }

  if (amac === "betimle") {
    adaylar = al("descriptives");
    tamam = true;
  }

  if (amac === "fark") {
    sorular.push(SORULAR.sonucTuru);
    const tur = yanitlar.sonucTuru;
    /*
      Ölçüm düzeyine göre İKİNCİ soru değişiyor: sürekli sonuçta dağılım,
      kategorik sonuçta kategori sayısı. Herkese her soru sorulmuyor.
    */
    if (tur === "surekli") sorular.push(SORULAR.dagilim);
    if (tur === "kategorik") sorular.push(SORULAR.kategoriSayisi);
    const dagilim = yanitlar.dagilim;
    const kategoriSayisi = yanitlar.kategoriSayisi;
    const ikinciCevaplandi =
      tur === "surekli" ? verildi(dagilim) : tur === "kategorik" ? verildi(kategoriSayisi) : true;
    if (verildi(tur) && ikinciCevaplandi) sorular.push(SORULAR.olcumDuzeni);
    const duzen = yanitlar.olcumDuzeni;
    if (verildi(tur) && ikinciCevaplandi && verildi(duzen)) {
      /* Karma desende grup/ölçüm sayısı sorulmaz: karma ANOVA deseni tanımlıyor. */
      if (duzen !== "karma") sorular.push(SORULAR.grupSayisi);
      const sayi = yanitlar.grupSayisi;

      const surekliBagimsiz = (): Aday[] => {
        if (sayi === "tek") return al("tekorneklem");
        if (sayi === "iki") return al("ttest");
        if (sayi === "ucDahaCok") {
          sorular.push(SORULAR.faktorSayisi);
          const faktor = yanitlar.faktorSayisi;
          if (!verildi(faktor)) return [];
          if (faktor === "iki") return al("ikiyonluanova");
          if (bilinmiyor(faktor)) return al("anova", "ikiyonluanova");
          sorular.push(SORULAR.kovaryat);
          const kov = yanitlar.kovaryat;
          if (!verildi(kov)) return [];
          if (kov === "var") return al("ancova");
          if (bilinmiyor(kov)) return al("anova", "ancova");
          return al("anova");
        }
        /* Grup sayısı bilinmiyor: iki ve çok gruplu adaylar birlikte. */
        return al("ttest", "anova");
      };

      /*
        Sürekli sonucun sıra temelli karşılığı. Tek örneklemde karşılık
        yok (tek örneklem Wilcoxon ArvoLab'da yok): orada boş dönüyor ve
        sınır notu ayrıca yazılıyor.
      */
      const siraTemelliKarsilik = (d: string | undefined, n: string | undefined): Aday[] => {
        if (n === "tek") return [];
        if (d === "bagimsiz") return n === "iki" ? al("mannwhitney") : n === "ucDahaCok" ? al("kruskalwallis") : al("mannwhitney", "kruskalwallis");
        if (d === "tekrarli") return n === "iki" ? al("wilcoxon") : n === "ucDahaCok" ? al("friedman") : al("wilcoxon", "friedman");
        if (d === "karma") return [];
        return n === "iki" ? al("mannwhitney", "wilcoxon") : n === "ucDahaCok" ? al("kruskalwallis", "friedman") : al("mannwhitney", "wilcoxon", "kruskalwallis", "friedman");
      };

      const siraliBagimsiz = (): Aday[] => {
        if (sayi === "tek") {
          desteklenmeyen = DESTEKLENMEYEN.tekOrneklemSirali;
          return [];
        }
        if (sayi === "iki") return al("mannwhitney");
        if (sayi === "ucDahaCok") return al("kruskalwallis");
        return al("mannwhitney", "kruskalwallis");
      };

      if (duzen === "karma") {
        if (tur === "surekli") adaylar = al("karmaanova");
        else if (tur === "sirali") desteklenmeyen = DESTEKLENMEYEN.karmaSirali;
        else if (tur === "kategorik") desteklenmeyen = DESTEKLENMEYEN.karmaKategorik;
        else {
          /* Tür bilinmiyor: karma desende yalnızca parametrik karşılık var. */
          adaylar = al("karmaanova");
          sinirlar.push(SINIR.olcumBilinmiyor);
        }
        tamam = verildi(tur);
      } else if (verildi(sayi)) {
        if (tur === "surekli") {
          if (duzen === "bagimsiz") adaylar = surekliBagimsiz();
          else if (duzen === "tekrarli") {
            adaylar = sayi === "iki" ? al("pairedttest") : sayi === "ucDahaCok" ? al("tekrarlianova") : sayi === "tek" ? al("tekorneklem") : al("pairedttest", "tekrarlianova");
          } else {
            /* Düzen bilinmiyor: bağımsız ve tekrarlı adaylar birlikte, uyarıyla. */
            adaylar = sayi === "iki" ? al("ttest", "pairedttest") : sayi === "ucDahaCok" ? al("anova", "tekrarlianova") : sayi === "tek" ? al("tekorneklem") : al("ttest", "pairedttest", "anova", "tekrarlianova");
            sinirlar.push(SINIR.duzenBilinmiyor);
          }
          /*
            DAĞILIM AYRI BİR KARAR. Çarpıklık değişkeni sıralı yapmıyor;
            sıra temelli karşılığı parametrik adayın YANINA ekleniyor ve
            hangisinin raporlanacağı varsayım şeridine bırakılıyor.
          */
          if (dagilim === "sorunlu" || bilinmiyor(dagilim)) {
            const siraliKarsilik = siraTemelliKarsilik(duzen, sayi);
            adaylar = [...adaylar, ...siraliKarsilik.filter((x) => !adaylar.some((a) => a.tur === x.tur))];
            sinirlar.push(dagilim === "sorunlu" ? SINIR.dagilimSorunlu : SINIR.dagilimBilinmiyor);
          }
        } else if (tur === "sirali") {
          if (duzen === "bagimsiz") adaylar = siraliBagimsiz();
          else if (duzen === "tekrarli") {
            if (sayi === "tek") desteklenmeyen = DESTEKLENMEYEN.tekOrneklemSirali;
            else adaylar = sayi === "iki" ? al("wilcoxon") : sayi === "ucDahaCok" ? al("friedman") : al("wilcoxon", "friedman");
          } else {
            adaylar = sayi === "iki" ? al("mannwhitney", "wilcoxon") : sayi === "ucDahaCok" ? al("kruskalwallis", "friedman") : al("mannwhitney", "wilcoxon", "kruskalwallis", "friedman");
            sinirlar.push(SINIR.duzenBilinmiyor);
          }
        } else if (tur === "kategorik") {
          /*
            KATEGORİ SAYISI KOŞULU AÇIKÇA DENETLENİYOR. Ki-kare r×c
            tabloyla çalışır, kategori sayısı serbesttir. McNemar ve
            Cochran Q ise İKİ kategorili sonuç ister; üç kategoride
            bunları önermek sessizce yanlış analiz yaptırır.
          */
          const ikiKategori = kategoriSayisi === "iki";
          const cokKategori = kategoriSayisi === "ucDahaCok";
          if (duzen === "bagimsiz") adaylar = al("chisquare");
          else if (duzen === "tekrarli") {
            if (sayi === "ucDahaCok") desteklenmeyen = DESTEKLENMEYEN.cochran;
            else if (sayi === "tek") adaylar = al("chisquare");
            else if (cokKategori) desteklenmeyen = DESTEKLENMEYEN.cokKategoriliTekrarli;
            else if (sayi === "iki" || bilinmiyor(sayi)) {
              adaylar = al("mcnemar");
              if (!ikiKategori) sinirlar.push(SINIR.kategoriBilinmiyor);
              if (bilinmiyor(sayi)) sinirlar.push(SINIR.grupBilinmiyor);
            }
          } else {
            /* Düzen bilinmiyor: McNemar yalnızca iki kategorili sonuçta aday. */
            adaylar = cokKategori || sayi === "ucDahaCok" ? al("chisquare") : al("chisquare", "mcnemar");
            if (!cokKategori && sayi !== "ucDahaCok" && !ikiKategori) sinirlar.push(SINIR.kategoriBilinmiyor);
            sinirlar.push(SINIR.duzenBilinmiyor);
          }
        } else {
          /*
            Sonuç türü bilinmiyor. Parametrik ve parametrik olmayan
            adaylar BİRLİKTE: dağılım testinin sonucuna bakıp otomatik
            seçim yapmak, ölçüm düzeyi kararını istatistiğe devretmek olur.
          */
          if (duzen === "bagimsiz") adaylar = sayi === "iki" ? al("ttest", "mannwhitney") : sayi === "ucDahaCok" ? al("anova", "kruskalwallis") : sayi === "tek" ? al("tekorneklem") : al("ttest", "mannwhitney", "anova", "kruskalwallis");
          else if (duzen === "tekrarli") adaylar = sayi === "iki" ? al("pairedttest", "wilcoxon") : sayi === "ucDahaCok" ? al("tekrarlianova", "friedman") : al("pairedttest", "wilcoxon", "tekrarlianova", "friedman");
          else {
            adaylar = al("ttest", "mannwhitney", "pairedttest", "wilcoxon");
            sinirlar.push(SINIR.duzenBilinmiyor);
          }
          sinirlar.push(SINIR.olcumBilinmiyor);
        }
        tamam = adaylar.length > 0 || desteklenmeyen !== null;
      }

      /*
        Çoklu sonuç değişkeni sorusu yalnızca sürekli sonuçta ve bir aday
        bulunduğunda sorulur: MANOVA'nın yokluğunu söylemek, ancak
        kullanıcı gerçekten çok değişkenli bir test arıyorsa anlamlı.
      */
      if (tur === "surekli" && adaylar.length > 0) {
        sorular.push(SORULAR.cokluSonuc);
        if (yanitlar.cokluSonuc === "cok") {
          desteklenmeyen = DESTEKLENMEYEN.manova;
        }
      }
    }
  }

  if (amac === "iliski") {
    sorular.push(SORULAR.sonucTuru);
    const tur = yanitlar.sonucTuru;
    /* Sürekli değişkende dağılım ayrı soru: çarpıklık onu sıralı yapmaz. */
    if (tur === "surekli") sorular.push(SORULAR.dagilim);
    const dagilim = yanitlar.dagilim;
    if (verildi(tur) && (tur !== "surekli" || verildi(dagilim))) {
      if (tur === "kategorik") {
        adaylar = al("chisquare");
        tamam = true;
      } else {
        sorular.push(SORULAR.kontrolDegiskeni);
        const kontrol = yanitlar.kontrolDegiskeni;
        if (verildi(kontrol)) {
          if (tur === "surekli") {
            adaylar = kontrol === "var" ? al("kismikorelasyon") : kontrol === "yok" ? al("correlation") : al("correlation", "kismikorelasyon");
            /* Dağılım kuşkuluysa sıra temelli karşılık da aday; ölçüm düzeyi değişmez. */
            if (dagilim === "sorunlu" || bilinmiyor(dagilim)) {
              adaylar = [...adaylar, ADAYLAR.spearman];
              sinirlar.push(dagilim === "sorunlu" ? SINIR.dagilimSorunlu : SINIR.dagilimBilinmiyor);
            }
          } else if (tur === "sirali") {
            adaylar = al("spearman");
            if (kontrol === "var") {
              sinirlar.push({
                tr: "ArvoLab'ın kısmi korelasyonu Pearson tabanlıdır; sıralı değişkende Spearman'ın kısmi karşılığı yok. Kontrol değişkenini modele katmak isterseniz regresyon daha uygun olur.",
                en: "ArvoLab's partial correlation is Pearson-based; there is no Spearman counterpart for ordinal variables. To include the control variable in a model, regression is more appropriate.",
              });
            }
          } else {
            adaylar = al("correlation", "spearman");
            sinirlar.push(SINIR.olcumBilinmiyor);
          }
          tamam = true;
        }
      }
    }
  }

  if (amac === "yordama") {
    sorular.push(SORULAR.sonucTuru);
    const tur = yanitlar.sonucTuru;
    if (tur === "kategorik") sorular.push(SORULAR.kategoriSayisi);
    const kategoriSayisi = yanitlar.kategoriSayisi;
    if (verildi(tur)) {
      if (tur === "surekli") {
        adaylar = al("regression");
        tamam = true;
      } else if (tur === "kategorik") {
        /*
          İKİLİ SONUÇ KOŞULU AÇIKÇA DENETLENİYOR. Üç ve daha çok
          kategoride ikili lojistik regresyon ÖNERİLMİYOR: kategorileri
          birleştirmek bilgi atar ve hangi kategorinin ayrıştığını gizler.
        */
        if (kategoriSayisi === "ucDahaCok") {
          desteklenmeyen = DESTEKLENMEYEN.cokKategoriliYordama;
          tamam = true;
        } else if (verildi(kategoriSayisi)) {
          adaylar = al("lojistik");
          if (bilinmiyor(kategoriSayisi)) sinirlar.push(SINIR.kategoriBilinmiyor);
          tamam = true;
        }
      } else if (tur === "sirali") {
        desteklenmeyen = DESTEKLENMEYEN.siraliYordama;
        tamam = true;
      } else {
        adaylar = al("regression", "lojistik");
        sinirlar.push(SINIR.olcumBilinmiyor);
        sinirlar.push(SINIR.kategoriBilinmiyor);
        tamam = true;
      }
    }
  }

  if (amac === "olcek") {
    sorular.push(SORULAR.olcekAmaci);
    const olcekAmaci = yanitlar.olcekAmaci;
    if (verildi(olcekAmaci)) {
      if (olcekAmaci === "guvenilirlik") adaylar = al("reliability");
      else if (olcekAmaci === "yapiKesfet") adaylar = al("faktor");
      else if (olcekAmaci === "yapiDogrula") adaylar = al("dfa");
      else {
        adaylar = al("reliability", "faktor", "dfa");
        sinirlar.push({
          tr: "Keşfetmekle doğrulamak aynı şey değil: yapıyı veriden çıkarıp sonra aynı veride doğrulamak geçerli bir kanıt değildir.",
          en: "Exploring and confirming are not the same: deriving a structure from the data and then confirming it on the same data is not valid evidence.",
        });
      }
      tamam = true;
    }
  }

  if (amac === "model") {
    sorular.push(SORULAR.modelTuru);
    const modelTuru = yanitlar.modelTuru;
    if (verildi(modelTuru)) {
      if (modelTuru === "araci") adaylar = al("aracilik");
      else if (modelTuru === "duzenleyici") adaylar = al("duzenleyicilik");
      else {
        adaylar = al("aracilik", "duzenleyicilik");
        sinirlar.push({
          tr: "Aracı ve düzenleyici aynı veriyle farklı modeller: hangisinin kuramsal gerekçesi varsa onu seçin, veriye bakıp karar vermeyin.",
          en: "A mediator and a moderator are different models on the same data: choose the one with a theoretical rationale rather than deciding from the data.",
        });
      }
      tamam = true;
    }
  }

  /* Desteklenmeyen desende aday verilmez: benzer ama yanlış teste yönlendirmek en sinsi hatadır. */
  if (desteklenmeyen) adaylar = [];

  if (adaylar.length > 0) sinirlar.push(SINIR.hepAday);

  return {
    sorular,
    tamam,
    adaylar,
    /* Tek aday bile "kesin" sayılmaz: düzen bilgisi ArvoLab'da yok. */
    guven: adaylar.length > 0 ? "aday" : "belirsiz",
    sinirlar,
    desteklenmeyen,
  };
}
