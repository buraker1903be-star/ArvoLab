/*
  HER ANALİZ İÇİN VERİ HAZIRLAMA REHBERİ (23.11.2026).

  Güvenilirlik analizine eklenen "Bu analiz için hangi veriler
  gerekli?" kartı bütün Analiz Merkezi'ne yayıldı. Analizi ilk kez
  yapan biri, dosyayı YÜKLEMEDEN önce Excel tablosunu nasıl
  kuracağını buradan öğreniyor: bir satır neyi temsil ediyor, hangi
  sütunlar zorunlu, hücrelere sayı mı kategori mi giriliyor, hangi
  değerler dosyada değil EKRANDA isteniyor ve o analizde en sık
  yapılan hata ne.

  TEK TANIM, ÜÇ KULLANIM. Sütun listesi hem örnek tabloyu, hem
  indirilen boş şablonu, hem de açıklamayı besliyor. Üçü ayrı
  yazılsaydı biri değişince ötekiler sessizce eskirdi.

  SEÇENEĞE GÖRE DEĞİŞEN DÜZENLER. Aynı analizin veri düzenini
  değiştiren seçenekleri varsa rehber ona göre güncelleniyor: iki
  yönlü ANOVA'nın ikinci faktörü, aracılık/düzenleyicilikte sonuç
  değişkeni, tekrarlı ölçüm sayısı, madde/yordayıcı/kovaryat sayısı.

  Kapsam listesi `ANALIZ_TURLERI`: testi (tests/unit/analiz-veri-rehberi.test.ts)
  her tür için bir giriş olmasını zorunlu kılıyor.

  Saf modül.
*/
import type { Dil, Metin } from "@/lib/dil";
import { ANALIZ_TURLERI, type AnalizTuru } from "@/lib/analiz-turleri";

export type HucreTuru = "sayi" | "kategori" | "etiket";

export interface RehberSutunu {
  ad: Metin;
  tur: HucreTuru;
  zorunlu: boolean;
  /** Örnek tablodaki dört değer; yoksa türden üretilir. */
  ornek?: string[];
}

export interface VeriRehberi {
  /** Bir satır neyi temsil ediyor. */
  satir: Metin;
  sutunlar: RehberSutunu[];
  /** Dosyada DEĞİL, analiz ekranında girilen değerler. */
  ekranGirdileri: Metin[];
  /** Yalnızca bu analiz için önemli olan yaygın hata. */
  yayginHata: Metin;
  /** Sütun listesine eklenen, analize özgü kısa cümleler. */
  notlar?: Metin[];
  /** Listenin altındaki uyarı/sınır notu. */
  ekNot?: Metin;
}

export interface RehberSecenekleri {
  /** İki yönlü ANOVA'da ikinci faktör seçildi mi. */
  ikinciFaktor?: boolean;
  /** Aracılık/düzenleyicilikte sonuç değişkeni seçildi mi. */
  ciktiY?: boolean;
  /** Tekrarlı ölçüm sayısı (friedman, tekrarlianova, karmaanova). */
  olcumSayisi?: number;
  /** Madde sayısı (reliability, faktor, dfa). */
  maddeSayisi?: number;
  /** Kovaryat / kontrol değişkeni sayısı (ancova, kismikorelasyon, aracilik, duzenleyicilik). */
  kovaryatSayisi?: number;
  /** Yordayıcı sayısı (regression, lojistik). */
  yordayiciSayisi?: number;
  /** Aracı sayısı (aracilik). */
  araciSayisi?: number;
}

const s = (tr: string, en: string, tur: HucreTuru, zorunlu: boolean, ornek?: string[]): RehberSutunu => ({
  ad: { tr, en },
  tur,
  zorunlu,
  ornek,
});

/** Katılımcı sütunu her analizde isteğe bağlı; analize seçilmemeli. */
const KATILIMCI = s("Katılımcı", "Participant", "etiket", false, ["K1", "K2", "K3", "K4"]);

