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
    <div className="stack">
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

        <div className="project-form-grid">
          <label className="project-form-full">
            <span>SPSS çıktısı (serbest metin)</span>
            <textarea
              rows={6}
              placeholder={"t(28) = 2.45, p = .021\nF(2, 57) = 4.31, p = .018\nr(48) = .42, p = .003"}
              value={statsInput}
              onChange={(e) => setStatsInput(e.target.value)}
            />
          </label>
        </div>

        <div className="project-form-actions mt-sm">
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
          <div className="mt-md">
            {statsResult.length === 0 ? (
              <p className="muted text-base">
                Tanınabilir bir istatistik ifadesi bulunamadı. Desteklenen
                biçimler: t(df) = ..., p = ...; F(df1, df2) = ..., p = ...;
                r = ..., p = ...; χ²(df) = ..., p = ...
              </p>
            ) : (
              <ul className="result-list">
                {statsResult.map((s, i) => (
                  <li key={i}>
                    <span className="muted">{s.raw}</span>
                    <br />
                    <strong className="tone-text" data-tone={s.significant ? "success" : "warning"}>
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

        <div className="project-form-grid">
          <label className="project-form-full">
            <span>Kod listesi</span>
            <textarea
              rows={6}
              placeholder={"Motivasyon eksikliği: 15\nÖğretmen desteği: 8\nZaman yönetimi: 1"}
              value={codebookInput}
              onChange={(e) => setCodebookInput(e.target.value)}
            />
          </label>
        </div>

        <div className="project-form-actions mt-sm">
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
          <div className="mt-md text-base">
            <p>
              <strong>{codebookResult.totalCodes}</strong> kod ·{" "}
              <strong>{codebookResult.totalFrequency}</strong> toplam kodlama
            </p>

            {codebookResult.duplicates.length > 0 && (
              <div className="mt-sm">
                <strong className="tone-text" data-tone="danger">Tekrar eden kod adları:</strong>
                <ul className="result-list">
                  {codebookResult.duplicates.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {codebookResult.singleUseCodes.length > 0 && (
              <div className="mt-sm">
                <strong className="tone-text" data-tone="warning">
                  Tek kullanımlık kodlar (birleştirme/gözden geçirme adayı):
                </strong>
                <ul className="result-list">
                  {codebookResult.singleUseCodes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-sm">
              <strong>Frekans Tablosu (azalan sırada)</strong>
              <div className="table-scroll mt-sm">
                <table className="stats-result-table">
                  <tbody>
                    {codebookResult.codes.map((c, i) => (
                      <tr key={i}>
                        <td>{c.name}</td>
                        <td>
                          {c.frequency ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
