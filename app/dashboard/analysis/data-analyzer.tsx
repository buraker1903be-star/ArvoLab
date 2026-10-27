"use client";

import { useState, useCallback, useMemo, useRef, useTransition } from "react";
import { UploadCloud, Play, Table as TableIcon, FileBarChart, Copy, Check, Save, ListPlus, Sparkles, Code2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { leveneTesti, normallikOlcutu } from "@/lib/stats-varsayim";
import { friedmanTesti, kruskalWallis, mannWhitneyU, spearmanKorelasyonu, wilcoxonIsaretliSiralar, YAKLASIKLIK_EN_AZ } from "@/lib/stats-parametrik-olmayan";
import { dogrusalRegresyon } from "@/lib/stats-regresyon";
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
  type DescriptiveStats,
} from "@/lib/stats-tests-core";
import { formatP, hesaplanabilir, isSignificant, formatNumber } from "@/lib/apa-format";
import { ANALIZ_ETIKETLERI, analizBasligi, type AnalizTuru } from "@/lib/analiz-turleri";
import { analizSonucuKaydet } from "@/app/actions/analiz-sonuclari";
import { analizDenetle, type AnalizDenetimYaniti } from "@/app/actions/ai-analiz";
import { analizBetigi, ARAC_ADI, PROGRAM_KARTLARI, YONTEM_GRUPLARI, YONTEM_KARTLARI, type AnalizAraci, type BetikSecimi } from "@/lib/analiz-betik";
import AsistanSonuc from "@/app/dashboard/_components/asistan-sonuc";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { elemeNotu, eslesenSatirlar, sayisalSutun } from "@/lib/veri-eslestirme";
import { basitEtkiler, ikiYonluAnova, type IkiYonluHata } from "@/lib/stats-iki-yonlu-anova";
import { gamesHowell, tukeyHSD } from "@/lib/stats-tukey";
import { shapiroWilk } from "@/lib/stats-shapiro";
import { ancova, karmaAnova, tekOrneklemTTest, tekrarliIkiliKarsilastirmalar, tekrarliOlcumlerAnova } from "@/lib/stats-anova-ek";
import ProfilGrafigi from "./profil-grafigi";
import { aracilik, duzenleyicilik } from "@/lib/stats-aracilik";
import { dogrulayiciFaktorAnalizi, MI_ESIGI, uyumYorumu } from "@/lib/stats-dfa";
import DfaModeli from "./dfa-modeli";
import { kismiKorelasyon, mcnemar } from "@/lib/stats-iliski";
import { lojistikRegresyon, type LojistikHata } from "@/lib/stats-lojistik";
import { aciklayiciFaktorAnalizi, kmoYorumu, maddeUyarisi } from "@/lib/stats-faktor";
import { sayisalMi } from "@/lib/veri-eslestirme";
import SutunSecimi from "./sutun-secimi";
import VeriHazirlama from "./veri-hazirlama";

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
const ANALYSIS_LABELS = ANALIZ_ETIKETLERI;