const sayiSutun = (tr: string, en: string, ornek: string[], zorunlu = true) => s(tr, en, "sayi", zorunlu, ornek);
const kategoriSutun = (tr: string, en: string, ornek: string[], zorunlu = true) => s(tr, en, "kategori", zorunlu, ornek);

/*
  Çoklu alanlar: istenen sayıda sütun. Alt sınır varsayılan 2 (iki
  maddeyle örnek anlamsız olurdu), aracı gibi TEK olabilen alanlarda 1.
  Üst sınır 6: örnek tablo okunmaz hâle gelmesin.
*/
const coklu = (
  tr: (i: number) => string,
  en: (i: number) => string,
  sayi: number,
  ornek: (i: number) => string[],
  tur: HucreTuru = "sayi",
  enAz = 2,
): RehberSutunu[] =>
  Array.from({ length: Math.min(Math.max(sayi, enAz), 6) }, (_, i) => s(tr(i + 1), en(i + 1), tur, true, ornek(i)));

const PUAN = ["72", "65", "80", "58"];
const PUAN2 = ["78", "70", "86", "61"];
const PUAN3 = ["81", "74", "88", "66"];
const YAS = ["21", "24", "19", "27"];
const GRUP2 = ["deney", "kontrol", "deney", "kontrol"];
const GRUP2EN = ["treatment", "control", "treatment", "control"];
const GRUP3 = ["9. sınıf", "10. sınıf", "11. sınıf", "9. sınıf"];
const GRUP3EN = ["grade 9", "grade 10", "grade 11", "grade 9"];
const EVETHAYIR = ["evet", "hayır", "evet", "hayır"];
const EVETHAYIREN = ["yes", "no", "yes", "no"];

/* Kategorik örnek değerler dile göre: Türkçe tabloda Türkçe kategoriler. */
const kategoriOrnegi = (tr: string[], en: string[], dil: Dil) => (dil === "en" ? en : tr);

type RehberKurucu = (o: Required<RehberSecenekleri>) => VeriRehberi;

