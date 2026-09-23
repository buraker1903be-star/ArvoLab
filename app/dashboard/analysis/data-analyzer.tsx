"use client";

import { useState, useCallback, useMemo, useRef, useTransition } from "react";
import { UploadCloud, Play, Table as TableIcon, FileBarChart, Copy, Check, Save } from "lucide-react";
import {
  describeNumeric,
  independentTTest,
  oneWayAnova,
  pearsonCorrelation,
  chiSquareIndependence,
  cronbachAlpha,
  frequencyTable,
  correlationMatrix,
  type DescriptiveStats,
} from "@/lib/stats-tests-core";
import { formatP, isSignificant, formatNumber } from "@/lib/apa-format";
import { ANALIZ_ETIKETLERI, analizBasligi, type AnalizTuru } from "@/lib/analiz-turleri";
import { analizSonucuKaydet } from "@/app/actions/analiz-sonuclari";
import { showToast } from "@/app/dashboard/_components/toast-events";

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

export default function DataAnalyzer({
  calismalar = [],
  secilenCalisma = "",
}: {
  calismalar?: { id: string; title: string }[];
  /* Çalışma merkezinden gelindiyse sonuç o çalışmaya kaydedilsin. */
  secilenCalisma?: string;
}) {
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [analysisType, setAnalysisType] = useState<AnalysisType>("descriptives");
  const [varA, setVarA] = useState("");
  const [varB, setVarB] = useState("");
  const [groupVar, setGroupVar] = useState("");
  const [reliabilityItems, setReliabilityItems] = useState<string[]>([]);

  const [result, setResult] = useState<React.ReactNode>(null);
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
  const [calisanAnaliz, setCalisanAnaliz] = useState<{ tur: AnalysisType; baslik: string } | null>(null);
  const [kayitCalismasi, setKayitCalismasi] = useState(secilenCalisma);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [kaydediliyor, kaydetmeyiBaslat] = useTransition();

  const sonucuKaydet = useCallback(() => {
    const metin = sonucKutusu.current?.innerText?.trim();
    if (!metin || !calisanAnaliz) return;
    kaydetmeyiBaslat(async () => {
      const sonuc = await analizSonucuKaydet({
        analizTuru: calisanAnaliz.tur,
        baslik: calisanAnaliz.baslik,
        apaMetni: metin,
        projectId: kayitCalismasi || null,
      });
      if ("error" in sonuc && sonuc.error) {
        // Sessiz düşmüyor: kullanıcı kaydettiğini sanıp sekmeyi kapatmasın.
        setResultError(sonuc.error);
        return;
      }
      setKaydedildi(true);
      showToast("success", "Sonuç kaydedildi; aşağıdaki geçmişte duruyor.");
    });
  }, [calisanAnaliz, kayitCalismasi]);

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

    const numericForMatrix = dataset.numericColumns.map((col) => ({
      name: col,
      values: getNumericColumn(col),
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
                    <td>{formatNumber(stats.mean)}</td>
                    <td>{formatNumber(stats.sd)}</td>
                    <td>{formatNumber(stats.min)}</td>
                    <td>{formatNumber(stats.max)}</td>
                    <td>{formatNumber(stats.median)}</td>
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
                        <td>%{formatNumber(f.percent, 1)}</td>
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
                        {formatNumber(c.r)}
                      </td>
                      <td>{formatP(c.p)}</td>
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
  }, [dataset, getNumericColumn]);

  const handleRunAnalysis = useCallback(() => {
    if (!dataset) return;
    setResultError(null);
    setResult(null);
    setKaydedildi(false);
    setCalisanAnaliz({
      tur: analysisType,
      baslik: analizBasligi(analysisType, {
        varA,
        varB,
        groupVar,
        maddeSayisi: reliabilityItems.length,
      }),
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
                  <td>{formatNumber(stats.mean)}</td>
                  <td>{formatNumber(stats.sd)}</td>
                  <td>{formatNumber(stats.min)}</td>
                  <td>{formatNumber(stats.max)}</td>
                  <td>{formatNumber(stats.median)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        );
      }

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
        const sig = isSignificant(r.p);
        setResult(
          <div>
            <p>
              <strong>{g1name}</strong>: N={r.n1}, Ort={formatNumber(r.m1)}, SS={formatNumber(r.sd1)}
              <br />
              <strong>{g2name}</strong>: N={r.n2}, Ort={formatNumber(r.m2)}, SS={formatNumber(r.sd2)}
            </p>
            <p className="tone-text" data-tone={sig ? "success" : "warning"}>
              t({r.df}) = {formatNumber(r.t)}, {formatP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
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
        const sig = isSignificant(r.p);
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
                    <td>{formatNumber(r.groupMeans[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="tone-text mt-sm" data-tone={sig ? "success" : "warning"}>
              F({r.dfb}, {r.dfw}) = {formatNumber(r.f)}, {formatP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
          </div>
        );
      }

      if (analysisType === "correlation") {
        const x = getNumericColumn(varA);
        const y = getNumericColumn(varB);
        const n = Math.min(x.length, y.length);
        if (n < 3) {
          setResultError("Korelasyon için en az 3 eşleşen gözlem gereklidir.");
          return;
        }
        const r = pearsonCorrelation(x.slice(0, n), y.slice(0, n));
        const sig = isSignificant(r.p);
        setResult(
          <p className="tone-text" data-tone={sig ? "success" : "warning"}>
            r({r.df}) = {formatNumber(r.r)}, {formatP(r.p)}
            {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
          </p>
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
        const sig = isSignificant(r.p);
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
              χ²({r.df}, N = {r.n}) = {formatNumber(r.chi2)}, {formatP(r.p)}
              {sig ? " — istatistiksel olarak anlamlı" : " — istatistiksel olarak anlamlı değil"}
            </p>
          </div>
        );
      }

      if (analysisType === "reliability") {
        if (reliabilityItems.length < 2) {
          setResultError("Güvenilirlik analizi için en az 2 madde seçmelisiniz.");
          return;
        }
        const items = reliabilityItems.map((col) => getNumericColumn(col));
        const minLen = Math.min(...items.map((i) => i.length));
        if (minLen < 3) {
          setResultError("Yetersiz veri: her maddede en az 3 gözlem olmalıdır.");
          return;
        }
        const trimmed = items.map((i) => i.slice(0, minLen));
        const r = cronbachAlpha(trimmed);
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
          <p>
            <strong>
              Cronbach&apos;s α = {formatNumber(r.alpha, 3)} ({r.k} madde, N = {r.n}) — güvenilirlik düzeyi:{" "}
              {level}
            </strong>
          </p>
        );
      }
    } catch (err) {
      console.error(err);
      setCalisanAnaliz(null);
      setResultError("Analiz çalıştırılırken bir hata oluştu. Seçtiğiniz değişkenlerin uygun türde olduğundan emin olun.");
    }
  }, [dataset, analysisType, varA, varB, groupVar, groupLevels, reliabilityItems, getNumericColumn, getGroupedNumeric]);

  return (
    <section className="project-form-card">
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
              }}
            >
              Yeni dosya yükle
            </button>
          </div>

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

          <h3 className="result-heading">
            Veya Belirli Bir Test Seçin
          </h3>
          <div className="project-form-grid">
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

            {(analysisType === "ttest" || analysisType === "anova" || analysisType === "chisquare") && (
              <label>
                <span>Grup değişkeni (kategorik)</span>
                <select value={groupVar} onChange={(e) => setGroupVar(e.target.value)}>
                  {dataset.categoricalColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(analysisType === "ttest" || analysisType === "anova" || analysisType === "correlation") && (
              <label>
                <span>{analysisType === "correlation" ? "Değişken 1" : "Sayısal değişken"}</span>
                <select value={varA} onChange={(e) => setVarA(e.target.value)}>
                  {dataset.numericColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {analysisType === "correlation" && (
              <label>
                <span>Değişken 2</span>
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

            {analysisType === "reliability" && (
              <label className="project-form-full">
                <span>Maddeler (Ctrl/Cmd ile birden çok seçin)</span>
                <select
                  multiple
                  value={reliabilityItems}
                  onChange={(e) =>
                    setReliabilityItems(Array.from(e.target.selectedOptions, (o) => o.value))
                  }
                  size={6}
                >
                  {dataset.numericColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
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
              <div className="cluster mt-sm">
                <button type="button" className="projects-filter-button button-compact" onClick={sonucuKopyala}>
                  {kopyalandi ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {kopyalandi ? "Kopyalandı" : "Sonucu kopyala"}
                </button>
                {calisanAnaliz && !kaydedildi ? (
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
                      onClick={sonucuKaydet}
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
                    Kaydedildi — sayfanın altındaki geçmişte.
                  </span>
                ) : null}
              </div>
              {/*
                Kaydetmenin ne kaydettiği açıkça yazılıyor: yukarıda
                "dosyanız sunucuya yüklenmez" sözü verildi, kullanıcı
                düğmeye basarken bunun hâlâ geçerli olduğunu bilmeli.
              */}
              <p className="hint">
                Kaydedilen yalnızca yukarıdaki sonuç metnidir; yüklediğiniz veri
                dosyası sunucuya gitmez. Kaydetmezseniz sonuç sayfayı
                yenilediğinizde kaybolur.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
