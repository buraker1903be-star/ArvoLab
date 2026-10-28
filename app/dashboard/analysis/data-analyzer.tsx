"use client";

import { asistanCagir } from "@/lib/asistan-istemci";
import { csvOku, excelSatirlariniDuzelt, kodluGrupSutunlari } from "@/lib/veri-okuma";
import { useState, useCallback, useMemo, useRef, useTransition } from "react";
import { UploadCloud, Play, Table as TableIcon, FileBarChart, Copy, Check, Save, ListPlus, Sparkles, Code2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { leveneTesti, normallikOlcutu } from "@/lib/stats-varsayim";
import { friedmanTesti, kruskalWallis, mannWhitneyU, spearmanKorelasyonu, wilcoxonIsaretliSiralar, YAKLASIKLIK_EN_AZ } from "@/lib/stats-parametrik-olmayan";
import { dogrusalRegresyon, katsayiAdi } from "@/lib/stats-regresyon";
import { VARSAYILAN_BICIM, type BicimKarari } from "@/lib/sayi-bicimi";
import {
  describeNumeric,
  independentTTest,
  eslestirilmisTTest,
  bonferroniKarsilastirmalari,
  oneWayAnova,
  pearsonCorrelation,
  chiSquareIndependence,
  cronbachAlpha,
  fisherKesinTesti,
  welchTTest,
  welchAnova,
  welchBonferroniKarsilastirmalari,
  frequencyTable,
  correlationMatrix,
  ETKI_YORUMU_METIN,
  type DescriptiveStats,
  type EtkiYorumu,
} from "@/lib/stats-tests-core";
import { formatP, hesaplanabilir, isSignificant, formatNumber } from "@/lib/apa-format";
import { ANALIZ_ETIKETLERI_METIN, analizBasligi, type AnalizTuru } from "@/lib/analiz-turleri";
import { analizSonucuKaydet } from "@/app/actions/analiz-sonuclari";
import { analizDenetle, type AnalizDenetimYaniti } from "@/app/actions/ai-analiz";
import { analizBetigi, ARAC_ADI_METIN, programKartlari, yontemGruplari, yontemKartlari, type AnalizAraci, type BetikSecimi } from "@/lib/analiz-betik";
import AsistanSonuc from "@/app/dashboard/_components/asistan-sonuc";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { elemeNotu, eslesenSatirlar, sayisalSutun } from "@/lib/veri-eslestirme";
import { basitEtkiler, ikiYonluAnova, type IkiYonluHata } from "@/lib/stats-iki-yonlu-anova";
import { gamesHowell, tukeyHSD } from "@/lib/stats-tukey";
import { shapiroWilk } from "@/lib/stats-shapiro";
import { ancova, karmaAnova, tekOrneklemTTest, tekrarliIkiliKarsilastirmalar, tekrarliOlcumlerAnova } from "@/lib/stats-anova-ek";
import ProfilGrafigi from "./profil-grafigi";
import { aracilik, cokluAracilik, duzenleyicilik, PARALEL_EN_COK, SERI_EN_COK } from "@/lib/stats-aracilik";
import { dogrulayiciFaktorAnalizi, MI_ESIGI, UYUM_YORUMU_METIN, uyumYorumu } from "@/lib/stats-dfa";
import DfaModeli from "./dfa-modeli";
import { kismiKorelasyon, mcnemar } from "@/lib/stats-iliski";
import { lojistikRegresyon, type LojistikHata } from "@/lib/stats-lojistik";
import { aciklayiciFaktorAnalizi, kmoYorumu, maddeUyarisi } from "@/lib/stats-faktor";
import { sayisalMi } from "@/lib/veri-eslestirme";
import SutunSecimi from "./sutun-secimi";
import VeriHazirlama from "./veri-hazirlama";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import type { Metin } from "@/lib/dil";

type CellValue = string | number | null;
type DataRow = Record<string, CellValue>;

interface ParsedDataset {
  columns: string[];
  rows: DataRow[];
  numericColumns: string[];
  categoricalColumns: string[];
}

/* Etiketler geçmiş listesinde de kullanılıyor; tek yerde (lib/analiz-turleri.ts). */
type AnalysisType = AnalizTuru;
const ANALYSIS_LABELS = ANALIZ_ETIKETLERI_METIN;

/* Hesaplanamama sebepleri kullanıcı diline çevriliyor; sayı uydurulmuyor. */
const IKI_YONLU_HATA: Record<IkiYonluHata, Metin> = {
  "az-duzey": {
    tr: "İki yönlü ANOVA için her iki faktörde de en az 2 kategori olmalıdır.",
    en: "A two-way ANOVA requires at least 2 categories in each factor.",
  },
  "bos-hucre": {
    tr: "Faktörlerin bazı kesişimlerinde hiç gözlem yok. Etkileşim o hücrede tanımsız olduğu için analiz yapılamaz; kategorileri birleştirin ya da veriyi tamamlayın.",
    en: "Some combinations of the factors have no observations. The interaction is undefined in that cell, so the analysis cannot be run; merge categories or complete the data.",
  },
  "az-gozlem": {
    tr: "Hücre başına yeterli gözlem yok: hata serbestlik derecesi kalmıyor.",
    en: "Not enough observations per cell: no error degrees of freedom remain.",
  },
  tekil: {
    tr: "Model çözülemedi; faktör düzeyleri birbirini tam olarak belirliyor olabilir.",
    en: "The model could not be solved; the factor levels may fully determine each other.",
  },
};

function isNumericValue(v: CellValue): boolean {
  if (v === null || v === "") return false;
  return !isNaN(Number(v));
}

function detectColumnTypes(columns: string[], rows: DataRow[]) {
  const numericColumns: string[] = [];
  const categoricalColumns: string[] = [];
  for (const col of columns) {
    const values = rows.map((r) => r[col]).filter((v) => v !== null && v !== "");
    if (values.length === 0) continue;
    const numericCount = values.filter(isNumericValue).length;
    if (numericCount / values.length > 0.9) {
      numericColumns.push(col);
    } else {
      categoricalColumns.push(col);
    }
  }
  return { numericColumns, categoricalColumns };
}

/*
  Tanımsız sonuç bozuk veri DEĞİL, gerçek veride sık karşılaşılan bir
  durum: bir grubun bütün değerleri aynıysa varyans sıfır ve t = 0/0 = NaN.
  Eskiden bu değer olduğu gibi biçimlendiriliyor, ekranda tezе
  yapıştırılabilir görünümde bir satır çıkıyordu:

      t(4) = NaN, p = NaN — istatistiksel olarak anlamlı değil

  İkinci yarısı daha sinsiydi: isSignificant(NaN) false döndüğü için ürün
  HESAPLANAMAMIŞ bir testi "anlamlı değil" diye raporluyordu. Artık neden
  hesaplanamadığı söyleniyor; kullanıcı verisine bakabilsin.
*/
const DEGISKENLIK_YOK: Metin = {
  tr: "Test hesaplanamadı: seçilen veride değişkenlik yok. Bir grubun (ya da maddenin) bütün değerleri aynıysa varyans sıfır olur ve test tanımsız kalır. Veriyi ve grup seçimini kontrol edin.",
  en: "The test could not be computed: the selected data has no variability. If all values of a group (or item) are identical, the variance is zero and the test is undefined. Check the data and the grouping variable.",
};

const BEKLENEN_SIFIR: Metin = {
  tr: "Test hesaplanamadı: çapraz tabloda tamamen boş bir satır ya da sütun var (beklenen değer sıfır). Kullanılmayan kategorileri çıkarıp tekrar deneyin.",
  en: "The test could not be computed: the contingency table has an entirely empty row or column (expected count of zero). Remove unused categories and try again.",
};

export default function DataAnalyzer({
  calismalar = [],
  secilenCalisma = "",
  pencere,
}: {
  calismalar?: { id: string; title: string; sayiBicimi?: BicimKarari }[];
  /* Çalışma merkezinden gelindiyse sonuç o çalışmaya kaydedilsin. */
  secilenCalisma?: string;
  /*
    Çalışmalarım kartının Analiz penceresi (analiz-penceresi.tsx). Her şey
    TEK YERDE: dosya bir kez yüklenir, yöntem kartla seçilir, sonuç
    hesaplanınca asistan kendiliğinden okur, "Teze ekleme sırasına koy"
    ile sıraya girer. Çalışma sabit; sayfadaki kapsamlı rapor ve çalışma
    seçici gizlenir.

    Eskiden (ilk sürüm, aynı gün) önce program (SPSS/R/Python) sonra yöntem
    seçiliyor, yöntem iç pencerede açılıyor ve her yöntemde dosya yeniden
    yükleniyordu. Kurum sahibi: "öğrencileri oraya buraya yönlendirmek
    istemiyorum". Program seçimi öğrenciye "analizi o programda yapacaksın"
    izlenimi veriyordu; oysa hesap burada yapılıyor. Betik artık sonucun
    altında isteğe bağlı, kapalı bir bölüm.
  */
  pencere?: { asistanAcik: boolean };
}) {
  const router = useRouter();
  const t = useCeviri();
  const dil = useDil();
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  /* Okuma kararları ("ondalık virgül olarak okundu"): sessiz tahmin olmasın. */
  const [veriNotlari, setVeriNotlari] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /*
    SAYININ YAZILIŞI SEÇİLİ ÇALIŞMANIN KILAVUZUNDAN gelir. Önce
    yalnızca SPSS yapıştırma aracı kılavuza uyuyordu ve bu motor
    APA'ya sabitti: aynı ekranda iki farklı biçim üretiliyordu.
  */
  const [analysisType, setAnalysisType] = useState<AnalysisType>("descriptives");
  const [varA, setVarA] = useState("");
  const [varB, setVarB] = useState("");
  const [groupVar, setGroupVar] = useState("");
  /* İki yönlü ANOVAnun ikinci faktörü. */
  const [groupVar2, setGroupVar2] = useState("");
  const [reliabilityItems, setReliabilityItems] = useState<string[]>([]);
  /* Regresyonun yordayıcıları; bağımlı değişken varA. */
  const [yordayicilar, setYordayicilar] = useState<string[]>([]);
  /* Friedman'ın tekrarlı ölçümleri (sütunlar, seçim sırasıyla). */
  const [olcumler, setOlcumler] = useState<string[]>([]);
  /* 27.10.2026'da eklenen analizlerin seçimleri. */
  const [testDegeri, setTestDegeri] = useState("3");
  const [kovaryatlar, setKovaryatlar] = useState<string[]>([]);
  const [olayDegeri, setOlayDegeri] = useState("");
  const [faktorSayisi, setFaktorSayisi] = useState("");
  /* Aracılık/düzenleyicilikte sonuç (Y); DFA'da faktör–madde tanımı. */
  const [varY, setVarY] = useState("");
  /* Aracılıkta bir ya da daha çok aracı ve çoklu aracının modeli. */
  const [aracilar, setAracilar] = useState<string[]>([]);
  const [araciModeli, setAraciModeli] = useState<"paralel" | "seri">("paralel");
  const [dfaFaktorleri, setDfaFaktorleri] = useState<{ ad: string; maddeler: string[] }[]>([
    { ad: "F1", maddeler: [] },
    { ad: "F2", maddeler: [] },
  ]);
  /* DFA'da serbest bırakılan hata kovaryansları (madde adı çiftleri). */
  const [dfaHataKovaryanslari, setDfaHataKovaryanslari] = useState<[string, string][]>([]);

  const [result, setResult] = useState<React.ReactNode>(null);
  /*
    Sonucun grafiği AYRI tutuluyor: kopyalanan ve teze kaydedilen metin
    sonuç kutusunun innerText'i; grafik onun içinde dursaydı eksen
    yazıları ("10.9 14.3 on son…") APA metnine karışıyordu (27.10.2026).
  */
  const [sonucGrafigi, setSonucGrafigi] = useState<React.ReactNode>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  /*
    Hesaplanan sonuç hiçbir yere yazılmıyordu: öğrenci t testini çalıştırıp
    ekrandan elle not alıyor, sayfayı yenileyince her şeyi kaybediyordu.
    Saklamak ayrı bir iş (veri de kullanıcının), ama kopyalamak bir
    düğmelik.
  */
  const sonucKutusu = useRef<HTMLDivElement>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  const sonucuKopyala = useCallback(async () => {
    const metin = sonucKutusu.current?.innerText?.trim();
    if (!metin) return;
    try {
      await navigator.clipboard.writeText(metin);
      setKopyalandi(true);
      window.setTimeout(() => setKopyalandi(false), 2000);
    } catch {
      // Pano izni yoksa sessiz kalınmıyor: kullanıcı neden olmadığını bilsin.
      setResultError(t({ tr: "Panoya kopyalanamadı. Metni seçip elle kopyalayabilirsiniz.", en: "Could not copy to the clipboard. You can select the text and copy it manually." }));
    }
  }, [t]);
  /*
    Kaydedilen sonucun künyesi ÇALIŞTIRMA ANINDA donduruluyor. Kullanıcı
    sonucu gördükten sonra değişken seçimini değiştirip kaydete basarsa,
    o anki seçimden üretilen başlık ekrandaki sayıyla uyuşmazdı — kayıt
    yanlış analizin adıyla saklanırdı.
  */
  /* Seçim de donduruluyor: betik, ekrandaki sonucu üreten değişkenlerle yazılmalı. */
  const [calisanAnaliz, setCalisanAnaliz] = useState<{ tur: AnalysisType; baslik: string; secim: BetikSecimi } | null>(null);
  const [kayitCalismasi, setKayitCalismasi] = useState(secilenCalisma);

  /*
    Biçim, sonucun KAYDEDİLECEĞİ çalışmadan alınıyor: kullanıcı
    sonucu hangi tezine yazacaksa onun kılavuzu geçerli. Çalışma
    seçilmemişse varsayılan uygulanıyor ve bu ekranda söyleniyor.
  */
  /* useMemo şart: nesne her render'da yeniden kurulsaydı aşağıdaki
     geri çağırmaların bağımlılıkları da her render'da değişir ve
     ağır analiz hesabı boşuna yeniden kurulurdu (lint uyarısı). */
  /*
    İngilizce arayüzde ondalık ayırıcı NOKTA. Kılavuzun virgül kuralı
    Türkçe yazımın kuralı; İngilizce rapor cümlesinin içine "2,45"
    yazmak okuru yanıltır (İngilizcede virgül binlik ayırıcıdır).
    Baştaki sıfır kararı kılavuzdan gelmeye devam ediyor.
  */
  const bicim: BicimKarari = useMemo(() => {
    const secili = calismalar.find((c) => c.id === kayitCalismasi)?.sayiBicimi ?? {
      ...VARSAYILAN_BICIM,
      kaynak: "varsayilan" as const,
    };
    return dil === "en" ? { ...secili, ayirici: "period" } : secili;
  }, [calismalar, kayitCalismasi, dil]);
  const yazP = useCallback((p: number) => formatP(p, bicim), [bicim]);
  const yazSayi = useCallback(
    (n: number, basamak = 2, sinirli = false) => formatNumber(n, basamak, bicim, sinirli),
    [bicim],
  );
  /* Yüzde işareti Türkçede sayının önünde (%12,5), İngilizcede arkasında (12.5%). */
  const yazYuzde = useCallback(
    (n: number, basamak = 1) => (dil === "en" ? `${formatNumber(n, basamak, bicim)}%` : `%${formatNumber(n, basamak, bicim)}`),
    [bicim, dil],
  );
  /* Sık geçen rapor parçaları; iki dilde tek yerde. */
  const anlamliYaz = useCallback(
    (sig: boolean) =>
      sig
        ? t({ tr: " — istatistiksel olarak anlamlı", en: " — statistically significant" })
        : t({ tr: " — istatistiksel olarak anlamlı değil", en: " — not statistically significant" }),
    [t],
  );
  const etkiEtiketi = useCallback(
    (y: EtkiYorumu) => t({ tr: `${ETKI_YORUMU_METIN[y].tr} etki`, en: `${ETKI_YORUMU_METIN[y].en} effect` }),
    [t],
  );
  const GA95 = t({ tr: "%95 GA", en: "95% CI" });
  const SONUC_TABLOSU = t({ tr: "Analiz sonuç tablosu", en: "Analysis results table" });
  const [kaydedildi, setKaydedildi] = useState(false);
  const [kaydediliyor, kaydetmeyiBaslat] = useTransition();

  const sonucuKaydet = useCallback((tezeEklenecek = false) => {
    const metin = sonucKutusu.current?.innerText?.trim();
    if (!metin || !calisanAnaliz) return;
    kaydetmeyiBaslat(async () => {
      const sonuc = await analizSonucuKaydet({
        analizTuru: calisanAnaliz.tur,
        baslik: calisanAnaliz.baslik,
        apaMetni: metin,
        projectId: kayitCalismasi || null,
        tezeEklenecek,
      });
      if ("error" in sonuc && sonuc.error) {
        // Sessiz düşmüyor: kullanıcı kaydettiğini sanıp sekmeyi kapatmasın.
        setResultError(sonuc.error);
        return;
      }
      setKaydedildi(true);
      if (pencere) {
        showToast(
          "success",
          tezeEklenecek
            ? t({ tr: "Teze ekleme sırasına kondu; editörde \"Analiz ekle\" ile ekleyin.", en: "Queued for the thesis; add it in the editor with \"Add analysis\"." })
            : t({ tr: "Sonuç kaydedildi.", en: "Result saved." }),
        );
        // Penceredeki sıra listesi ve karttaki sayı sunucudan geliyor.
        router.refresh();
      } else {
        showToast("success", t({ tr: "Sonuç kaydedildi; aşağıdaki geçmişte duruyor.", en: "Result saved; you can find it in the history below." }));
      }
    });
  }, [calisanAnaliz, kayitCalismasi, pencere, router, t]);

  /*
    ASİSTAN YORUMU: hesap tarayıcıda yapıldı, asistan yalnızca çıktıyı
    denetler (eksik etki büyüklüğü, varsayım, raporlama biçimi). Yeni
    sayı üretemez; ürettiği anda cevap düşer (lib/ai/bulgu.ts). Sonuç
    her değişince eski yorum silinir — başka analizin yorumu yanlış
    sonucun altında kalmasın.
  */
  const [yorum, setYorum] = useState<AnalizDenetimYaniti | null>(null);
  const [yorumBekleniyor, yorumuBaslat] = useTransition();
  const yorumIste = useCallback(
    (baslik: string, zorla: boolean) => {
      const metin = sonucKutusu.current?.innerText?.trim();
      if (!metin) return;
      yorumuBaslat(async () => {
        setYorum(null);
        setYorum(
          await asistanCagir(() => analizDenetle({
            istatistikMetni: metin,
            projectId: kayitCalismasi || null,
            yontem: baslik,
            zorla,
          }), dil),
        );
      });
    },
    [kayitCalismasi, dil],
  );
  const [betikKopyalandi, setBetikKopyalandi] = useState(false);
  const [betikAraci, setBetikAraci] = useState<AnalizAraci>("spss");
  const betik = pencere && calisanAnaliz ? analizBetigi(betikAraci, calisanAnaliz.tur, calisanAnaliz.secim, dil) : null;

  const [fullReport, setFullReport] = useState<React.ReactNode>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setParseError(null);
    setDataset(null);
    setResult(null);
    try {
      const bayt = new Uint8Array(await file.arrayBuffer());
      /*
        Metin dosyaları (CSV/TSV) kendi okuyucumuzdan geçiyor: kodlama,
        ayırıcı ve ondalık kararı dosya başına (lib/veri-okuma.ts). SheetJS
        Türkçe Excel'in noktalı virgüllü CSV'sinde "3,5"i 35 okuyordu.
      */
      let okunan;
      if (/\.(csv|tsv|txt)$/i.test(file.name)) {
        okunan = csvOku(bayt, dil);
      } else {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(bayt, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const ham = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
        okunan = excelSatirlariniDuzelt(ham.length ? Object.keys(ham[0]) : [], ham, dil);
      }
      const columns = okunan.sutunlar;
      const json = okunan.satirlar as DataRow[];

      if (json.length === 0) {
        setParseError(t({ tr: "Dosyada okunabilir veri bulunamadı.", en: "No readable data was found in the file." }));
        return;
      }

      const { numericColumns, categoricalColumns } = detectColumnTypes(columns, json);

      setDataset({ columns, rows: json, numericColumns, categoricalColumns });
      setVeriNotlari(okunan.notlar);
      setFileName(file.name);
      setVarA(numericColumns[0] ?? "");
      setVarB(numericColumns[1] ?? numericColumns[0] ?? "");
      setGroupVar(categoricalColumns[0] ?? kodluGrupSutunlari(numericColumns, json)[0] ?? "");
    } catch (err) {
      console.error(err);
      setParseError(t({ tr: "Dosya okunamadı. Lütfen geçerli bir .xlsx, .xls veya .csv dosyası yükleyin.", en: "The file could not be read. Please upload a valid .xlsx, .xls or .csv file." }));
    } finally {
      setLoading(false);
    }
  }, [dil, t]);

  /*
    Grup değişkeni olabilecek sütunlar: kategorikler + sayıyla kodlanmış
    gruplar (Cinsiyet 1/2, Sınıf 1/2/3; lib/veri-okuma.ts). SPSS'ten gelen
    veride gruplar hep sayıyla kodlu; eskiden bu sütunlar yalnızca sayısal
    sayıldığı için t-testi, ANOVA ve ki-karenin grup listesi boş kalıyordu.
  */
  const grupSutunlari = useMemo(
    () => (dataset ? [...dataset.categoricalColumns, ...kodluGrupSutunlari(dataset.numericColumns, dataset.rows)] : []),
    [dataset],
  );

  const groupLevels = useMemo(() => {
    if (!dataset || !groupVar) return [];
    const set = new Set<string>();
    dataset.rows.forEach((r) => {
      const v = r[groupVar];
      if (v !== null && v !== "") set.add(String(v));
    });
    return [...set];
  }, [dataset, groupVar]);

  /*
    İKİ DEĞERLİ SÜTUNLAR (McNemar, lojistik regresyonun bağımlısı).
    0/1 kodlanmış bir sütun sayısal sayılıyor ve kategorik listede
    görünmüyordu; burada türüne bakılmaz, yalnızca iki farklı değer
    taşıması aranır.
  */
  const ikiDegerliSutunlar = useMemo(() => {
    if (!dataset) return [] as { ad: string; degerler: string[] }[];
    return dataset.columns.flatMap((ad) => {
      const degerler = new Set<string>();
      for (const r of dataset.rows) {
        const v = r[ad];
        if (v === null || v === "") continue;
        degerler.add(String(v));
        if (degerler.size > 2) return [];
      }
      return degerler.size === 2 ? [{ ad, degerler: [...degerler].sort() }] : [];
    });
  }, [dataset]);

  // Her ikisi de yalnızca dataset'e kapanıyor; useCallback ile kimlikleri
  // dataset değiştiğinde değişiyor. Aşağıdaki iki useCallback zaten dataset'e
  // bağlı olduğu için davranış aynı — bağımlılık listeleri artık eksiksiz.
  const getNumericColumn = useCallback((col: string): number[] => {
    if (!dataset) return [];
    return dataset.rows
      .map((r) => r[col])
      .filter((v) => v !== null && v !== "" && !isNaN(Number(v)))
      .map(Number);
  }, [dataset]);

  /*
    EŞLEŞTİRİLMİŞ analizler satır hizasını korumak ZORUNDA.
    getNumericColumn her sütunu ayrı okuyup boşları attığı için sütunlar
    kısalıyor ve kalanlar başa kayıyordu; iki sütunu en kısa olanın
    boyuna kesmek 2. kişinin ön testini 1. kişinin son testiyle
    eşleştiriyordu (bkz. lib/veri-eslestirme.ts).
  */
  const eslesenSutunlar = useCallback(
    (...sutunAdlari: string[]) => eslesenSatirlar(dataset?.rows ?? [], sutunAdlari),
    [dataset],
  );

  const getGroupedNumeric = useCallback((numericCol: string, groupCol: string): Map<string, number[]> => {
    const map = new Map<string, number[]>();
    if (!dataset) return map;
    dataset.rows.forEach((r) => {
      const g = r[groupCol];
      const v = r[numericCol];
      if (g === null || g === "" || v === null || v === "" || isNaN(Number(v))) return;
      const key = String(g);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(Number(v));
    });
    return map;
  }, [dataset]);

  const handleGenerateFullReport = useCallback(() => {
    if (!dataset) return;
    setFullReport(null);

    const numericSections = dataset.numericColumns.map((col) => {
      const stats = describeNumeric(getNumericColumn(col));
      return { col, stats };
    });

    const categoricalSections = dataset.categoricalColumns.map((col) => {
      const values = dataset.rows
        .map((r) => r[col])
        .filter((v): v is string | number => v !== null && v !== "");
      return { col, freq: frequencyTable(values) };
    });

    /* Sütunlar TAM boyda (eksik hücre null): matris her çifti kendi
       içinde eşleştiriyor. Boşları atılmış sütunlarda tek bir eksik
       hücre o sütunun girdiği bütün çiftleri kaydırıyordu. */
    const numericForMatrix = dataset.numericColumns.map((col) => ({
      name: col,
      values: sayisalSutun(dataset.rows, col),
    }));
    const matrix = numericForMatrix.length >= 2 ? correlationMatrix(numericForMatrix) : [];

    setFullReport(
      <div className="stack">
        {numericSections.length > 0 && (
          <div>
            <h3 className="result-heading">
              {t({ tr: "1. Betimsel İstatistikler (Sayısal Değişkenler)", en: "1. Descriptive Statistics (Numeric Variables)" })}
            </h3>
            <div className="table-scroll" role="region" aria-label={SONUC_TABLOSU} tabIndex={0}>
            <table className="stats-result-table">
              <thead>
                <tr>
                  <th>{t({ tr: "Değişken", en: "Variable" })}</th>
                  <th>N</th>
                  <th>{t({ tr: "Ortalama", en: "M" })}</th>
                  <th>{t({ tr: "SS", en: "SD" })}</th>
                  <th>Min</th>
                  <th>{t({ tr: "Maks", en: "Max" })}</th>
                  <th>{t({ tr: "Medyan", en: "Median" })}</th>
                </tr>
              </thead>
              <tbody>
                {numericSections.map(({ col, stats }) => (
                  <tr key={col}>
                    <td>{col}</td>
                    <td>{stats.n}</td>
                    <td>{yazSayi(stats.mean)}</td>
                    <td>{yazSayi(stats.sd)}</td>
                    <td>{yazSayi(stats.min)}</td>
                    <td>{yazSayi(stats.max)}</td>
                    <td>{yazSayi(stats.median)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {categoricalSections.length > 0 && (
          <div>
            <h3 className="result-heading">
              {t({ tr: "2. Frekans Tabloları (Kategorik Değişkenler)", en: "2. Frequency Tables (Categorical Variables)" })}
            </h3>
            {categoricalSections.map(({ col, freq }) => (
              <div key={col} className="result-block">
                <p className="result-heading text-sm">{col}</p>
                <div className="table-scroll" role="region" aria-label={SONUC_TABLOSU} tabIndex={0}>
                <table className="stats-result-table">
                  <thead>
                    <tr>
                      <th>{t({ tr: "Değer", en: "Value" })}</th>
                      <th>{t({ tr: "Frekans", en: "Frequency" })}</th>
                      <th>{t({ tr: "Yüzde", en: "Percent" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freq.map((f) => (
                      <tr key={f.value}>
                        <td>{f.value}</td>
                        <td>{f.count}</td>
                        <td>{yazYuzde(f.percent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {matrix.length > 0 && (
          <div>
            <h3 className="result-heading">
              {t({ tr: "3. Korelasyon Matrisi (Sayısal Değişken Çiftleri)", en: "3. Correlation Matrix (Pairs of Numeric Variables)" })}
            </h3>
            <div className="table-scroll" role="region" aria-label={SONUC_TABLOSU} tabIndex={0}>
            <table className="stats-result-table">
              <thead>
                <tr>
                  <th>{t({ tr: "Değişken 1", en: "Variable 1" })}</th>
                  <th>{t({ tr: "Değişken 2", en: "Variable 2" })}</th>
                  <th>r</th>
                  <th>p</th>
                  <th>N</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((c, i) => {
                  const sig = isSignificant(c.p);
                  return (
                    <tr key={i}>
                      <td>{c.varA}</td>
                      <td>{c.varB}</td>
                      <td className={sig ? "stats-significant" : undefined}>
                        {yazSayi(c.r)}
                      </td>
                      <td>{yazP(c.p)}</td>
                      <td>{c.n}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <p className="hint">
              {t({ tr: "Yeşil/kalın satırlar p < .05 düzeyinde istatistiksel olarak anlamlıdır.", en: "Green/bold rows are statistically significant at p < .05." })}
            </p>
          </div>
        )}

        {numericSections.length === 0 && categoricalSections.length === 0 && (
          <p className="muted text-base">
            {t({ tr: "Rapor oluşturmak için okunabilir sayısal veya kategorik sütun bulunamadı.", en: "No readable numeric or categorical columns were found to build a report." })}
          </p>
        )}
      </div>
    );
  }, [dataset, getNumericColumn, yazSayi, yazP, yazYuzde, SONUC_TABLOSU, t]);

  const handleRunAnalysis = useCallback(() => {
    if (!dataset) return;
    setResultError(null);
    setResult(null);
    setSonucGrafigi(null);
    setKaydedildi(false);
    setYorum(null);
    const baslik = analizBasligi(
      analysisType,
      {
      varA,
      varB: analysisType === "aracilik" ? aracilar.join(araciModeli === "seri" ? " → " : " + ") : varB,
      groupVar,
      /* Regresyonda "madde sayısı" yordayıcı sayısıdır; başlık
         tek kaynaktan üretiliyor (lib/analiz-turleri). */
      maddeSayisi:
        analysisType === "regression" || analysisType === "lojistik"
          ? yordayicilar.filter((c) => c !== varA).length
          : analysisType === "friedman" || analysisType === "tekrarlianova" || analysisType === "karmaanova"
            ? olcumler.length
            : analysisType === "dfa"
              ? dfaFaktorleri.reduce((t, f) => t + f.maddeler.length, 0)
            : reliabilityItems.length,
      testDegeri: analysisType === "tekorneklem" ? Number(testDegeri.replace(",", ".")) : undefined,
      varY,
      },
      dil,
    );
    /*
      ASİSTAN KENDİLİĞİNDEN OKUR (yalnızca pencerede): öğrenci ayrıca
      düğme aramasın. Sonuç bu olay bittikten sonra çiziliyor; zamanlayıcı
      çizilmiş metni okusun diye. Hesap hatayla bittiyse sonuç kutusu
      yoktur ve asistana hiçbir şey gitmez. Aynı sonuç ikinci kez
      sorulursa kayıtlı cevap gelir, saatlik hak yanmaz.
    */
    if (pencere?.asistanAcik) window.setTimeout(() => yorumIste(baslik, false), 0);
    setCalisanAnaliz({
      secim: {
        varA, varB, groupVar, groupVar2,
        maddeler: analysisType === "friedman" || analysisType === "tekrarlianova" || analysisType === "karmaanova" ? olcumler : reliabilityItems,
        yordayicilar: yordayicilar.filter((c) => c !== varA),
        kovaryatlar: kovaryatlar.filter((c) => c !== varA && c !== varB && c !== varY),
        testDegeri: Number(testDegeri.replace(",", ".")),
        faktorSayisi: Number(faktorSayisi) > 0 ? Number(faktorSayisi) : undefined,
        varY,
        dfaFaktorleri: dfaFaktorleri.filter((f) => f.maddeler.length),
        dfaHataKovaryanslari,
        aracilar: analysisType === "aracilik" ? aracilar : undefined,
        araciModeli,
        dosyaAdi: fileName, gruplar: groupLevels,
      },
      tur: analysisType,
      baslik,
    });

    try {
      if (analysisType === "descriptives") {
        const rows = dataset.numericColumns.map((col) => {
          const stats: DescriptiveStats = describeNumeric(getNumericColumn(col));
          return { col, stats };
        });
        setResult(
          <div className="table-scroll" role="region" aria-label={SONUC_TABLOSU} tabIndex={0}>
          <table className="stats-result-table">
            <thead>
              <tr>
                <th>{t({ tr: "Değişken", en: "Variable" })}</th>
                <th>N</th>
                <th>{t({ tr: "Ortalama", en: "M" })}</th>
                <th>{t({ tr: "SS", en: "SD" })}</th>
                <th>Min</th>
                <th>{t({ tr: "Maks", en: "Max" })}</th>
                <th>{t({ tr: "Medyan", en: "Median" })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ col, stats }) => (
                <tr key={col}>
                  <td>{col}</td>
                  <td>{stats.n}</td>
                  <td>{yazSayi(stats.mean)}</td>
                  <td>{yazSayi(stats.sd)}</td>
                  <td>{yazSayi(stats.min)}</td>
                  <td>{yazSayi(stats.max)}</td>
                  <td>{yazSayi(stats.median)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        );
      }

      /*
        VARSAYIM ŞERİDİ (25.10.2026).

        Parametrik testin sonucu, varsayımlar sağlanmadığında
        YANILTICI olur ama ekranda hiçbir farkı yoktu: p değeri aynı
        güvenle yazılıyordu. Şerit sonucun YANINDA duruyor — yerine
        değil. Kararı kullanıcı veriyor; asistanın "denetler, yazmaz"
        ilkesinin istatistik karşılığı.
      */
      const varsayimSeridi = (gruplar: number[][], adlar: string[]) => {
        const normallik = gruplar.map((g, i) => ({ ad: adlar[i], olcut: normallikOlcutu(g), sw: shapiroWilk(g) }));
        /* Tek dizide (eşleştirilmiş farklar, tek örneklem) karşılaştırılacak
           varyans yok; Levene yazılmıyor. Eskiden yazılıyor ve tanımsız F
           "varyanslar homojen değil" uyarısına dönüşebiliyordu. */
        const tekDizi = gruplar.length < 2;
        const levene = tekDizi ? null : leveneTesti(gruplar);
        const homojen = levene ? levene.homojen : true;
        const sorunlu = normallik.filter((x) => x.olcut.n >= 4 && !x.olcut.normaleYakin);
        const olculemeyen = normallik.filter((x) => x.olcut.n < 4);
        return (
          <div className="mt-sm">
            <strong>{t({ tr: "Varsayımlar", en: "Assumptions" })}</strong>
            <ul className="muted text-sm">
              {normallik.map(({ ad, olcut, sw }) => (
                <li key={ad}>
                  {ad}: {olcut.n < 4
                    ? t({ tr: "normallik ölçülemedi (dörtten az gözlem)", en: "normality could not be assessed (fewer than four observations)" })
                    : t({
                        tr: `çarpıklık ${yazSayi(olcut.carpiklik)}, basıklık ${yazSayi(olcut.basiklik)}`,
                        en: `skewness ${yazSayi(olcut.carpiklik)}, kurtosis ${yazSayi(olcut.basiklik)}`,
                      }) +
                      (olcut.normaleYakin
                        ? t({ tr: " — normale yakın", en: " — approximately normal" })
                        : t({ tr: " — normalden uzak", en: " — departs from normality" }))}
                  {hesaplanabilir(sw.w, sw.p) ? ` · Shapiro-Wilk W = ${yazSayi(sw.w, 3)}, ${yazP(sw.p)}` : ""}
                </li>
              ))}
              <li>
                {t({
                  tr: "Karar çarpıklık ve basıklığa göre (|değer| < 1,5). Shapiro-Wilk büyük örneklemde küçük sapmayı da anlamlı bulur; küçük örneklemde (n < 50) kılavuzlar onu tercih eder.",
                  en: "The decision is based on skewness and kurtosis (|value| < 1.5). In large samples Shapiro–Wilk flags even small departures as significant; in small samples (n < 50) guidelines prefer it.",
                })}
              </li>
              {levene ? (
                <li>
                  {t({ tr: "Levene (medyan)", en: "Levene's test (median)" })}: F({levene.df1}, {levene.df2}) = {yazSayi(levene.f)},{" "}
                  {yazP(levene.p)} —{" "}
                  {levene.homojen
                    ? t({ tr: "varyanslar homojen", en: "variances are homogeneous" })
                    : t({ tr: "varyanslar homojen değil", en: "variances are not homogeneous" })}
                </li>
              ) : null}
            </ul>
            {(sorunlu.length > 0 || !homojen || olculemeyen.length > 0) && (
              <p className="tone-text text-sm" data-tone="warning">
                {olculemeyen.length > 0
                  ? t({ tr: "Normallik ölçülemediği için sonucu temkinli okuyun.", en: "Normality could not be assessed, so interpret the result with caution." })
                  : sorunlu.length > 0
                    ? t({ tr: "Dağılım normalden uzak; parametrik olmayan karşılığı daha uygun olabilir.", en: "The distribution departs from normality; the nonparametric alternative may be more appropriate." })
                    : t({ tr: "Varyanslar homojen değil; eşit varyans varsaymayan bir test düşünün.", en: "Variances are not homogeneous; consider a test that does not assume equal variances." })}
              </p>
            )}
          </div>
        );
      };

      if (analysisType === "ttest") {
        if (groupLevels.length !== 2) {
          setResultError(
            t({
              tr: `Bağımsız örneklem t-testi tam olarak 2 grup gerektirir. Seçili grup değişkeninde ${groupLevels.length} farklı değer bulundu.`,
              en: `An independent-samples t test requires exactly 2 groups. The selected grouping variable has ${groupLevels.length} distinct values.`,
            }),
          );
          return;
        }
        const grouped = getGroupedNumeric(varA, groupVar);
        const [g1name, g2name] = groupLevels;
        const g1 = grouped.get(g1name) ?? [];
        const g2 = grouped.get(g2name) ?? [];
        if (g1.length < 2 || g2.length < 2) {
          setResultError(t({ tr: "Her grupta en az 2 gözlem olmalıdır.", en: "Each group must have at least 2 observations." }));
          return;
        }
        const r = independentTTest(g1, g2);
        if (!hesaplanabilir(r.t, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        /*
          VARYANSLAR AYRIŞIYORSA WELCH DE YAZILIYOR. Varsayım şeridi
          "Welch kullanılmalı" diyordu ama program Welch'i yapamıyordu:
          kullanıcıya uygulayamayacağı bir öneri veriliyordu.

          Sadece Levene düştüğünde gösteriliyor, her zaman değil: iki
          p değerini yan yana koymak "hangisi anlamlıysa onu yaz"maya
          davet eder. Varsayım sağlanıyorsa gösterilecek bir seçim yok.
        */
        const varyans = leveneTesti([g1, g2]);
        const welch = varyans.homojen ? null : welchTTest(g1, g2);
        const welchSig = welch ? isSignificant(welch.p) : false;
        setResult(
          <div>
            <p>
              <strong>{g1name}</strong>: {t({
                tr: `N=${r.n1}, Ort=${yazSayi(r.m1)}, SS=${yazSayi(r.sd1)}`,
                en: `N = ${r.n1}, M = ${yazSayi(r.m1)}, SD = ${yazSayi(r.sd1)}`,
              })}
              <br />
              <strong>{g2name}</strong>: {t({
                tr: `N=${r.n2}, Ort=${yazSayi(r.m2)}, SS=${yazSayi(r.sd2)}`,
                en: `N = ${r.n2}, M = ${yazSayi(r.m2)}, SD = ${yazSayi(r.sd2)}`,
              })}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              t({r.df}) = {yazSayi(r.t)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            {/* Etki büyüklüğü p'nin yanında: p "fark var mı"yı, d
                "fark ne kadar"ı söyler. */}
            <p className="muted text-sm">
              Cohen&apos;s d = {yazSayi(r.d)} ({etkiEtiketi(r.dYorum)}) · {t({ tr: "ortalama farkı", en: "mean difference" })}{" "}
              {yazSayi(r.fark)}, {GA95} [{yazSayi(r.altSinir)}, {yazSayi(r.ustSinir)}]
            </p>
            {welch && hesaplanabilir(welch.t, welch.p) ? (
              <div className="stats-welch">
                <p className="tone-text" data-tone={welchSig ? "success" : "warning"}>
                  {t({ tr: "Eşit varyans varsayılmadan (Welch)", en: "Equal variances not assumed (Welch)" })}: t({yazSayi(welch.df, 2)}) = {yazSayi(welch.t)}, {yazP(welch.p)}
                  {anlamliYaz(welchSig)}
                </p>
                <p className="muted text-sm">
                  {t({
                    tr: "Levene testi varyansların homojen olmadığını gösteriyor; bu satır raporlanmalıdır. Serbestlik derecesi ondalıklıdır (Welch-Satterthwaite).",
                    en: "Levene's test indicates that variances are not homogeneous; this row should be reported. The degrees of freedom are fractional (Welch–Satterthwaite).",
                  })}{" "}
                  Cohen&apos;s d = {yazSayi(welch.d)} ({etkiEtiketi(welch.dYorum)}) · {GA95} [{yazSayi(welch.altSinir)},{" "}
                  {yazSayi(welch.ustSinir)}]
                </p>
              </div>
            ) : null}
            {varsayimSeridi([g1, g2], [g1name, g2name])}
          </div>
        );
      }

      if (analysisType === "anova") {
        if (groupLevels.length < 3) {
          setResultError(
            t({
              tr: `Tek yönlü ANOVA en az 3 grup gerektirir (2 grup için t-testini kullanın). Seçili değişkende ${groupLevels.length} grup bulundu.`,
              en: `A one-way ANOVA requires at least 3 groups (use a t test for 2 groups). The selected variable has ${groupLevels.length} groups.`,
            }),
          );
          return;
        }
        const grouped = getGroupedNumeric(varA, groupVar);
        const groups = groupLevels.map((g) => grouped.get(g) ?? []);
        if (groups.some((g) => g.length < 2)) {
          setResultError(t({ tr: "Her grupta en az 2 gözlem olmalıdır.", en: "Each group must have at least 2 observations." }));
          return;
        }
        const r = oneWayAnova(groups);
        if (!hesaplanabilir(r.f, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        /*
          Üç ve daha çok grupta da varsayım şeridi "eşit varyans
          varsaymayan bir test düşünün" diyordu ve karşılığı yoktu.
          İki gruptaki gibi: yalnızca Levene düştüğünde yazılıyor.
        */
        const anovaVaryans = leveneTesti(groups);
        const welchF = anovaVaryans.homojen ? null : welchAnova(groups);
        const welchFSig = welchF ? isSignificant(welchF.p) : false;
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label={SONUC_TABLOSU} tabIndex={0}>
            <table className="stats-result-table">
              <thead>
                <tr>
                  <th>{t({ tr: "Grup", en: "Group" })}</th>
                  <th>N</th>
                  <th>{t({ tr: "Ortalama", en: "M" })}</th>
                </tr>
              </thead>
              <tbody>
                {groupLevels.map((g, i) => (
                  <tr key={g}>
                    <td>{g}</td>
                    <td>{r.groupNs[i]}</td>
                    <td>{yazSayi(r.groupMeans[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="tone-text mt-sm" data-tone={sig ? "success" : "warning"}>
              F({r.dfb}, {r.dfw}) = {yazSayi(r.f)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
                      <p className="muted text-sm">
              η² = {yazSayi(r.etaKare)} ({etkiEtiketi(r.etaYorum)})
            </p>
            {welchF && hesaplanabilir(welchF.f, welchF.p) ? (
              <div className="stats-welch">
                <p className="tone-text" data-tone={welchFSig ? "success" : "warning"}>
                  {t({ tr: "Eşit varyans varsayılmadan (Welch)", en: "Equal variances not assumed (Welch)" })}: F({welchF.df1}, {yazSayi(welchF.df2, 2)}) ={" "}
                  {yazSayi(welchF.f)}, {yazP(welchF.p)}
                  {anlamliYaz(welchFSig)}
                </p>
                <p className="muted text-sm">
                  {t({
                    tr: "Levene testi varyansların homojen olmadığını gösteriyor; bu satır raporlanmalıdır. η² burada YAZILMIYOR: kareler toplamından geliyor ve o hesap eşit varyans varsayıyor.",
                    en: "Levene's test indicates that variances are not homogeneous; this row should be reported. η² is NOT shown here: it is derived from sums of squares, which assume equal variances.",
                  })}
                </p>
              </div>
            ) : null}
            {/*
              ANOVA "en az biri farklı" diyor, hangisi olduğunu
              söylemiyordu. İkili karşılaştırma yalnızca F ANLAMLIYSA
              gösteriliyor: anlamsız bir ANOVA'nın ardından ikili
              karşılaştırma okumak, düzeltmenin koruduğu şeyi
              baştan delmek olur.

              Hangi F'e bakılacağı varyansa bağlı: varyanslar
              homojense klasik F ve ortak hata kareli Bonferroni,
              değilse Welch F ve çift başına Welch'li Bonferroni —
              ortak hata karesi zaten eşit varyans varsayıyor.
            */}
            {(welchF ? welchFSig : sig) && (() => {
              /*
                POST-HOC (27.10.2026): varyanslar homojense Tukey HSD,
                değilse Games-Howell — jürilerin ve dergilerin beklediği
                ikili. Bonferroni yanında ikinci sütun olarak kalıyor:
                temkinli taraf, ve tezde hangisini raporlayacağı
                danışmanın tercihi.
              */
              const asil = welchF ? gamesHowell(groups, groupLevels) : tukeyHSD(groups, groupLevels);
              const bonf = welchF
                ? welchBonferroniKarsilastirmalari(groups, groupLevels)
                : bonferroniKarsilastirmalari(groups, groupLevels);
              const yontem = welchF ? "Games-Howell" : "Tukey HSD";
              return (
                <div className="mt-sm">
                  <strong>
                    {t({ tr: "İkili karşılaştırmalar", en: "Pairwise comparisons" })} ({yontem}
                    {welchF ? t({ tr: ", eşit varyans varsayılmadan", en: ", equal variances not assumed" }) : ""})
                  </strong>
                  <div className="table-scroll" role="region" aria-label={t({ tr: "İkili karşılaştırmalar", en: "Pairwise comparisons" })} tabIndex={0}>
                    <table className="stats-result-table">
                      <thead>
                        <tr>
                          <th>{t({ tr: "Karşılaştırma", en: "Comparison" })}</th>
                          <th>{t({ tr: "Ortalama farkı", en: "Mean difference" })}</th>
                          <th>p ({yontem})</th>
                          <th>p (Bonferroni)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asil.map((c, i) => (
                          <tr key={`${c.a}-${c.b}`} className={c.anlamli ? "stats-significant" : undefined}>
                            <td>
                              {c.a} — {c.b}
                            </td>
                            <td>{yazSayi(c.ortalamaFarki)}</td>
                            <td>{yazP(c.p)}</td>
                            <td>{yazP(bonf[i].p)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted text-sm">
                    {welchF
                      ? t({ tr: "Varyanslar homojen olmadığı için Games-Howell raporlanmalıdır.", en: "Because variances are not homogeneous, Games–Howell should be reported." })
                      : t({ tr: "Varyanslar homojen; Tukey HSD raporlanır. Bonferroni daha temkinlidir.", en: "Variances are homogeneous; report Tukey HSD. Bonferroni is more conservative." })}
                  </p>
                </div>
              );
            })()}
            {varsayimSeridi(groups, groupLevels)}
          </div>
        );
      }

      if (analysisType === "correlation") {
        const veri = eslesenSutunlar(varA, varB);
        const [x, y] = veri.sutunlar;
        if (veri.n < 3) {
          setResultError(t({ tr: "Korelasyon için en az 3 eşleşen gözlem gereklidir.", en: "A correlation requires at least 3 paired observations." }));
          return;
        }
        const r = pearsonCorrelation(x, y);
        if (!hesaplanabilir(r.r, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              r({r.df}) = {yazSayi(r.r)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
          </div>
        );
      }

      /*
        PARAMETRİK OLMAYAN KARŞILIKLAR (25.10.2026).

        Sıralara dayandıkları için uç değerden ve çarpıklıktan
        etkilenmiyorlar; varsayım şeridi bunları önerdiğinde artık
        karşılığı var. Normallik şeridi burada ÇİZİLMİYOR: bu
        testler normallik varsaymıyor, varsaymayan bir testin
        altına normallik raporlamak kullanıcıyı yanıltırdı.
      */
      if (analysisType === "pairedttest") {
        const veri = eslesenSutunlar(varA, varB);
        const [once, sonra] = veri.sutunlar;
        if (veri.n < 3) {
          setResultError(t({ tr: "Eşleştirilmiş t-testi için en az 3 eşleşen gözlem gereklidir.", en: "A paired-samples t test requires at least 3 paired observations." }));
          return;
        }
        const r = eslestirilmisTTest(once, sonra);
        if (!hesaplanabilir(r.t, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              <strong>{varA}</strong> − <strong>{varB}</strong>:{" "}
              {t({
                tr: `N=${r.n}, fark ort.=${yazSayi(r.farkOrtalamasi)}, fark SS=${yazSayi(r.farkSS)}`,
                en: `N = ${r.n}, M difference = ${yazSayi(r.farkOrtalamasi)}, SD difference = ${yazSayi(r.farkSS)}`,
              })}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              t({r.df}) = {yazSayi(r.t)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            <p className="muted text-sm">
              Cohen&apos;s d<sub>z</sub> = {yazSayi(r.dz)} ({etkiEtiketi(r.dzYorum)}) · {GA95} [
              {yazSayi(r.altSinir)}, {yazSayi(r.ustSinir)}]
            </p>
            {/* Eşleştirilmiş testte normallik FARKLARIN dağılımına
                bakar, ölçümlerin kendisine değil. */}
            {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
            {varsayimSeridi(
              [Array.from({ length: r.n }, (_, i) => once[i] - sonra[i])],
              [t({ tr: "Farklar", en: "Differences" })],
            )}
            {/* Şerit "parametrik olmayan karşılığı" diyordu ama hangisi olduğunu
                söylemiyordu; karşılık artık programda var (27.10.2026). */}
            {(() => {
              const olcut = normallikOlcutu(Array.from({ length: r.n }, (_, i) => once[i] - sonra[i]));
              return olcut.n >= 4 && !olcut.normaleYakin ? (
                <p className="muted text-sm">
                  {t({
                    tr: "Karşılığı: “Wilcoxon İşaretli Sıralar Testi” kartı, aynı iki ölçümle.",
                    en: "Alternative: the “Wilcoxon Signed-Rank Test” card, with the same two measurements.",
                  })}
                </p>
              ) : null;
            })()}
          </div>,
        );
      }

      if (analysisType === "regression") {
        const secilen = yordayicilar.filter((c) => c !== varA);
        if (secilen.length === 0) {
          setResultError(t({ tr: "En az bir yordayıcı değişken seçin (bağımlı değişkenden farklı olmalı).", en: "Select at least one predictor (it must differ from the dependent variable)." }));
          return;
        }
        const veri = eslesenSutunlar(varA, ...secilen);
        const [y, ...sutunlar] = veri.sutunlar;
        if (veri.n < secilen.length + 2) {
          setResultError(
            t({
              tr: `Yordayıcı başına yeterli gözlem yok: ${secilen.length} yordayıcı için en az ${secilen.length + 2} eşleşen gözlem gerekiyor.`,
              en: `Not enough observations per predictor: ${secilen.length} predictor(s) require at least ${secilen.length + 2} complete observations.`,
            }),
          );
          return;
        }
        const r = dogrusalRegresyon(y, sutunlar, secilen);
        /*
          TEKİLLİK SESSİZ GEÇİLMİYOR: yordayıcılar birbirinin
          neredeyse aynısıysa katsayılar anlamsızdır ve sayı üretmek
          onları güvenilir göstermek olurdu.
        */
        if (r.tekil) {
          setResultError(
            t({
              tr: "Model kurulamadı: yordayıcılar birbirine çok benziyor (çoklu doğrusallık) ya da gözlem sayısı yetersiz.",
              en: "The model could not be estimated: the predictors are too similar to each other (multicollinearity) or there are too few observations.",
            }),
          );
          return;
        }
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              F({r.dfb}, {r.dfw}) = {yazSayi(r.f)}, {yazP(r.p)}
              {sig ? t({ tr: " — model anlamlı", en: " — the model is statistically significant" }) : t({ tr: " — model anlamlı değil", en: " — the model is not statistically significant" })}
            </p>
            <p className="muted text-sm">
              R² = {yazSayi(r.rKare)} · {t({ tr: "düzeltilmiş R²", en: "adjusted R²" })} = {yazSayi(r.duzeltilmisRKare)} · N = {r.n}
            </p>
            {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
            <div className="table-scroll" role="region" aria-label={t({ tr: "Regresyon katsayıları", en: "Regression coefficients" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{t({ tr: "Değişken", en: "Variable" })}</th>
                    <th>B</th>
                    <th>{t({ tr: "SH", en: "SE" })}</th>
                    <th>β</th>
                    <th>t</th>
                    <th>p</th>
                  </tr>
                </thead>
                <tbody>
                  {r.katsayilar.map((k) => (
                    <tr key={k.ad}>
                      <td>{katsayiAdi(k.ad, dil)}</td>
                      <td>{yazSayi(k.b)}</td>
                      <td>{yazSayi(k.standartHata)}</td>
                      <td>{Number.isNaN(k.beta) ? "—" : yazSayi(k.beta)}</td>
                      <td>{yazSayi(k.t)}</td>
                      <td>{yazP(k.p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Ham B'ler farklı birimlerde; "hangisi daha etkili"
                sorusu ancak β ile yanıtlanır. */}
            <p className="hint">
              {t({
                tr: "B ham katsayı (birim başına değişim), β standartlaştırılmış katsayı — yordayıcıları birbiriyle karşılaştırmak için β kullanın.",
                en: "B is the unstandardized coefficient (change per unit), β the standardized coefficient — use β to compare predictors with each other.",
              })}
            </p>
          </div>,
        );
      }

      if (analysisType === "mannwhitney") {
        if (groupLevels.length !== 2) {
          setResultError(
            t({
              tr: `Mann-Whitney U tam olarak 2 grup gerektirir. Seçili grup değişkeninde ${groupLevels.length} farklı değer bulundu.`,
              en: `The Mann–Whitney U test requires exactly 2 groups. The selected grouping variable has ${groupLevels.length} distinct values.`,
            }),
          );
          return;
        }
        const grouped = getGroupedNumeric(varA, groupVar);
        const [g1name, g2name] = groupLevels;
        const g1 = grouped.get(g1name) ?? [];
        const g2 = grouped.get(g2name) ?? [];
        if (g1.length < 2 || g2.length < 2) {
          setResultError(t({ tr: "Her grupta en az 2 gözlem olmalıdır.", en: "Each group must have at least 2 observations." }));
          return;
        }
        const r = mannWhitneyU(g1, g2);
        if (!hesaplanabilir(r.z, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              <strong>{g1name}</strong>: {t({ tr: `N=${r.n1}, sıra ort.=${yazSayi(r.siraOrtalamasi1)}`, en: `N = ${r.n1}, mean rank = ${yazSayi(r.siraOrtalamasi1)}` })}
              <br />
              <strong>{g2name}</strong>: {t({ tr: `N=${r.n2}, sıra ort.=${yazSayi(r.siraOrtalamasi2)}`, en: `N = ${r.n2}, mean rank = ${yazSayi(r.siraOrtalamasi2)}` })}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              U = {yazSayi(r.u)}, z = {yazSayi(r.z)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            <p className="muted text-sm">r = {yazSayi(r.etki)} ({t({ tr: "sıralara dayalı etki büyüklüğü", en: "rank-based effect size" })})</p>
            {/* Yaklaşıklık küçük örneklemde sapıyor; sessizce
                yaklaşık bir p vermek kesin sanılan bir sayı
                üretmek olurdu. */}
            {(r.n1 < YAKLASIKLIK_EN_AZ || r.n2 < YAKLASIKLIK_EN_AZ) && (
              <p className="tone-text text-sm" data-tone="warning">
                {t({
                  tr: `Gruplardan biri ${YAKLASIKLIK_EN_AZ} gözlemden küçük; p değeri büyük örneklem yaklaşıklığıyla hesaplandı ve kesin değildir.`,
                  en: `One of the groups has fewer than ${YAKLASIKLIK_EN_AZ} observations; the p value was computed with the large-sample approximation and is not exact.`,
                })}
              </p>
            )}
          </div>,
        );
      }

      /*
        WILCOXON (27.10.2026): eşleştirilmiş t-testinin parametrik olmayan
        karşılığı. Satırlar eşleştirilmiş t-testiyle AYNI yoldan hizalanır
        (eslesenSutunlar); fark yönü SPSS'teki gibi sonra − önce.
      */
      if (analysisType === "wilcoxon") {
        const veri = eslesenSutunlar(varA, varB);
        const [once, sonra] = veri.sutunlar;
        if (veri.n < 3) {
          setResultError(t({ tr: "Wilcoxon testi için en az 3 eşleşen gözlem gereklidir.", en: "The Wilcoxon test requires at least 3 paired observations." }));
          return;
        }
        const r = wilcoxonIsaretliSiralar(once, sonra);
        if (r.nEtkin === 0) {
          setResultError(t({ tr: "Test hesaplanamadı: bütün katılımcılarda iki ölçüm birbirine eşit, karşılaştırılacak fark yok.", en: "The test could not be computed: the two measurements are equal for every participant, so there is no difference to compare." }));
          return;
        }
        if (!hesaplanabilir(r.z, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              <strong>{varB}</strong> − <strong>{varA}</strong>:{" "}
              {t({
                tr: `N=${r.n} · artan ${r.artiSayisi}, azalan ${r.eksiSayisi}, eşit ${r.esitSayisi}`,
                en: `N = ${r.n} · increased ${r.artiSayisi}, decreased ${r.eksiSayisi}, ties ${r.esitSayisi}`,
              })}
              <br />
              {t({
                tr: `Pozitif sıralar toplamı = ${yazSayi(r.wArti)}, negatif sıralar toplamı = ${yazSayi(r.wEksi)}`,
                en: `Sum of positive ranks = ${yazSayi(r.wArti)}, sum of negative ranks = ${yazSayi(r.wEksi)}`,
              })}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              z = {yazSayi(r.z)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            <p className="muted text-sm">r = {yazSayi(r.etki)} ({t({ tr: "sıralara dayalı etki büyüklüğü", en: "rank-based effect size" })})</p>
            {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
            {r.esitSayisi > 0 ? (
              <p className="muted text-sm">
                {t({
                  tr: `İki ölçümü eşit olan ${r.esitSayisi} kişi teste girmez (Wilcoxon yöntemi).`,
                  en: `${r.esitSayisi} participant(s) with equal measurements are excluded from the test (Wilcoxon method).`,
                })}
              </p>
            ) : null}
            {r.nEtkin < YAKLASIKLIK_EN_AZ && (
              <p className="tone-text text-sm" data-tone="warning">
                {t({
                  tr: `Farkı sıfır olmayan çift sayısı ${YAKLASIKLIK_EN_AZ}'den az; p değeri büyük örneklem yaklaşıklığıyla hesaplandı ve kesin değildir.`,
                  en: `Fewer than ${YAKLASIKLIK_EN_AZ} pairs have a non-zero difference; the p value was computed with the large-sample approximation and is not exact.`,
                })}
              </p>
            )}
          </div>,
        );
      }

      /*
        FRIEDMAN (27.10.2026): üç ve daha çok tekrarlı ölçüm. Bir kişinin
        bir ölçümü boşsa o kişi bütünüyle düşer (liste bazlı); yarım
        satırı sıralamak kişiler arasında farklı sayıda ölçümü
        karşılaştırmak olurdu.
      */
      if (analysisType === "friedman") {
        if (olcumler.length < 3) {
          setResultError(t({ tr: "Friedman testi için en az üç ölçüm (sütun) seçin. İki ölçüm için Wilcoxon testini kullanın.", en: "Select at least three measurements (columns) for the Friedman test. For two measurements, use the Wilcoxon test." }));
          return;
        }
        const veri = eslesenSutunlar(...olcumler);
        if (veri.n < 2) {
          setResultError(t({ tr: "Friedman testi için bütün ölçümleri dolu en az 2 katılımcı gereklidir.", en: "The Friedman test requires at least 2 participants with all measurements present." }));
          return;
        }
        const r = friedmanTesti(veri.sutunlar);
        if (!hesaplanabilir(r.chiKare, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Friedman sıra ortalamaları", en: "Friedman mean ranks" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{t({ tr: "Ölçüm", en: "Measurement" })}</th>
                    <th>{t({ tr: "Sıra ortalaması", en: "Mean rank" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {olcumler.map((o, i) => (
                    <tr key={o}>
                      <td>{o}</td>
                      <td>{yazSayi(r.siraOrtalamalari[i])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              χ²({r.df}, N = {r.n}) = {yazSayi(r.chiKare)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            <p className="muted text-sm">Kendall W = {yazSayi(r.kendallW)} ({t({ tr: "etki büyüklüğü, 0–1", en: "effect size, 0–1" })})</p>
            {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
            {sig ? (
              <p className="muted text-sm">
                {t({
                  tr: "Fark anlamlı: hangi ölçümlerin farklı olduğunu görmek için ölçüm çiftlerini Wilcoxon testiyle karşılaştırın ve çoklu karşılaştırma için anlamlılık düzeyini düzeltin (Bonferroni: .05 / çift sayısı).",
                  en: "The difference is significant: to see which measurements differ, compare pairs with the Wilcoxon test and adjust the significance level for multiple comparisons (Bonferroni: .05 / number of pairs).",
                })}
              </p>
            ) : null}
          </div>,
        );
      }

      /* ---------- 27.10.2026'da eklenen analizler ---------- */

      if (analysisType === "tekorneklem") {
        const deger = Number(testDegeri.replace(",", "."));
        if (!testDegeri.trim() || !Number.isFinite(deger)) {
          setResultError(t({ tr: "Karşılaştırılacak değeri yazın (ör. 5'li ölçekte orta nokta 3).", en: "Enter the test value (e.g. the midpoint 3 on a 5-point scale)." }));
          return;
        }
        const dizi = getNumericColumn(varA);
        if (dizi.length < 2) {
          setResultError(t({ tr: "Tek örneklem t-testi için en az 2 gözlem gereklidir.", en: "A one-sample t test requires at least 2 observations." }));
          return;
        }
        const r = tekOrneklemTTest(dizi, deger);
        if (!hesaplanabilir(r.t, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              <strong>{varA}</strong>:{" "}
              {t({
                tr: `N=${r.n}, ortalama=${yazSayi(r.ortalama)}, SS=${yazSayi(r.ss)} · test değeri ${deger}`,
                en: `N = ${r.n}, M = ${yazSayi(r.ortalama)}, SD = ${yazSayi(r.ss)} · test value ${deger}`,
              })}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              t({r.df}) = {yazSayi(r.t)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            <p className="muted text-sm">
              Cohen&apos;s d = {yazSayi(r.d)} · {t({ tr: "farkın %95 GA", en: "95% CI of the difference" })} [{yazSayi(r.altSinir)}, {yazSayi(r.ustSinir)}]
            </p>
            {varsayimSeridi([dizi], [varA])}
          </div>,
        );
      }

      if (analysisType === "tekrarlianova") {
        if (olcumler.length < 2) {
          setResultError(t({ tr: "Tekrarlı ölçümler ANOVA için en az iki ölçüm (sütun) seçin; genellikle üç ve daha çok.", en: "Select at least two measurements (columns) for a repeated-measures ANOVA; usually three or more." }));
          return;
        }
        const veri = eslesenSutunlar(...olcumler);
        if (veri.n < 3) {
          setResultError(t({ tr: "Bütün ölçümleri dolu en az 3 katılımcı gereklidir.", en: "At least 3 participants with all measurements present are required." }));
          return;
        }
        const r = tekrarliOlcumlerAnova(veri.sutunlar);
        if (!hesaplanabilir(r.f, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        /*
          Küreselliğe göre hangi satırın raporlanacağı: Mauchly anlamlıysa
          (p < .05) Greenhouse-Geisser; ε > .75 ise Huynh-Feldt de kabul
          görüyor (Girden, 1992). Hepsi tabloda; ekran hangisini
          önerdiğini yazıyor.
        */
        const kuresellikBozuk = r.k > 2 && isSignificant(r.mauchlyP);
        const onerilen = !kuresellikBozuk ? "kuresel" : r.ggEpsilon > 0.75 ? "hf" : "gg";
        const raporP = onerilen === "kuresel" ? r.p : onerilen === "gg" ? r.ggP : r.hfP;
        const eps = onerilen === "gg" ? r.ggEpsilon : onerilen === "hf" ? r.hfEpsilon : 1;
        const sig = isSignificant(raporP);
        const ikili = sig ? tekrarliIkiliKarsilastirmalar(veri.sutunlar, olcumler) : [];
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Ölçüm ortalamaları", en: "Measurement means" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>{t({ tr: "Ölçüm", en: "Measurement" })}</th><th>{t({ tr: "Ortalama", en: "M" })}</th></tr>
                </thead>
                <tbody>
                  {olcumler.map((o, i) => (
                    <tr key={o}><td>{o}</td><td>{yazSayi(r.ortalamalar[i])}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tone-text mt-sm" data-tone={sig ? "success" : "warning"}>
              F({yazSayi(r.df1 * eps, eps === 1 ? 0 : 2)}, {yazSayi(r.df2 * eps, eps === 1 ? 0 : 2)}) = {yazSayi(r.f)}, {yazP(raporP)}
              {anlamliYaz(sig)}
              {onerilen === "gg" ? " (Greenhouse-Geisser)" : onerilen === "hf" ? " (Huynh-Feldt)" : ""}
            </p>
            <p className="muted text-sm">{t({ tr: "Kısmi η²", en: "Partial η²" })} = {yazSayi(r.kismiEtaKare)} · N = {r.n}</p>
            <div className="mt-sm">
              <strong>{t({ tr: "Küresellik", en: "Sphericity" })}</strong>
              <ul className="muted text-sm">
                {r.k > 2 ? (
                  <li>
                    {t({ tr: "Mauchly W", en: "Mauchly's W" })} = {yazSayi(r.mauchlyW, 3)}, χ²({r.mauchlyDf}) = {yazSayi(r.mauchlyChi)}, {yazP(r.mauchlyP)} —{" "}
                    {kuresellikBozuk
                      ? t({ tr: "küresellik varsayımı sağlanmıyor", en: "the sphericity assumption is violated" })
                      : t({ tr: "küresellik varsayımı sağlanıyor", en: "the sphericity assumption is met" })}
                  </li>
                ) : (
                  <li>{t({ tr: "İki ölçümde küresellik tanım gereği sağlanır.", en: "With two measurements, sphericity is met by definition." })}</li>
                )}
                <li>
                  Greenhouse-Geisser ε = {yazSayi(r.ggEpsilon, 3)}: {yazP(r.ggP)} · Huynh-Feldt ε = {yazSayi(r.hfEpsilon, 3)}:{" "}
                  {yazP(r.hfP)}
                </li>
              </ul>
            </div>
            {ikili.length ? (
              <div className="mt-sm">
                <strong>{t({ tr: "İkili karşılaştırmalar (eşleştirilmiş t, Bonferroni)", en: "Pairwise comparisons (paired t, Bonferroni)" })}</strong>
                <ul className="muted text-sm">
                  {ikili.map((c) => (
                    <li key={`${c.a}-${c.b}`}>
                      {c.a} — {c.b}: {t({ tr: "fark", en: "difference" })} {yazSayi(c.fark)}, {yazP(c.p)}
                      {c.anlamli ? t({ tr: " — anlamlı", en: " — significant" }) : t({ tr: " — anlamlı değil", en: " — not significant" })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
          </div>,
        );
      }

      if (analysisType === "ancova") {
        const kovlar = kovaryatlar.filter((c) => c !== varA);
        if (!kovlar.length) {
          setResultError(t({ tr: "En az bir kovaryat seçin (ör. ön test puanı).", en: "Select at least one covariate (e.g. the pretest score)." }));
          return;
        }
        const gozlemler = dataset.rows.flatMap((satir) => {
          const g = satir[groupVar];
          if (g === null || g === "" || !sayisalMi(satir[varA]) || !kovlar.every((c) => sayisalMi(satir[c]))) return [];
          return [{ grup: String(g), y: Number(satir[varA]), kovaryatlar: kovlar.map((c) => Number(satir[c])) }];
        });
        const dusen = dataset.rows.length - gozlemler.length;
        const r = ancova(gozlemler, kovlar, groupVar);
        if (r === "az-grup") return setResultError(t({ tr: "ANCOVA için grup değişkeninde en az 2 grup olmalıdır.", en: "ANCOVA requires at least 2 groups in the grouping variable." }));
        if (r === "az-gozlem") return setResultError(t({ tr: "Gözlem sayısı grup ve kovaryat sayısına göre yetersiz.", en: "Too few observations for the number of groups and covariates." }));
        if (r === "tekil") return setResultError(t({ tr: "Model kurulamadı: kovaryat ile grup birbirini tam belirliyor olabilir.", en: "The model could not be estimated: the covariate and the group may fully determine each other." }));
        const grupEtkisi = r.etkiler[r.etkiler.length - 1];
        const sig = isSignificant(grupEtkisi.p);
        const egimBozuk = Number.isFinite(r.egimP) && isSignificant(r.egimP);
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label={t({ tr: "ANCOVA tablosu", en: "ANCOVA table" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>{t({ tr: "Kaynak", en: "Source" })}</th><th>{t({ tr: "KT", en: "SS" })}</th><th>{t({ tr: "sd", en: "df" })}</th><th>F</th><th>p</th><th>{t({ tr: "Kısmi η²", en: "Partial η²" })}</th></tr>
                </thead>
                <tbody>
                  {r.etkiler.map((e) => (
                    <tr key={e.ad} className={isSignificant(e.p) ? "stats-significant" : undefined}>
                      <td>{e.ad}</td><td>{yazSayi(e.ss)}</td><td>{e.df}</td><td>{yazSayi(e.f)}</td><td>{yazP(e.p)}</td><td>{yazSayi(e.kismiEtaKare)}</td>
                    </tr>
                  ))}
                  <tr><td>{t({ tr: "Hata", en: "Error" })}</td><td>{yazSayi(r.hataSS)}</td><td>{r.hataDf}</td><td /><td /><td /></tr>
                </tbody>
              </table>
            </div>
            <p className="tone-text mt-sm" data-tone={sig ? "success" : "warning"}>
              {groupVar}: F({grupEtkisi.df}, {r.hataDf}) = {yazSayi(grupEtkisi.f)}, {yazP(grupEtkisi.p)}
              {sig
                ? t({ tr: " — kovaryat kontrol edildiğinde gruplar farklı", en: " — the groups differ after controlling for the covariate" })
                : t({ tr: " — kovaryat kontrol edildiğinde gruplar farklı değil", en: " — the groups do not differ after controlling for the covariate" })}
            </p>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Düzeltilmiş ortalamalar", en: "Adjusted means" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>{t({ tr: "Grup", en: "Group" })}</th><th>N</th><th>{t({ tr: "Ham ortalama", en: "Unadjusted M" })}</th><th>{t({ tr: "Düzeltilmiş ortalama", en: "Adjusted M" })}</th></tr>
                </thead>
                <tbody>
                  {r.gruplar.map((g, i) => (
                    <tr key={g}><td>{g}</td><td>{r.grupNleri[i]}</td><td>{yazSayi(r.hamOrtalamalar[i])}</td><td>{yazSayi(r.duzeltilmisOrtalamalar[i])}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted text-sm">{t({ tr: "Düzeltilmiş ortalamalar kovaryatların genel ortalamasında hesaplandı.", en: "Adjusted means were evaluated at the grand mean of the covariates." })}</p>
            {Number.isFinite(r.egimF) ? (
              <p className={egimBozuk ? "tone-text text-sm" : "muted text-sm"} data-tone={egimBozuk ? "warning" : undefined}>
                {t({ tr: "Regresyon eğimlerinin homojenliği (grup × kovaryat)", en: "Homogeneity of regression slopes (group × covariate)" })}: F({r.egimDf1}, {r.egimDf2}) = {yazSayi(r.egimF)}, {yazP(r.egimP)} —{" "}
                {egimBozuk
                  ? t({ tr: "varsayım sağlanmıyor; kovaryatın etkisi gruplarda farklı, ANCOVA sonucu yanıltıcı olabilir.", en: "the assumption is violated; the covariate's effect differs across groups, so the ANCOVA result may be misleading." })
                  : t({ tr: "varsayım sağlanıyor.", en: "the assumption is met." })}
              </p>
            ) : null}
            {dusen > 0 ? (
              <p className="muted text-sm">
                {t({ tr: `${dusen} satır eksik veri yüzünden analiz dışı bırakıldı.`, en: `${dusen} row(s) were excluded from the analysis because of missing data.` })}
              </p>
            ) : null}
          </div>,
        );
      }

      if (analysisType === "kismikorelasyon") {
        const kontroller = kovaryatlar.filter((c) => c !== varA && c !== varB);
        if (!kontroller.length) {
          setResultError(t({ tr: "En az bir kontrol değişkeni seçin.", en: "Select at least one control variable." }));
          return;
        }
        if (varA === varB) return setResultError(t({ tr: "İki farklı değişken seçin.", en: "Select two different variables." }));
        const veri = eslesenSutunlar(varA, varB, ...kontroller);
        const [x, y, ...k] = veri.sutunlar;
        if (veri.n < kontroller.length + 3) {
          setResultError(t({ tr: "Kontrol değişkeni sayısına göre yeterli eşleşen gözlem yok.", en: "Not enough complete observations for the number of control variables." }));
          return;
        }
        const r = kismiKorelasyon(x, y, k);
        if (!r || !hesaplanabilir(r.r, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              r<sub>{t({ tr: "kısmi", en: "partial" })}</sub>({r.df}) = {yazSayi(r.r)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            <p className="muted text-sm">
              {t({
                tr: `Kontrol edilen: ${kontroller.join(", ")} · kontrol edilmeden r = ${yazSayi(r.hamR)} · N = ${r.n}`,
                en: `Controlled for: ${kontroller.join(", ")} · zero-order r = ${yazSayi(r.hamR)} · N = ${r.n}`,
              })}
            </p>
            {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
          </div>,
        );
      }

      if (analysisType === "mcnemar") {
        const a = ikiDegerliSutunlar.find((x) => x.ad === varA);
        const b = ikiDegerliSutunlar.find((x) => x.ad === varB);
        if (!a || !b || varA === varB) {
          setResultError(t({ tr: "İki farklı, ikişer kategorili sütun seçin (ör. eğitim öncesi ve sonrası Evet/Hayır).", en: "Select two different columns with two categories each (e.g. Yes/No before and after training)." }));
          return;
        }
        if (a.degerler.join("|") !== b.degerler.join("|")) {
          setResultError(
            t({
              tr: `İki ölçüm aynı kategorileri taşımalı: ${varA} (${a.degerler.join(", ")}), ${varB} (${b.degerler.join(", ")}).`,
              en: `Both measurements must have the same categories: ${varA} (${a.degerler.join(", ")}), ${varB} (${b.degerler.join(", ")}).`,
            }),
          );
          return;
        }
        const ciftler = dataset.rows.filter((r) => r[varA] !== null && r[varA] !== "" && r[varB] !== null && r[varB] !== "");
        const r = mcnemar(ciftler.map((x) => String(x[varA])), ciftler.map((x) => String(x[varB])), a.degerler as [string, string]);
        const sig = isSignificant(r.pKesin);
        const [d1, d2] = a.degerler;
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label={t({ tr: "McNemar tablosu", en: "McNemar table" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>{varA} \ {varB}</th><th>{d1}</th><th>{d2}</th></tr>
                </thead>
                <tbody>
                  <tr><td>{d1}</td><td>{r.tablo[0][0]}</td><td>{r.tablo[0][1]}</td></tr>
                  <tr><td>{d2}</td><td>{r.tablo[1][0]}</td><td>{r.tablo[1][1]}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="tone-text mt-sm" data-tone={sig ? "success" : "warning"}>
              {t({ tr: "McNemar (kesin, binom)", en: "McNemar test (exact, binomial)" })}: {yazP(r.pKesin)}
              {sig
                ? t({ tr: " — iki ölçüm arasında değişim anlamlı", en: " — the change between the two measurements is statistically significant" })
                : t({ tr: " — iki ölçüm arasında değişim anlamlı değil", en: " — the change between the two measurements is not statistically significant" })}
            </p>
            <p className="muted text-sm">
              {t({
                tr: `Değişen kişiler: ${d1}→${d2} ${r.b}, ${d2}→${d1} ${r.c}. Test yalnızca fikir değiştirenlere bakar.`,
                en: `Participants who changed: ${d1}→${d2} ${r.b}, ${d2}→${d1} ${r.c}. The test considers only those who changed.`,
              })}
              {r.b + r.c >= 25 && hesaplanabilir(r.chiKare, r.pChiKare)
                ? t({
                    tr: ` Süreklilik düzeltmeli χ²(1) = ${yazSayi(r.chiKare)}, ${yazP(r.pChiKare)}.`,
                    en: ` With continuity correction, χ²(1) = ${yazSayi(r.chiKare)}, ${yazP(r.pChiKare)}.`,
                  })
                : ""}
            </p>
          </div>,
        );
      }

      if (analysisType === "lojistik") {
        const bagimli = ikiDegerliSutunlar.find((x) => x.ad === varA);
        if (!bagimli) {
          setResultError(t({ tr: "Bağımlı değişken olarak iki kategorili bir sütun seçin.", en: "Select a column with two categories as the dependent variable." }));
          return;
        }
        const secilen = yordayicilar.filter((c) => c !== varA);
        if (!secilen.length) {
          setResultError(t({ tr: "En az bir yordayıcı değişken seçin.", en: "Select at least one predictor." }));
          return;
        }
        const olay = bagimli.degerler.includes(olayDegeri) ? olayDegeri : bagimli.degerler[1];
        const satirlar = dataset.rows.filter(
          (r) => r[varA] !== null && r[varA] !== "" && secilen.every((c) => sayisalMi(r[c])),
        );
        const y = satirlar.map((r) => (String(r[varA]) === olay ? 1 : 0));
        const X = secilen.map((c) => satirlar.map((r) => Number(r[c])));
        const r = lojistikRegresyon(y, X, secilen);
        const HATA: Record<LojistikHata, Metin> = {
          "tek-sinif": {
            tr: "Bağımlı değişkende yalnızca bir kategori kaldı; iki kategori de bulunmalı.",
            en: "Only one category remains in the dependent variable; both categories must be present.",
          },
          "az-gozlem": { tr: "Yordayıcı sayısına göre yeterli gözlem yok.", en: "Not enough observations for the number of predictors." },
          tekil: {
            tr: "Model kurulamadı: yordayıcılar birbirinin aynısı ya da neredeyse aynısı.",
            en: "The model could not be estimated: the predictors are identical or nearly identical.",
          },
          ayrisma: {
            tr: "Model kestirilemedi: yordayıcılar sonucu kusursuz ayırıyor (tam ayrışma). Bu durumda katsayılar sonsuza gider ve anlamsızdır; yordayıcıları ya da kategorileri gözden geçirin.",
            en: "The model could not be estimated: the predictors separate the outcome perfectly (complete separation). The coefficients then diverge to infinity and are meaningless; review the predictors or categories.",
          },
        };
        if (typeof r === "string") return setResultError(t(HATA[r]));
        const sig = isSignificant(r.modelP);
        const diger = bagimli.degerler.find((d) => d !== olay)!;
        setResult(
          <div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              {t({ tr: "Model", en: "Model" })} χ²({r.modelDf}) = {yazSayi(r.modelChiKare)}, {yazP(r.modelP)}
              {sig ? t({ tr: " — model anlamlı", en: " — the model is statistically significant" }) : t({ tr: " — model anlamlı değil", en: " — the model is not statistically significant" })}
            </p>
            <p className="muted text-sm">
              −2LL = {yazSayi(r.eksiIkiLL)} · Cox-Snell R² = {yazSayi(r.coxSnell)} · Nagelkerke R² = {yazSayi(r.nagelkerke)} · N ={" "}
              {r.n} ({t({ tr: `olay “${olay}”: ${r.olaySayisi}`, en: `event “${olay}”: ${r.olaySayisi}` })})
            </p>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Lojistik regresyon katsayıları", en: "Logistic regression coefficients" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>{t({ tr: "Değişken", en: "Variable" })}</th><th>B</th><th>{t({ tr: "SH", en: "SE" })}</th><th>Wald</th><th>p</th><th>Exp(B)</th><th>{GA95}</th></tr>
                </thead>
                <tbody>
                  {r.katsayilar.map((k) => (
                    <tr key={k.ad} className={k.ad !== "(Sabit)" && isSignificant(k.p) ? "stats-significant" : undefined}>
                      <td>{katsayiAdi(k.ad, dil)}</td><td>{yazSayi(k.b)}</td><td>{yazSayi(k.se)}</td><td>{yazSayi(k.wald)}</td><td>{yazP(k.p)}</td>
                      <td>{yazSayi(k.expB)}</td><td>{k.ad === "(Sabit)" ? "" : `[${yazSayi(k.expAlt)}, ${yazSayi(k.expUst)}]`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted text-sm">
              {t({
                tr: `Doğru sınıflama ${yazYuzde(r.dogruOrani * 100)} (kesim 0,5): “${diger}” ${r.siniflama[0][0]}/${r.siniflama[0][0] + r.siniflama[0][1]}, “${olay}” ${r.siniflama[1][1]}/${r.siniflama[1][0] + r.siniflama[1][1]}. Exp(B), yordayıcı bir birim arttığında “${olay}” olma olasılığının (odds) kaç katına çıktığıdır.`,
                en: `Correctly classified ${yazYuzde(r.dogruOrani * 100)} (cut-off 0.5): “${diger}” ${r.siniflama[0][0]}/${r.siniflama[0][0] + r.siniflama[0][1]}, “${olay}” ${r.siniflama[1][1]}/${r.siniflama[1][0] + r.siniflama[1][1]}. Exp(B) is the factor by which the odds of “${olay}” change when the predictor increases by one unit.`,
              })}
            </p>
            {dataset.rows.length - satirlar.length > 0 ? (
              <p className="muted text-sm">
                {t({
                  tr: `${dataset.rows.length - satirlar.length} satır eksik veri yüzünden analiz dışı bırakıldı.`,
                  en: `${dataset.rows.length - satirlar.length} row(s) were excluded from the analysis because of missing data.`,
                })}
              </p>
            ) : null}
          </div>,
        );
      }

      if (analysisType === "faktor") {
        if (reliabilityItems.length < 3) {
          setResultError(t({ tr: "Faktör analizi için en az üç madde seçin.", en: "Select at least three items for factor analysis." }));
          return;
        }
        const veri = eslesenSutunlar(...reliabilityItems);
        const istenen = Number(faktorSayisi);
        const r = aciklayiciFaktorAnalizi(veri.sutunlar, istenen > 0 ? istenen : undefined);
        if (r === "az-madde") return setResultError(t({ tr: "Faktör analizi için en az üç madde seçin.", en: "Select at least three items for factor analysis." }));
        if (r === "az-gozlem")
          return setResultError(
            t({
              tr: `Gözlem sayısı (${veri.n}) madde sayısından fazla olmalı; genel öneri madde başına en az 5–10 kişi.`,
              en: `The number of observations (${veri.n}) must exceed the number of items; a common recommendation is at least 5–10 participants per item.`,
            }),
          );
        if (r === "tekil")
          return setResultError(
            t({
              tr: "Korelasyon matrisi tekil: bazı maddeler birbirinin aynısı ya da değişkenliği yok. O maddeleri çıkarın.",
              en: "The correlation matrix is singular: some items are identical or have no variability. Remove those items.",
            }),
          );
        const uygun = r.kmo >= 0.6 && isSignificant(r.bartlettP);
        setResult(
          <div>
            <p className="tone-text" data-tone={uygun ? "success" : "warning"}>
              KMO = {yazSayi(r.kmo, 3)} ({kmoYorumu(r.kmo, dil)}) · Bartlett χ²({r.bartlettDf}) = {yazSayi(r.bartlettChi)}, {yazP(r.bartlettP)}
              {uygun
                ? t({ tr: " — veri faktör analizine uygun", en: " — the data are suitable for factor analysis" })
                : t({ tr: " — veri faktör analizine uygun görünmüyor (KMO < .60 ya da Bartlett anlamsız)", en: " — the data do not appear suitable for factor analysis (KMO < .60 or Bartlett's test not significant)" })}
            </p>
            <p className="muted text-sm">
              {t({
                tr: `Temel bileşenler, varimax döndürme · ${r.faktorSayisi} faktör`,
                en: `Principal components, varimax rotation · ${r.faktorSayisi} factor(s)`,
              })}
              {istenen > 0
                ? t({ tr: " (sizin belirlediğiniz)", en: " (as you specified)" })
                : t({ tr: " (öz değeri 1'den büyük olanlar)", en: " (eigenvalues greater than 1)" })}{" "}
              · {t({ tr: "toplam açıklanan varyans", en: "total variance explained" })} {yazYuzde(r.toplamAciklanan)} · N = {r.n}
            </p>
            <p className="muted text-sm">
              {t({ tr: "Öz değerler", en: "Eigenvalues" })}: {r.ozDegerler.slice(0, Math.min(r.ozDegerler.length, 8)).map((d) => yazSayi(d)).join(" · ")}
            </p>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Döndürülmüş faktör yükleri", en: "Rotated factor loadings" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{t({ tr: "Madde", en: "Item" })}</th>
                    {r.aciklananYuzde.map((y, f) => (
                      <th key={f}>F{f + 1} ({yazYuzde(y)})</th>
                    ))}
                    <th>h²</th>
                    <th>{t({ tr: "Not", en: "Note" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {reliabilityItems.map((m, i) => {
                    const uyari = maddeUyarisi(r.yukler[i]);
                    return (
                      <tr key={m}>
                        <td>{m}</td>
                        {r.yukler[i].map((y, f) => (
                          <td key={f} className={Math.abs(y) >= 0.3 ? "stats-significant" : "muted"}>{yazSayi(y)}</td>
                        ))}
                        <td>{yazSayi(r.ortakVaryans[i])}</td>
                        <td>
                          {uyari === "dusuk"
                            ? t({ tr: "yük < .30", en: "loading < .30" })
                            : uyari === "binisik"
                              ? t({ tr: "binişik", en: "cross-loading" })
                              : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted text-sm">
              {t({
                tr: "Yükü .30'un altında kalan ve iki faktöre .10'dan yakın yüklenen (binişik) maddeler işaretlendi. Madde çıkarma kararı kuramsal yapıya göre sizin ve danışmanınızındır; bir madde çıkarıldığında analizi yeniden çalıştırın.",
                en: "Items with loadings below .30 and items loading on two factors within .10 of each other (cross-loadings) are flagged. Whether to remove an item is a decision for you and your advisor based on the theoretical structure; rerun the analysis after removing an item.",
              })}
            </p>
            {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
          </div>,
        );
      }

      /*
        KARMA ANOVA (27.10.2026): grup (gruplar arası) × ölçüm (tekrarlı).
        Bir kişinin bir ölçümü boşsa o kişi bütünüyle düşer (liste bazlı).
      */
      if (analysisType === "karmaanova") {
        if (olcumler.length < 2) {
          setResultError(t({ tr: "En az iki ölçüm (sütun) seçin, ör. ön test ve son test.", en: "Select at least two measurements (columns), e.g. pretest and posttest." }));
          return;
        }
        if (groupLevels.length < 2) {
          setResultError(t({ tr: "Grup değişkeninde en az iki grup olmalıdır (ör. deney ve kontrol).", en: "The grouping variable must have at least two groups (e.g. experimental and control)." }));
          return;
        }
        const tamSatirlar = dataset.rows.filter(
          (satir) => satir[groupVar] !== null && satir[groupVar] !== "" && olcumler.every((o) => sayisalMi(satir[o])),
        );
        const veriGruplari = groupLevels.map((g) => {
          const kendi = tamSatirlar.filter((satir) => String(satir[groupVar]) === g);
          return olcumler.map((o) => kendi.map((satir) => Number(satir[o])));
        });
        const r = karmaAnova(veriGruplari, groupLevels);
        if (r === "az-grup") return setResultError(t({ tr: "En az iki grup gerekli.", en: "At least two groups are required." }));
        if (r === "az-olcum") return setResultError(t({ tr: "En az iki ölçüm gerekli.", en: "At least two measurements are required." }));
        if (r === "az-gozlem")
          return setResultError(
            t({
              tr: "Her grupta bütün ölçümleri dolu en az 2 kişi olmalı; toplam kişi sayısı da ölçüm sayısından fazla olmalı.",
              en: "Each group needs at least 2 participants with all measurements present, and the total number of participants must exceed the number of measurements.",
            }),
          );
        if (!hesaplanabilir(r.olcum.f, r.etkilesim.f, r.grup.f)) return setResultError(t(DEGISKENLIK_YOK));

        /* Küresellik bozuksa tekrarlı etkilerde Greenhouse-Geisser (ε > .75 ise Huynh-Feldt). */
        const kuresellikBozuk = olcumler.length > 2 && isSignificant(r.mauchlyP);
        const duzeltme = !kuresellikBozuk ? null : r.ggEpsilon > 0.75 ? "hf" : "gg";
        const eps = duzeltme === "gg" ? r.ggEpsilon : duzeltme === "hf" ? r.hfEpsilon : 1;
        const raporP = (e: typeof r.olcum) => (duzeltme === "gg" ? e.ggP : duzeltme === "hf" ? e.hfP : e.p);
        const df = (d: number, tekrarli: boolean) => (tekrarli && eps !== 1 ? yazSayi(d * eps, 2) : String(d));
        const satirlar = [
          { e: r.grup, tekrarli: false },
          { e: r.olcum, tekrarli: true },
          { e: r.etkilesim, tekrarli: true },
        ];
        const etkilesimSig = isSignificant(raporP(r.etkilesim));

        /*
          BASİT ETKİLER: etkileşim anlamlıysa ana etkiler tek başına
          yorumlanmaz; her ölçümde grup farkı ve her grupta zaman etkisi
          ayrı ayrı bakılır. p'ler aile içinde Bonferroni ile düzeltilir.
        */
        const olcumdeGrup = etkilesimSig
          ? olcumler.map((o, s) => {
              const a = oneWayAnova(veriGruplari.map((g) => g[s]));
              return { ad: o, f: a.f, df1: a.dfb, df2: a.dfw, p: Math.min(1, a.p * olcumler.length) };
            })
          : [];
        const gruptaZaman = etkilesimSig
          ? groupLevels.map((g, j) => {
              const ta = tekrarliOlcumlerAnova(veriGruplari[j]);
              const pp = olcumler.length > 2 && isSignificant(ta.mauchlyP) ? ta.ggP : ta.p;
              return { ad: g, f: ta.f, df1: ta.df1, df2: ta.df2, p: Math.min(1, pp * groupLevels.length) };
            })
          : [];
        const dusen = dataset.rows.length - tamSatirlar.length;

        setSonucGrafigi(<ProfilGrafigi olcumler={olcumler} gruplar={groupLevels} ortalamalar={r.hucreOrtalamalari} />);
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Hücre ortalamaları", en: "Cell means" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{t({ tr: "Grup", en: "Group" })}</th>
                    <th>N</th>
                    {olcumler.map((o) => (
                      <th key={o}>{o}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupLevels.map((g, j) => (
                    <tr key={g}>
                      <td>{g}</td>
                      <td>{r.grupNleri[j]}</td>
                      {r.hucreOrtalamalari[j].map((v, s) => (
                        <td key={s}>{yazSayi(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Karma ANOVA tablosu", en: "Mixed ANOVA table" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{t({ tr: "Kaynak", en: "Source" })}</th>
                    <th>{t({ tr: "sd", en: "df" })}</th>
                    <th>F</th>
                    <th>p</th>
                    <th>{t({ tr: "Kısmi η²", en: "Partial η²" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map(({ e, tekrarli }) => (
                    <tr key={e.ad} className={isSignificant(tekrarli ? raporP(e) : e.p) ? "stats-significant" : undefined}>
                      <td>
                        {e.ad === "Grup"
                          ? groupVar
                          : e.ad === "Ölçüm"
                            ? t({ tr: "Ölçüm (zaman)", en: "Measurement (time)" })
                            : t({ tr: `Ölçüm × ${groupVar}`, en: `Measurement × ${groupVar}` })}
                      </td>
                      <td>
                        {df(e.df1, tekrarli)}, {df(e.df2, tekrarli)}
                      </td>
                      <td>{yazSayi(e.f)}</td>
                      <td>{yazP(tekrarli ? raporP(e) : e.p)}</td>
                      <td>{yazSayi(e.kismiEtaKare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tone-text mt-sm" data-tone={etkilesimSig ? "success" : "warning"}>
              {t({ tr: `Etkileşim (ölçüm × ${groupVar})`, en: `Interaction (measurement × ${groupVar})` })}: F({df(r.etkilesim.df1, true)}, {df(r.etkilesim.df2, true)}) = {yazSayi(r.etkilesim.f)},{" "}
              {yazP(raporP(r.etkilesim))}
              {etkilesimSig
                ? t({ tr: " — grupların zaman içindeki değişimi farklı", en: " — the groups change differently over time" })
                : t({ tr: " — grupların zaman içindeki değişimi farklı değil", en: " — the groups do not change differently over time" })}
              {duzeltme === "gg" ? " (Greenhouse-Geisser)" : duzeltme === "hf" ? " (Huynh-Feldt)" : ""}
            </p>
            <ul className="muted text-sm">
              {olcumler.length > 2 ? (
                <li>
                  {t({ tr: "Mauchly W", en: "Mauchly's W" })} = {yazSayi(r.mauchlyW, 3)}, χ²({r.mauchlyDf}) = {yazSayi(r.mauchlyChi)}, {yazP(r.mauchlyP)} —{" "}
                  {kuresellikBozuk
                    ? t({ tr: "küresellik sağlanmıyor; tekrarlı etkilerde düzeltilmiş sd ve p yazıldı", en: "sphericity is violated; corrected df and p are reported for the within-subjects effects" })
                    : t({ tr: "küresellik sağlanıyor", en: "sphericity is met" })}{" "}
                  · GG ε = {yazSayi(r.ggEpsilon, 3)}, HF ε = {yazSayi(r.hfEpsilon, 3)}
                </li>
              ) : (
                <li>{t({ tr: "İki ölçümde küresellik tanım gereği sağlanır.", en: "With two measurements, sphericity is met by definition." })}</li>
              )}
              {olcumler.map((o, s) => {
                const l = leveneTesti(veriGruplari.map((g) => g[s]));
                return (
                  <li key={o}>
                    Levene ({o}): F({l.df1}, {l.df2}) = {yazSayi(l.f)}, {yazP(l.p)} —{" "}
                    {l.homojen
                      ? t({ tr: "varyanslar homojen", en: "variances are homogeneous" })
                      : t({ tr: "varyanslar homojen değil", en: "variances are not homogeneous" })}
                  </li>
                );
              })}
            </ul>
            {etkilesimSig ? (
              <div className="mt-sm">
                <strong>{t({ tr: "Basit etkiler (Bonferroni düzeltmeli)", en: "Simple effects (Bonferroni-corrected)" })}</strong>
                <ul className="muted text-sm">
                  {olcumdeGrup.map((b) => (
                    <li key={`o-${b.ad}`}>
                      {t({ tr: `${b.ad} ölçümünde gruplar`, en: `Groups at ${b.ad}` })}: F({b.df1}, {b.df2}) = {yazSayi(b.f)}, {yazP(b.p)}
                      {isSignificant(b.p)
                        ? t({ tr: " — fark anlamlı", en: " — the difference is significant" })
                        : t({ tr: " — fark anlamlı değil", en: " — the difference is not significant" })}
                    </li>
                  ))}
                  {gruptaZaman.map((b) => (
                    <li key={`g-${b.ad}`}>
                      {t({ tr: `${b.ad} grubunda zaman`, en: `Time within group ${b.ad}` })}: F({b.df1}, {b.df2}) = {yazSayi(b.f)}, {yazP(b.p)}
                      {isSignificant(b.p)
                        ? t({ tr: " — değişim anlamlı", en: " — the change is significant" })
                        : t({ tr: " — değişim anlamlı değil", en: " — the change is not significant" })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="muted text-sm">
                {t({
                  tr: `Etkileşim anlamlı olmadığı için ${groupVar} ve ölçüm ana etkileri tablodaki gibi yorumlanır.`,
                  en: `Because the interaction is not significant, the main effects of ${groupVar} and measurement are interpreted as shown in the table.`,
                })}
              </p>
            )}
            {dusen > 0 ? (
              <p className="muted text-sm">
                {t({ tr: `${dusen} satır eksik veri yüzünden analiz dışı bırakıldı.`, en: `${dusen} row(s) were excluded from the analysis because of missing data.` })}
              </p>
            ) : null}
          </div>,
        );
      }

      /* ---------- Aracılık, düzenleyicilik, DFA (27.10.2026) ---------- */

      /*
        ÇOKLU ARACI (27.10.2026): iki ve daha çok aracıda paralel (Model 4)
        ya da seri (Model 6). Tek aracı aşağıdaki yoldan gider.
      */
      if (analysisType === "aracilik" && aracilar.length >= 2) {
        const ms = aracilar.filter((a) => a !== varA && a !== varY);
        if (!varY || varA === varY || ms.length < 2) {
          setResultError(
            t({
              tr: "Bağımsız (X) ve sonuç (Y) için iki farklı değişken, aracı olarak bunlardan farklı en az iki değişken seçin.",
              en: "Select two different variables for the predictor (X) and the outcome (Y), and at least two other variables as mediators.",
            }),
          );
          return;
        }
        if (araciModeli === "seri" && ms.length > SERI_EN_COK) {
          setResultError(
            t({
              tr: `Seri modelde en çok ${SERI_EN_COK} aracı olabilir (yol sayısı hızla artıyor ve yorumlanamaz hâle geliyor).`,
              en: `A serial model can have at most ${SERI_EN_COK} mediators (the number of paths grows quickly and becomes uninterpretable).`,
            }),
          );
          return;
        }
        const kovlar = kovaryatlar.filter((c) => c !== varA && c !== varY && !ms.includes(c));
        const veri = eslesenSutunlar(varA, varY, ...ms, ...kovlar);
        const [x, y, ...geri] = veri.sutunlar;
        const mVeri = geri.slice(0, ms.length);
        const k = geri.slice(ms.length);
        if (veri.n < ms.length + kovlar.length + 10) {
          setResultError(t({ tr: "Bu model için yeterli eşleşen gözlem yok.", en: "Not enough complete observations for this model." }));
          return;
        }
        const r = cokluAracilik(x, mVeri, y, araciModeli, k);
        if (!r || !hesaplanabilir(r.toplamDolayli.etki, r.cUs.p)) return setResultError(t(DEGISKENLIK_YOK));
        const anlamli = (o: { bootAlt: number; bootUst: number }) => o.bootAlt > 0 || o.bootUst < 0;
        const yolAdi = (sira: number[]) => [varA, ...sira.map((i) => ms[i]), varY].join(" → ");
        const satir = (ad: string, yol: { b: number; se: number; t: number; p: number }) => (
          <tr key={ad} className={isSignificant(yol.p) ? "stats-significant" : undefined}>
            <td>{ad}</td><td>{yazSayi(yol.b)}</td><td>{yazSayi(yol.se)}</td><td>{yazSayi(yol.t)}</td><td>{yazP(yol.p)}</td>
          </tr>
        );
        const toplamAnlamli = anlamli(r.toplamDolayli);
        setResult(
          <div>
            <p className="muted text-sm">
              {araciModeli === "paralel"
                ? t({
                    tr: `Paralel aracılık (PROCESS Model 4): ${ms.length} aracı, aracılar birbirini etkilemiyor.`,
                    en: `Parallel mediation (PROCESS Model 4): ${ms.length} mediators that do not affect each other.`,
                  })
                : t({
                    tr: `Seri aracılık (PROCESS Model 6): ${ms.join(" → ")} sırasıyla zincir.`,
                    en: `Serial mediation (PROCESS Model 6): a chain in the order ${ms.join(" → ")}.`,
                  })}{" "}
              N = {r.n}
              {kovlar.length ? t({ tr: ` · kontrol: ${kovlar.join(", ")}`, en: ` · covariates: ${kovlar.join(", ")}` }) : ""}
            </p>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Doğrudan yollar", en: "Direct paths" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>{t({ tr: "Yol", en: "Path" })}</th><th>B</th><th>{t({ tr: "SH", en: "SE" })}</th><th>t</th><th>p</th></tr>
                </thead>
                <tbody>
                  {ms.map((m, j) => satir(`a${j + 1}: ${varA} → ${m}`, r.a[j]))}
                  {ms.flatMap((m, j) => ms.slice(0, j).map((o, i) => (r.d[j][i] ? satir(`d${j + 1}${i + 1}: ${o} → ${m}`, r.d[j][i]!) : null)))}
                  {ms.map((m, j) => satir(`b${j + 1}: ${m} → ${varY}`, r.b[j]))}
                  {satir(t({ tr: `c: ${varA} → ${varY} (toplam etki)`, en: `c: ${varA} → ${varY} (total effect)` }), r.c)}
                  {satir(t({ tr: `c′: ${varA} → ${varY} (doğrudan etki)`, en: `c′: ${varA} → ${varY} (direct effect)` }), r.cUs)}
                </tbody>
              </table>
            </div>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Dolaylı etkiler", en: "Indirect effects" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{t({ tr: "Dolaylı yol", en: "Indirect path" })}</th>
                    <th>{t({ tr: "Etki", en: "Effect" })}</th>
                    <th>{t({ tr: "Boot SH", en: "Boot SE" })}</th>
                    <th>{t({ tr: "%95 bootstrap GA", en: "95% bootstrap CI" })}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {r.yollar.map((y2, i) => (
                    <tr key={i} className={anlamli(y2) ? "stats-significant" : undefined}>
                      <td>Ind{i + 1}: {yolAdi(y2.araciSirasi)}</td><td>{yazSayi(y2.etki)}</td><td>{yazSayi(y2.bootSE)}</td>
                      <td>[{yazSayi(y2.bootAlt)}, {yazSayi(y2.bootUst)}]</td><td>{anlamli(y2) ? t({ tr: "anlamlı", en: "significant" }) : t({ tr: "anlamlı değil", en: "not significant" })}</td>
                    </tr>
                  ))}
                  <tr className={toplamAnlamli ? "stats-significant" : undefined}>
                    <td>{t({ tr: "Toplam dolaylı etki", en: "Total indirect effect" })}</td><td>{yazSayi(r.toplamDolayli.etki)}</td><td>{yazSayi(r.toplamDolayli.bootSE)}</td>
                    <td>[{yazSayi(r.toplamDolayli.bootAlt)}, {yazSayi(r.toplamDolayli.bootUst)}]</td><td>{toplamAnlamli ? t({ tr: "anlamlı", en: "significant" }) : t({ tr: "anlamlı değil", en: "not significant" })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="tone-text mt-sm" data-tone={toplamAnlamli ? "success" : "warning"}>
              {r.yollar.filter(anlamli).length
                ? t({
                    tr: `Anlamlı dolaylı yollar: ${r.yollar.map((y2, i) => (anlamli(y2) ? `Ind${i + 1}` : "")).filter(Boolean).join(", ")} (bootstrap aralığı sıfırı içermiyor).`,
                    en: `Significant indirect paths: ${r.yollar.map((y2, i) => (anlamli(y2) ? `Ind${i + 1}` : "")).filter(Boolean).join(", ")} (the bootstrap interval does not include zero).`,
                  })
                : t({
                    tr: "Hiçbir özgül dolaylı yolun bootstrap aralığı sıfırı dışlamıyor.",
                    en: "No specific indirect path has a bootstrap interval that excludes zero.",
                  })}
            </p>
            {r.karsitliklar.length ? (
              <div className="mt-sm">
                <strong>{t({ tr: "Dolaylı etkilerin karşılaştırılması (karşıtlıklar)", en: "Comparison of indirect effects (contrasts)" })}</strong>
                <ul className="muted text-sm">
                  {r.karsitliklar.map((k2) => (
                    <li key={`${k2.a}-${k2.b}`}>
                      Ind{k2.a + 1} − Ind{k2.b + 1} = {yazSayi(k2.fark)}, {GA95} [{yazSayi(k2.bootAlt)}, {yazSayi(k2.bootUst)}]
                      {anlamli(k2)
                        ? t({ tr: " — iki dolaylı etki farklı", en: " — the two indirect effects differ" })
                        : t({ tr: " — iki dolaylı etki arasında fark yok", en: " — no difference between the two indirect effects" })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="muted text-sm">
              {t({
                tr: `${r.bootOrnek} bootstrap örneği, yüzdelik yöntem; aynı veri her zaman aynı aralığı verir.`,
                en: `${r.bootOrnek} bootstrap samples, percentile method; the same data always yields the same interval.`,
              })}{" "}
              R²(Y) = {yazSayi(r.rKareY)} ·{" "}
              {ms.map((m, j) => `R²(${m}) = ${yazSayi(r.rKareM[j])}`).join(" · ")}
            </p>
            {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
          </div>,
        );
      }

      if ((analysisType === "aracilik" && aracilar.length < 2) || analysisType === "duzenleyicilik") {
        const aracilikMi = analysisType === "aracilik";
        /* Tek aracılı modelde aracı, aracı seçiminden; düzenleyicilikte W seçim kutusundan. */
        const mAdi = aracilikMi ? (aracilar[0] ?? "") : varB;
        if (!varY || new Set([varA, mAdi, varY]).size < 3) {
          setResultError(
            aracilikMi
              ? t({ tr: "Bağımsız (X), aracı (M) ve sonuç (Y) için üç farklı değişken seçin.", en: "Select three different variables for the predictor (X), mediator (M) and outcome (Y)." })
              : t({ tr: "Bağımsız (X), düzenleyici (W) ve sonuç (Y) için üç farklı değişken seçin.", en: "Select three different variables for the predictor (X), moderator (W) and outcome (Y)." }),
          );
          return;
        }
        const kovlar = kovaryatlar.filter((c) => c !== varA && c !== mAdi && c !== varY);
        const veri = eslesenSutunlar(varA, mAdi, varY, ...kovlar);
        const [x, mw, y, ...k] = veri.sutunlar;
        if (veri.n < kovlar.length + 10) {
          setResultError(t({ tr: "Bu analiz için yeterli eşleşen gözlem yok (en az 10 ve kovaryat başına bir fazlası).", en: "Not enough complete observations for this analysis (at least 10, plus one per covariate)." }));
          return;
        }
        if (aracilikMi) {
          const r = aracilik(x, mw, y, k);
          if (!r || !hesaplanabilir(r.dolayli, r.a.p, r.b.p)) return setResultError(t(DEGISKENLIK_YOK));
          const anlamli = r.bootAlt > 0 || r.bootUst < 0;
          const yolSatiri = (ad: string, yol: { b: number; se: number; t: number; p: number }) => (
            <tr key={ad} className={isSignificant(yol.p) ? "stats-significant" : undefined}>
              <td>{ad}</td>
              <td>{yazSayi(yol.b)}</td>
              <td>{yazSayi(yol.se)}</td>
              <td>{yazSayi(yol.t)}</td>
              <td>{yazP(yol.p)}</td>
            </tr>
          );
          setResult(
            <div>
              <div className="table-scroll" role="region" aria-label={t({ tr: "Aracılık yolları", en: "Mediation paths" })} tabIndex={0}>
                <table className="stats-result-table">
                  <thead>
                    <tr><th>{t({ tr: "Yol", en: "Path" })}</th><th>B</th><th>{t({ tr: "SH", en: "SE" })}</th><th>t</th><th>p</th></tr>
                  </thead>
                  <tbody>
                    {yolSatiri(`a: ${varA} → ${mAdi}`, r.a)}
                    {yolSatiri(t({ tr: `b: ${mAdi} → ${varY} (${varA} kontrol)`, en: `b: ${mAdi} → ${varY} (controlling for ${varA})` }), r.b)}
                    {yolSatiri(t({ tr: `c: ${varA} → ${varY} (toplam etki)`, en: `c: ${varA} → ${varY} (total effect)` }), r.c)}
                    {yolSatiri(t({ tr: `c′: ${varA} → ${varY} (doğrudan etki)`, en: `c′: ${varA} → ${varY} (direct effect)` }), r.cUs)}
                  </tbody>
                </table>
              </div>
              <p className="tone-text mt-sm" data-tone={anlamli ? "success" : "warning"}>
                {t({ tr: "Dolaylı etki (a·b)", en: "Indirect effect (a·b)" })} = {yazSayi(r.dolayli)}, {t({ tr: "%95 bootstrap GA", en: "95% bootstrap CI" })} [{yazSayi(r.bootAlt)}, {yazSayi(r.bootUst)}]
                {anlamli
                  ? t({ tr: " — aralık sıfırı içermiyor: aracılık anlamlı", en: " — the interval does not include zero: the mediation is significant" })
                  : t({ tr: " — aralık sıfırı içeriyor: aracılık anlamlı değil", en: " — the interval includes zero: the mediation is not significant" })}
              </p>
              <p className="muted text-sm">
                {t({
                  tr: `Bootstrap SH = ${yazSayi(r.bootSE)} (${r.bootOrnek} örnek, yüzdelik yöntem) · standartlaştırılmış dolaylı etki = ${yazSayi(r.standartDolayli)}`,
                  en: `Bootstrap SE = ${yazSayi(r.bootSE)} (${r.bootOrnek} samples, percentile method) · standardized indirect effect = ${yazSayi(r.standartDolayli)}`,
                })}{" "}
                · Sobel z = {yazSayi(r.sobelZ)}, {yazP(r.sobelP)} · R²(M) = {yazSayi(r.rKareM)}, R²(Y) ={" "}
                {yazSayi(r.rKareY)} · N = {r.n}
                {kovlar.length ? t({ tr: ` · kontrol: ${kovlar.join(", ")}`, en: ` · covariates: ${kovlar.join(", ")}` }) : ""}
              </p>
              <p className="muted text-sm">
                {t({
                  tr: "Karar bootstrap aralığına göre verilir (Hayes, 2018); Sobel testi a·b'nin normal dağıldığını varsaydığı için yalnızca bilgi amaçlı.",
                  en: "The decision is based on the bootstrap interval (Hayes, 2018); the Sobel test assumes a·b is normally distributed and is shown for information only.",
                })}{" "}
                {anlamli && !isSignificant(r.cUs.p) ? t({ tr: "Doğrudan etki anlamsız: tam aracılık örüntüsü.", en: "The direct effect is not significant: a pattern of full mediation." }) : ""}
                {anlamli && isSignificant(r.cUs.p) ? t({ tr: "Doğrudan etki de anlamlı: kısmi aracılık örüntüsü.", en: "The direct effect is also significant: a pattern of partial mediation." }) : ""}
              </p>
              {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
            </div>,
          );
        } else {
          const r = duzenleyicilik(x, mw, y, k);
          if (!r || !hesaplanabilir(r.deltaF, r.deltaP)) return setResultError(t(DEGISKENLIK_YOK));
          const sig = isSignificant(r.deltaP);
          const adlar: Record<string, string> = { "(Sabit)": katsayiAdi("(Sabit)", dil), X: varA, W: mAdi, "X × W": `${varA} × ${mAdi}` };
          /* Koşullu etki etiketleri hesap modülünden Türkçe geliyor; ekranda çevriliyor. */
          const kosulEtiketi: Record<string, Metin> = {
            "Ortalama − 1 SS": { tr: "Ortalama − 1 SS", en: "M − 1 SD" },
            Ortalama: { tr: "Ortalama", en: "M" },
            "Ortalama + 1 SS": { tr: "Ortalama + 1 SS", en: "M + 1 SD" },
          };
          setResult(
            <div>
              <div className="table-scroll" role="region" aria-label={t({ tr: "Düzenleyicilik modeli", en: "Moderation model" })} tabIndex={0}>
                <table className="stats-result-table">
                  <thead>
                    <tr><th>{t({ tr: "Değişken (merkezlenmiş)", en: "Variable (centred)" })}</th><th>B</th><th>{t({ tr: "SH", en: "SE" })}</th><th>t</th><th>p</th></tr>
                  </thead>
                  <tbody>
                    {r.katsayilar.map((c) => (
                      <tr key={c.ad} className={c.ad !== "(Sabit)" && isSignificant(c.p) ? "stats-significant" : undefined}>
                        <td>{adlar[c.ad]}</td><td>{yazSayi(c.b)}</td><td>{yazSayi(c.se)}</td><td>{yazSayi(c.t)}</td><td>{yazP(c.p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="tone-text mt-sm" data-tone={sig ? "success" : "warning"}>
                {t({ tr: "Etkileşim", en: "Interaction" })}: ΔR² = {yazSayi(r.deltaRKare, 3)}, F(1, {r.df}) = {yazSayi(r.deltaF)}, {yazP(r.deltaP)}
                {sig
                  ? t({
                      tr: ` — ${varA}'in etkisi ${mAdi}'ye göre değişiyor (düzenleyicilik anlamlı)`,
                      en: ` — the effect of ${varA} depends on ${mAdi} (significant moderation)`,
                    })
                  : t({ tr: " — düzenleyicilik anlamlı değil", en: " — the moderation is not significant" })}
              </p>
              <p className="muted text-sm">
                R² = {yazSayi(r.rKare)} · N = {r.n}
                {kovlar.length ? t({ tr: ` · kontrol: ${kovlar.join(", ")}`, en: ` · covariates: ${kovlar.join(", ")}` }) : ""}
              </p>
              <strong>{t({ tr: `${mAdi} düzeylerinde ${varA}'in koşullu etkisi`, en: `Conditional effect of ${varA} at levels of ${mAdi}` })}</strong>
              <div className="table-scroll" role="region" aria-label={t({ tr: "Koşullu etkiler", en: "Conditional effects" })} tabIndex={0}>
                <table className="stats-result-table">
                  <thead>
                    <tr><th>{mAdi}</th><th>{t({ tr: "Etki", en: "Effect" })}</th><th>{t({ tr: "SH", en: "SE" })}</th><th>t</th><th>p</th><th>{GA95}</th></tr>
                  </thead>
                  <tbody>
                    {r.kosullu.map((c) => (
                      <tr key={c.etiket} className={isSignificant(c.p) ? "stats-significant" : undefined}>
                        <td>
                          {c.etiket.startsWith("W =")
                            ? yazSayi(c.w)
                            : `${kosulEtiketi[c.etiket] ? t(kosulEtiketi[c.etiket]) : c.etiket} (${yazSayi(c.w)})`}
                        </td>
                        <td>{yazSayi(c.etki)}</td><td>{yazSayi(c.se)}</td><td>{yazSayi(c.t)}</td><td>{yazP(c.p)}</td>
                        <td>[{yazSayi(c.alt)}, {yazSayi(c.ust)}]</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {r.jnSinirlari.length ? (
                <p className="muted text-sm">
                  Johnson-Neyman:{" "}
                  {t({
                    tr: `${varA}'in etkisi ${mAdi} = ${r.jnSinirlari.map((v) => yazSayi(v)).join(" ve ")} noktasında anlamlılık sınırını geçiyor (gözlenen aralık ${yazSayi(r.wAralik[0])}–${yazSayi(r.wAralik[1])}).`,
                    en: `the effect of ${varA} crosses the significance threshold at ${mAdi} = ${r.jnSinirlari.map((v) => yazSayi(v)).join(" and ")} (observed range ${yazSayi(r.wAralik[0])}–${yazSayi(r.wAralik[1])}).`,
                  })}
                </p>
              ) : null}
              <p className="muted text-sm">
                {t({
                  tr: `${varA} ve ${mAdi} ortalamadan arındırılarak (merkezlenerek) modellendi; etkileşim katsayısı bundan etkilenmez.`,
                  en: `${varA} and ${mAdi} were mean-centred before modelling; the interaction coefficient is not affected by this.`,
                })}
              </p>
              {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
            </div>,
          );
        }
      }

      if (analysisType === "dfa") {
        const faktorler = dfaFaktorleri.filter((f) => f.maddeler.length);
        if (faktorler.length < 1 || faktorler.some((f) => f.maddeler.length < 2) || (faktorler.length === 1 && faktorler[0].maddeler.length < 3)) {
          setResultError(t({ tr: "Her faktöre en az iki madde atayın (tek faktörlü modelde en az üç).", en: "Assign at least two items to each factor (at least three in a one-factor model)." }));
          return;
        }
        const maddeler = faktorler.flatMap((f) => f.maddeler);
        const veri = eslesenSutunlar(...maddeler);
        /* Hata kovaryansları madde ADIYLA tutuluyor; modelde olmayan maddeye ait çift düşer. */
        const hataCiftleri = dfaHataKovaryanslari.flatMap(([a, b]): [number, number][] => {
          const i = maddeler.indexOf(a);
          const j = maddeler.indexOf(b);
          return i >= 0 && j >= 0 && i !== j ? [[Math.min(i, j), Math.max(i, j)]] : [];
        });
        const faktorYedekAdi = t({ tr: "Faktör", en: "Factor" });
        const r = dogrulayiciFaktorAnalizi(
          veri.sutunlar,
          maddeler,
          {
            faktorler: faktorler.map((f) => f.ad.trim() || faktorYedekAdi),
            maddeFaktoru: faktorler.flatMap((f, k) => f.maddeler.map(() => k)),
            hataKovaryanslari: hataCiftleri,
          },
          dil,
        );
        if (r === "az-madde") return setResultError(t({ tr: "DFA için en az üç madde gerekir.", en: "CFA requires at least three items." }));
        if (r === "az-gozlem")
          return setResultError(
            t({
              tr: `Gözlem sayısı (${veri.n}) madde sayısından fazla olmalı; DFA için genel öneri en az 200 kişi.`,
              en: `The number of observations (${veri.n}) must exceed the number of items; a common recommendation for CFA is at least 200 participants.`,
            }),
          );
        if (r === "tanimsiz")
          return setResultError(
            t({
              tr: "Model tanımlanamıyor: her faktörde en az iki madde olmalı ve serbest parametre sayısı veriyi aşmamalı.",
              en: "The model is not identified: each factor needs at least two items and the number of free parameters must not exceed the data.",
            }),
          );
        if (r === "kestirilemedi")
          return setResultError(
            t({
              tr: "Model kestirilemedi: kovaryans matrisi tekil (bir madde diğerinin aynısı ya da değişkenliği yok) ya da başlangıç noktası uygun değil.",
              en: "The model could not be estimated: the covariance matrix is singular (an item duplicates another or has no variability) or the starting values are unsuitable.",
            }),
          );
        const indeks = (ad: "chiKareDf" | "cfi" | "tli" | "rmsea" | "srmr" | "gfi" | "agfi", etiket: string, deger: number) => (
          <tr key={ad}>
            <td>{etiket}</td>
            <td>{yazSayi(deger, 3)}</td>
            <td>{t(UYUM_YORUMU_METIN[uyumYorumu(ad, deger)])}</td>
          </tr>
        );
        const adlar = faktorler.map((f) => f.ad.trim() || faktorYedekAdi);
        /*
          DEĞİŞİKLİK İNDEKSLERİ kopyalanan sonuç metninin DIŞINDA: çalışma
          önerisi, rapor değil; "Modele ekle" düğmeleri de metne karışmasın.
        */
        const oneriler = r.degisiklikIndeksleri.filter((d) => d.mi >= MI_ESIGI).slice(0, 15);
        setSonucGrafigi(
          <details className="analiz-betik mt-sm" open={oneriler.length > 0}>
            <summary>
              {t({ tr: "Değişiklik (modifikasyon) indeksleri", en: "Modification indices" })}
              {oneriler.length ? t({ tr: ` · ${oneriler.length} öneri`, en: ` · ${oneriler.length} suggestion(s)` }) : ""}
            </summary>
            {oneriler.length ? (
              <>
                <div className="table-scroll" role="region" aria-label={t({ tr: "Değişiklik indeksleri", en: "Modification indices" })} tabIndex={0}>
                  <table className="stats-result-table">
                    <thead>
                      <tr><th>{t({ tr: "Öneri", en: "Suggestion" })}</th><th>MI</th><th>EPC</th><th>Std. EPC</th><th /></tr>
                    </thead>
                    <tbody>
                      {oneriler.map((d) => {
                        const ciftAdi: [string, string] = [maddeler[d.i], maddeler[d.j]];
                        const ayniFaktor = d.tur === "hata-kovaryansi" && faktorler.some((f) => f.maddeler.includes(ciftAdi[0]) && f.maddeler.includes(ciftAdi[1]));
                        return (
                          <tr key={`${d.tur}-${d.i}-${d.j}`}>
                            <td>{d.etiket}</td><td>{yazSayi(d.mi)}</td><td>{yazSayi(d.epc)}</td><td>{yazSayi(d.sepc)}</td>
                            <td>
                              {d.tur === "hata-kovaryansi" ? (
                                <button
                                  type="button"
                                  className="projects-filter-button button-compact"
                                  onClick={() => {
                                    setDfaHataKovaryanslari((h) => [...h, ciftAdi]);
                                    showToast(
                                      "success",
                                      t({
                                        tr: `${ciftAdi[0]} ↔ ${ciftAdi[1]} modele eklendi; analizi yeniden çalıştırın.`,
                                        en: `${ciftAdi[0]} ↔ ${ciftAdi[1]} added to the model; run the analysis again.`,
                                      }),
                                    );
                                  }}
                                >
                                  {t({ tr: "Modele ekle", en: "Add to model" })}
                                  {ayniFaktor ? "" : t({ tr: " (farklı faktör)", en: " (different factor)" })}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="muted text-sm">
                  {t({
                    tr: "MI, o parametre serbest bırakılsa χ²'nin yaklaşık ne kadar düşeceğidir (eşik 3,84). Değişikliği YALNIZCA kuramsal bir gerekçe varsa yapın: aynı faktördeki benzer ifadeli iki maddenin hatalarını ilişkilendirmek yaygın ve savunulabilir; farklı faktörlerdeki maddeler ya da çapraz yük yapının sorunlu olduğunu gösterir — o maddeyi gözden geçirin. Her seferinde tek değişiklik yapıp analizi yeniden çalıştırın ve yaptığınız her değişikliği tezde raporlayın.",
                    en: "MI is the approximate drop in χ² if that parameter were freed (threshold 3.84). Make a change ONLY if there is a theoretical justification: correlating the errors of two similarly worded items on the same factor is common and defensible; items on different factors or a cross-loading indicate a problem with the structure — review that item. Make one change at a time, rerun the analysis and report every change in your thesis.",
                  })}
                </p>
              </>
            ) : (
              <p className="muted text-sm">
                {t({
                  tr: "3,84'ün üzerinde değişiklik indeksi yok; model sabit parametrelerden kaynaklanan belirgin bir uyumsuzluk göstermiyor.",
                  en: "No modification index exceeds 3.84; the model shows no marked misfit due to fixed parameters.",
                })}
              </p>
            )}
          </details>,
        );
        setResult(
          <div>
            <p className="tone-text" data-tone={r.cfi >= 0.9 && r.rmsea <= 0.08 ? "success" : "warning"}>
              χ²({r.df}, N = {r.n}) = {yazSayi(r.chiKare)}, {yazP(r.p)} · CFI = {yazSayi(r.cfi, 3)} · TLI = {yazSayi(r.tli, 3)} · RMSEA ={" "}
              {yazSayi(r.rmsea, 3)} · SRMR = {yazSayi(r.srmr, 3)}
            </p>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Uyum indeksleri", en: "Fit indices" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>{t({ tr: "İndeks", en: "Index" })}</th><th>{t({ tr: "Değer", en: "Value" })}</th><th>{t({ tr: "Değerlendirme", en: "Evaluation" })}</th></tr>
                </thead>
                <tbody>
                  {indeks("chiKareDf", t({ tr: "χ²/sd", en: "χ²/df" }), r.chiKareDf)}
                  {indeks("cfi", "CFI", r.cfi)}
                  {indeks("tli", "TLI (NNFI)", r.tli)}
                  {indeks("rmsea", "RMSEA", r.rmsea)}
                  {indeks("srmr", "SRMR", r.srmr)}
                  {indeks("gfi", "GFI", r.gfi)}
                  {indeks("agfi", "AGFI", r.agfi)}
                </tbody>
              </table>
            </div>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Faktör yükleri", en: "Factor loadings" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{t({ tr: "Faktör", en: "Factor" })}</th><th>{t({ tr: "Madde", en: "Item" })}</th><th>{t({ tr: "Standart yük", en: "Standardized loading" })}</th>
                    <th>B</th><th>{t({ tr: "SH", en: "SE" })}</th><th>z</th><th>p</th><th>R²</th>
                  </tr>
                </thead>
                <tbody>
                  {r.yukler.map((y) => (
                    <tr key={y.madde} className={y.std < 0.5 ? undefined : "stats-significant"}>
                      <td>{y.faktor}</td><td>{y.madde}</td><td>{yazSayi(y.std)}</td><td>{yazSayi(y.b)}</td><td>{yazSayi(y.se)}</td>
                      <td>{yazSayi(y.z)}</td><td>{yazP(y.p)}</td><td>{yazSayi(y.std * y.std)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-scroll" role="region" aria-label={t({ tr: "Güvenirlik ve geçerlik", en: "Reliability and validity" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{t({ tr: "Faktör", en: "Factor" })}</th><th>CR</th><th>AVE</th><th>√AVE</th>
                    {adlar.map((a) => (
                      <th key={a}>r ({a})</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adlar.map((a, k) => (
                    <tr key={a}>
                      <td>{a}</td><td>{yazSayi(r.cr[k])}</td><td>{yazSayi(r.ave[k])}</td><td>{yazSayi(Math.sqrt(r.ave[k]))}</td>
                      {adlar.map((_, j) => (
                        <td key={j}>{j === k ? "—" : yazSayi(r.faktorKorelasyonlari[k][j])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted text-sm">
              {t({
                tr: "Eşikler (Hu ve Bentler, 1999; Kline, 2016): CFI/TLI ≥ .90 kabul edilebilir, ≥ .95 iyi; RMSEA ve SRMR ≤ .08 kabul edilebilir, ≤ .05 iyi. Standart yük ≥ .50, CR ≥ .70 ve AVE ≥ .50 yaygın ölçütler; ayırt edici geçerlik için √AVE, faktörün diğer faktörlerle korelasyonundan büyük olmalı (Fornell-Larcker). Kestirim en çok olabilirlik, χ² = (N − 1)·F (AMOS/LISREL kuralı); faktör varyansları 1'e sabit.",
                en: "Thresholds (Hu & Bentler, 1999; Kline, 2016): CFI/TLI ≥ .90 acceptable, ≥ .95 good; RMSEA and SRMR ≤ .08 acceptable, ≤ .05 good. Standardized loading ≥ .50, CR ≥ .70 and AVE ≥ .50 are common criteria; for discriminant validity √AVE should exceed the factor's correlations with the other factors (Fornell–Larcker). Maximum likelihood estimation, χ² = (N − 1)·F (AMOS/LISREL convention); factor variances fixed to 1.",
              })}
            </p>
            {r.heywood.length ? (
              <p className="tone-text text-sm" data-tone="warning">
                {t({
                  tr: `Negatif hata varyansı (Heywood durumu): ${r.heywood.join(", ")}. Model ya da örneklem sorunlu; bu maddelerin yerini ve örneklem büyüklüğünü gözden geçirin, sonucu bu hâliyle raporlamayın.`,
                  en: `Negative error variance (Heywood case): ${r.heywood.join(", ")}. The model or sample is problematic; review the placement of these items and the sample size, and do not report the result as it stands.`,
                })}
              </p>
            ) : null}
            {!r.yakinsadi ? (
              <p className="tone-text text-sm" data-tone="warning">
                {t({ tr: "Kestirim tam yakınsamadı; değerleri temkinli okuyun.", en: "Estimation did not fully converge; interpret the values with caution." })}
              </p>
            ) : null}
            {r.hataKovaryanslari.length ? (
              <div className="table-scroll" role="region" aria-label={t({ tr: "Hata kovaryansları", en: "Error covariances" })} tabIndex={0}>
                <table className="stats-result-table">
                  <thead>
                    <tr>
                      <th>{t({ tr: "Hata kovaryansı", en: "Error covariance" })}</th><th>{t({ tr: "Kovaryans", en: "Covariance" })}</th>
                      <th>{t({ tr: "Korelasyon", en: "Correlation" })}</th><th>{t({ tr: "SH", en: "SE" })}</th><th>p</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.hataKovaryanslari.map((h) => (
                      <tr key={`${h.a}-${h.b}`}>
                        <td>{h.a} ↔ {h.b}</td><td>{yazSayi(h.kov)}</td><td>{yazSayi(h.r)}</td><td>{yazSayi(h.se)}</td><td>{yazP(h.p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {elemeNotu(veri, dil) ? <p className="muted text-sm">{elemeNotu(veri, dil)}</p> : null}
          </div>,
        );
      }

      if (analysisType === "kruskalwallis") {
        if (groupLevels.length < 3) {
          setResultError(
            t({
              tr: `Kruskal-Wallis en az 3 grup gerektirir (2 grup için Mann-Whitney U kullanın). Seçili değişkende ${groupLevels.length} grup bulundu.`,
              en: `The Kruskal–Wallis H test requires at least 3 groups (use Mann–Whitney U for 2 groups). The selected variable has ${groupLevels.length} groups.`,
            }),
          );
          return;
        }
        const grouped = getGroupedNumeric(varA, groupVar);
        const groups = groupLevels.map((g) => grouped.get(g) ?? []);
        if (groups.some((g) => g.length < 2)) {
          setResultError(t({ tr: "Her grupta en az 2 gözlem olmalıdır.", en: "Each group must have at least 2 observations." }));
          return;
        }
        const r = kruskalWallis(groups);
        if (!hesaplanabilir(r.h, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              {groupLevels.map((ad, i) => (
                <span key={ad}>
                  <strong>{ad}</strong>:{" "}
                  {t({
                    tr: `N=${groups[i].length}, sıra ort.=${yazSayi(r.siraOrtalamalari[i])}`,
                    en: `N = ${groups[i].length}, mean rank = ${yazSayi(r.siraOrtalamalari[i])}`,
                  })}
                  <br />
                </span>
              ))}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              H({r.df}) = {yazSayi(r.h)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            <p className="muted text-sm">ε² = {yazSayi(r.epsilonKare)} ({t({ tr: "sıralara dayalı etki büyüklüğü", en: "rank-based effect size" })})</p>
          </div>,
        );
      }

      if (analysisType === "spearman") {
        const veri = eslesenSutunlar(varA, varB);
        const [x, y] = veri.sutunlar;
        if (veri.n < 3) {
          setResultError(t({ tr: "Korelasyon için en az 3 eşleşen gözlem gereklidir.", en: "A correlation requires at least 3 paired observations." }));
          return;
        }
        const r = spearmanKorelasyonu(x, y);
        if (!hesaplanabilir(r.r, r.p)) return setResultError(t(DEGISKENLIK_YOK));
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              r<sub>s</sub>({r.df}) = {yazSayi(r.r)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            <p className="muted text-sm">
              {t({
                tr: `Açıklanan varyans ${yazSayi(r.rKare * 100)}% · ilişki ${ETKI_YORUMU_METIN[r.rYorum].tr}`,
                en: `Variance explained ${yazSayi(r.rKare * 100)}% · ${ETKI_YORUMU_METIN[r.rYorum].en} association`,
              })}
            </p>
          </div>,
        );
      }

      if (analysisType === "chisquare") {
        if (!dataset) return;
        /*
          Boş hücre kategori DEĞİL. Eskiden String(null) "null" diye bir düzey
          açıyordu: yanıtsız anket maddeleri fazladan satır/sütun olarak χ²,
          sd, N ve Cramér V'yi değiştiriyordu; R ve Python betikleri eksik
          değeri atıyordu, sonuçlar uyuşmuyordu.
        */
        const dolu = (v: CellValue) => v !== null && v !== "";
        const rowLevels = [...new Set(dataset.rows.filter((r) => dolu(r[groupVar]) && dolu(r[varA])).map((r) => String(r[groupVar])))];
        const colLevels = [...new Set(dataset.rows.filter((r) => dolu(r[groupVar]) && dolu(r[varA])).map((r) => String(r[varA])))];
        if (rowLevels.length < 2 || colLevels.length < 2) {
          setResultError(t({ tr: "Ki-kare testi için her iki değişkende de en az 2 kategori olmalıdır.", en: "The chi-square test requires at least 2 categories in each variable." }));
          return;
        }
        const table = rowLevels.map((rl) =>
          colLevels.map(
            (cl) => dataset.rows.filter((r) => String(r[groupVar]) === rl && String(r[varA]) === cl).length
          )
        );
        const r = chiSquareIndependence(table);
        if (!hesaplanabilir(r.chi2, r.p)) return setResultError(t(BEKLENEN_SIFIR));
        const sig = isSignificant(r.p);
        /*
          Varsayım düştüğünde 2×2 tabloda Fisher kesin testi de
          yazılıyor. Uyarıyı tek başına vermek kullanıcıyı çıkmazda
          bırakırdı: "testin geçersiz" deyip yerine bir şey
          vermemek, Welch'ten önceki durumun aynısı. Fisher
          yaklaşım DEĞİL, küçük örneklemde doğru olan test o.

          İkiden büyük tablolarda kesin testin karşılığı yok:
          kategorileri birleştirmek ya da örneklemi büyütmek gerekiyor
          ve bu kullanıcının kararı.
        */
        const ikiyeIki = table.length === 2 && table[0].length === 2;
        const fisherP = !r.varsayimSaglandi && ikiyeIki ? fisherKesinTesti(table) : null;
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label={SONUC_TABLOSU} tabIndex={0}>
            <table className="stats-result-table">
              <thead>
                <tr>
                  <th></th>
                  {colLevels.map((cl) => (
                    <th key={cl}>{cl}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowLevels.map((rl, i) => (
                  <tr key={rl}>
                    <td>
                      <strong>{rl}</strong>
                    </td>
                    {table[i].map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="tone-text mt-sm" data-tone={sig ? "success" : "warning"}>
              χ²({r.df}, N = {r.n}) = {yazSayi(r.chi2)}, {yazP(r.p)}
              {anlamliYaz(sig)}
            </p>
            {/* Etki büyüklüğü hesaplanıyordu ama ekranda hiç
                yazılmıyordu: p "ilişki var mı"yı, V "ne kadar
                güçlü"yü söyler. Öteki testlerde zaten yazılıyor. */}
            <p className="muted text-sm">
              Cramér&apos;s V = {yazSayi(r.cramersV)} ({etkiEtiketi(r.vYorum)})
            </p>
            <div className="mt-sm">
              <strong>{t({ tr: "Varsayım", en: "Assumption" })}</strong>
              <ul className="muted text-sm">
                <li>
                  {t({
                    tr: `En küçük beklenen frekans ${yazSayi(r.enKucukBeklenen, 2)}; hücrelerin ${yazSayi(r.dusukHucreOrani * 100, 0)}%'inde beklenen 5'in altında`,
                    en: `Smallest expected frequency ${yazSayi(r.enKucukBeklenen, 2)}; ${yazSayi(r.dusukHucreOrani * 100, 0)}% of cells have an expected count below 5`,
                  })}{" "}
                  —{" "}
                  {r.varsayimSaglandi
                    ? t({ tr: "ölçüt sağlanıyor", en: "the criterion is met" })
                    : t({ tr: "ölçüt sağlanmıyor", en: "the criterion is not met" })}
                </li>
              </ul>
              {!r.varsayimSaglandi && (
                <p className="tone-text text-sm" data-tone="warning">
                  {t({
                    tr: "Beklenen frekanslar küçük: χ² sürekli bir dağılıma yaklaşımdır ve bu durumda p değeri olduğundan küçük çıkar.",
                    en: "Expected frequencies are small: χ² is an approximation to a continuous distribution, and in this case the p value comes out smaller than it should.",
                  })}
                  {fisherP === null
                    ? t({
                        tr: " İkiden çok kategorili tabloda kesin testin karşılığı yok; kategorileri birleştirmek ya da örneklemi büyütmek gerekir.",
                        en: " There is no exact test for tables with more than two categories; categories need to be merged or the sample enlarged.",
                      })
                    : ""}
                </p>
              )}
              {fisherP !== null && Number.isFinite(fisherP) ? (
                <div className="stats-welch">
                  <p className="tone-text" data-tone={isSignificant(fisherP) ? "success" : "warning"}>
                    {t({ tr: "Fisher kesin testi (iki kuyruklu)", en: "Fisher's exact test (two-tailed)" })}: {yazP(fisherP)}
                    {anlamliYaz(isSignificant(fisherP))}
                  </p>
                  <p className="muted text-sm">
                    {t({
                      tr: "Yaklaşım değil, kesin hesap: kenar toplamları sabitken bütün tabloların olasılığı toplanıyor. Beklenen frekanslar küçükken raporlanması gereken satır budur.",
                      en: "An exact computation, not an approximation: the probabilities of all tables with the same margins are summed. This is the line to report when expected frequencies are small.",
                    })}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        );
      }

      if (analysisType === "ikiyonluanova") {
        if (!dataset) return;
        if (!groupVar2 || groupVar2 === groupVar) {
          setResultError(t({ tr: "İki yönlü ANOVA için birbirinden farklı iki kategorik faktör seçin.", en: "Select two different categorical factors for a two-way ANOVA." }));
          return;
        }
        /*
          Satır hizası burada da şart: üç sütunun (iki faktör + ölçüm)
          HEPSİ dolu olan satırlar alınıyor. Faktörler kategorik olduğu
          için eslesenSutunlar kullanılamıyor (o sayısal sütunlar için).
        */
        const gozlemler: { a: string; b: string; deger: number }[] = [];
        let dusen = 0;
        for (const satir of dataset.rows) {
          const fa = satir[groupVar];
          const fb = satir[groupVar2];
          const deger = satir[varA];
          if (fa === null || fa === "" || fb === null || fb === "" || !isNumericValue(deger)) {
            dusen += 1;
            continue;
          }
          gozlemler.push({ a: String(fa), b: String(fb), deger: Number(deger) });
        }

        const r = ikiYonluAnova(gozlemler, groupVar, groupVar2);
        if (typeof r === "string") {
          setResultError(t(IKI_YONLU_HATA[r]));
          return;
        }
        if (!hesaplanabilir(r.faktorA.f, r.faktorA.p)) return setResultError(t(DEGISKENLIK_YOK));

        const satirlar = [r.faktorA, r.faktorB, r.etkilesim];
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label={t({ tr: "İki yönlü ANOVA tablosu", en: "Two-way ANOVA table" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{t({ tr: "Kaynak", en: "Source" })}</th>
                    <th>{t({ tr: "KT", en: "SS" })}</th>
                    <th>{t({ tr: "sd", en: "df" })}</th>
                    <th>{t({ tr: "KO", en: "MS" })}</th>
                    <th>F</th>
                    <th>p</th>
                    <th>{t({ tr: "kısmi η²", en: "partial η²" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((etki) => (
                    <tr key={etki.ad}>
                      <td>{etki.ad}</td>
                      <td>{yazSayi(etki.ss)}</td>
                      <td>{etki.df}</td>
                      <td>{yazSayi(etki.ms)}</td>
                      <td className={isSignificant(etki.p) ? "tone-text" : undefined} data-tone={isSignificant(etki.p) ? "success" : undefined}>
                        {yazSayi(etki.f)}
                      </td>
                      <td>{yazP(etki.p)}</td>
                      <td>{yazSayi(etki.kismiEtaKare)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>{t({ tr: "Hata", en: "Error" })}</td>
                    <td>{yazSayi(r.hata.ss)}</td>
                    <td>{r.hata.df}</td>
                    <td>{yazSayi(r.hata.ms)}</td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
            {/*
              ETKİLEŞİM ÖNCE OKUNUR. Etkileşim anlamlıysa ana etkiler tek
              başına yanıltıcıdır: "sınıf düzeyi fark yaratıyor" demek,
              farkın kadınlarda ve erkeklerde AYNI olduğunu varsayar.
            */}
            <p className="tone-text" data-tone={isSignificant(r.etkilesim.p) ? "warning" : "success"}>
              {isSignificant(r.etkilesim.p)
                ? t({
                    tr: "Etkileşim anlamlı: bir faktörün etkisi, öteki faktörün düzeyine göre değişiyor. Ana etkileri tek başına yorumlamayın; aşağıdaki hücre ortalamalarına bakın.",
                    en: "The interaction is significant: the effect of one factor depends on the level of the other. Do not interpret the main effects on their own; look at the cell means below.",
                  })
                : t({
                    tr: "Etkileşim anlamlı değil: ana etkiler tek başına yorumlanabilir.",
                    en: "The interaction is not significant: the main effects can be interpreted on their own.",
                  })}
            </p>
            <div className="table-scroll mt-sm" role="region" aria-label={t({ tr: "Hücre ortalamaları", en: "Cell means" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{groupVar} \ {groupVar2}</th>
                    {r.duzeyB.map((b) => (
                      <th key={b}>{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.duzeyA.map((a) => (
                    <tr key={a}>
                      <td>
                        <strong>{a}</strong>
                      </td>
                      {r.duzeyB.map((b) => {
                        const hucre = r.hucreler.find((h) => h.a === a && h.b === b);
                        return (
                          <td key={b}>
                            {hucre ? `${yazSayi(hucre.ortalama)} (n=${hucre.n})` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/*
              BASİT ETKİLER yalnızca etkileşim anlamlıyken. Anlamsız bir
              etkileşimin ardından alt grupları tek tek sınamak,
              düzeltmenin koruduğu şeyi baştan delmek olurdu — ANOVA'nın
              ikili karşılaştırmalarındaki kuralın aynısı.
            */}
            {isSignificant(r.etkilesim.p) && (
              <div className="mt-sm">
                <strong>{t({ tr: "Basit etkiler (Bonferroni düzeltmeli)", en: "Simple effects (Bonferroni-corrected)" })}</strong>
                <ul className="muted text-sm">
                  {[
                    ...basitEtkiler(gozlemler, r, "a", groupVar, groupVar2),
                    ...basitEtkiler(gozlemler, r, "b", groupVar, groupVar2),
                  ].map((etki) => (
                    <li key={`${etki.faktor}-${etki.duzey}`}>
                      {dil === "en" ? (
                        <>
                          {etki.faktor} within <b>{etki.duzey}</b>
                        </>
                      ) : (
                        <>
                          <b>{etki.duzey}</b> içinde {etki.faktor}
                        </>
                      )}
                      : F({etki.df}, {r.hata.df}) = {yazSayi(etki.f)}, {yazP(etki.p)}
                      {etki.anlamli ? t({ tr: " — anlamlı", en: " — significant" }) : t({ tr: " — anlamlı değil", en: " — not significant" })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="muted text-sm">
              {t({
                tr: "Kareler toplamı model karşılaştırmasıyla (III. tip) hesaplanır; hücreler eşit büyüklükte olmadığında ders kitabının kapalı formülleri geçerli değildir.",
                en: "Sums of squares are computed by model comparison (Type III); when cells are unequal in size, the closed-form textbook formulas do not apply.",
              })}
              {r.dengeli
                ? t({ tr: " Bu veride hücreler eşit büyüklükte.", en: " In these data the cells are equal in size." })
                : t({ tr: " Bu veride hücreler eşit büyüklükte DEĞİL.", en: " In these data the cells are NOT equal in size." })}
              {dusen > 0
                ? t({ tr: ` ${dusen} satır eksik veri yüzünden analiz dışı bırakıldı.`, en: ` ${dusen} row(s) were excluded from the analysis because of missing data.` })
                : ""}
            </p>
            {/* Varsayımlar HÜCRE düzeyinde: iki yönlü modelde normallik ve
                varyans homojenliği her kesişim için ayrı ayrı geçerli
                olmalı, faktörlerin kenar toplamları için değil. */}
            {varsayimSeridi(
              r.hucreler.map((h) => gozlemler.filter((g) => g.a === h.a && g.b === h.b).map((g) => g.deger)),
              r.hucreler.map((h) => `${h.a} · ${h.b}`),
            )}
          </div>
        );
      }

      if (analysisType === "reliability") {
        if (reliabilityItems.length < 2) {
          setResultError(t({ tr: "Güvenilirlik analizi için en az 2 madde seçmelisiniz.", en: "Select at least 2 items for a reliability analysis." }));
          return;
        }
        const veri = eslesenSutunlar(...reliabilityItems);
        if (veri.n < 3) {
          setResultError(t({ tr: "Yetersiz veri: bütün maddeleri dolu olan en az 3 satır gerekiyor.", en: "Insufficient data: at least 3 rows with all items present are required." }));
          return;
        }
        const r = cronbachAlpha(veri.sutunlar);
        if (!hesaplanabilir(r.alpha)) return setResultError(t(DEGISKENLIK_YOK));
        const level =
          r.alpha >= 0.9
            ? t({ tr: "mükemmel", en: "excellent" })
            : r.alpha >= 0.8
            ? t({ tr: "iyi", en: "good" })
            : r.alpha >= 0.7
            ? t({ tr: "kabul edilebilir", en: "acceptable" })
            : r.alpha >= 0.6
            ? t({ tr: "şüpheli", en: "questionable" })
            : t({ tr: "düşük", en: "poor" });
        setResult(
          <div>
            <p>
              <strong>
                Cronbach&apos;s α = {yazSayi(r.alpha, 3)} (
                {t({ tr: `${r.k} madde, N = ${r.n}`, en: `${r.k} items, N = ${r.n}` })}) —{" "}
                {t({ tr: "güvenilirlik düzeyi", en: "reliability level" })}: {level}
              </strong>
              {elemeNotu(veri, dil) ? <span className="muted text-sm"> · {elemeNotu(veri, dil)}</span> : null}
            </p>
            {/*
              MADDE İSTATİSTİKLERİ. Tek bir alfa sayısı "ölçek güvenilir mi"
              sorusunu yanıtlıyor ama "hangi madde bozuyor" sorusunu değil;
              alfa düşük çıktığında öğrencinin elinde atılacak maddeyi
              gösteren hiçbir şey yoktu.
            */}
            <div className="table-scroll" role="region" aria-label={t({ tr: "Madde istatistikleri", en: "Item statistics" })} tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>{t({ tr: "Madde", en: "Item" })}</th>
                    <th>{t({ tr: "Düzeltilmiş madde-toplam r", en: "Corrected item–total r" })}</th>
                    <th>{t({ tr: "Madde silinirse α", en: "α if item deleted" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.maddeler.map((madde) => {
                    /* Eşik 0,30: bu değerin altındaki madde ölçeğin ölçtüğü
                       şeyi ölçmüyor sayılır. Negatifse madde büyük olasılıkla
                       ters kodlanmış ve çevrilmemiştir. */
                    const zayif = Number.isFinite(madde.duzeltilmisKorelasyon) && madde.duzeltilmisKorelasyon < 0.3;
                    return (
                      <tr key={madde.sira}>
                        <td>{reliabilityItems[madde.sira]}</td>
                        <td className={zayif ? "tone-text" : undefined} data-tone={zayif ? "warning" : undefined}>
                          {Number.isFinite(madde.duzeltilmisKorelasyon) ? yazSayi(madde.duzeltilmisKorelasyon, 3) : "—"}
                        </td>
                        <td>{Number.isFinite(madde.alphaSilinirse) ? yazSayi(madde.alphaSilinirse, 3) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted text-sm">
              {t({
                tr: "Düzeltilmiş madde-toplam korelasyonu maddeyi DİĞER maddelerin toplamıyla karşılaştırır. 0,30'un altı maddenin ölçekle örtüşmediğine, negatif değer ters kodlanmış olabileceğine işaret eder.",
                en: "The corrected item–total correlation compares the item with the sum of the OTHER items. Values below .30 suggest the item does not fit the scale; a negative value suggests it may be reverse-coded.",
              })}
            </p>
          </div>
        );
      }
    } catch (err) {
      console.error(err);
      setCalisanAnaliz(null);
      setResultError(
        t({
          tr: "Analiz çalıştırılırken bir hata oluştu. Seçtiğiniz değişkenlerin uygun türde olduğundan emin olun.",
          en: "An error occurred while running the analysis. Make sure the selected variables are of the appropriate type.",
        }),
      );
    }
  }, [dataset, fileName, analysisType, varA, varB, groupVar, groupVar2, groupLevels, reliabilityItems, yordayicilar, olcumler, testDegeri, kovaryatlar, olayDegeri, faktorSayisi, varY, aracilar, araciModeli, dfaFaktorleri, dfaHataKovaryanslari, ikiDegerliSutunlar, getNumericColumn, getGroupedNumeric, eslesenSutunlar, yazP, yazSayi, yazYuzde, anlamliYaz, etkiEtiketi, GA95, SONUC_TABLOSU, t, dil, pencere, yorumIste]);

  return (
    <section className={pencere ? "analiz-pencere-govde" : "project-form-card"}>
      {pencere ? (
        <>
          <h3 className="pencere-kart-baslik">{t({ tr: "Veriniz", en: "Your data" })}</h3>
          <p className="muted text-sm mb-md">
            {t({
              tr: "Excel (.xlsx/.xls) ya da CSV dosyanızı yükleyin; analizi ArvoLab yapar. Hesap tarayıcınızda yapılır, dosyanız sunucuya gitmez; kaydedilen yalnızca sonuç metnidir.",
              en: "Upload your Excel (.xlsx/.xls) or CSV file; ArvoLab runs the analysis. The computation happens in your browser and your file never reaches the server; only the result text is saved.",
            })}
          </p>
        </>
      ) : (
      <div className="project-form-heading">
        <h2>{t({ tr: "Veri Yükle ve Analiz Et", en: "Upload and Analyse Data" })}</h2>
        <p>
          {t({
            tr: "Excel (.xlsx/.xls) veya CSV dosyanızı yükleyin; betimsel istatistik, t-testi, ANOVA, korelasyon, ki-kare ve güvenilirlik analizi çalıştırabilirsiniz. Tüm hesaplama tarayıcınızda yapılır — dosyanız sunucuya yüklenmez. Sonuçlar gerçek hesaplamalardır; yorum/sonuç metni üretilmez, yalnızca sayısal sonuç ve anlamlılık işaretlenir.",
            en: "Upload your Excel (.xlsx/.xls) or CSV file to run descriptive statistics, t tests, ANOVA, correlation, chi-square and reliability analyses. All computation happens in your browser — your file is not uploaded to the server. Results are real computations; no interpretation or conclusion text is generated, only the numerical result and its significance are marked.",
          })}
        </p>
      </div>
      )}

      {!dataset && (
        <label className="dropzone">
          <UploadCloud size={28} aria-hidden="true" />
          <span className="text-base">
            {loading ? t({ tr: "Okunuyor...", en: "Reading..." }) : t({ tr: "Excel veya CSV dosyası seçmek için tıklayın", en: "Click to choose an Excel or CSV file" })}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,.txt"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {parseError && (
        <p className="alert mt-sm" data-tone="danger" role="alert">
          {parseError}
        </p>
      )}

      {dataset && (
        <div>
          <div className="file-info-bar mb-md">
            <span>
              <TableIcon size={14} className="inline-icon" aria-hidden="true" />
              <strong>{fileName}</strong> —{" "}
              {t({
                tr: `${dataset.rows.length} satır, ${dataset.columns.length} sütun (${dataset.numericColumns.length} sayısal, ${dataset.categoricalColumns.length} kategorik)`,
                en: `${dataset.rows.length} rows, ${dataset.columns.length} columns (${dataset.numericColumns.length} numeric, ${dataset.categoricalColumns.length} categorical)`,
              })}
            </span>
            <button
              type="button"
              className="projects-filter-button"
              onClick={() => {
                setDataset(null);
                setResult(null);
                setFileName(null);
                setVeriNotlari([]);
                setFullReport(null);
                setCalisanAnaliz(null);
                setKaydedildi(false);
                setYorum(null);
              }}
            >
              {t({ tr: "Yeni dosya yükle", en: "Upload a new file" })}
            </button>
          </div>
          {veriNotlari.length ? (
            <p className="muted text-sm mb-md" role="status">
              {veriNotlari.join(" ")}{" "}
              {t({
                tr: "Sayılar yanlış görünüyorsa dosyayı Excel'den .xlsx olarak kaydedip yükleyin.",
                en: "If the numbers look wrong, save the file from Excel as .xlsx and upload it.",
              })}
            </p>
          ) : null}

          {/*
            Pencerede kapsamlı rapor tek düğme: bütün değişkenlerin betimsel
            istatistiği, frekansları ve korelasyon matrisi. Eskiden pencerede
            hiç yoktu; sayfa da pencereye geçince özellik kaybolacaktı.
          */}
          <VeriHazirlama
            key={fileName ?? ""}
            satirlar={dataset.rows}
            sutunlar={dataset.columns}
            sayisalSutunlar={dataset.numericColumns}
            ekle={(satirlar, yeniSutunlar) =>
              setDataset((d) =>
                d
                  ? {
                      ...d,
                      rows: satirlar,
                      columns: [...d.columns, ...yeniSutunlar],
                      /* Türetilen sütun her zaman sayısal: testlerde hemen seçilebilsin. */
                      numericColumns: [...d.numericColumns, ...yeniSutunlar],
                    }
                  : d,
              )
            }
          />
          {pencere ? (
            <details className="analiz-betik mb-md">
              <summary>
                <FileBarChart size={14} className="inline-icon" aria-hidden="true" />
                {t({ tr: "Bütün değişkenlerin özet raporu (betimsel, frekans, korelasyon)", en: "Summary report of all variables (descriptives, frequencies, correlations)" })}
              </summary>
              <button type="button" className="projects-filter-button button-compact mt-sm" onClick={handleGenerateFullReport}>
                {t({ tr: "Raporu oluştur", en: "Generate report" })}
              </button>
              {fullReport ? <div className="results-divider text-base">{fullReport}</div> : null}
            </details>
          ) : null}
          {pencere ? null : (
          <div className="sub-card mb-lg">
            <div className="project-form-heading">
              <h2>
                <FileBarChart size={16} aria-hidden="true" />
                {t({ tr: "SPSS Tarzı Kapsamlı Analiz Raporu", en: "SPSS-Style Comprehensive Analysis Report" })}
              </h2>
              <p>
                {t({
                  tr: "Tek tıkla, veri setinizdeki TÜM değişkenler için betimsel istatistikleri, frekans tablolarını ve sayısal değişken çiftleri arasındaki korelasyon matrisini otomatik oluşturur — tıpkı SPSS'te \"Analyze > Descriptives\" ve \"Correlate\" çalıştırmak gibi. Belirli bir hipotezi test etmek isterseniz aşağıdaki tekil testleri kullanın.",
                  en: "With one click, generates descriptive statistics, frequency tables and the correlation matrix between pairs of numeric variables for ALL variables in your dataset — just like running \"Analyze > Descriptives\" and \"Correlate\" in SPSS. To test a specific hypothesis, use the individual tests below.",
                })}
              </p>
            </div>
            <button type="button" className="projects-primary-button" onClick={handleGenerateFullReport}>
              <FileBarChart size={15} aria-hidden="true" />
              {t({ tr: "Kapsamlı Raporu Oluştur", en: "Generate Comprehensive Report" })}
            </button>

            {fullReport && (
              <div className="results-divider text-base">
                {fullReport}
              </div>
            )}
          </div>
          )}

          {pencere ? null : (
          <h3 className="result-heading">
            {t({ tr: "Veya Belirli Bir Test Seçin", en: "Or Choose a Specific Test" })}
          </h3>
          )}
          {/* Pencerede yöntem kartla seçilir; dosya yüklü kalır, yöntem değiştirmek tek dokunuş. */}
          {pencere ? (
            <>
              <h3 className="pencere-kart-baslik">{t({ tr: "Hangi analiz?", en: "Which analysis?" })}</h3>
              {yontemGruplari(dil).map((g) => (
                <div key={g.baslik}>
                  <p className="analiz-grup-baslik">{g.baslik}</p>
                  <div className="analiz-kartlari">
                    {g.turler.map((tur) => {
                      const k = yontemKartlari(dil).find((x) => x.tur === tur)!;
                      return (
                        <button
                          key={k.tur}
                          type="button"
                          className="analiz-karti"
                          aria-pressed={k.tur === analysisType}
                          onClick={() => {
                            setAnalysisType(k.tur);
                            /* Seçim kutusunun listesi türe göre değişiyor (iki değerli sütunlar);
                               listede olmayan eski seçim ekranda ilk seçenek gibi görünüp
                               başka bir sütunla hesaplanmasın. */
                            if (k.tur === "mcnemar" || k.tur === "lojistik") {
                              const adlar = ikiDegerliSutunlar.map((x) => x.ad);
                              if (!adlar.includes(varA)) setVarA(adlar[0] ?? "");
                              if (k.tur === "mcnemar" && !adlar.includes(varB)) setVarB(adlar[1] ?? adlar[0] ?? "");
                            } else if (dataset && !dataset.numericColumns.includes(varA) && k.tur !== "chisquare") {
                              setVarA(dataset.numericColumns[0] ?? "");
                            }
                            setResult(null);
                            setResultError(null);
                            setCalisanAnaliz(null);
                            setKaydedildi(false);
                            setYorum(null);
                          }}
                        >
                          <b>{k.ad}</b>
                          <small>{k.aciklama}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : null}
          <div className="project-form-grid">
            {pencere ? null : (
            <label>
              <span>{t({ tr: "Analiz türü", en: "Analysis type" })}</span>
              <select value={analysisType} onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}>
                {Object.entries(ANALYSIS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            )}

            {(analysisType === "ttest" || analysisType === "anova" || analysisType === "chisquare" || analysisType === "mannwhitney" || analysisType === "kruskalwallis" || analysisType === "ikiyonluanova" || analysisType === "ancova" || analysisType === "karmaanova") && (
              <label>
                <span>
                  {analysisType === "ikiyonluanova"
                    ? t({ tr: "1. faktör (kategorik)", en: "Factor 1 (categorical)" })
                    : t({ tr: "Grup değişkeni (kategorik)", en: "Grouping variable (categorical)" })}
                </span>
                <select value={groupVar} onChange={(e) => setGroupVar(e.target.value)}>
                  {grupSutunlari.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {analysisType === "ikiyonluanova" && (
              <label>
                <span>{t({ tr: "2. faktör (kategorik)", en: "Factor 2 (categorical)" })}</span>
                <select value={groupVar2} onChange={(e) => setGroupVar2(e.target.value)}>
                  <option value="">{t({ tr: "Seçin", en: "Select" })}</option>
                  {grupSutunlari.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(analysisType === "ttest" || analysisType === "anova" || analysisType === "correlation" || analysisType === "pairedttest" || analysisType === "wilcoxon" || analysisType === "regression" || analysisType === "mannwhitney" || analysisType === "kruskalwallis" || analysisType === "spearman" || analysisType === "ikiyonluanova" || analysisType === "tekorneklem" || analysisType === "ancova" || analysisType === "kismikorelasyon" || analysisType === "aracilik" || analysisType === "duzenleyicilik") && (
              <label>
                <span>
                  {analysisType === "aracilik" || analysisType === "duzenleyicilik"
                    ? t({ tr: "Bağımsız değişken (X)", en: "Predictor (X)" })
                    : analysisType === "correlation" || analysisType === "spearman" || analysisType === "kismikorelasyon"
                      ? t({ tr: "Değişken 1", en: "Variable 1" })
                      : analysisType === "pairedttest" || analysisType === "wilcoxon"
                        ? t({ tr: "Önceki ölçüm", en: "Earlier measurement" })
                        : analysisType === "regression"
                          ? t({ tr: "Bağımlı değişken (Y)", en: "Dependent variable (Y)" })
                          : analysisType === "ancova"
                            ? t({ tr: "Bağımlı değişken (ör. son test)", en: "Dependent variable (e.g. posttest)" })
                            : t({ tr: "Sayısal değişken", en: "Numeric variable" })}
                </span>
                <select value={varA} onChange={(e) => setVarA(e.target.value)}>
                  {dataset.numericColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(analysisType === "correlation" || analysisType === "spearman" || analysisType === "pairedttest" || analysisType === "wilcoxon" || analysisType === "kismikorelasyon" || analysisType === "duzenleyicilik") && (
              <label>
                <span>
                  {analysisType === "duzenleyicilik"
                    ? t({ tr: "Düzenleyici değişken (W)", en: "Moderator (W)" })
                    : analysisType === "pairedttest" || analysisType === "wilcoxon"
                      ? t({ tr: "Sonraki ölçüm", en: "Later measurement" })
                      : t({ tr: "Değişken 2", en: "Variable 2" })}
                </span>
                <select value={varB} onChange={(e) => setVarB(e.target.value)}>
                  {dataset.numericColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {analysisType === "chisquare" && (
              <label>
                <span>{t({ tr: "İkinci kategorik değişken", en: "Second categorical variable" })}</span>
                <select value={varA} onChange={(e) => setVarA(e.target.value)}>
                  {grupSutunlari.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(analysisType === "aracilik" || analysisType === "duzenleyicilik") && (
              <label>
                <span>{t({ tr: "Sonuç değişkeni (Y)", en: "Outcome variable (Y)" })}</span>
                <select value={varY} onChange={(e) => setVarY(e.target.value)}>
                  <option value="">{t({ tr: "Seçin", en: "Select" })}</option>
                  {dataset.numericColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {analysisType === "aracilik" && (
              <SutunSecimi
                etiket={t({ tr: "Aracı değişken(ler) (M)", en: "Mediator(s) (M)" })}
                sutunlar={dataset.numericColumns.filter((c) => c !== varA && c !== varY)}
                secili={aracilar.filter((c) => c !== varA && c !== varY)}
                degistir={setAracilar}
                ipucu={
                  aracilar.length >= 2
                    ? araciModeli === "seri"
                      ? t({
                          tr: `Seri modelde zincirin sırası listedeki sıradır (soldan sağa, yukarıdan aşağı); en çok ${SERI_EN_COK} aracı.`,
                          en: `In a serial model the chain follows the order of the list (left to right, top to bottom); at most ${SERI_EN_COK} mediators.`,
                        })
                      : t({
                          tr: `Paralel modelde aracılar birbirini etkilemez; en çok ${PARALEL_EN_COK} aracı.`,
                          en: `In a parallel model the mediators do not affect each other; at most ${PARALEL_EN_COK} mediators.`,
                        })
                    : t({
                        tr: "Bir aracı: basit aracılık. İki ve daha çok aracıda paralel ya da seri model seçilir.",
                        en: "One mediator: simple mediation. With two or more mediators, choose a parallel or serial model.",
                      })
                }
              />
            )}

            {analysisType === "aracilik" && aracilar.length >= 2 && (
              <label>
                <span>{t({ tr: "Aracı modeli", en: "Mediation model" })}</span>
                <select value={araciModeli} onChange={(e) => setAraciModeli(e.target.value as "paralel" | "seri")}>
                  <option value="paralel">{t({ tr: "Paralel (Model 4): aracılar birbirinden bağımsız", en: "Parallel (Model 4): mediators independent of each other" })}</option>
                  <option value="seri">{t({ tr: "Seri (Model 6): X → M1 → M2 → … → Y zinciri", en: "Serial (Model 6): chain X → M1 → M2 → … → Y" })}</option>
                </select>
              </label>
            )}

            {/* Seride sıra anlam taşıyor: zincir X → M1 → M2 → Y. Seçim kutuları veri
                sırasını izlediği için sıra burada ayrıca değiştirilebiliyor. */}
            {analysisType === "aracilik" && araciModeli === "seri" && aracilar.length >= 2 && (
              <div className="project-form-full">
                <span className="text-sm">{t({ tr: "Zincirin sırası", en: "Order of the chain" })}</span>
                <ol className="turetilen-sutunlar">
                  {aracilar.map((m, i) => (
                    <li key={m} className="cluster">
                      <span>
                        M{i + 1}: {m}
                      </span>
                      {i > 0 ? (
                        <button
                          type="button"
                          className="projects-filter-button button-compact"
                          aria-label={t({ tr: `${m}: bir öne al`, en: `${m}: move up` })}
                          onClick={() => setAracilar((a) => a.map((x, k) => (k === i - 1 ? a[i] : k === i ? a[i - 1] : x)))}
                        >
                          {t({ tr: "↑ Öne al", en: "↑ Move up" })}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {(analysisType === "aracilik" || analysisType === "duzenleyicilik") && (
              <SutunSecimi
                etiket={t({ tr: "Kontrol değişkenleri (isteğe bağlı)", en: "Covariates (optional)" })}
                sutunlar={dataset.numericColumns.filter((c) => c !== varA && c !== varY && (analysisType === "aracilik" ? !aracilar.includes(c) : c !== varB))}
                secili={kovaryatlar.filter((c) => c !== varA && c !== varY && (analysisType === "aracilik" ? !aracilar.includes(c) : c !== varB))}
                degistir={setKovaryatlar}
              />
            )}

            {analysisType === "dfa" && (
              <DfaModeli
                sutunlar={dataset.numericColumns}
                faktorler={dfaFaktorleri}
                degistir={setDfaFaktorleri}
                hataKovaryanslari={dfaHataKovaryanslari}
                hataKovaryanslariniDegistir={setDfaHataKovaryanslari}
              />
            )}

            {analysisType === "tekorneklem" && (
              <label>
                <span>{t({ tr: "Karşılaştırılacak değer", en: "Test value" })}</span>
                <input inputMode="decimal" value={testDegeri} onChange={(e) => setTestDegeri(e.target.value)} placeholder="3" />
              </label>
            )}

            {(analysisType === "mcnemar" || analysisType === "lojistik") && (
              <label>
                <span>
                  {analysisType === "mcnemar"
                    ? t({ tr: "Önceki ölçüm (iki kategorili)", en: "Earlier measurement (two categories)" })
                    : t({ tr: "Bağımlı değişken (iki kategorili)", en: "Dependent variable (two categories)" })}
                </span>
                <select value={varA} onChange={(e) => setVarA(e.target.value)}>
                  {ikiDegerliSutunlar.length ? null : <option value="">{t({ tr: "İki kategorili sütun yok", en: "No two-category column" })}</option>}
                  {ikiDegerliSutunlar.map((c) => (
                    <option key={c.ad} value={c.ad}>
                      {c.ad} ({c.degerler.join(" / ")})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {analysisType === "mcnemar" && (
              <label>
                <span>{t({ tr: "Sonraki ölçüm (iki kategorili)", en: "Later measurement (two categories)" })}</span>
                <select value={varB} onChange={(e) => setVarB(e.target.value)}>
                  {ikiDegerliSutunlar.map((c) => (
                    <option key={c.ad} value={c.ad}>
                      {c.ad} ({c.degerler.join(" / ")})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {analysisType === "lojistik" && (
              <label>
                <span>{t({ tr: "Olay (1) kabul edilen kategori", en: "Category coded as the event (1)" })}</span>
                <select
                  value={ikiDegerliSutunlar.find((c) => c.ad === varA)?.degerler.includes(olayDegeri) ? olayDegeri : ikiDegerliSutunlar.find((c) => c.ad === varA)?.degerler[1] ?? ""}
                  onChange={(e) => setOlayDegeri(e.target.value)}
                >
                  {(ikiDegerliSutunlar.find((c) => c.ad === varA)?.degerler ?? []).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(analysisType === "ancova" || analysisType === "kismikorelasyon") && (
              <SutunSecimi
                etiket={
                  analysisType === "ancova"
                    ? t({ tr: "Kovaryatlar (ör. ön test)", en: "Covariates (e.g. pretest)" })
                    : t({ tr: "Kontrol değişkenleri", en: "Control variables" })
                }
                sutunlar={dataset.numericColumns.filter((c) => c !== varA && (analysisType === "ancova" || c !== varB))}
                secili={kovaryatlar.filter((c) => c !== varA && c !== varB)}
                degistir={setKovaryatlar}
              />
            )}

            {(analysisType === "regression" || analysisType === "lojistik") && (
              <SutunSecimi
                etiket={t({ tr: "Yordayıcı değişkenler", en: "Predictors" })}
                /* Bağımlı değişken yordayıcı olarak seçilemez: kendisiyle açıklanan model anlamsızdır. */
                sutunlar={dataset.numericColumns.filter((c) => c !== varA)}
                secili={yordayicilar.filter((c) => c !== varA)}
                degistir={setYordayicilar}
              />
            )}

            {(analysisType === "reliability" || analysisType === "faktor") && (
              <SutunSecimi
                etiket={t({ tr: "Maddeler", en: "Items" })}
                sutunlar={dataset.numericColumns}
                secili={reliabilityItems}
                degistir={setReliabilityItems}
                ipucu={t({
                  tr: "Ters maddeleri önce yukarıdaki Veri hazırlama bölümünde çevirin ve buraya çevrilmiş (_ters) sütunu seçin.",
                  en: "Reverse-score negatively worded items first under Data preparation above, then select the reversed (_ters) column here.",
                })}
              />
            )}

            {analysisType === "faktor" && (
              <label>
                <span>{t({ tr: "Faktör sayısı (boş: öz değeri 1'den büyük olanlar)", en: "Number of factors (blank: eigenvalues greater than 1)" })}</span>
                <input
                  inputMode="numeric"
                  value={faktorSayisi}
                  onChange={(e) => setFaktorSayisi(e.target.value.replace(/\D/g, ""))}
                  placeholder={t({ tr: "Otomatik", en: "Automatic" })}
                />
              </label>
            )}

            {(analysisType === "friedman" || analysisType === "tekrarlianova" || analysisType === "karmaanova") && (
              <SutunSecimi
                etiket={
                  analysisType === "friedman"
                    ? t({ tr: "Tekrarlı ölçümler (en az üç)", en: "Repeated measurements (at least three)" })
                    : t({ tr: "Tekrarlı ölçümler", en: "Repeated measurements" })
                }
                sutunlar={dataset.numericColumns}
                secili={olcumler}
                degistir={setOlcumler}
                ipucu={t({
                  tr: "Aynı kişilerin ön test, son test ve izleme ölçümleri gibi; her sütun bir ölçüm.",
                  en: "Such as pretest, posttest and follow-up measurements of the same participants; each column is one measurement.",
                })}
              />
            )}
          </div>

          <div className="project-form-actions mt-md">
            <button type="button" className="projects-primary-button" onClick={handleRunAnalysis}>
              <Play size={15} aria-hidden="true" />
              {t({ tr: "Analizi Çalıştır", en: "Run analysis" })}
            </button>
          </div>

          {resultError && (
            <p className="alert mt-md" data-tone="danger" role="alert">
              {resultError}
            </p>
          )}

          {result && (
            <div className="results-divider text-base">
              {/*
                Sonuç JSX olarak tutuluyor ve her analiz türü kendi
                biçimini üretiyor; kopyalanacak metni her dalda ayrıca
                kurmak yerine kapsayıcının kendi metni okunuyor. Tek
                dokunuş, bütün türlerde çalışıyor.
              */}
              <div ref={sonucKutusu}>{result}</div>
              {sonucGrafigi}
              <div className="cluster mt-sm">
                <button type="button" className="projects-filter-button button-compact" onClick={sonucuKopyala}>
                  {kopyalandi ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {kopyalandi ? t({ tr: "Kopyalandı", en: "Copied" }) : t({ tr: "Sonucu kopyala", en: "Copy result" })}
                </button>
                {pencere && calisanAnaliz && !kaydedildi ? (
                  <>
                    <button
                      type="button"
                      className="projects-primary-button button-compact"
                      onClick={() => sonucuKaydet(true)}
                      disabled={kaydediliyor}
                    >
                      <ListPlus size={14} aria-hidden="true" />
                      {kaydediliyor ? t({ tr: "Kaydediliyor…", en: "Saving…" }) : t({ tr: "Teze ekleme sırasına koy", en: "Queue for thesis" })}
                    </button>
                  </>
                ) : null}
                {!pencere && calisanAnaliz && !kaydedildi ? (
                  <>
                    {calismalar.length > 0 ? (
                      <select
                        className="compact-select"
                        aria-label={t({ tr: "Sonucun kaydedileceği çalışma", en: "Project to save the result to" })}
                        value={kayitCalismasi}
                        onChange={(e) => setKayitCalismasi(e.target.value)}
                      >
                        <option value="">{t({ tr: "Çalışmaya bağlamadan", en: "Without linking to a project" })}</option>
                        {calismalar.map((calisma) => (
                          <option key={calisma.id} value={calisma.id}>{calisma.title}</option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      type="button"
                      className="projects-filter-button button-compact"
                      onClick={() => sonucuKaydet(false)}
                      disabled={kaydediliyor}
                    >
                      <Save size={14} aria-hidden="true" />
                      {kaydediliyor ? t({ tr: "Kaydediliyor…", en: "Saving…" }) : t({ tr: "Sonucu kaydet", en: "Save result" })}
                    </button>
                  </>
                ) : null}
                {kaydedildi ? (
                  <span className="hint">
                    <Check size={14} className="inline-icon" aria-hidden="true" />
                    {pencere
                      ? t({ tr: "Sırada — editörde “Analiz sonucu ekle” ile tezinize ekleyin.", en: "Queued — add it to your thesis in the editor with “Add analysis result”." })
                      : t({ tr: "Kaydedildi — sayfanın altındaki geçmişte.", en: "Saved — in the history at the bottom of the page." })}
                  </span>
                ) : null}
              </div>

              {pencere?.asistanAcik && calisanAnaliz ? (
                <div className="asistan-kart mt-md">
                  <div className="asistan-kart-ust">
                    <h3>{t({ tr: "Asistan ne diyor?", en: "What does the assistant say?" })}</h3>
                    <p>
                      {t({
                        tr: "Asistan sonucu kendiliğinden okur; eksik etki büyüklüğünü, varsayımları ve raporlamada dikkat edilecekleri söyler. Bulgunuzu yorumlayan cümle yazmaz, size verilmeyen sayı üretemez.",
                        en: "The assistant reads the result automatically and points out missing effect sizes, assumptions and reporting issues. It does not write sentences interpreting your finding and cannot produce numbers you did not provide.",
                      })}
                    </p>
                  </div>
                  {yorumBekleniyor ? <p className="hint" role="status">{t({ tr: "Asistan sonucu okuyor…", en: "The assistant is reading the result…" })}</p> : null}
                  {yorum && !yorum.hata && !yorum.bulgular?.length ? (
                    <p className="hint">{t({ tr: "Asistanın bu sonuç için ekleyeceği bir not yok.", en: "The assistant has no notes to add for this result." })}</p>
                  ) : null}
                  {/* Kendiliğinden okuma bir sebeple başlamadıysa elle başlatılabilir. */}
                  {yorum || yorumBekleniyor ? null : (
                    <button type="button" className="projects-filter-button button-compact" onClick={() => yorumIste(calisanAnaliz.baslik, false)}>
                      <Sparkles size={14} aria-hidden="true" />
                      {t({ tr: "Asistana okut", en: "Ask the assistant" })}
                    </button>
                  )}
                  <AsistanSonuc
                    sonuc={yorum}
                    yetenek="analiz"
                    etiketler={{ uyari: t({ tr: "Eksik", en: "Missing" }), oneri: t({ tr: "Öneri", en: "Suggestion" }), bilgi: t({ tr: "Not", en: "Note" }) }}
                    bulguBasligi={t({ tr: "Asistanın notları", en: "Assistant's notes" })}
                    bekleniyor={yorumBekleniyor}
                    onYenidenSorgula={() => yorumIste(calisanAnaliz.baslik, true)}
                    gecmisGizli
                  />
                </div>
              ) : null}
              {/*
                PROGRAMIN BETİĞİ (isteğe bağlı, kapalı): hesap burada
                yapıldı; bu bölüm yalnızca danışmanı "SPSS çıktısı" isteyen
                öğrenci için — aynı analizi o programda yeniden üreten
                komutlar (lib/analiz-betik.ts). Kendisi hesap yapmaz.
              */}
              {betik ? (
                <details className="analiz-betik mt-md">
                  <summary>
                    <Code2 size={14} className="inline-icon" aria-hidden="true" />
                    {t({ tr: "Danışmanınız SPSS, R ya da Python çıktısı isterse", en: "If your advisor asks for SPSS, R or Python output" })}
                  </summary>
                  <div className="pencere-dugmeler mt-sm" role="group" aria-label={t({ tr: "Program", en: "Program" })}>
                    {programKartlari(dil).filter((k) => !k.desteklenmiyor).map((k) => (
                      <button
                        key={k.anahtar}
                        type="button"
                        className="projects-filter-button button-compact"
                        aria-pressed={k.anahtar === betikAraci}
                        onClick={() => k.anahtar !== "ansys" && setBetikAraci(k.anahtar)}
                      >
                        {k.ad}
                      </button>
                    ))}
                  </div>
                  <p className="hint">
                    {t({
                      tr: `Analiz yukarıda ArvoLab'da yapıldı. Aşağıdaki ${ARAC_ADI_METIN[betikAraci].tr} aynı analizi o programda tekrarlar; sonuçlar aynı çıkar. ANSYS gibi mühendislik simülasyonları veri tablosu analizi değildir, ArvoLab çalıştıramaz.`,
                      en: `The analysis above was run in ArvoLab. The ${ARAC_ADI_METIN[betikAraci].en} below repeats the same analysis in that program; the results are the same. Engineering simulations such as ANSYS are not data-table analyses and ArvoLab cannot run them.`,
                    })}
                  </p>
                  <pre>{betik}</pre>
                  <button
                    type="button"
                    className="projects-filter-button button-compact"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(betik);
                        setBetikKopyalandi(true);
                        window.setTimeout(() => setBetikKopyalandi(false), 2000);
                      } catch {
                        setResultError(t({ tr: "Panoya kopyalanamadı. Betiği seçip elle kopyalayabilirsiniz.", en: "Could not copy to the clipboard. You can select the script and copy it manually." }));
                      }
                    }}
                  >
                    {betikKopyalandi ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    {betikKopyalandi ? t({ tr: "Kopyalandı", en: "Copied" }) : t({ tr: "Kopyala", en: "Copy" })}
                  </button>
                </details>
              ) : null}
              {/*
                Kaydetmenin ne kaydettiği açıkça yazılıyor: yukarıda
                "dosyanız sunucuya yüklenmez" sözü verildi, kullanıcı
                düğmeye basarken bunun hâlâ geçerli olduğunu bilmeli.
              */}
              {pencere ? null : (
              <p className="hint">
                {t({
                  tr: "Kaydedilen yalnızca yukarıdaki sonuç metnidir; yüklediğiniz veri dosyası sunucuya gitmez. Kaydetmezseniz sonuç sayfayı yenilediğinizde kaybolur.",
                  en: "Only the result text above is saved; your data file never reaches the server. If you don't save it, the result is lost when you refresh the page.",
                })}
              </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