const KURUCULAR: Record<AnalizTuru, RehberKurucu> = {
  descriptives: () => ({
    satir: { tr: "Her satır bir katılımcı (ya da bir gözlem).", en: "Each row is one participant (or one observation)." },
    sutunlar: [KATILIMCI, sayiSutun("Puan", "Score", PUAN), sayiSutun("Yaş", "Age", YAS, false)],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Sayısal sütuna birim yazmayın: “72 puan” ya da “21 yaş” metin sayılır ve ortalaması alınamaz. Hücrede yalnızca sayı olsun.",
      en: "Do not write units in a numeric column: “72 points” or “21 years” counts as text and cannot be averaged. Put only the number in the cell.",
    },
  }),
  ttest: () => ({
    satir: { tr: "Her satır BİR kişi. Kişinin hangi grupta olduğu ayrı bir sütunda yazılır.", en: "Each row is ONE person. Which group the person is in goes in a separate column." },
    sutunlar: [KATILIMCI, kategoriSutun("Grup", "Group", GRUP2), sayiSutun("Puan", "Score", PUAN)],
    ekranGirdileri: [],
    yayginHata: {
      tr: "İki grubun puanlarını İKİ AYRI SÜTUNA yazmayın. Bütün puanlar tek sütunda, grup adı yanındaki sütunda olmalı.",
      en: "Do not put the two groups' scores in TWO SEPARATE COLUMNS. All scores go in one column, with the group name in the column beside it.",
    },
  }),
  anova: () => ({
    satir: { tr: "Her satır bir kişi; grup bilgisi ayrı sütunda, üç ya da daha çok kategoriyle.", en: "Each row is one person; the group goes in a separate column with three or more categories." },
    sutunlar: [KATILIMCI, kategoriSutun("Grup", "Group", GRUP3), sayiSutun("Puan", "Score", PUAN)],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Her grubu ayrı bir sütuna yazmayın; gruplar tek sütunda kategori olarak durmalı. Grup adları birebir aynı yazılmalı (“9. sınıf” ile “9.sınıf” iki ayrı grup sayılır).",
      en: "Do not give each group its own column; groups belong in one column as categories. Group names must match exactly (“grade 9” and “Grade9” count as two groups).",
    },
  }),
  correlation: () => ({
    satir: { tr: "Her satır bir kişi; iki sayısal ölçüm aynı satırda.", en: "Each row is one person; the two numeric measurements sit in the same row." },
    sutunlar: [KATILIMCI, sayiSutun("Değişken 1", "Variable 1", PUAN), sayiSutun("Değişken 2", "Variable 2", PUAN2)],
    ekranGirdileri: [],
    yayginHata: {
      tr: "İki değişken farklı kişilere aitse korelasyon anlamsızdır: aynı satırdaki iki sayı AYNI kişinin olmalı.",
      en: "A correlation is meaningless if the two variables come from different people: the two numbers in a row must belong to the SAME person.",
    },
  }),
  chisquare: () => ({
    satir: { tr: "Her satır BİR kişi. İki kategorik yanıtı aynı satırda yazın; çapraz tablo ArvoLab'da oluşturulur.", en: "Each row is ONE person. Put their two categorical answers in the same row; ArvoLab builds the cross-table." },
    sutunlar: [KATILIMCI, kategoriSutun("Cinsiyet", "Gender", ["kadın", "erkek", "kadın", "erkek"]), kategoriSutun("Tercih", "Preference", EVETHAYIR)],
    ekranGirdileri: [],
    yayginHata: {
      tr: "HAZIR ÇAPRAZ TABLO (satırlarda bir değişken, sütunlarda öteki, hücrelerde sayımlar) yüklemeyin. Ham satırlar gerekiyor: her kişi bir satır.",
      en: "Do not upload a READY-MADE CROSS-TABLE (one variable in rows, the other in columns, counts in the cells). Raw rows are needed: one person per row.",
    },
  }),
  reliability: (o) => ({
    satir: { tr: "Her satır bir katılımcı, her sütun bir anket maddesi.", en: "Each row is one participant, each column is one questionnaire item." },
    /* Bu dört cümle 23.11.2026'da güvenilirlik kartıyla geldi ve
       kabul testinde birebir sınanıyor; rehber genele yayılırken
       korunuyor. */
    notlar: [
      { tr: "Hücrelere verilen yanıtları yazın.", en: "Write the given answers in the cells." },
      { tr: "Yalnızca toplam puan yeterli değildir.", en: "A total score on its own is not enough." },
      { tr: "Katılımcı sütunu isteğe bağlıdır ve analize seçilmez.", en: "A participant column is optional and is not selected for the analysis." },
    ],
    ekNot: {
      tr: "Cronbach α için en az 2 madde, McDonald ω için en az 3 madde gerekir. Üç madde seçmek ω'nın hesaplanacağını GARANTİ ETMEZ: model kestirilemezse ya da geçersiz hata varyansı çıkarsa ω yerine sebebi yazılır.",
      en: "Cronbach's α needs at least 2 items and McDonald's ω at least 3. Selecting three items does NOT guarantee that ω can be computed: if the model cannot be estimated or an invalid error variance appears, the reason is shown instead of ω.",
    },
    sutunlar: [KATILIMCI, ...coklu((i) => `Madde ${i}`, (i) => `Item ${i}`, o.maddeSayisi, (i) => ["4", "3", "5", "2"].map((x) => String(Math.max(1, Math.min(5, Number(x) + (i % 2 === 0 ? 0 : 1))))))],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Yalnızca toplam puan yeterli değildir: her maddenin yanıtı ayrı sütunda olmalı. Ters maddeleri önce kendiniz çevirin.",
      en: "A total score on its own is not enough: each item's answer needs its own column. Reverse-score negatively worded items yourself first.",
    },
  }),
  pairedttest: () => ({
    satir: { tr: "Her satır bir kişi; aynı kişinin ÖNCE ve SONRA puanı AYNI satırda.", en: "Each row is one person; that person's BEFORE and AFTER scores are in the SAME row." },
    sutunlar: [KATILIMCI, sayiSutun("Ön test", "Pre-test", PUAN), sayiSutun("Son test", "Post-test", PUAN2)],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Ön ve son ölçümleri ALT ALTA tek sütuna yazmayın; eşleşme satırdan okunur. Bir kişinin iki ölçümü iki ayrı satırdaysa test yapılamaz.",
      en: "Do not stack the before and after measurements in one column; the pairing is read from the row. If one person's two measurements are on two rows, the test cannot run.",
    },
  }),
  mannwhitney: () => ({
    satir: { tr: "Her satır bir kişi; grup ayrı sütunda, iki kategorili.", en: "Each row is one person; the group is a separate column with two categories." },
    sutunlar: [KATILIMCI, kategoriSutun("Grup", "Group", GRUP2), sayiSutun("Puan", "Score", PUAN)],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Sıralı bir ölçek kullanıyorsanız (1–5 gibi) hücrelere SAYIYI yazın, “katılıyorum” gibi etiketi değil.",
      en: "If you use an ordinal scale (such as 1–5) put the NUMBER in the cell, not a label like “agree”.",
    },
  }),
  kruskalwallis: () => ({
    satir: { tr: "Her satır bir kişi; grup ayrı sütunda, üç ya da daha çok kategoriyle.", en: "Each row is one person; the group is a separate column with three or more categories." },
    sutunlar: [KATILIMCI, kategoriSutun("Grup", "Group", GRUP3), sayiSutun("Puan", "Score", PUAN)],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Grupları ayrı sütunlara dağıtmayın; tek bir grup sütunu gerekir.",
      en: "Do not spread the groups across separate columns; a single group column is required.",
    },
  }),
  spearman: () => ({
    satir: { tr: "Her satır bir kişi; iki sıralı ya da sayısal ölçüm aynı satırda.", en: "Each row is one person; the two ordinal or numeric measurements sit in the same row." },
    sutunlar: [KATILIMCI, sayiSutun("Sıra 1", "Rank 1", ["3", "1", "5", "2"]), sayiSutun("Sıra 2", "Rank 2", ["4", "2", "5", "1"])],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Sıralama bilgisini metin olarak yazmayın (“birinci”, “ikinci”); hücrede sayı olmalı.",
      en: "Do not write the ranking as text (“first”, “second”); the cell must hold a number.",
    },
  }),
  regression: (o) => ({
    satir: { tr: "Her satır bir kişi; yordanan değişken ve bütün yordayıcılar aynı satırda.", en: "Each row is one person; the outcome and all predictors sit in the same row." },
    sutunlar: [
      KATILIMCI,
      sayiSutun("Bağımlı değişken", "Outcome", PUAN),
      ...coklu((i) => `Yordayıcı ${i}`, (i) => `Predictor ${i}`, o.yordayiciSayisi, (i) => (i === 0 ? YAS : PUAN2)),
    ],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Yordayıcılar SAYISAL olmalı. Kategorik bir değişkeni (cinsiyet gibi) yordayıcı yapmak için önce 0/1 olarak kodlayın.",
      en: "Predictors must be NUMERIC. To use a categorical variable (such as gender) as a predictor, code it as 0/1 first.",
    },
  }),
  ikiyonluanova: (o) => ({
    satir: {
      tr: o.ikinciFaktor
        ? "Her satır bir kişi; İKİ faktörün de kategorisi ayrı sütunlarda."
        : "Her satır bir kişi; birinci faktörün kategorisi ayrı sütunda. İkinci faktörü seçerseniz onun için de bir sütun gerekir.",
      en: o.ikinciFaktor
        ? "Each row is one person; BOTH factors' categories are in separate columns."
        : "Each row is one person; the first factor's category is in its own column. If you select a second factor, it needs a column too.",
    },
    sutunlar: [
      KATILIMCI,
      kategoriSutun("1. faktör", "Factor 1", GRUP2),
      kategoriSutun("2. faktör", "Factor 2", ["A", "A", "B", "B"], o.ikinciFaktor),
      sayiSutun("Puan", "Score", PUAN),
    ],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Her faktör–düzey birleşimine (hücreye) en az iki kişi düşmeli; boş bir hücre kalırsa etkileşim hesaplanamaz.",
      en: "Every factor-level combination (cell) needs at least two people; if a cell is empty the interaction cannot be computed.",
    },
  }),
  wilcoxon: () => ({
    satir: { tr: "Her satır bir kişi; iki ölçüm AYNI satırda.", en: "Each row is one person; the two measurements are in the SAME row." },
    sutunlar: [KATILIMCI, sayiSutun("Ön test", "Pre-test", PUAN), sayiSutun("Son test", "Post-test", PUAN2)],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Ölçümleri alt alta tek sütuna yazmayın; eşleşme satırdan okunur.",
      en: "Do not stack the measurements in one column; the pairing is read from the row.",
    },
  }),
  friedman: (o) => ({
    satir: { tr: "Her satır bir kişi; her ölçüm (ön test, son test, izleme…) ayrı bir sütun.", en: "Each row is one person; each measurement (pre, post, follow-up…) is its own column." },
    sutunlar: [KATILIMCI, ...coklu((i) => `Ölçüm ${i}`, (i) => `Measurement ${i}`, Math.max(o.olcumSayisi, 3), (i) => [PUAN, PUAN2, PUAN3][i % 3])],
    ekranGirdileri: [],
    yayginHata: {
      tr: "En az ÜÇ ölçüm sütunu gerekir; iki ölçüm için Wilcoxon kullanın.",
      en: "At least THREE measurement columns are required; for two measurements use Wilcoxon.",
    },
  }),
  tekorneklem: () => ({
    satir: { tr: "Her satır bir kişi; tek bir sayısal sütun yeterli.", en: "Each row is one person; a single numeric column is enough." },
    sutunlar: [KATILIMCI, sayiSutun("Puan", "Score", PUAN)],
    ekranGirdileri: [
      { tr: "Karşılaştırılacak değer (ölçeğin orta noktası, norm değeri vb.) analiz ekranında girilir, dosyada yer almaz.", en: "The test value (the scale midpoint, a norm value and so on) is entered on the analysis screen, not in the file." },
    ],
    yayginHata: {
      tr: "Karşılaştırılacak değeri dosyaya bir sütun olarak eklemeyin; o ekranda girilir.",
      en: "Do not add the test value to the file as a column; it is entered on screen.",
    },
  }),
  tekrarlianova: (o) => ({
    satir: { tr: "Her satır bir kişi; her tekrarlı ölçüm ayrı bir sütun.", en: "Each row is one person; each repeated measurement is its own column." },
    sutunlar: [KATILIMCI, ...coklu((i) => `Ölçüm ${i}`, (i) => `Measurement ${i}`, Math.max(o.olcumSayisi, 3), (i) => [PUAN, PUAN2, PUAN3][i % 3])],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Ölçümleri alt alta yazıp yanına “zaman” sütunu koymayın (uzun biçim); ArvoLab geniş biçim bekler: her ölçüm bir sütun.",
      en: "Do not stack the measurements with a “time” column beside them (long format); ArvoLab expects wide format: one column per measurement.",
    },
  }),
  ancova: (o) => ({
    satir: { tr: "Her satır bir kişi; grup, bağımlı değişken ve kovaryat(lar) aynı satırda.", en: "Each row is one person; group, outcome and covariate(s) sit in the same row." },
    sutunlar: [
      KATILIMCI,
      kategoriSutun("Grup", "Group", GRUP2),
      sayiSutun("Son test", "Post-test", PUAN2),
      ...coklu((i) => (i === 1 ? "Ön test (kovaryat)" : `Kovaryat ${i}`), (i) => (i === 1 ? "Pre-test (covariate)" : `Covariate ${i}`), Math.max(o.kovaryatSayisi, 1), () => PUAN),
    ],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Kovaryat SAYISAL olmalı ve çoğunlukla ön testtir. Kovaryatı grup sütunuyla karıştırmayın.",
      en: "The covariate must be NUMERIC and is usually the pre-test. Do not confuse the covariate with the group column.",
    },
  }),
  kismikorelasyon: (o) => ({
    satir: { tr: "Her satır bir kişi; iki değişken ve kontrol değişken(ler)i aynı satırda.", en: "Each row is one person; the two variables and the control variable(s) sit in the same row." },
    sutunlar: [
      KATILIMCI,
      sayiSutun("Değişken 1", "Variable 1", PUAN),
      sayiSutun("Değişken 2", "Variable 2", PUAN2),
      ...coklu((i) => `Kontrol ${i}`, (i) => `Control ${i}`, Math.max(o.kovaryatSayisi, 1), () => YAS),
    ],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Kontrol değişkeni de sayısal olmalı; kategorik bir değişkeni kontrol etmek için önce kodlayın.",
      en: "The control variable must also be numeric; to control for a categorical variable, code it first.",
    },
  }),
  mcnemar: () => ({
    satir: { tr: "Her satır bir kişi; aynı kişinin ÖNCEKİ ve SONRAKİ iki kategorili yanıtı aynı satırda.", en: "Each row is one person; that person's BEFORE and AFTER two-category answers are in the same row." },
    sutunlar: [KATILIMCI, kategoriSutun("Önce", "Before", EVETHAYIR), kategoriSutun("Sonra", "After", ["hayır", "hayır", "evet", "evet"])],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Her iki sütunda da tam olarak İKİ kategori olmalı ve ikisi aynı kişiye ait olmalı. Sayım tablosu yüklemeyin.",
      en: "Both columns must hold exactly TWO categories and both must belong to the same person. Do not upload a counts table.",
    },
  }),
  lojistik: (o) => ({
    satir: { tr: "Her satır bir kişi; iki kategorili sonuç ve yordayıcılar aynı satırda.", en: "Each row is one person; the two-category outcome and the predictors sit in the same row." },
    sutunlar: [
      KATILIMCI,
      kategoriSutun("Sonuç", "Outcome", ["geçti", "kaldı", "geçti", "kaldı"]),
      ...coklu((i) => `Yordayıcı ${i}`, (i) => `Predictor ${i}`, o.yordayiciSayisi, (i) => (i === 0 ? PUAN : YAS)),
    ],
    ekranGirdileri: [
      { tr: "Hangi kategorinin “olay (1)” sayılacağı analiz ekranında seçilir; dosyada 0/1'e çevirmeniz gerekmez.", en: "Which category counts as the “event (1)” is chosen on the analysis screen; you do not need to recode to 0/1 in the file." },
    ],
    yayginHata: {
      tr: "Sonuç sütununda ikiden çok kategori olmamalı. Yordayıcılar sayısal olmalı.",
      en: "The outcome column must not hold more than two categories. Predictors must be numeric.",
    },
  }),
  faktor: (o) => ({
    satir: { tr: "Her satır bir katılımcı, her sütun bir madde.", en: "Each row is one participant, each column is one item." },
    sutunlar: [KATILIMCI, ...coklu((i) => `Madde ${i}`, (i) => `Item ${i}`, Math.max(o.maddeSayisi, 4), () => ["4", "3", "5", "2"])],
    ekranGirdileri: [
      { tr: "Faktör sayısı analiz ekranında girilir; boş bırakılırsa öz değeri 1'den büyük faktörler alınır.", en: "The number of factors is entered on the analysis screen; left blank, factors with eigenvalues above 1 are taken." },
    ],
    yayginHata: {
      tr: "Katılımcı sayısı madde sayısından belirgin biçimde çok olmalı; birkaç satırla faktör çözümü anlamsızdır.",
      en: "You need clearly more participants than items; a factor solution from a handful of rows is meaningless.",
    },
  }),
  karmaanova: (o) => ({
    satir: { tr: "Her satır bir kişi; grup bir sütunda, her ölçüm ayrı sütunda.", en: "Each row is one person; the group in one column, each measurement in its own column." },
    sutunlar: [
      KATILIMCI,
      kategoriSutun("Grup", "Group", GRUP2),
      ...coklu((i) => `Ölçüm ${i}`, (i) => `Measurement ${i}`, Math.max(o.olcumSayisi, 2), (i) => [PUAN, PUAN2, PUAN3][i % 3]),
    ],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Deney ve kontrol grubunu AYRI DOSYALARA ya da ayrı sütunlara ayırmayın; grup tek sütunda kategori olarak durmalı.",
      en: "Do not split the treatment and control groups into SEPARATE FILES or separate columns; the group belongs in one column as a category.",
    },
  }),
  aracilik: (o) => ({
    satir: {
      tr: "Her satır bir kişi; bağımsız değişken (X), aracı(lar) (M) ve sonuç (Y) aynı satırda.",
      en: "Each row is one person; the independent variable (X), mediator(s) (M) and outcome (Y) sit in the same row.",
    },
    sutunlar: [
      KATILIMCI,
      sayiSutun("X (bağımsız)", "X (independent)", PUAN),
      ...coklu(
        (i) => (o.araciSayisi > 1 ? `M${i} (aracı)` : "M (aracı)"),
        (i) => (o.araciSayisi > 1 ? `M${i} (mediator)` : "M (mediator)"),
        o.araciSayisi,
        () => PUAN2,
        "sayi",
        1,
      ),
      sayiSutun("Y (sonuç)", "Y (outcome)", PUAN3, o.ciktiY),
    ],
    ekranGirdileri: [
      { tr: "İki ya da daha çok aracı seçerseniz modelin türü (paralel / seri) ve seri modelde zincirin sırası ekranda belirlenir.", en: "If you select two or more mediators, the model type (parallel / serial) and, for a serial model, the order of the chain are set on screen." },
    ],
    yayginHata: {
      tr: "X, M ve Y'nin üçü de SAYISAL olmalı ve üçü aynı kişiden gelmelidir.",
      en: "X, M and Y must all be NUMERIC and must all come from the same person.",
    },
  }),
  duzenleyicilik: (o) => ({
    satir: { tr: "Her satır bir kişi; bağımsız değişken (X), düzenleyici (W) ve sonuç (Y) aynı satırda.", en: "Each row is one person; the independent variable (X), moderator (W) and outcome (Y) sit in the same row." },
    sutunlar: [
      KATILIMCI,
      sayiSutun("X (bağımsız)", "X (independent)", PUAN),
      sayiSutun("W (düzenleyici)", "W (moderator)", PUAN2),
      sayiSutun("Y (sonuç)", "Y (outcome)", PUAN3, o.ciktiY),
    ],
    ekranGirdileri: [],
    yayginHata: {
      tr: "Etkileşim terimini kendiniz hesaplayıp sütun olarak eklemeyin; ArvoLab değişkenleri merkezileyip çarpımı kendisi kurar.",
      en: "Do not compute the interaction term yourself and add it as a column; ArvoLab centres the variables and builds the product itself.",
    },
  }),
  dfa: (o) => ({
    satir: { tr: "Her satır bir katılımcı, her sütun bir madde.", en: "Each row is one participant, each column is one item." },
    sutunlar: [KATILIMCI, ...coklu((i) => `Madde ${i}`, (i) => `Item ${i}`, Math.max(o.maddeSayisi, 4), () => ["4", "3", "5", "2"])],
    ekranGirdileri: [
      { tr: "Faktör yapısı (hangi madde hangi faktöre yüklenecek) analiz ekranında kurulur; dosyada yer almaz.", en: "The factor structure (which item loads on which factor) is set up on the analysis screen; it is not part of the file." },
    ],
    yayginHata: {
      tr: "Her faktörde en az üç madde bulunmalı; iki maddeli bir faktör tek başına tanımlanamaz.",
      en: "Each factor needs at least three items; a two-item factor is not identified on its own.",
    },
  }),
};