/* Hesaplanamama sebepleri kullanıcı diline çevriliyor; sayı uydurulmuyor. */
const IKI_YONLU_HATA: Record<IkiYonluHata, string> = {
  "az-duzey": "İki yönlü ANOVA için her iki faktörde de en az 2 kategori olmalıdır.",
  "bos-hucre":
    "Faktörlerin bazı kesişimlerinde hiç gözlem yok. Etkileşim o hücrede tanımsız olduğu için analiz yapılamaz; kategorileri birleştirin ya da veriyi tamamlayın.",
  "az-gozlem": "Hücre başına yeterli gözlem yok: hata serbestlik derecesi kalmıyor.",
  tekil: "Model çözülemedi; faktör düzeyleri birbirini tam olarak belirliyor olabilir.",
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
const DEGISKENLIK_YOK =
  "Test hesaplanamadı: seçilen veride değişkenlik yok. Bir grubun (ya da maddenin) bütün değerleri aynıysa varyans sıfır olur ve test tanımsız kalır. Veriyi ve grup seçimini kontrol edin.";

const BEKLENEN_SIFIR =
  "Test hesaplanamadı: çapraz tabloda tamamen boş bir satır ya da sütun var (beklenen değer sıfır). Kullanılmayan kategorileri çıkarıp tekrar deneyin.";

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
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
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
      setResultError("Panoya kopyalanamadı. Metni seçip elle kopyalayabilirsiniz.");
    }
  }, []);
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
  const bicim: BicimKarari = useMemo(
    () =>
      calismalar.find((c) => c.id === kayitCalismasi)?.sayiBicimi ?? {
        ...VARSAYILAN_BICIM,
        kaynak: "varsayilan",
      },
    [calismalar, kayitCalismasi],
  );
  const yazP = useCallback((p: number) => formatP(p, bicim), [bicim]);
  const yazSayi = useCallback(
    (n: number, basamak = 2, sinirli = false) => formatNumber(n, basamak, bicim, sinirli),
    [bicim],
  );
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
        showToast("success", tezeEklenecek ? "Teze ekleme sırasına kondu; editörde \"Analiz ekle\" ile ekleyin." : "Sonuç kaydedildi.");
        // Penceredeki sıra listesi ve karttaki sayı sunucudan geliyor.
        router.refresh();
      } else {
        showToast("success", "Sonuç kaydedildi; aşağıdaki geçmişte duruyor.");
      }
    });
  }, [calisanAnaliz, kayitCalismasi, pencere, router]);

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
          await analizDenetle({
            istatistikMetni: metin,
            projectId: kayitCalismasi || null,
            yontem: baslik,
            zorla,
          }),
        );
      });
    },
    [kayitCalismasi],
  );
  const [betikKopyalandi, setBetikKopyalandi] = useState(false);
  const [betikAraci, setBetikAraci] = useState<AnalizAraci>("spss");
  const betik = pencere && calisanAnaliz ? analizBetigi(betikAraci, calisanAnaliz.tur, calisanAnaliz.secim) : null;

  const [fullReport, setFullReport] = useState<React.ReactNode>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setParseError(null);
    setDataset(null);
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json<DataRow>(sheet, { defval: null });

      if (json.length === 0) {
        setParseError("Dosyada okunabilir veri bulunamadı.");
        return;
      }

      const columns = Object.keys(json[0]);
      const { numericColumns, categoricalColumns } = detectColumnTypes(columns, json);

      setDataset({ columns, rows: json, numericColumns, categoricalColumns });
      setFileName(file.name);
      setVarA(numericColumns[0] ?? "");
      setVarB(numericColumns[1] ?? numericColumns[0] ?? "");
      setGroupVar(categoricalColumns[0] ?? "");
    } catch (err) {
      console.error(err);
      setParseError("Dosya okunamadı. Lütfen geçerli bir .xlsx, .xls veya .csv dosyası yükleyin.");
    } finally {
      setLoading(false);
    }
  }, []);

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
              1. Betimsel İstatistikler (Sayısal Değişkenler)
            </h3>
            <div className="table-scroll" role="region" aria-label="Analiz sonuç tablosu" tabIndex={0}>
            <table className="stats-result-table">
              <thead>
                <tr>
                  <th>Değişken</th>
                  <th>N</th>
                  <th>Ortalama</th>
                  <th>SS</th>
                  <th>Min</th>
                  <th>Maks</th>
                  <th>Medyan</th>
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
              2. Frekans Tabloları (Kategorik Değişkenler)
            </h3>
            {categoricalSections.map(({ col, freq }) => (
              <div key={col} className="result-block">
                <p className="result-heading text-sm">{col}</p>
                <div className="table-scroll" role="region" aria-label="Analiz sonuç tablosu" tabIndex={0}>
                <table className="stats-result-table">
                  <thead>
                    <tr>
                      <th>Değer</th>
                      <th>Frekans</th>
                      <th>Yüzde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freq.map((f) => (
                      <tr key={f.value}>
                        <td>{f.value}</td>
                        <td>{f.count}</td>
                        <td>%{yazSayi(f.percent, 1)}</td>
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
              3. Korelasyon Matrisi (Sayısal Değişken Çiftleri)
            </h3>
            <div className="table-scroll" role="region" aria-label="Analiz sonuç tablosu" tabIndex={0}>
            <table className="stats-result-table">
              <thead>
                <tr>
                  <th>Değişken 1</th>
                  <th>Değişken 2</th>
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
              Yeşil/kalın satırlar p &lt; .05 düzeyinde istatistiksel olarak anlamlıdır.
            </p>
          </div>
        )}

        {numericSections.length === 0 && categoricalSections.length === 0 && (
          <p className="muted text-base">
            Rapor oluşturmak için okunabilir sayısal veya kategorik sütun bulunamadı.
          </p>
        )}
      </div>
    );
  }, [dataset, getNumericColumn, yazSayi, yazP]);

  const handleRunAnalysis = useCallback(() => {
    if (!dataset) return;
    setResultError(null);
    setResult(null);
    setSonucGrafigi(null);
    setKaydedildi(false);
    setYorum(null);
    const baslik = analizBasligi(analysisType, {
      varA,
      varB,
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
    });
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
          <div className="table-scroll" role="region" aria-label="Analiz sonuç tablosu" tabIndex={0}>
          <table className="stats-result-table">
            <thead>
              <tr>
                <th>Değişken</th>
                <th>N</th>
                <th>Ortalama</th>
                <th>SS</th>
                <th>Min</th>
                <th>Maks</th>
                <th>Medyan</th>
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
            <strong>Varsayımlar</strong>
            <ul className="muted text-sm">
              {normallik.map(({ ad, olcut, sw }) => (
                <li key={ad}>
                  {ad}: {olcut.n < 4
                    ? "normallik ölçülemedi (dörtten az gözlem)"
                    : `çarpıklık ${yazSayi(olcut.carpiklik)}, basıklık ${yazSayi(olcut.basiklik)}` +
                      (olcut.normaleYakin ? " — normale yakın" : " — normalden uzak")}
                  {hesaplanabilir(sw.w, sw.p) ? ` · Shapiro-Wilk W = ${yazSayi(sw.w, 3)}, ${yazP(sw.p)}` : ""}
                </li>
              ))}
              <li>
                Karar çarpıklık ve basıklığa göre (|değer| &lt; 1,5). Shapiro-Wilk büyük örneklemde küçük sapmayı da
                anlamlı bulur; küçük örneklemde (n &lt; 50) kılavuzlar onu tercih eder.
              </li>
              {levene ? (
                <li>
                  Levene (medyan): F({levene.df1}, {levene.df2}) = {yazSayi(levene.f)},{" "}
                  {yazP(levene.p)} — {levene.homojen ? "varyanslar homojen" : "varyanslar homojen değil"}
                </li>
              ) : null}
            </ul>
            {(sorunlu.length > 0 || !homojen || olculemeyen.length > 0) && (
              <p className="tone-text text-sm" data-tone="warning">
                {olculemeyen.length > 0
                  ? "Normallik ölçülemediği için sonucu temkinli okuyun."
                  : sorunlu.length > 0
                    ? "Dağılım normalden uzak; parametrik olmayan karşılığı daha uygun olabilir."
                    : "Varyanslar homojen değil; eşit varyans varsaymayan bir test düşünün."}
              </p>
            )}
          </div>
        );
      };

      if (analysisType === "ttest") {
        if (groupLevels.length !== 2) {
          setResultError(
            `Bağımsız örneklem t-testi tam olarak 2 grup gerektirir. Seçili grup değişkeninde ${groupLevels.length} farklı değer bulundu.`
          );
          return;
        }
        const grouped = getGroupedNumeric(varA, groupVar);
        const [g1name, g2name] = groupLevels;
        const g1 = grouped.get(g1name) ?? [];
        const g2 = grouped.get(g2name) ?? [];
        if (g1.length < 2 || g2.length < 2) {
          setResultError("Her grupta en az 2 gözlem olmalıdır.");
          return;
        }
        const r = independentTTest(g1, g2);
        if (!hesaplanabilir(r.t, r.p)) return setResultError(DEGISKENLIK_YOK);
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
              <strong>{g1name}</strong>: N={r.n1}, Ort={yazSayi(r.m1)}, SS={yazSayi(r.sd1)}
              <br />
              <strong>{g2name}</strong>: N={r.n2}, Ort={yazSayi(r.m2)}, SS={yazSayi(r.sd2)}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              t({r.df}) = {yazSayi(r.t)}, {yazP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            {/* Etki büyüklüğü p'nin yanında: p "fark var mı"yı, d
                "fark ne kadar"ı söyler. */}
            <p className="muted text-sm">
              Cohen&apos;s d = {yazSayi(r.d)} ({r.dYorum} etki) · ortalama farkı{" "}
              {yazSayi(r.fark)}, %95 GA [{yazSayi(r.altSinir)}, {yazSayi(r.ustSinir)}]
            </p>
            {welch && hesaplanabilir(welch.t, welch.p) ? (
              <div className="stats-welch">
                <p className="tone-text" data-tone={welchSig ? "success" : "warning"}>
                  Eşit varyans varsayılmadan (Welch): t({yazSayi(welch.df, 2)}) = {yazSayi(welch.t)}, {yazP(welch.p)}
                  {welchSig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
                </p>
                <p className="muted text-sm">
                  Levene testi varyansların homojen olmadığını gösteriyor; bu satır raporlanmalıdır.
                  Serbestlik derecesi ondalıklıdır (Welch-Satterthwaite). Cohen&apos;s d ={" "}
                  {yazSayi(welch.d)} ({welch.dYorum} etki) · %95 GA [{yazSayi(welch.altSinir)},{" "}
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
            `Tek yönlü ANOVA en az 3 grup gerektirir (2 grup için t-testini kullanın). Seçili değişkende ${groupLevels.length} grup bulundu.`
          );
          return;
        }
        const grouped = getGroupedNumeric(varA, groupVar);
        const groups = groupLevels.map((g) => grouped.get(g) ?? []);
        if (groups.some((g) => g.length < 2)) {
          setResultError("Her grupta en az 2 gözlem olmalıdır.");
          return;
        }
        const r = oneWayAnova(groups);
        if (!hesaplanabilir(r.f, r.p)) return setResultError(DEGISKENLIK_YOK);
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
            <div className="table-scroll" role="region" aria-label="Analiz sonuç tablosu" tabIndex={0}>
            <table className="stats-result-table">
              <thead>
                <tr>
                  <th>Grup</th>
                  <th>N</th>
                  <th>Ortalama</th>
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
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
                      <p className="muted text-sm">
              η² = {yazSayi(r.etaKare)} ({r.etaYorum} etki)
            </p>
            {welchF && hesaplanabilir(welchF.f, welchF.p) ? (
              <div className="stats-welch">
                <p className="tone-text" data-tone={welchFSig ? "success" : "warning"}>
                  Eşit varyans varsayılmadan (Welch): F({welchF.df1}, {yazSayi(welchF.df2, 2)}) ={" "}
                  {yazSayi(welchF.f)}, {yazP(welchF.p)}
                  {welchFSig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
                </p>
                <p className="muted text-sm">
                  Levene testi varyansların homojen olmadığını gösteriyor; bu satır raporlanmalıdır.
                  η² burada YAZILMIYOR: kareler toplamından geliyor ve o hesap eşit varyans varsayıyor.
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
                    İkili karşılaştırmalar ({yontem}{welchF ? ", eşit varyans varsayılmadan" : ""})
                  </strong>
                  <div className="table-scroll" role="region" aria-label="İkili karşılaştırmalar" tabIndex={0}>
                    <table className="stats-result-table">
                      <thead>
                        <tr>
                          <th>Karşılaştırma</th>
                          <th>Ortalama farkı</th>
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
                      ? "Varyanslar homojen olmadığı için Games-Howell raporlanmalıdır."
                      : "Varyanslar homojen; Tukey HSD raporlanır. Bonferroni daha temkinlidir."}
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
          setResultError("Korelasyon için en az 3 eşleşen gözlem gereklidir.");
          return;
        }
        const r = pearsonCorrelation(x, y);
        if (!hesaplanabilir(r.r, r.p)) return setResultError(DEGISKENLIK_YOK);
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              r({r.df}) = {yazSayi(r.r)}, {yazP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
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
          setResultError("Eşleştirilmiş t-testi için en az 3 eşleşen gözlem gereklidir.");
          return;
        }
        const r = eslestirilmisTTest(once, sonra);
        if (!hesaplanabilir(r.t, r.p)) return setResultError(DEGISKENLIK_YOK);
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              <strong>{varA}</strong> − <strong>{varB}</strong>: N={r.n}, fark ort.=
              {yazSayi(r.farkOrtalamasi)}, fark SS={yazSayi(r.farkSS)}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              t({r.df}) = {yazSayi(r.t)}, {yazP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            <p className="muted text-sm">
              Cohen&apos;s d<sub>z</sub> = {yazSayi(r.dz)} ({r.dzYorum} etki) · %95 GA [
              {yazSayi(r.altSinir)}, {yazSayi(r.ustSinir)}]
            </p>
            {/* Eşleştirilmiş testte normallik FARKLARIN dağılımına
                bakar, ölçümlerin kendisine değil. */}
            {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
            {varsayimSeridi(
              [Array.from({ length: r.n }, (_, i) => once[i] - sonra[i])],
              ["Farklar"],
            )}
            {/* Şerit "parametrik olmayan karşılığı" diyordu ama hangisi olduğunu
                söylemiyordu; karşılık artık programda var (27.10.2026). */}
            {(() => {
              const olcut = normallikOlcutu(Array.from({ length: r.n }, (_, i) => once[i] - sonra[i]));
              return olcut.n >= 4 && !olcut.normaleYakin ? (
                <p className="muted text-sm">Karşılığı: “Wilcoxon İşaretli Sıralar Testi” kartı, aynı iki ölçümle.</p>
              ) : null;
            })()}
          </div>,
        );
      }

      if (analysisType === "regression") {
        const secilen = yordayicilar.filter((c) => c !== varA);
        if (secilen.length === 0) {
          setResultError("En az bir yordayıcı değişken seçin (bağımlı değişkenden farklı olmalı).");
          return;
        }
        const veri = eslesenSutunlar(varA, ...secilen);
        const [y, ...sutunlar] = veri.sutunlar;
        if (veri.n < secilen.length + 2) {
          setResultError(
            `Yordayıcı başına yeterli gözlem yok: ${secilen.length} yordayıcı için en az ${secilen.length + 2} eşleşen gözlem gerekiyor.`,
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
            "Model kurulamadı: yordayıcılar birbirine çok benziyor (çoklu doğrusallık) ya da gözlem sayısı yetersiz.",
          );
          return;
        }
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              F({r.dfb}, {r.dfw}) = {yazSayi(r.f)}, {yazP(r.p)}
              {sig ? " — model anlamlı" : " — model anlamlı değil"}
            </p>
            <p className="muted text-sm">
              R² = {yazSayi(r.rKare)} · düzeltilmiş R² = {yazSayi(r.duzeltilmisRKare)} · N = {r.n}
            </p>
            {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
            <div className="table-scroll" role="region" aria-label="Regresyon katsayıları" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>Değişken</th>
                    <th>B</th>
                    <th>SH</th>
                    <th>β</th>
                    <th>t</th>
                    <th>p</th>
                  </tr>
                </thead>
                <tbody>
                  {r.katsayilar.map((k) => (
                    <tr key={k.ad}>
                      <td>{k.ad}</td>
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
              B ham katsayı (birim başına değişim), β standartlaştırılmış katsayı —
              yordayıcıları birbiriyle karşılaştırmak için β kullanın.
            </p>
          </div>,
        );
      }

      if (analysisType === "mannwhitney") {
        if (groupLevels.length !== 2) {
          setResultError(
            `Mann-Whitney U tam olarak 2 grup gerektirir. Seçili grup değişkeninde ${groupLevels.length} farklı değer bulundu.`,
          );
          return;
        }
        const grouped = getGroupedNumeric(varA, groupVar);
        const [g1name, g2name] = groupLevels;
        const g1 = grouped.get(g1name) ?? [];
        const g2 = grouped.get(g2name) ?? [];
        if (g1.length < 2 || g2.length < 2) {
          setResultError("Her grupta en az 2 gözlem olmalıdır.");
          return;
        }
        const r = mannWhitneyU(g1, g2);
        if (!hesaplanabilir(r.z, r.p)) return setResultError(DEGISKENLIK_YOK);
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              <strong>{g1name}</strong>: N={r.n1}, sıra ort.={yazSayi(r.siraOrtalamasi1)}
              <br />
              <strong>{g2name}</strong>: N={r.n2}, sıra ort.={yazSayi(r.siraOrtalamasi2)}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              U = {yazSayi(r.u)}, z = {yazSayi(r.z)}, {yazP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            <p className="muted text-sm">r = {yazSayi(r.etki)} (sıralara dayalı etki büyüklüğü)</p>
            {/* Yaklaşıklık küçük örneklemde sapıyor; sessizce
                yaklaşık bir p vermek kesin sanılan bir sayı
                üretmek olurdu. */}
            {(r.n1 < YAKLASIKLIK_EN_AZ || r.n2 < YAKLASIKLIK_EN_AZ) && (
              <p className="tone-text text-sm" data-tone="warning">
                Gruplardan biri {YAKLASIKLIK_EN_AZ} gözlemden küçük; p değeri büyük örneklem
                yaklaşıklığıyla hesaplandı ve kesin değildir.
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
          setResultError("Wilcoxon testi için en az 3 eşleşen gözlem gereklidir.");
          return;
        }
        const r = wilcoxonIsaretliSiralar(once, sonra);
        if (r.nEtkin === 0) {
          setResultError("Test hesaplanamadı: bütün katılımcılarda iki ölçüm birbirine eşit, karşılaştırılacak fark yok.");
          return;
        }
        if (!hesaplanabilir(r.z, r.p)) return setResultError(DEGISKENLIK_YOK);
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              <strong>{varB}</strong> − <strong>{varA}</strong>: N={r.n} · artan {r.artiSayisi}, azalan{" "}
              {r.eksiSayisi}, eşit {r.esitSayisi}
              <br />
              Pozitif sıralar toplamı = {yazSayi(r.wArti)}, negatif sıralar toplamı = {yazSayi(r.wEksi)}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              z = {yazSayi(r.z)}, {yazP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            <p className="muted text-sm">r = {yazSayi(r.etki)} (sıralara dayalı etki büyüklüğü)</p>
            {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
            {r.esitSayisi > 0 ? (
              <p className="muted text-sm">İki ölçümü eşit olan {r.esitSayisi} kişi teste girmez (Wilcoxon yöntemi).</p>
            ) : null}
            {r.nEtkin < YAKLASIKLIK_EN_AZ && (
              <p className="tone-text text-sm" data-tone="warning">
                Farkı sıfır olmayan çift sayısı {YAKLASIKLIK_EN_AZ}&apos;den az; p değeri büyük örneklem yaklaşıklığıyla
                hesaplandı ve kesin değildir.
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
          setResultError("Friedman testi için en az üç ölçüm (sütun) seçin. İki ölçüm için Wilcoxon testini kullanın.");
          return;
        }
        const veri = eslesenSutunlar(...olcumler);
        if (veri.n < 2) {
          setResultError("Friedman testi için bütün ölçümleri dolu en az 2 katılımcı gereklidir.");
          return;
        }
        const r = friedmanTesti(veri.sutunlar);
        if (!hesaplanabilir(r.chiKare, r.p)) return setResultError(DEGISKENLIK_YOK);
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label="Friedman sıra ortalamaları" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>Ölçüm</th>
                    <th>Sıra ortalaması</th>
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
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            <p className="muted text-sm">Kendall W = {yazSayi(r.kendallW)} (etki büyüklüğü, 0–1)</p>
            {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
            {sig ? (
              <p className="muted text-sm">
                Fark anlamlı: hangi ölçümlerin farklı olduğunu görmek için ölçüm çiftlerini Wilcoxon testiyle
                karşılaştırın ve çoklu karşılaştırma için anlamlılık düzeyini düzeltin (Bonferroni: .05 / çift sayısı).
              </p>
            ) : null}
          </div>,
        );
      }

      /* ---------- 27.10.2026'da eklenen analizler ---------- */

      if (analysisType === "tekorneklem") {
        const deger = Number(testDegeri.replace(",", "."));
        if (!testDegeri.trim() || !Number.isFinite(deger)) {
          setResultError("Karşılaştırılacak değeri yazın (ör. 5'li ölçekte orta nokta 3).");
          return;
        }
        const dizi = getNumericColumn(varA);
        if (dizi.length < 2) {
          setResultError("Tek örneklem t-testi için en az 2 gözlem gereklidir.");
          return;
        }
        const r = tekOrneklemTTest(dizi, deger);
        if (!hesaplanabilir(r.t, r.p)) return setResultError(DEGISKENLIK_YOK);
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              <strong>{varA}</strong>: N={r.n}, ortalama={yazSayi(r.ortalama)}, SS={yazSayi(r.ss)} · test değeri {deger}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              t({r.df}) = {yazSayi(r.t)}, {yazP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            <p className="muted text-sm">
              Cohen&apos;s d = {yazSayi(r.d)} · farkın %95 GA [{yazSayi(r.altSinir)}, {yazSayi(r.ustSinir)}]
            </p>
            {varsayimSeridi([dizi], [varA])}
          </div>,
        );
      }

      if (analysisType === "tekrarlianova") {
        if (olcumler.length < 2) {
          setResultError("Tekrarlı ölçümler ANOVA için en az iki ölçüm (sütun) seçin; genellikle üç ve daha çok.");
          return;
        }
        const veri = eslesenSutunlar(...olcumler);
        if (veri.n < 3) {
          setResultError("Bütün ölçümleri dolu en az 3 katılımcı gereklidir.");
          return;
        }
        const r = tekrarliOlcumlerAnova(veri.sutunlar);
        if (!hesaplanabilir(r.f, r.p)) return setResultError(DEGISKENLIK_YOK);
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
            <div className="table-scroll" role="region" aria-label="Ölçüm ortalamaları" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>Ölçüm</th><th>Ortalama</th></tr>
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
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
              {onerilen === "gg" ? " (Greenhouse-Geisser)" : onerilen === "hf" ? " (Huynh-Feldt)" : ""}
            </p>
            <p className="muted text-sm">Kısmi η² = {yazSayi(r.kismiEtaKare)} · N = {r.n}</p>
            <div className="mt-sm">
              <strong>Küresellik</strong>
              <ul className="muted text-sm">
                {r.k > 2 ? (
                  <li>
                    Mauchly W = {yazSayi(r.mauchlyW, 3)}, χ²({r.mauchlyDf}) = {yazSayi(r.mauchlyChi)}, {yazP(r.mauchlyP)} —{" "}
                    {kuresellikBozuk ? "küresellik varsayımı sağlanmıyor" : "küresellik varsayımı sağlanıyor"}
                  </li>
                ) : (
                  <li>İki ölçümde küresellik tanım gereği sağlanır.</li>
                )}
                <li>
                  Greenhouse-Geisser ε = {yazSayi(r.ggEpsilon, 3)}: {yazP(r.ggP)} · Huynh-Feldt ε = {yazSayi(r.hfEpsilon, 3)}:{" "}
                  {yazP(r.hfP)}
                </li>
              </ul>
            </div>
            {ikili.length ? (
              <div className="mt-sm">
                <strong>İkili karşılaştırmalar (eşleştirilmiş t, Bonferroni)</strong>
                <ul className="muted text-sm">
                  {ikili.map((c) => (
                    <li key={`${c.a}-${c.b}`}>
                      {c.a} — {c.b}: fark {yazSayi(c.fark)}, {yazP(c.p)}
                      {c.anlamli ? " — anlamlı" : " — anlamlı değil"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
          </div>,
        );
      }

      if (analysisType === "ancova") {
        const kovlar = kovaryatlar.filter((c) => c !== varA);
        if (!kovlar.length) {
          setResultError("En az bir kovaryat seçin (ör. ön test puanı).");
          return;
        }
        const gozlemler = dataset.rows.flatMap((satir) => {
          const g = satir[groupVar];
          if (g === null || g === "" || !sayisalMi(satir[varA]) || !kovlar.every((c) => sayisalMi(satir[c]))) return [];
          return [{ grup: String(g), y: Number(satir[varA]), kovaryatlar: kovlar.map((c) => Number(satir[c])) }];
        });
        const dusen = dataset.rows.length - gozlemler.length;
        const r = ancova(gozlemler, kovlar, groupVar);
        if (r === "az-grup") return setResultError("ANCOVA için grup değişkeninde en az 2 grup olmalıdır.");
        if (r === "az-gozlem") return setResultError("Gözlem sayısı grup ve kovaryat sayısına göre yetersiz.");
        if (r === "tekil") return setResultError("Model kurulamadı: kovaryat ile grup birbirini tam belirliyor olabilir.");
        const grupEtkisi = r.etkiler[r.etkiler.length - 1];
        const sig = isSignificant(grupEtkisi.p);
        const egimBozuk = Number.isFinite(r.egimP) && isSignificant(r.egimP);
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label="ANCOVA tablosu" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>Kaynak</th><th>KT</th><th>sd</th><th>F</th><th>p</th><th>Kısmi η²</th></tr>
                </thead>
                <tbody>
                  {r.etkiler.map((e) => (
                    <tr key={e.ad} className={isSignificant(e.p) ? "stats-significant" : undefined}>
                      <td>{e.ad}</td><td>{yazSayi(e.ss)}</td><td>{e.df}</td><td>{yazSayi(e.f)}</td><td>{yazP(e.p)}</td><td>{yazSayi(e.kismiEtaKare)}</td>
                    </tr>
                  ))}
                  <tr><td>Hata</td><td>{yazSayi(r.hataSS)}</td><td>{r.hataDf}</td><td /><td /><td /></tr>
                </tbody>
              </table>
            </div>
            <p className="tone-text mt-sm" data-tone={sig ? "success" : "warning"}>
              {groupVar}: F({grupEtkisi.df}, {r.hataDf}) = {yazSayi(grupEtkisi.f)}, {yazP(grupEtkisi.p)}
              {sig ? " — kovaryat kontrol edildiğinde gruplar farklı" : " — kovaryat kontrol edildiğinde gruplar farklı değil"}
            </p>
            <div className="table-scroll" role="region" aria-label="Düzeltilmiş ortalamalar" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>Grup</th><th>N</th><th>Ham ortalama</th><th>Düzeltilmiş ortalama</th></tr>
                </thead>
                <tbody>
                  {r.gruplar.map((g, i) => (
                    <tr key={g}><td>{g}</td><td>{r.grupNleri[i]}</td><td>{yazSayi(r.hamOrtalamalar[i])}</td><td>{yazSayi(r.duzeltilmisOrtalamalar[i])}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted text-sm">Düzeltilmiş ortalamalar kovaryatların genel ortalamasında hesaplandı.</p>
            {Number.isFinite(r.egimF) ? (
              <p className={egimBozuk ? "tone-text text-sm" : "muted text-sm"} data-tone={egimBozuk ? "warning" : undefined}>
                Regresyon eğimlerinin homojenliği (grup × kovaryat): F({r.egimDf1}, {r.egimDf2}) = {yazSayi(r.egimF)}, {yazP(r.egimP)} —{" "}
                {egimBozuk
                  ? "varsayım sağlanmıyor; kovaryatın etkisi gruplarda farklı, ANCOVA sonucu yanıltıcı olabilir."
                  : "varsayım sağlanıyor."}
              </p>
            ) : null}
            {dusen > 0 ? <p className="muted text-sm">{dusen} satır eksik veri yüzünden analiz dışı bırakıldı.</p> : null}
          </div>,
        );
      }

      if (analysisType === "kismikorelasyon") {
        const kontroller = kovaryatlar.filter((c) => c !== varA && c !== varB);
        if (!kontroller.length) {
          setResultError("En az bir kontrol değişkeni seçin.");
          return;
        }
        if (varA === varB) return setResultError("İki farklı değişken seçin.");
        const veri = eslesenSutunlar(varA, varB, ...kontroller);
        const [x, y, ...k] = veri.sutunlar;
        if (veri.n < kontroller.length + 3) {
          setResultError("Kontrol değişkeni sayısına göre yeterli eşleşen gözlem yok.");
          return;
        }
        const r = kismiKorelasyon(x, y, k);
        if (!r || !hesaplanabilir(r.r, r.p)) return setResultError(DEGISKENLIK_YOK);
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              r<sub>kısmi</sub>({r.df}) = {yazSayi(r.r)}, {yazP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            <p className="muted text-sm">
              Kontrol edilen: {kontroller.join(", ")} · kontrol edilmeden r = {yazSayi(r.hamR)} · N = {r.n}
            </p>
            {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
          </div>,
        );
      }

      if (analysisType === "mcnemar") {
        const a = ikiDegerliSutunlar.find((x) => x.ad === varA);
        const b = ikiDegerliSutunlar.find((x) => x.ad === varB);
        if (!a || !b || varA === varB) {
          setResultError("İki farklı, ikişer kategorili sütun seçin (ör. eğitim öncesi ve sonrası Evet/Hayır).");
          return;
        }
        if (a.degerler.join("|") !== b.degerler.join("|")) {
          setResultError(`İki ölçüm aynı kategorileri taşımalı: ${varA} (${a.degerler.join(", ")}), ${varB} (${b.degerler.join(", ")}).`);
          return;
        }
        const ciftler = dataset.rows.filter((r) => r[varA] !== null && r[varA] !== "" && r[varB] !== null && r[varB] !== "");
        const r = mcnemar(ciftler.map((x) => String(x[varA])), ciftler.map((x) => String(x[varB])), a.degerler as [string, string]);
        const sig = isSignificant(r.pKesin);
        const [d1, d2] = a.degerler;
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label="McNemar tablosu" tabIndex={0}>
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
              McNemar (kesin, binom): {yazP(r.pKesin)}
              {sig ? " — iki ölçüm arasında değişim anlamlı" : " — iki ölçüm arasında değişim anlamlı değil"}
            </p>
            <p className="muted text-sm">
              Değişen kişiler: {d1}→{d2} {r.b}, {d2}→{d1} {r.c}. Test yalnızca fikir değiştirenlere bakar.
              {r.b + r.c >= 25 && hesaplanabilir(r.chiKare, r.pChiKare)
                ? ` Süreklilik düzeltmeli χ²(1) = ${yazSayi(r.chiKare)}, ${yazP(r.pChiKare)}.`
                : ""}
            </p>
          </div>,
        );
      }

      if (analysisType === "lojistik") {
        const bagimli = ikiDegerliSutunlar.find((x) => x.ad === varA);
        if (!bagimli) {
          setResultError("Bağımlı değişken olarak iki kategorili bir sütun seçin.");
          return;
        }
        const secilen = yordayicilar.filter((c) => c !== varA);
        if (!secilen.length) {
          setResultError("En az bir yordayıcı değişken seçin.");
          return;
        }
        const olay = bagimli.degerler.includes(olayDegeri) ? olayDegeri : bagimli.degerler[1];
        const satirlar = dataset.rows.filter(
          (r) => r[varA] !== null && r[varA] !== "" && secilen.every((c) => sayisalMi(r[c])),
        );
        const y = satirlar.map((r) => (String(r[varA]) === olay ? 1 : 0));
        const X = secilen.map((c) => satirlar.map((r) => Number(r[c])));
        const r = lojistikRegresyon(y, X, secilen);
        const HATA: Record<LojistikHata, string> = {
          "tek-sinif": "Bağımlı değişkende yalnızca bir kategori kaldı; iki kategori de bulunmalı.",
          "az-gozlem": "Yordayıcı sayısına göre yeterli gözlem yok.",
          tekil: "Model kurulamadı: yordayıcılar birbirinin aynısı ya da neredeyse aynısı.",
          ayrisma:
            "Model kestirilemedi: yordayıcılar sonucu kusursuz ayırıyor (tam ayrışma). Bu durumda katsayılar sonsuza gider ve anlamsızdır; yordayıcıları ya da kategorileri gözden geçirin.",
        };
        if (typeof r === "string") return setResultError(HATA[r]);
        const sig = isSignificant(r.modelP);
        const diger = bagimli.degerler.find((d) => d !== olay)!;
        setResult(
          <div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              Model χ²({r.modelDf}) = {yazSayi(r.modelChiKare)}, {yazP(r.modelP)}
              {sig ? " — model anlamlı" : " — model anlamlı değil"}
            </p>
            <p className="muted text-sm">
              −2LL = {yazSayi(r.eksiIkiLL)} · Cox-Snell R² = {yazSayi(r.coxSnell)} · Nagelkerke R² = {yazSayi(r.nagelkerke)} · N ={" "}
              {r.n} (olay “{olay}”: {r.olaySayisi})
            </p>
            <div className="table-scroll" role="region" aria-label="Lojistik regresyon katsayıları" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>Değişken</th><th>B</th><th>SH</th><th>Wald</th><th>p</th><th>Exp(B)</th><th>%95 GA</th></tr>
                </thead>
                <tbody>
                  {r.katsayilar.map((k) => (
                    <tr key={k.ad} className={k.ad !== "(Sabit)" && isSignificant(k.p) ? "stats-significant" : undefined}>
                      <td>{k.ad}</td><td>{yazSayi(k.b)}</td><td>{yazSayi(k.se)}</td><td>{yazSayi(k.wald)}</td><td>{yazP(k.p)}</td>
                      <td>{yazSayi(k.expB)}</td><td>{k.ad === "(Sabit)" ? "" : `[${yazSayi(k.expAlt)}, ${yazSayi(k.expUst)}]`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted text-sm">
              Doğru sınıflama %{yazSayi(r.dogruOrani * 100, 1)} (kesim 0,5): “{diger}” {r.siniflama[0][0]}/{r.siniflama[0][0] + r.siniflama[0][1]}, “{olay}”{" "}
              {r.siniflama[1][1]}/{r.siniflama[1][0] + r.siniflama[1][1]}. Exp(B), yordayıcı bir birim arttığında “{olay}” olma
              olasılığının (odds) kaç katına çıktığıdır.
            </p>
            {dataset.rows.length - satirlar.length > 0 ? (
              <p className="muted text-sm">{dataset.rows.length - satirlar.length} satır eksik veri yüzünden analiz dışı bırakıldı.</p>
            ) : null}
          </div>,
        );
      }

      if (analysisType === "faktor") {
        if (reliabilityItems.length < 3) {
          setResultError("Faktör analizi için en az üç madde seçin.");
          return;
        }
        const veri = eslesenSutunlar(...reliabilityItems);
        const istenen = Number(faktorSayisi);
        const r = aciklayiciFaktorAnalizi(veri.sutunlar, istenen > 0 ? istenen : undefined);
        if (r === "az-madde") return setResultError("Faktör analizi için en az üç madde seçin.");
        if (r === "az-gozlem") return setResultError(`Gözlem sayısı (${veri.n}) madde sayısından fazla olmalı; genel öneri madde başına en az 5–10 kişi.`);
        if (r === "tekil") return setResultError("Korelasyon matrisi tekil: bazı maddeler birbirinin aynısı ya da değişkenliği yok. O maddeleri çıkarın.");
        const uygun = r.kmo >= 0.6 && isSignificant(r.bartlettP);
        setResult(
          <div>
            <p className="tone-text" data-tone={uygun ? "success" : "warning"}>
              KMO = {yazSayi(r.kmo, 3)} ({kmoYorumu(r.kmo)}) · Bartlett χ²({r.bartlettDf}) = {yazSayi(r.bartlettChi)}, {yazP(r.bartlettP)}
              {uygun ? " — veri faktör analizine uygun" : " — veri faktör analizine uygun görünmüyor (KMO < .60 ya da Bartlett anlamsız)"}
            </p>
            <p className="muted text-sm">
              Temel bileşenler, varimax döndürme · {r.faktorSayisi} faktör
              {istenen > 0 ? " (sizin belirlediğiniz)" : " (öz değeri 1'den büyük olanlar)"} · toplam açıklanan varyans %
              {yazSayi(r.toplamAciklanan, 1)} · N = {r.n}
            </p>
            <p className="muted text-sm">
              Öz değerler: {r.ozDegerler.slice(0, Math.min(r.ozDegerler.length, 8)).map((d) => yazSayi(d)).join(" · ")}
            </p>
            <div className="table-scroll" role="region" aria-label="Döndürülmüş faktör yükleri" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>Madde</th>
                    {r.aciklananYuzde.map((y, f) => (
                      <th key={f}>F{f + 1} (%{yazSayi(y, 1)})</th>
                    ))}
                    <th>h²</th>
                    <th>Not</th>
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
                        <td>{uyari === "dusuk" ? "yük < .30" : uyari === "binisik" ? "binişik" : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted text-sm">
              Yükü .30&apos;un altında kalan ve iki faktöre .10&apos;dan yakın yüklenen (binişik) maddeler işaretlendi. Madde
              çıkarma kararı kuramsal yapıya göre sizin ve danışmanınızındır; bir madde çıkarıldığında analizi yeniden çalıştırın.
            </p>
            {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
          </div>,
        );
      }

      /*
        KARMA ANOVA (27.10.2026): grup (gruplar arası) × ölçüm (tekrarlı).
        Bir kişinin bir ölçümü boşsa o kişi bütünüyle düşer (liste bazlı).
      */
      if (analysisType === "karmaanova") {
        if (olcumler.length < 2) {
          setResultError("En az iki ölçüm (sütun) seçin, ör. ön test ve son test.");
          return;
        }
        if (groupLevels.length < 2) {
          setResultError("Grup değişkeninde en az iki grup olmalıdır (ör. deney ve kontrol).");
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
        if (r === "az-grup") return setResultError("En az iki grup gerekli.");
        if (r === "az-olcum") return setResultError("En az iki ölçüm gerekli.");
        if (r === "az-gozlem") return setResultError("Her grupta bütün ölçümleri dolu en az 2 kişi olmalı; toplam kişi sayısı da ölçüm sayısından fazla olmalı.");
        if (!hesaplanabilir(r.olcum.f, r.etkilesim.f, r.grup.f)) return setResultError(DEGISKENLIK_YOK);

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
          ? olcumler.map((o, t) => {
              const a = oneWayAnova(veriGruplari.map((g) => g[t]));
              return { ad: o, f: a.f, df1: a.dfb, df2: a.dfw, p: Math.min(1, a.p * olcumler.length) };
            })
          : [];
        const gruptaZaman = etkilesimSig
          ? groupLevels.map((g, j) => {
              const t = tekrarliOlcumlerAnova(veriGruplari[j]);
              const pp = olcumler.length > 2 && isSignificant(t.mauchlyP) ? t.ggP : t.p;
              return { ad: g, f: t.f, df1: t.df1, df2: t.df2, p: Math.min(1, pp * groupLevels.length) };
            })
          : [];
        const dusen = dataset.rows.length - tamSatirlar.length;

        setSonucGrafigi(<ProfilGrafigi olcumler={olcumler} gruplar={groupLevels} ortalamalar={r.hucreOrtalamalari} />);
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label="Hücre ortalamaları" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>Grup</th>
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
                      {r.hucreOrtalamalari[j].map((v, t) => (
                        <td key={t}>{yazSayi(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-scroll" role="region" aria-label="Karma ANOVA tablosu" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>Kaynak</th>
                    <th>sd</th>
                    <th>F</th>
                    <th>p</th>
                    <th>Kısmi η²</th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map(({ e, tekrarli }) => (
                    <tr key={e.ad} className={isSignificant(tekrarli ? raporP(e) : e.p) ? "stats-significant" : undefined}>
                      <td>{e.ad === "Grup" ? groupVar : e.ad === "Ölçüm" ? "Ölçüm (zaman)" : `Ölçüm × ${groupVar}`}</td>
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
              Etkileşim (ölçüm × {groupVar}): F({df(r.etkilesim.df1, true)}, {df(r.etkilesim.df2, true)}) = {yazSayi(r.etkilesim.f)},{" "}
              {yazP(raporP(r.etkilesim))}
              {etkilesimSig
                ? " — grupların zaman içindeki değişimi farklı"
                : " — grupların zaman içindeki değişimi farklı değil"}
              {duzeltme === "gg" ? " (Greenhouse-Geisser)" : duzeltme === "hf" ? " (Huynh-Feldt)" : ""}
            </p>
            <ul className="muted text-sm">
              {olcumler.length > 2 ? (
                <li>
                  Mauchly W = {yazSayi(r.mauchlyW, 3)}, χ²({r.mauchlyDf}) = {yazSayi(r.mauchlyChi)}, {yazP(r.mauchlyP)} —{" "}
                  {kuresellikBozuk ? "küresellik sağlanmıyor; tekrarlı etkilerde düzeltilmiş sd ve p yazıldı" : "küresellik sağlanıyor"} ·
                  GG ε = {yazSayi(r.ggEpsilon, 3)}, HF ε = {yazSayi(r.hfEpsilon, 3)}
                </li>
              ) : (
                <li>İki ölçümde küresellik tanım gereği sağlanır.</li>
              )}
              {olcumler.map((o, t) => {
                const l = leveneTesti(veriGruplari.map((g) => g[t]));
                return (
                  <li key={o}>
                    Levene ({o}): F({l.df1}, {l.df2}) = {yazSayi(l.f)}, {yazP(l.p)} — {l.homojen ? "varyanslar homojen" : "varyanslar homojen değil"}
                  </li>
                );
              })}
            </ul>
            {etkilesimSig ? (
              <div className="mt-sm">
                <strong>Basit etkiler (Bonferroni düzeltmeli)</strong>
                <ul className="muted text-sm">
                  {olcumdeGrup.map((b) => (
                    <li key={`o-${b.ad}`}>
                      {b.ad} ölçümünde gruplar: F({b.df1}, {b.df2}) = {yazSayi(b.f)}, {yazP(b.p)}
                      {isSignificant(b.p) ? " — fark anlamlı" : " — fark anlamlı değil"}
                    </li>
                  ))}
                  {gruptaZaman.map((b) => (
                    <li key={`g-${b.ad}`}>
                      {b.ad} grubunda zaman: F({b.df1}, {b.df2}) = {yazSayi(b.f)}, {yazP(b.p)}
                      {isSignificant(b.p) ? " — değişim anlamlı" : " — değişim anlamlı değil"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="muted text-sm">
                Etkileşim anlamlı olmadığı için {groupVar} ve ölçüm ana etkileri tablodaki gibi yorumlanır.
              </p>
            )}
            {dusen > 0 ? <p className="muted text-sm">{dusen} satır eksik veri yüzünden analiz dışı bırakıldı.</p> : null}
          </div>,
        );
      }

      /* ---------- Aracılık, düzenleyicilik, DFA (27.10.2026) ---------- */

      if (analysisType === "aracilik" || analysisType === "duzenleyicilik") {
        const aracilikMi = analysisType === "aracilik";
        if (!varY || new Set([varA, varB, varY]).size < 3) {
          setResultError(
            aracilikMi
              ? "Bağımsız (X), aracı (M) ve sonuç (Y) için üç farklı değişken seçin."
              : "Bağımsız (X), düzenleyici (W) ve sonuç (Y) için üç farklı değişken seçin.",
          );
          return;
        }
        const kovlar = kovaryatlar.filter((c) => c !== varA && c !== varB && c !== varY);
        const veri = eslesenSutunlar(varA, varB, varY, ...kovlar);
        const [x, mw, y, ...k] = veri.sutunlar;
        if (veri.n < kovlar.length + 10) {
          setResultError("Bu analiz için yeterli eşleşen gözlem yok (en az 10 ve kovaryat başına bir fazlası).");
          return;
        }
        if (aracilikMi) {
          const r = aracilik(x, mw, y, k);
          if (!r || !hesaplanabilir(r.dolayli, r.a.p, r.b.p)) return setResultError(DEGISKENLIK_YOK);
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
              <div className="table-scroll" role="region" aria-label="Aracılık yolları" tabIndex={0}>
                <table className="stats-result-table">
                  <thead>
                    <tr><th>Yol</th><th>B</th><th>SH</th><th>t</th><th>p</th></tr>
                  </thead>
                  <tbody>
                    {yolSatiri(`a: ${varA} → ${varB}`, r.a)}
                    {yolSatiri(`b: ${varB} → ${varY} (${varA} kontrol)`, r.b)}
                    {yolSatiri(`c: ${varA} → ${varY} (toplam etki)`, r.c)}
                    {yolSatiri(`c′: ${varA} → ${varY} (doğrudan etki)`, r.cUs)}
                  </tbody>
                </table>
              </div>
              <p className="tone-text mt-sm" data-tone={anlamli ? "success" : "warning"}>
                Dolaylı etki (a·b) = {yazSayi(r.dolayli)}, %95 bootstrap GA [{yazSayi(r.bootAlt)}, {yazSayi(r.bootUst)}]
                {anlamli ? " — aralık sıfırı içermiyor: aracılık anlamlı" : " — aralık sıfırı içeriyor: aracılık anlamlı değil"}
              </p>
              <p className="muted text-sm">
                Bootstrap SH = {yazSayi(r.bootSE)} ({r.bootOrnek} örnek, yüzdelik yöntem) · standartlaştırılmış dolaylı etki ={" "}
                {yazSayi(r.standartDolayli)} · Sobel z = {yazSayi(r.sobelZ)}, {yazP(r.sobelP)} · R²(M) = {yazSayi(r.rKareM)}, R²(Y) ={" "}
                {yazSayi(r.rKareY)} · N = {r.n}
                {kovlar.length ? ` · kontrol: ${kovlar.join(", ")}` : ""}
              </p>
              <p className="muted text-sm">
                Karar bootstrap aralığına göre verilir (Hayes, 2018); Sobel testi a·b&apos;nin normal dağıldığını varsaydığı için
                yalnızca bilgi amaçlı. {anlamli && !isSignificant(r.cUs.p) ? "Doğrudan etki anlamsız: tam aracılık örüntüsü." : ""}
                {anlamli && isSignificant(r.cUs.p) ? "Doğrudan etki de anlamlı: kısmi aracılık örüntüsü." : ""}
              </p>
              {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
            </div>,
          );
        } else {
          const r = duzenleyicilik(x, mw, y, k);
          if (!r || !hesaplanabilir(r.deltaF, r.deltaP)) return setResultError(DEGISKENLIK_YOK);
          const sig = isSignificant(r.deltaP);
          const adlar: Record<string, string> = { "(Sabit)": "(Sabit)", X: varA, W: varB, "X × W": `${varA} × ${varB}` };
          setResult(
            <div>
              <div className="table-scroll" role="region" aria-label="Düzenleyicilik modeli" tabIndex={0}>
                <table className="stats-result-table">
                  <thead>
                    <tr><th>Değişken (merkezlenmiş)</th><th>B</th><th>SH</th><th>t</th><th>p</th></tr>
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
                Etkileşim: ΔR² = {yazSayi(r.deltaRKare, 3)}, F(1, {r.df}) = {yazSayi(r.deltaF)}, {yazP(r.deltaP)}
                {sig ? ` — ${varA}'in etkisi ${varB}'ye göre değişiyor (düzenleyicilik anlamlı)` : " — düzenleyicilik anlamlı değil"}
              </p>
              <p className="muted text-sm">R² = {yazSayi(r.rKare)} · N = {r.n}{kovlar.length ? ` · kontrol: ${kovlar.join(", ")}` : ""}</p>
              <strong>{varB} düzeylerinde {varA}&apos;in koşullu etkisi</strong>
              <div className="table-scroll" role="region" aria-label="Koşullu etkiler" tabIndex={0}>
                <table className="stats-result-table">
                  <thead>
                    <tr><th>{varB}</th><th>Etki</th><th>SH</th><th>t</th><th>p</th><th>%95 GA</th></tr>
                  </thead>
                  <tbody>
                    {r.kosullu.map((c) => (
                      <tr key={c.etiket} className={isSignificant(c.p) ? "stats-significant" : undefined}>
                        <td>{c.etiket.startsWith("W =") ? yazSayi(c.w) : `${c.etiket} (${yazSayi(c.w)})`}</td>
                        <td>{yazSayi(c.etki)}</td><td>{yazSayi(c.se)}</td><td>{yazSayi(c.t)}</td><td>{yazP(c.p)}</td>
                        <td>[{yazSayi(c.alt)}, {yazSayi(c.ust)}]</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {r.jnSinirlari.length ? (
                <p className="muted text-sm">
                  Johnson-Neyman: {varA}&apos;in etkisi {varB} = {r.jnSinirlari.map((v) => yazSayi(v)).join(" ve ")} noktasında anlamlılık
                  sınırını geçiyor (gözlenen aralık {yazSayi(r.wAralik[0])}–{yazSayi(r.wAralik[1])}).
                </p>
              ) : null}
              <p className="muted text-sm">
                {varA} ve {varB} ortalamadan arındırılarak (merkezlenerek) modellendi; etkileşim katsayısı bundan etkilenmez.
              </p>
              {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
            </div>,
          );
        }
      }

      if (analysisType === "dfa") {
        const faktorler = dfaFaktorleri.filter((f) => f.maddeler.length);
        if (faktorler.length < 1 || faktorler.some((f) => f.maddeler.length < 2) || (faktorler.length === 1 && faktorler[0].maddeler.length < 3)) {
          setResultError("Her faktöre en az iki madde atayın (tek faktörlü modelde en az üç).");
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
        const r = dogrulayiciFaktorAnalizi(veri.sutunlar, maddeler, {
          faktorler: faktorler.map((f) => f.ad.trim() || "Faktör"),
          maddeFaktoru: faktorler.flatMap((f, k) => f.maddeler.map(() => k)),
          hataKovaryanslari: hataCiftleri,
        });
        if (r === "az-madde") return setResultError("DFA için en az üç madde gerekir.");
        if (r === "az-gozlem") return setResultError(`Gözlem sayısı (${veri.n}) madde sayısından fazla olmalı; DFA için genel öneri en az 200 kişi.`);
        if (r === "tanimsiz") return setResultError("Model tanımlanamıyor: her faktörde en az iki madde olmalı ve serbest parametre sayısı veriyi aşmamalı.");
        if (r === "kestirilemedi") return setResultError("Model kestirilemedi: kovaryans matrisi tekil (bir madde diğerinin aynısı ya da değişkenliği yok) ya da başlangıç noktası uygun değil.");
        const indeks = (ad: "chiKareDf" | "cfi" | "tli" | "rmsea" | "srmr" | "gfi" | "agfi", etiket: string, deger: number) => (
          <tr key={ad}>
            <td>{etiket}</td>
            <td>{yazSayi(deger, 3)}</td>
            <td>{uyumYorumu(ad, deger)}</td>
          </tr>
        );
        const adlar = faktorler.map((f) => f.ad.trim() || "Faktör");
        /*
          DEĞİŞİKLİK İNDEKSLERİ kopyalanan sonuç metninin DIŞINDA: çalışma
          önerisi, rapor değil; "Modele ekle" düğmeleri de metne karışmasın.
        */
        const oneriler = r.degisiklikIndeksleri.filter((d) => d.mi >= MI_ESIGI).slice(0, 15);
        setSonucGrafigi(
          <details className="analiz-betik mt-sm" open={oneriler.length > 0}>
            <summary>Değişiklik (modifikasyon) indeksleri{oneriler.length ? ` · ${oneriler.length} öneri` : ""}</summary>
            {oneriler.length ? (
              <>
                <div className="table-scroll" role="region" aria-label="Değişiklik indeksleri" tabIndex={0}>
                  <table className="stats-result-table">
                    <thead>
                      <tr><th>Öneri</th><th>MI</th><th>EPC</th><th>Std. EPC</th><th /></tr>
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
                                    showToast("success", `${ciftAdi[0]} ↔ ${ciftAdi[1]} modele eklendi; analizi yeniden çalıştırın.`);
                                  }}
                                >
                                  Modele ekle{ayniFaktor ? "" : " (farklı faktör)"}
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
                  MI, o parametre serbest bırakılsa χ²&apos;nin yaklaşık ne kadar düşeceğidir (eşik 3,84). Değişikliği YALNIZCA
                  kuramsal bir gerekçe varsa yapın: aynı faktördeki benzer ifadeli iki maddenin hatalarını ilişkilendirmek
                  yaygın ve savunulabilir; farklı faktörlerdeki maddeler ya da çapraz yük yapının sorunlu olduğunu gösterir —
                  o maddeyi gözden geçirin. Her seferinde tek değişiklik yapıp analizi yeniden çalıştırın ve yaptığınız her
                  değişikliği tezde raporlayın.
                </p>
              </>
            ) : (
              <p className="muted text-sm">3,84&apos;ün üzerinde değişiklik indeksi yok; model sabit parametrelerden kaynaklanan belirgin bir uyumsuzluk göstermiyor.</p>
            )}
          </details>,
        );
        setResult(
          <div>
            <p className="tone-text" data-tone={r.cfi >= 0.9 && r.rmsea <= 0.08 ? "success" : "warning"}>
              χ²({r.df}, N = {r.n}) = {yazSayi(r.chiKare)}, {yazP(r.p)} · CFI = {yazSayi(r.cfi, 3)} · TLI = {yazSayi(r.tli, 3)} · RMSEA ={" "}
              {yazSayi(r.rmsea, 3)} · SRMR = {yazSayi(r.srmr, 3)}
            </p>
            <div className="table-scroll" role="region" aria-label="Uyum indeksleri" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>İndeks</th><th>Değer</th><th>Değerlendirme</th></tr>
                </thead>
                <tbody>
                  {indeks("chiKareDf", "χ²/sd", r.chiKareDf)}
                  {indeks("cfi", "CFI", r.cfi)}
                  {indeks("tli", "TLI (NNFI)", r.tli)}
                  {indeks("rmsea", "RMSEA", r.rmsea)}
                  {indeks("srmr", "SRMR", r.srmr)}
                  {indeks("gfi", "GFI", r.gfi)}
                  {indeks("agfi", "AGFI", r.agfi)}
                </tbody>
              </table>
            </div>
            <div className="table-scroll" role="region" aria-label="Faktör yükleri" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr><th>Faktör</th><th>Madde</th><th>Standart yük</th><th>B</th><th>SH</th><th>z</th><th>p</th><th>R²</th></tr>
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
            <div className="table-scroll" role="region" aria-label="Güvenirlik ve geçerlik" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>Faktör</th><th>CR</th><th>AVE</th><th>√AVE</th>
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
              Eşikler (Hu ve Bentler, 1999; Kline, 2016): CFI/TLI ≥ .90 kabul edilebilir, ≥ .95 iyi; RMSEA ve SRMR ≤ .08 kabul
              edilebilir, ≤ .05 iyi. Standart yük ≥ .50, CR ≥ .70 ve AVE ≥ .50 yaygın ölçütler; ayırt edici geçerlik için √AVE,
              faktörün diğer faktörlerle korelasyonundan büyük olmalı (Fornell-Larcker). Kestirim en çok olabilirlik, χ² = (N − 1)·F
              (AMOS/LISREL kuralı); faktör varyansları 1&apos;e sabit.
            </p>
            {r.heywood.length ? (
              <p className="tone-text text-sm" data-tone="warning">
                Negatif hata varyansı (Heywood durumu): {r.heywood.join(", ")}. Model ya da örneklem sorunlu; bu maddelerin yerini ve
                örneklem büyüklüğünü gözden geçirin, sonucu bu hâliyle raporlamayın.
              </p>
            ) : null}
            {!r.yakinsadi ? (
              <p className="tone-text text-sm" data-tone="warning">Kestirim tam yakınsamadı; değerleri temkinli okuyun.</p>
            ) : null}
            {r.hataKovaryanslari.length ? (
              <div className="table-scroll" role="region" aria-label="Hata kovaryansları" tabIndex={0}>
                <table className="stats-result-table">
                  <thead>
                    <tr><th>Hata kovaryansı</th><th>Kovaryans</th><th>Korelasyon</th><th>SH</th><th>p</th></tr>
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
            {elemeNotu(veri) ? <p className="muted text-sm">{elemeNotu(veri)}</p> : null}
          </div>,
        );
      }

      if (analysisType === "kruskalwallis") {
        if (groupLevels.length < 3) {
          setResultError(
            `Kruskal-Wallis en az 3 grup gerektirir (2 grup için Mann-Whitney U kullanın). Seçili değişkende ${groupLevels.length} grup bulundu.`,
          );
          return;
        }
        const grouped = getGroupedNumeric(varA, groupVar);
        const groups = groupLevels.map((g) => grouped.get(g) ?? []);
        if (groups.some((g) => g.length < 2)) {
          setResultError("Her grupta en az 2 gözlem olmalıdır.");
          return;
        }
        const r = kruskalWallis(groups);
        if (!hesaplanabilir(r.h, r.p)) return setResultError(DEGISKENLIK_YOK);
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              {groupLevels.map((ad, i) => (
                <span key={ad}>
                  <strong>{ad}</strong>: N={groups[i].length}, sıra ort.=
                  {yazSayi(r.siraOrtalamalari[i])}
                  <br />
                </span>
              ))}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              H({r.df}) = {yazSayi(r.h)}, {yazP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            <p className="muted text-sm">ε² = {yazSayi(r.epsilonKare)} (sıralara dayalı etki büyüklüğü)</p>
          </div>,
        );
      }

      if (analysisType === "spearman") {
        const veri = eslesenSutunlar(varA, varB);
        const [x, y] = veri.sutunlar;
        if (veri.n < 3) {
          setResultError("Korelasyon için en az 3 eşleşen gözlem gereklidir.");
          return;
        }
        const r = spearmanKorelasyonu(x, y);
        if (!hesaplanabilir(r.r, r.p)) return setResultError(DEGISKENLIK_YOK);
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              r<sub>s</sub>({r.df}) = {yazSayi(r.r)}, {yazP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            <p className="muted text-sm">
              Açıklanan varyans {yazSayi(r.rKare * 100)}% · ilişki {r.rYorum}
            </p>
          </div>,
        );
      }

      if (analysisType === "chisquare") {
        if (!dataset) return;
        const rowLevels = [...new Set(dataset.rows.map((r) => String(r[groupVar])).filter(Boolean))];
        const colLevels = [...new Set(dataset.rows.map((r) => String(r[varA])).filter(Boolean))];
        if (rowLevels.length < 2 || colLevels.length < 2) {
          setResultError("Ki-kare testi için her iki değişkende de en az 2 kategori olmalıdır.");
          return;
        }
        const table = rowLevels.map((rl) =>
          colLevels.map(
            (cl) => dataset.rows.filter((r) => String(r[groupVar]) === rl && String(r[varA]) === cl).length
          )
        );
        const r = chiSquareIndependence(table);
        if (!hesaplanabilir(r.chi2, r.p)) return setResultError(BEKLENEN_SIFIR);
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
            <div className="table-scroll" role="region" aria-label="Analiz sonuç tablosu" tabIndex={0}>
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
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
            {/* Etki büyüklüğü hesaplanıyordu ama ekranda hiç
                yazılmıyordu: p "ilişki var mı"yı, V "ne kadar
                güçlü"yü söyler. Öteki testlerde zaten yazılıyor. */}
            <p className="muted text-sm">
              Cramér&apos;s V = {yazSayi(r.cramersV)} ({r.vYorum} etki)
            </p>
            <div className="mt-sm">
              <strong>Varsayım</strong>
              <ul className="muted text-sm">
                <li>
                  En küçük beklenen frekans {yazSayi(r.enKucukBeklenen, 2)}; hücrelerin{" "}
                  {yazSayi(r.dusukHucreOrani * 100, 0)}&#37;&apos;inde beklenen 5&apos;in altında —{" "}
                  {r.varsayimSaglandi ? "ölçüt sağlanıyor" : "ölçüt sağlanmıyor"}
                </li>
              </ul>
              {!r.varsayimSaglandi && (
                <p className="tone-text text-sm" data-tone="warning">
                  Beklenen frekanslar küçük: χ² sürekli bir dağılıma yaklaşımdır ve bu durumda
                  p değeri olduğundan küçük çıkar.
                  {fisherP === null
                    ? " İkiden çok kategorili tabloda kesin testin karşılığı yok; kategorileri birleştirmek ya da örneklemi büyütmek gerekir."
                    : ""}
                </p>
              )}
              {fisherP !== null && Number.isFinite(fisherP) ? (
                <div className="stats-welch">
                  <p className="tone-text" data-tone={isSignificant(fisherP) ? "success" : "warning"}>
                    Fisher kesin testi (iki kuyruklu): {yazP(fisherP)}
                    {isSignificant(fisherP)
                      ? " — istatistiksel olarak anlamlı"
                      : " — istatistiksel olarak anlamlı değil"}
                  </p>
                  <p className="muted text-sm">
                    Yaklaşım değil, kesin hesap: kenar toplamları sabitken bütün tabloların
                    olasılığı toplanıyor. Beklenen frekanslar küçükken raporlanması gereken
                    satır budur.
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
          setResultError("İki yönlü ANOVA için birbirinden farklı iki kategorik faktör seçin.");
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
          setResultError(IKI_YONLU_HATA[r]);
          return;
        }
        if (!hesaplanabilir(r.faktorA.f, r.faktorA.p)) return setResultError(DEGISKENLIK_YOK);

        const satirlar = [r.faktorA, r.faktorB, r.etkilesim];
        setResult(
          <div>
            <div className="table-scroll" role="region" aria-label="İki yönlü ANOVA tablosu" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>Kaynak</th>
                    <th>KT</th>
                    <th>sd</th>
                    <th>KO</th>
                    <th>F</th>
                    <th>p</th>
                    <th>kısmi η²</th>
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
                    <td>Hata</td>
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
                ? "Etkileşim anlamlı: bir faktörün etkisi, öteki faktörün düzeyine göre değişiyor. Ana etkileri tek başına yorumlamayın; aşağıdaki hücre ortalamalarına bakın."
                : "Etkileşim anlamlı değil: ana etkiler tek başına yorumlanabilir."}
            </p>
            <div className="table-scroll mt-sm" role="region" aria-label="Hücre ortalamaları" tabIndex={0}>
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
                <strong>Basit etkiler (Bonferroni düzeltmeli)</strong>
                <ul className="muted text-sm">
                  {[
                    ...basitEtkiler(gozlemler, r, "a", groupVar, groupVar2),
                    ...basitEtkiler(gozlemler, r, "b", groupVar, groupVar2),
                  ].map((etki) => (
                    <li key={`${etki.faktor}-${etki.duzey}`}>
                      <b>{etki.duzey}</b> içinde {etki.faktor}: F({etki.df}, {r.hata.df}) ={" "}
                      {yazSayi(etki.f)}, {yazP(etki.p)}
                      {etki.anlamli ? " — anlamlı" : " — anlamlı değil"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="muted text-sm">
              Kareler toplamı model karşılaştırmasıyla (III. tip) hesaplanır; hücreler eşit
              büyüklükte olmadığında ders kitabının kapalı formülleri geçerli değildir.
              {r.dengeli ? " Bu veride hücreler eşit büyüklükte." : " Bu veride hücreler eşit büyüklükte DEĞİL."}
              {dusen > 0 ? ` ${dusen} satır eksik veri yüzünden analiz dışı bırakıldı.` : ""}
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
          setResultError("Güvenilirlik analizi için en az 2 madde seçmelisiniz.");
          return;
        }
        const veri = eslesenSutunlar(...reliabilityItems);
        if (veri.n < 3) {
          setResultError("Yetersiz veri: bütün maddeleri dolu olan en az 3 satır gerekiyor.");
          return;
        }
        const r = cronbachAlpha(veri.sutunlar);
        if (!hesaplanabilir(r.alpha)) return setResultError(DEGISKENLIK_YOK);
        const level =
          r.alpha >= 0.9
            ? "mükemmel"
            : r.alpha >= 0.8
            ? "iyi"
            : r.alpha >= 0.7
            ? "kabul edilebilir"
            : r.alpha >= 0.6
            ? "şüpheli"
            : "düşük";
        setResult(
          <div>
            <p>
              <strong>
                Cronbach&apos;s α = {yazSayi(r.alpha, 3)} ({r.k} madde, N = {r.n}) — güvenilirlik düzeyi:{" "}
                {level}
              </strong>
              {elemeNotu(veri) ? <span className="muted text-sm"> · {elemeNotu(veri)}</span> : null}
            </p>
            {/*
              MADDE İSTATİSTİKLERİ. Tek bir alfa sayısı "ölçek güvenilir mi"
              sorusunu yanıtlıyor ama "hangi madde bozuyor" sorusunu değil;
              alfa düşük çıktığında öğrencinin elinde atılacak maddeyi
              gösteren hiçbir şey yoktu.
            */}
            <div className="table-scroll" role="region" aria-label="Madde istatistikleri" tabIndex={0}>
              <table className="stats-result-table">
                <thead>
                  <tr>
                    <th>Madde</th>
                    <th>Düzeltilmiş madde-toplam r</th>
                    <th>Madde silinirse α</th>
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
              Düzeltilmiş madde-toplam korelasyonu maddeyi DİĞER maddelerin toplamıyla karşılaştırır.
              0,30&apos;un altı maddenin ölçekle örtüşmediğine, negatif değer ters kodlanmış olabileceğine işaret eder.
            </p>
          </div>
        );
      }
    } catch (err) {
      console.error(err);
      setCalisanAnaliz(null);
      setResultError("Analiz çalıştırılırken bir hata oluştu. Seçtiğiniz değişkenlerin uygun türde olduğundan emin olun.");
    }
  }, [dataset, fileName, analysisType, varA, varB, groupVar, groupVar2, groupLevels, reliabilityItems, yordayicilar, olcumler, testDegeri, kovaryatlar, olayDegeri, faktorSayisi, varY, dfaFaktorleri, dfaHataKovaryanslari, ikiDegerliSutunlar, getNumericColumn, getGroupedNumeric, eslesenSutunlar, yazP, yazSayi, pencere, yorumIste]);

  return (
    <section className={pencere ? "analiz-pencere-govde" : "project-form-card"}>
      {pencere ? (
        <>
          <h3 className="pencere-kart-baslik">Veriniz</h3>
          <p className="muted text-sm mb-md">
            Excel (.xlsx/.xls) ya da CSV dosyanızı yükleyin; analizi ArvoLab yapar. Hesap tarayıcınızda
            yapılır, dosyanız sunucuya gitmez; kaydedilen yalnızca sonuç metnidir.
          </p>
        </>
      ) : (
      <div className="project-form-heading">
        <h2>Veri Yükle ve Analiz Et</h2>
        <p>
          Excel (.xlsx/.xls) veya CSV dosyanızı yükleyin; betimsel istatistik,
          t-testi, ANOVA, korelasyon, ki-kare ve güvenilirlik analizi
          çalıştırabilirsiniz. Tüm hesaplama tarayıcınızda yapılır — dosyanız
          sunucuya yüklenmez. Sonuçlar gerçek hesaplamalardır; yorum/sonuç
          metni üretilmez, yalnızca sayısal sonuç ve anlamlılık işaretlenir.
        </p>
      </div>
      )}

      {!dataset && (
        <label className="dropzone">
          <UploadCloud size={28} aria-hidden="true" />
          <span className="text-base">
            {loading ? "Okunuyor..." : "Excel veya CSV dosyası seçmek için tıklayın"}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
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
              <strong>{fileName}</strong> — {dataset.rows.length} satır, {dataset.columns.length} sütun (
              {dataset.numericColumns.length} sayısal, {dataset.categoricalColumns.length} kategorik)
            </span>
            <button
              type="button"
              className="projects-filter-button"
              onClick={() => {
                setDataset(null);
                setResult(null);
                setFileName(null);
                setFullReport(null);
                setCalisanAnaliz(null);
                setKaydedildi(false);
                setYorum(null);
              }}
            >
              Yeni dosya yükle
            </button>
          </div>

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
                Bütün değişkenlerin özet raporu (betimsel, frekans, korelasyon)
              </summary>
              <button type="button" className="projects-filter-button button-compact mt-sm" onClick={handleGenerateFullReport}>
                Raporu oluştur
              </button>
              {fullReport ? <div className="results-divider text-base">{fullReport}</div> : null}
            </details>
          ) : null}
          {pencere ? null : (
          <div className="sub-card mb-lg">
            <div className="project-form-heading">
              <h2>
                <FileBarChart size={16} aria-hidden="true" />
                SPSS Tarzı Kapsamlı Analiz Raporu
              </h2>
              <p>
                Tek tıkla, veri setinizdeki TÜM değişkenler için betimsel
                istatistikleri, frekans tablolarını ve sayısal değişken
                çiftleri arasındaki korelasyon matrisini otomatik oluşturur —
                tıpkı SPSS&apos;te &quot;Analyze &gt; Descriptives&quot; ve
                &quot;Correlate&quot; çalıştırmak gibi. Belirli bir
                hipotezi test etmek isterseniz aşağıdaki tekil testleri
                kullanın.
              </p>
            </div>
            <button type="button" className="projects-primary-button" onClick={handleGenerateFullReport}>
              <FileBarChart size={15} aria-hidden="true" />
              Kapsamlı Raporu Oluştur
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
            Veya Belirli Bir Test Seçin
          </h3>
          )}
          {/* Pencerede yöntem kartla seçilir; dosya yüklü kalır, yöntem değiştirmek tek dokunuş. */}
          {pencere ? (
            <>
              <h3 className="pencere-kart-baslik">Hangi analiz?</h3>
              {YONTEM_GRUPLARI.map((g) => (
                <div key={g.baslik}>
                  <p className="analiz-grup-baslik">{g.baslik}</p>
                  <div className="analiz-kartlari">
                    {g.turler.map((tur) => {
                      const k = YONTEM_KARTLARI.find((x) => x.tur === tur)!;
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
              <span>Analiz türü</span>
              <select value={analysisType} onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}>
                {Object.entries(ANALYSIS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            )}

            {(analysisType === "ttest" || analysisType === "anova" || analysisType === "chisquare" || analysisType === "mannwhitney" || analysisType === "kruskalwallis" || analysisType === "ikiyonluanova" || analysisType === "ancova" || analysisType === "karmaanova") && (
              <label>
                <span>{analysisType === "ikiyonluanova" ? "1. faktör (kategorik)" : "Grup değişkeni (kategorik)"}</span>
                <select value={groupVar} onChange={(e) => setGroupVar(e.target.value)}>
                  {dataset.categoricalColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {analysisType === "ikiyonluanova" && (
              <label>
                <span>2. faktör (kategorik)</span>
                <select value={groupVar2} onChange={(e) => setGroupVar2(e.target.value)}>
                  <option value="">Seçin</option>
                  {dataset.categoricalColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(analysisType === "ttest" || analysisType === "anova" || analysisType === "correlation" || analysisType === "pairedttest" || analysisType === "wilcoxon" || analysisType === "regression" || analysisType === "mannwhitney" || analysisType === "kruskalwallis" || analysisType === "spearman" || analysisType === "ikiyonluanova" || analysisType === "tekorneklem" || analysisType === "ancova" || analysisType === "kismikorelasyon" || analysisType === "aracilik" || analysisType === "duzenleyicilik") && (
              <label>
                <span>{analysisType === "aracilik" || analysisType === "duzenleyicilik" ? "Bağımsız değişken (X)" : analysisType === "correlation" || analysisType === "spearman" || analysisType === "kismikorelasyon" ? "Değişken 1" : analysisType === "pairedttest" || analysisType === "wilcoxon" ? "Önceki ölçüm" : analysisType === "regression" ? "Bağımlı değişken (Y)" : analysisType === "ancova" ? "Bağımlı değişken (ör. son test)" : "Sayısal değişken"}</span>
                <select value={varA} onChange={(e) => setVarA(e.target.value)}>
                  {dataset.numericColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(analysisType === "correlation" || analysisType === "spearman" || analysisType === "pairedttest" || analysisType === "wilcoxon" || analysisType === "kismikorelasyon" || analysisType === "aracilik" || analysisType === "duzenleyicilik") && (
              <label>
                <span>{analysisType === "aracilik" ? "Aracı değişken (M)" : analysisType === "duzenleyicilik" ? "Düzenleyici değişken (W)" : analysisType === "pairedttest" || analysisType === "wilcoxon" ? "Sonraki ölçüm" : "Değişken 2"}</span>
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
                <span>İkinci kategorik değişken</span>
                <select value={varA} onChange={(e) => setVarA(e.target.value)}>
                  {dataset.categoricalColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(analysisType === "aracilik" || analysisType === "duzenleyicilik") && (
              <label>
                <span>Sonuç değişkeni (Y)</span>
                <select value={varY} onChange={(e) => setVarY(e.target.value)}>
                  <option value="">Seçin</option>
                  {dataset.numericColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(analysisType === "aracilik" || analysisType === "duzenleyicilik") && (
              <SutunSecimi
                etiket="Kontrol değişkenleri (isteğe bağlı)"
                sutunlar={dataset.numericColumns.filter((c) => c !== varA && c !== varB && c !== varY)}
                secili={kovaryatlar.filter((c) => c !== varA && c !== varB && c !== varY)}
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
                <span>Karşılaştırılacak değer</span>
                <input inputMode="decimal" value={testDegeri} onChange={(e) => setTestDegeri(e.target.value)} placeholder="3" />
              </label>
            )}

            {(analysisType === "mcnemar" || analysisType === "lojistik") && (
              <label>
                <span>{analysisType === "mcnemar" ? "Önceki ölçüm (iki kategorili)" : "Bağımlı değişken (iki kategorili)"}</span>
                <select value={varA} onChange={(e) => setVarA(e.target.value)}>
                  {ikiDegerliSutunlar.length ? null : <option value="">İki kategorili sütun yok</option>}
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
                <span>Sonraki ölçüm (iki kategorili)</span>
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
                <span>Olay (1) kabul edilen kategori</span>
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
                etiket={analysisType === "ancova" ? "Kovaryatlar (ör. ön test)" : "Kontrol değişkenleri"}
                sutunlar={dataset.numericColumns.filter((c) => c !== varA && (analysisType === "ancova" || c !== varB))}
                secili={kovaryatlar.filter((c) => c !== varA && c !== varB)}
                degistir={setKovaryatlar}
              />
            )}

            {(analysisType === "regression" || analysisType === "lojistik") && (
              <SutunSecimi
                etiket="Yordayıcı değişkenler"
                /* Bağımlı değişken yordayıcı olarak seçilemez: kendisiyle açıklanan model anlamsızdır. */
                sutunlar={dataset.numericColumns.filter((c) => c !== varA)}
                secili={yordayicilar.filter((c) => c !== varA)}
                degistir={setYordayicilar}
              />
            )}

            {(analysisType === "reliability" || analysisType === "faktor") && (
              <SutunSecimi
                etiket="Maddeler"
                sutunlar={dataset.numericColumns}
                secili={reliabilityItems}
                degistir={setReliabilityItems}
                ipucu="Ters maddeleri önce yukarıdaki Veri hazırlama bölümünde çevirin ve buraya çevrilmiş (_ters) sütunu seçin."
              />
            )}

            {analysisType === "faktor" && (
              <label>
                <span>Faktör sayısı (boş: öz değeri 1&apos;den büyük olanlar)</span>
                <input inputMode="numeric" value={faktorSayisi} onChange={(e) => setFaktorSayisi(e.target.value.replace(/\D/g, ""))} placeholder="Otomatik" />
              </label>
            )}

            {(analysisType === "friedman" || analysisType === "tekrarlianova" || analysisType === "karmaanova") && (
              <SutunSecimi
                etiket={analysisType === "friedman" ? "Tekrarlı ölçümler (en az üç)" : "Tekrarlı ölçümler"}
                sutunlar={dataset.numericColumns}
                secili={olcumler}
                degistir={setOlcumler}
                ipucu="Aynı kişilerin ön test, son test ve izleme ölçümleri gibi; her sütun bir ölçüm."
              />
            )}
          </div>

          <div className="project-form-actions mt-md">
            <button type="button" className="projects-primary-button" onClick={handleRunAnalysis}>
              <Play size={15} aria-hidden="true" />
              Analizi Çalıştır
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
                  {kopyalandi ? "Kopyalandı" : "Sonucu kopyala"}
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
                      {kaydediliyor ? "Kaydediliyor…" : "Teze ekleme sırasına koy"}
                    </button>
                  </>
                ) : null}
                {!pencere && calisanAnaliz && !kaydedildi ? (
                  <>
                    {calismalar.length > 0 ? (
                      <select
                        className="compact-select"
                        aria-label="Sonucun kaydedileceği çalışma"
                        value={kayitCalismasi}
                        onChange={(e) => setKayitCalismasi(e.target.value)}
                      >
                        <option value="">Çalışmaya bağlamadan</option>
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
                      {kaydediliyor ? "Kaydediliyor…" : "Sonucu kaydet"}
                    </button>
                  </>
                ) : null}
                {kaydedildi ? (
                  <span className="hint">
                    <Check size={14} className="inline-icon" aria-hidden="true" />
                    {pencere ? "Sırada — editörde “Analiz sonucu ekle” ile tezinize ekleyin." : "Kaydedildi — sayfanın altındaki geçmişte."}
                  </span>
                ) : null}
              </div>

              {pencere?.asistanAcik && calisanAnaliz ? (
                <div className="asistan-kart mt-md">
                  <div className="asistan-kart-ust">
                    <h3>Asistan ne diyor?</h3>
                    <p>
                      Asistan sonucu kendiliğinden okur; eksik etki büyüklüğünü, varsayımları ve
                      raporlamada dikkat edilecekleri söyler. Bulgunuzu yorumlayan cümle yazmaz,
                      size verilmeyen sayı üretemez.
                    </p>
                  </div>
                  {yorumBekleniyor ? <p className="hint" role="status">Asistan sonucu okuyor…</p> : null}
                  {yorum && !yorum.hata && !yorum.bulgular?.length ? (
                    <p className="hint">Asistanın bu sonuç için ekleyeceği bir not yok.</p>
                  ) : null}
                  {/* Kendiliğinden okuma bir sebeple başlamadıysa elle başlatılabilir. */}
                  {yorum || yorumBekleniyor ? null : (
                    <button type="button" className="projects-filter-button button-compact" onClick={() => yorumIste(calisanAnaliz.baslik, false)}>
                      <Sparkles size={14} aria-hidden="true" />
                      Asistana okut
                    </button>
                  )}
                  <AsistanSonuc
                    sonuc={yorum}
                    yetenek="analiz"
                    etiketler={{ uyari: "Eksik", oneri: "Öneri", bilgi: "Not" }}
                    bulguBasligi="Asistanın notları"
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
                    Danışmanınız SPSS, R ya da Python çıktısı isterse
                  </summary>
                  <div className="pencere-dugmeler mt-sm" role="group" aria-label="Program">
                    {PROGRAM_KARTLARI.filter((k) => !k.desteklenmiyor).map((k) => (
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
                    Analiz yukarıda ArvoLab&apos;da yapıldı. Aşağıdaki {ARAC_ADI[betikAraci]} aynı analizi o programda
                    tekrarlar; sonuçlar aynı çıkar. ANSYS gibi mühendislik simülasyonları veri tablosu analizi değildir,
                    ArvoLab çalıştıramaz.
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
                        setResultError("Panoya kopyalanamadı. Betiği seçip elle kopyalayabilirsiniz.");
                      }
                    }}
                  >
                    {betikKopyalandi ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    {betikKopyalandi ? "Kopyalandı" : "Kopyala"}
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
                Kaydedilen yalnızca yukarıdaki sonuç metnidir; yüklediğiniz veri
                dosyası sunucuya gitmez. Kaydetmezseniz sonuç sayfayı
                yenilediğinizde kaybolur.
              </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
