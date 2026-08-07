"use client";

import { useState, useCallback, useMemo } from "react";
import { UploadCloud, Play, Table as TableIcon, FileBarChart } from "lucide-react";
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

type CellValue = string | number | null;
type DataRow = Record<string, CellValue>;

interface ParsedDataset {
  columns: string[];
  rows: DataRow[];
  numericColumns: string[];
  categoricalColumns: string[];
}

type AnalysisType = "descriptives" | "ttest" | "anova" | "correlation" | "chisquare" | "reliability";

const ANALYSIS_LABELS: Record<AnalysisType, string> = {
  descriptives: "Betimsel İstatistikler",
  ttest: "Bağımsız Örneklem t-Testi",
  anova: "Tek Yönlü ANOVA",
  correlation: "Pearson Korelasyonu",
  chisquare: "Ki-Kare Bağımsızlık Testi",
  reliability: "Güvenilirlik Analizi (Cronbach Alpha)",
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

export default function DataAnalyzer() {
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

  function getNumericColumn(col: string): number[] {
    if (!dataset) return [];
    return dataset.rows
      .map((r) => r[col])
      .filter((v) => v !== null && v !== "" && !isNaN(Number(v)))
      .map(Number);
  }

  function getGroupedNumeric(numericCol: string, groupCol: string): Map<string, number[]> {
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
  }

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
      <div style={{ display: "grid", gap: 24 }}>
        {numericSections.length > 0 && (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              1. Betimsel İstatistikler (Sayısal Değişkenler)
            </h3>
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
        )}

        {categoricalSections.length > 0 && (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              2. Frekans Tabloları (Kategorik Değişkenler)
            </h3>
            {categoricalSections.map(({ col, freq }) => (
              <div key={col} style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{col}</p>
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
            ))}
          </div>
        )}

        {matrix.length > 0 && (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              3. Korelasyon Matrisi (Sayısal Değişken Çiftleri)
            </h3>
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
                      <td style={{ color: sig ? "#16a34a" : undefined, fontWeight: sig ? 700 : 400 }}>
                        {formatNumber(c.r)}
                      </td>
                      <td>{formatP(c.p)}</td>
                      <td>{c.n}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
              Yeşil/kalın satırlar p &lt; .05 düzeyinde istatistiksel olarak anlamlıdır.
            </p>
          </div>
        )}

        {numericSections.length === 0 && categoricalSections.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Rapor oluşturmak için okunabilir sayısal veya kategorik sütun bulunamadı.
          </p>
        )}
      </div>
    );
  }, [dataset]);

  const handleRunAnalysis = useCallback(() => {
    if (!dataset) return;
    setResultError(null);
    setResult(null);

    try {
      if (analysisType === "descriptives") {
        const rows = dataset.numericColumns.map((col) => {
          const stats: DescriptiveStats = describeNumeric(getNumericColumn(col));
          return { col, stats };
        });
        setResult(
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
            <p style={{ color: sig ? "#16a34a" : "#d97706", fontWeight: 700 }}>
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
            <p style={{ color: sig ? "#16a34a" : "#d97706", fontWeight: 700, marginTop: 10 }}>
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
          <p style={{ color: sig ? "#16a34a" : "#d97706", fontWeight: 700 }}>
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
            <p style={{ color: sig ? "#16a34a" : "#d97706", fontWeight: 700, marginTop: 10 }}>
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
          <p style={{ fontWeight: 700 }}>
            Cronbach&apos;s α = {formatNumber(r.alpha, 3)} ({r.k} madde, N = {r.n}) — güvenilirlik düzeyi:{" "}
            {level}
          </p>
        );
      }
    } catch (err) {
      console.error(err);
      setResultError("Analiz çalıştırılırken bir hata oluştu. Seçtiğiniz değişkenlerin uygun türde olduğundan emin olun.");
    }
  }, [dataset, analysisType, varA, varB, groupVar, groupLevels, reliabilityItems]);

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
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            border: "2px dashed var(--border)",
            borderRadius: 14,
            padding: "40px 20px",
            cursor: "pointer",
          }}
        >
          <UploadCloud size={28} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            {loading ? "Okunuyor..." : "Excel veya CSV dosyası seçmek için tıklayın"}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {parseError && (
        <p className="login-error" role="alert" style={{ marginTop: 12 }}>
          {parseError}
        </p>
      )}

      {dataset && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <span>
              <TableIcon size={14} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
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
              }}
            >
              Yeni dosya yükle
            </button>
          </div>

          <div className="project-form-card" style={{ marginBottom: 20, background: "var(--surface-muted)" }}>
            <div className="project-form-heading">
              <h2 style={{ fontSize: 14 }}>
                <FileBarChart size={16} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
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
              <FileBarChart size={15} />
              Kapsamlı Raporu Oluştur
            </button>

            {fullReport && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: 13 }}>
                {fullReport}
              </div>
            )}
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
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
                  style={{ minHeight: 120 }}
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

          <div className="project-form-actions" style={{ marginTop: 16 }}>
            <button type="button" className="projects-primary-button" onClick={handleRunAnalysis}>
              <Play size={15} />
              Analizi Çalıştır
            </button>
          </div>

          {resultError && (
            <p className="login-error" role="alert" style={{ marginTop: 16 }}>
              {resultError}
            </p>
          )}

          {result && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: 13 }}>
              {result}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