const VARSAYILAN: Required<RehberSecenekleri> = {
  ikinciFaktor: false,
  ciktiY: true,
  olcumSayisi: 3,
  maddeSayisi: 3,
  kovaryatSayisi: 1,
  yordayiciSayisi: 2,
  araciSayisi: 1,
};

/** Analizin veri rehberi; seçenekler veri düzenini değiştiriyorsa ona göre. */
export function veriRehberi(tur: AnalizTuru, secenek: RehberSecenekleri = {}): VeriRehberi {
  const kurucu = KURUCULAR[tur];
  if (!kurucu) throw new Error(`Veri rehberi tanımsız: ${tur}`);
  /* Seçim YOKKEN (0) rehber varsayılan düzenini gösterir. Ekran, henüz
     hiçbir sütun seçilmemişken 0 gönderiyor; bu sayıyı olduğu gibi
     almak rehberi varsayılandan küçültüyordu — güvenilirlik şablonu
     dosya yüklenmeden önce 3 değil 2 madde sütunuyla iniyordu.
     Pozitif bir sayı ise kullanıcının düzenidir, aynen geçer. */
  const sayi = (deger: number | undefined, varsayilan: number) =>
    Number.isFinite(deger) && (deger as number) > 0 ? Math.floor(deger as number) : varsayilan;
  return kurucu({
    ...VARSAYILAN,
    ...secenek,
    olcumSayisi: sayi(secenek.olcumSayisi, VARSAYILAN.olcumSayisi),
    maddeSayisi: sayi(secenek.maddeSayisi, VARSAYILAN.maddeSayisi),
    kovaryatSayisi: sayi(secenek.kovaryatSayisi, VARSAYILAN.kovaryatSayisi),
    yordayiciSayisi: sayi(secenek.yordayiciSayisi, VARSAYILAN.yordayiciSayisi),
    araciSayisi: sayi(secenek.araciSayisi, VARSAYILAN.araciSayisi),
  });
}

