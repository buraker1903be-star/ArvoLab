"use client";

import { useState, useTransition } from "react";
import { detectStatistics, type DetectedStatistic } from "@/lib/stats-interpreter";
import { parseCodebook, type CodebookCheckResult } from "@/lib/codebook-check";
import { analizDenetle, type AnalizDenetimYaniti } from "@/app/actions/ai-analiz";
import AsistanSonuc from "../_components/asistan-sonuc";

type Calisma = { id: string; title: string };

export default function AnalysisTools({
  asistanAcik,
  calismalar = [],
  secilenCalisma = "",
}: {
  asistanAcik: boolean;
  calismalar?: Calisma[];
  /* Çalışma merkezinden gelindiyse o çalışma hazır seçili gelir; kullanıcı
     aynı seçimi her sayfada yeniden yapmasın (lib/calisma-ozeti.ts adım
     bağlantıları ?calisma=<id> taşıyor). */
  secilenCalisma?: string;
}) {
  const [statsInput, setStatsInput] = useState("");
  const [statsResult, setStatsResult] = useState<DetectedStatistic[] | null>(null);

  // Asistan denetimi: tespit edilen istatistikler + çalışmanın kısa bağlamı.
  const [arastirmaSorusu, setArastirmaSorusu] = useState("");
  const [orneklem, setOrneklem] = useState("");
  const [calismaId, setCalismaId] = useState(secilenCalisma);
  const [denetim, setDenetim] = useState<AnalizDenetimYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();

  // zorla=true: kayıtlı cevap atlanır, modele yeniden sorulur.
  function denetle(zorla: boolean) {
    if (!statsResult) return;
    basla(async () => {
      setDenetim(null);
      setDenetim(
        await analizDenetle({
          istatistikMetni: statsInput,
          apaSatirlari: statsResult.map((s) => s.apaSentenceFragment),
          arastirmaSorusu,
          orneklem,
          projectId: calismaId || null,
          zorla,
        }),
      );
    });
  }

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

        {statsResult && statsResult.length > 0 && (
          <div className="asistan-kart mt-md">
            <div className="asistan-kart-ust">
              <h3>Asistan denetlesin</h3>
              <p>
                Asistan raporlamayı denetler: eksik etki büyüklüğü, eksik
                serbestlik derecesi, p değeri biçimi, varsayımlar. Metninizi
                yazmaz ve bulgunuzu yorumlamaz; size verilmeyen hiçbir sayıyı
                da üretemez — ürettiği anda cevap gösterilmez.
              </p>
            </div>

            <div className="project-form-grid">
              <label>
                <span>Araştırma sorusu (isteğe bağlı)</span>
                <input
                  type="text"
                  maxLength={2000}
                  placeholder="İki öğretim yöntemi arasında başarı farkı var mı?"
                  value={arastirmaSorusu}
                  onChange={(e) => setArastirmaSorusu(e.target.value)}
                />
              </label>
              <label>
                <span>Örneklem (isteğe bağlı)</span>
                <input
                  type="text"
                  maxLength={2000}
                  placeholder="N = 60, iki bağımsız grup"
                  value={orneklem}
                  onChange={(e) => setOrneklem(e.target.value)}
                />
              </label>
              {calismalar.length > 0 && (
                <label>
                  <span>Çalışma (isteğe bağlı)</span>
                  <select value={calismaId} onChange={(e) => setCalismaId(e.target.value)}>
                    <option value="">Bağlı değil</option>
                    {calismalar.map((calisma) => (
                      <option key={calisma.id} value={calisma.id}>{calisma.title}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="project-form-actions mt-sm">
              <button
                type="button"
                className="projects-primary-button"
                disabled={!asistanAcik || bekleniyor}
                onClick={() => denetle(false)}
              >
                {bekleniyor ? "Denetleniyor…" : "Raporlamayı Denetle"}
              </button>
            </div>

            {!asistanAcik && (
              <p className="asistan-uyari" data-tone="neutral">
                Asistan bu kurulumda kapalı; yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor.
              </p>
            )}

            <AsistanSonuc
              sonuc={denetim}
              yetenek="analiz"
              etiketler={{ uyari: "Eksik", oneri: "Öneri", bilgi: "Not" }}
              bulguBasligi="Denetim bulguları"
              bekleniyor={bekleniyor}
              onYenidenSorgula={() => denetle(true)}
            />
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
