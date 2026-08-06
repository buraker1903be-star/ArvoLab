"use client";

import { useState } from "react";
import { detectStatistics, type DetectedStatistic } from "@/lib/stats-interpreter";
import { parseCodebook, type CodebookCheckResult } from "@/lib/codebook-check";

export default function AnalysisTools() {
  const [statsInput, setStatsInput] = useState("");
  const [statsResult, setStatsResult] = useState<DetectedStatistic[] | null>(null);

  const [codebookInput, setCodebookInput] = useState("");
  const [codebookResult, setCodebookResult] = useState<CodebookCheckResult | null>(null);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* SPSS Çıktısı -> APA Biçimlendirici */}
      <section className="project-form-card">
        <div className="project-form-heading">
          <h2>SPSS Çıktısı → APA 7 Biçimlendirici</h2>
          <p>
            SPSS&apos;ten kopyaladığınız istatistik değerlerini (t, F, r, χ²)
            yapıştırın; sistem bunları APA 7 raporlama biçimine çevirir.
            Yeni analiz yapmaz, yorum üretmez — yalnızca biçimlendirir ve
            anlamlılık eşiğini (p &lt; .05) mekanik olarak işaretler.
          </p>
        </div>

        <label className="project-form-full" style={{ display: "block" }}>
          <span>SPSS çıktısı (serbest metin)</span>
          <textarea
            rows={6}
            placeholder={"t(28) = 2.45, p = .021\nF(2, 57) = 4.31, p = .018\nr(48) = .42, p = .003"}
            value={statsInput}
            onChange={(e) => setStatsInput(e.target.value)}
          />
        </label>

        <div className="project-form-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="projects-primary-button"
            onClick={() => setStatsResult(detectStatistics(statsInput))}
            disabled={!statsInput.trim()}
          >
            İstatistikleri Tespit Et
          </button>
        </div>

        {statsResult && (
          <div style={{ marginTop: 16 }}>
            {statsResult.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                Tanınabilir bir istatistik ifadesi bulunamadı. Desteklenen
                biçimler: t(df) = ..., p = ...; F(df1, df2) = ..., p = ...;
                r = ..., p = ...; χ²(df) = ..., p = ...
              </p>
            ) : (
              <ul style={{ fontSize: 13, paddingLeft: 18 }}>
                {statsResult.map((s, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <span style={{ color: "var(--muted-foreground)" }}>{s.raw}</span>
                    <br />
                    <strong style={{ color: s.significant ? "#16a34a" : "#d97706" }}>
                      {s.apaSentenceFragment}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* MAXQDA Kod Kitabı Kontrolü */}
      <section className="project-form-card">
        <div className="project-form-heading">
          <h2>MAXQDA Kod Kitabı Kalite Kontrolü</h2>
          <p>
            Kod listenizi (her satıra bir kod, opsiyonel olarak frekansıyla
            birlikte) yapıştırın. Sistem tekrar eden kod adlarını, tek
            kullanımlık kodları ve frekans dağılımını gösterir. Yeni tema
            veya kod önermez — yalnızca liste kalitesini denetler.
          </p>
        </div>

        <label className="project-form-full" style={{ display: "block" }}>
          <span>Kod listesi</span>
          <textarea
            rows={6}
            placeholder={"Motivasyon eksikliği: 15\nÖğretmen desteği: 8\nZaman yönetimi: 1"}
            value={codebookInput}
            onChange={(e) => setCodebookInput(e.target.value)}
          />
        </label>

        <div className="project-form-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="projects-primary-button"
            onClick={() => setCodebookResult(parseCodebook(codebookInput))}
            disabled={!codebookInput.trim()}
          >
            Kod Kitabını Kontrol Et
          </button>
        </div>

        {codebookResult && (
          <div style={{ marginTop: 16, fontSize: 13 }}>
            <p>
              <strong>{codebookResult.totalCodes}</strong> kod ·{" "}
              <strong>{codebookResult.totalFrequency}</strong> toplam kodlama
            </p>

            {codebookResult.duplicates.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong style={{ color: "#dc2626" }}>Tekrar eden kod adları:</strong>
                <ul style={{ paddingLeft: 18 }}>
                  {codebookResult.duplicates.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {codebookResult.singleUseCodes.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong style={{ color: "#d97706" }}>
                  Tek kullanımlık kodlar (birleştirme/gözden geçirme adayı):
                </strong>
                <ul style={{ paddingLeft: 18 }}>
                  {codebookResult.singleUseCodes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <strong>Frekans Tablosu (azalan sırada)</strong>
              <table style={{ width: "100%", marginTop: 6, borderCollapse: "collapse" }}>
                <tbody>
                  {codebookResult.codes.map((c, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "4px 0" }}>{c.name}</td>
                      <td style={{ padding: "4px 0", textAlign: "right" }}>
                        {c.frequency ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