/** Rehberi olan analizler: kapsam testinin okuduğu liste. */
export const REHBERLI_ANALIZLER = ANALIZ_TURLERI.filter((t) => t in KURUCULAR);

/** Örnek tablonun ve boş şablonun ORTAK sütun başlıkları. */
export function rehberBasliklari(rehber: VeriRehberi, dil: Dil): string[] {
  return rehber.sutunlar.map((x) => (dil === "en" ? x.ad.en : x.ad.tr));
}

const varsayilanOrnek = (tur: HucreTuru, i: number): string =>
  tur === "sayi" ? String(60 + i * 7) : tur === "etiket" ? `K${i + 1}` : ["A", "B", "A", "B"][i % 4];

/** Örnek tablonun satırları: sütun tanımlarından üretiliyor. */
export function rehberOrnekSatirlari(rehber: VeriRehberi, dil: Dil, satir = 4): string[][] {
  return Array.from({ length: satir }, (_, i) =>
    rehber.sutunlar.map((x) => {
      if (!x.ornek) return varsayilanOrnek(x.tur, i);
      if (x.tur !== "kategori") return x.ornek[i % x.ornek.length];
      /* Kategorik örnekler dile göre: Türkçe tabloda Türkçe kategoriler. */
      const en = EN_KATEGORI.get(x.ornek.join("|"));
      const liste = en ? kategoriOrnegi(x.ornek, en, dil) : x.ornek;
      return liste[i % liste.length];
    }),
  );
}

/* Türkçe kategori örneklerinin İngilizce karşılıkları. */
const EN_KATEGORI = new Map<string, string[]>([
  [GRUP2.join("|"), GRUP2EN],
  [GRUP3.join("|"), GRUP3EN],
  [EVETHAYIR.join("|"), EVETHAYIREN],
  [["hayır", "hayır", "evet", "evet"].join("|"), ["no", "no", "yes", "yes"]],
  [["kadın", "erkek", "kadın", "erkek"].join("|"), ["female", "male", "female", "male"]],
  [["geçti", "kaldı", "geçti", "kaldı"].join("|"), ["passed", "failed", "passed", "failed"]],
]);

/** Boş şablon: YALNIZCA başlık satırı. */
export function rehberSablonCsv(rehber: VeriRehberi, dil: Dil): string {
  return `${rehberBasliklari(rehber, dil).join(",")}\n`;
}

export function rehberSablonAdi(tur: AnalizTuru, dil: Dil): string {
  return `${tur}-${dil === "en" ? "template" : "sablon"}.csv`;
}
