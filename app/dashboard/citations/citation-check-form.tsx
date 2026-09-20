"use client";

import { useState, useTransition } from "react";
import { kaynakcaDenetle, type KaynakcaDenetimYaniti } from "@/app/actions/ai-kaynakca";
import { runCitationCheck } from "@/app/actions/citation-check";
import type { Tone } from "@/lib/status-tone";

interface Project {
  id: string;
  title: string;
  university: string | null;
}

interface CheckResultRef {
  raw: string;
  issues: { field: string; message: string; severity: string }[];
}

interface AcademicMatch {
  provider: "crossref" | "openalex";
  title: string;
  year: number | null;
  doi: string | null;
  authors: string[];
  venue: string | null;
  url: string;
  citedByCount: number | null;
  confidence: number;
}

interface AcademicVerification {
  reference: string;
  status: "verified" | "possible_match" | "not_found" | "insufficient_data";
  googleScholarUrl: string;
  bestMatch: AcademicMatch | null;
  matches: AcademicMatch[];
}

interface InTextCitation {
  raw: string;
}

interface CheckResult {
  complianceScore: number;
  references: CheckResultRef[];
  citations: InTextCitation[];
  crossCheck: {
    citationsWithoutReference: { raw: string }[];
    referencesWithoutCitation: { raw: string }[];
  };
  academicVerification: AcademicVerification[];
  verificationSummary: {
    verified: number;
    possible: number;
    notFound: number;
    insufficientData: number;
  };
}

const STATUS_META: Record<AcademicVerification["status"], { label: string; tone: Tone }> = {
  verified: { label: "Doğrulandı", tone: "success" },
  possible_match: { label: "Olası eşleşme", tone: "warning" },
  not_found: { label: "Kayıt bulunamadı", tone: "danger" },
  insufficient_data: { label: "Yetersiz veri", tone: "neutral" },
};

const BULGU_TONU = { uyari: "danger", oneri: "warning", bilgi: "info" } as const;
const BULGU_ETIKETI = { uyari: "Sorun", oneri: "Öneri", bilgi: "Not" } as const;

export default function CitationCheckForm({ projects, asistanAcik }: { projects: Project[]; asistanAcik: boolean }) {
  const [projectId, setProjectId] = useState<string>("");
  const [projectTitle, setProjectTitle] = useState("");
  const [referenceList, setReferenceList] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denetim, setDenetim] = useState<KaynakcaDenetimYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const selectedProject = projects.find((p) => p.id === projectId);
      const res = await runCitationCheck({
        projectId: projectId || null,
        projectTitle: selectedProject ? selectedProject.title : projectTitle || null,
        referenceList,
        bodyText,
      });
      if ("error" in res) {
        setError(res.error as string);
      } else {
        setResult(res as CheckResult);
      }
    } catch {
      setError("Akademik veri kaynaklarına erişilirken bir hata oluştu. Lütfen yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="project-form-card mt-md">
      <div className="project-form-heading">
        <h2>Kaynakça ve Atıf Doğrulama</h2>
        <p>
          Kaynakları APA 7 kuralları, metin içi atıf eşleşmesi ve akademik kayıt
          varlığı açısından birlikte kontrol edin.
        </p>
      </div>

      <div className="callout mb-md" data-tone="info">
        Bibliyografik bilgiler Crossref ve OpenAlex üzerinden doğrulanır. Her sonuçta
        ayrıca Google Scholar’da aynı kaynağı açan bağımsız arama bağlantısı verilir.
        Tek seferde en fazla 25 kaynak kontrol edilir.
      </div>

      <div className="project-form-grid">
        {projects.length > 0 ? (
          <label>
            <span>Bağlı çalışma (opsiyonel)</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Seçili çalışma yok</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>Çalışma başlığı (opsiyonel etiket)</span>
            <input
              type="text"
              placeholder="Örn. Eğitim Bilimleri Yüksek Lisans Tezi"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
          </label>
        )}

        <label className="project-form-full">
          <span>Kaynakça listesi</span>
          <textarea
            rows={8}
            placeholder={"Yılmaz, A. (2020). Örnek makale başlığı. Dergi Adı, 12(3), 45-60. https://doi.org/..."}
            value={referenceList}
            onChange={(e) => setReferenceList(e.target.value)}
          />
        </label>

        <label className="project-form-full">
          <span>Metin (metin içi atıf kontrolü için, opsiyonel)</span>
          <textarea
            rows={6}
            placeholder="...önceki çalışmalarda (Yılmaz, 2020) belirtildiği gibi..."
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
        </label>
      </div>

      <div className="project-form-actions">
        <button
          type="button"
          className="projects-primary-button"
          onClick={handleCheck}
          disabled={loading || !referenceList.trim()}
        >
          {loading ? "Crossref, OpenAlex ve Scholar kontrol ediliyor..." : "Kaynakları Doğrula ve Kaydet"}
        </button>
      </div>

      {error && (
        <p className="alert mt-sm" data-tone="danger" role="alert">{error}</p>
      )}

      {result && (
        <div className="results-divider">
          <div className="chip-row">
            <strong className="chip">
              APA 7 Uyum: {result.complianceScore}/100
            </strong>
            <span className="chip" data-tone="success">
              {result.verificationSummary.verified} doğrulandı
            </span>
            <span className="chip" data-tone="warning">
              {result.verificationSummary.possible} olası eşleşme
            </span>
            <span className="chip" data-tone="danger">
              {result.verificationSummary.notFound} bulunamadı
            </span>
          </div>

          <div className="result-block">
            <h3 className="result-heading-lg">
              Akademik Kayıt Doğrulaması
            </h3>
            <div>
              {result.academicVerification.map((item, index) => {
                const meta = STATUS_META[item.status];
                return (
                  <article key={index} className="result-item" data-tone={meta.tone}>
                    <div className="project-card-main">
                      <div>
                        <div className="muted text-sm">
                          {item.reference}
                        </div>
                        {item.bestMatch ? (
                          <>
                            <div className="mt-sm">
                              <strong>{item.bestMatch.title}</strong>
                            </div>
                            <div className="hint">
                              {item.bestMatch.authors.slice(0, 4).join(", ") || "Yazar bilgisi yok"}
                              {item.bestMatch.year ? ` · ${item.bestMatch.year}` : ""}
                              {item.bestMatch.venue ? ` · ${item.bestMatch.venue}` : ""}
                            </div>
                            <div className="cluster cluster-spaced text-sm">
                              {item.bestMatch.url && (
                                <a href={item.bestMatch.url} target="_blank" rel="noreferrer" className="link-accent">
                                  {item.bestMatch.doi ? `DOI: ${item.bestMatch.doi}` : "Akademik kaydı aç"}
                                </a>
                              )}
                              <span>
                                {item.bestMatch.provider === "crossref" ? "Crossref" : "OpenAlex"}
                                {" · "}eşleşme %{Math.round(item.bestMatch.confidence * 100)}
                              </span>
                              {item.bestMatch.citedByCount !== null && (
                                <span>{item.bestMatch.citedByCount} atıf</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-base mt-sm">
                            Crossref ve OpenAlex üzerinde yeterince güçlü bir eşleşme bulunamadı.
                          </div>
                        )}
                      </div>
                      <span className="status-pill" data-tone={meta.tone}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-sm text-sm">
                      <a
                        href={item.googleScholarUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="link-accent"
                      >
                        Google Scholar’da kontrol et ↗
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="result-block">
            <h3 className="result-heading">APA 7 Biçim Sorunları</h3>
            <div className="stack-sm text-base">
              {result.references.map((reference, index) => (
                <div key={index}>
                  <div className="muted">{reference.raw}</div>
                  {reference.issues.length === 0 ? (
                    <div className="tone-text" data-tone="success">Biçim sorunu bulunamadı.</div>
                  ) : reference.issues.map((issue, issueIndex) => (
                    <div key={issueIndex} className="tone-text" data-tone={issue.severity === "error" ? "danger" : "warning"}>
                      [{issue.severity}] {issue.message}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="result-block">
            <h3 className="result-heading">
              Kaynakçada olup metinde atıfı bulunmayanlar
            </h3>
            <ul className="result-list">
              {result.crossCheck.referencesWithoutCitation.map((reference, index) => <li key={index}>{reference.raw}</li>)}
              {result.crossCheck.referencesWithoutCitation.length === 0 && (
                <li className="result-ok">Yok</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="result-heading">
              Metinde atıfı olup kaynakçada bulunmayanlar
            </h3>
            <ul className="result-list">
              {result.crossCheck.citationsWithoutReference.map((citation, index) => <li key={index}>{citation.raw}</li>)}
              {result.crossCheck.citationsWithoutReference.length === 0 && (
                <li className="result-ok">Yok</li>
              )}
            </ul>
          </div>

          <div className="ai-denetim">
            <div className="project-form-heading">
              <h3>Asistan yorumlasın</h3>
              <p>
                Yukarıdaki sonuçlar mekanik: dizinde bulunmayan her kayıt hata
                değildir — Türkçe tezler ve kurum raporları Crossref&apos;te
                çoğu zaman yer almaz. Asistan beklenen yoklukla gerçek şüpheyi
                ayırır, biçim sorunlarını önceliklendirir ve{" "}
                <strong>atıf–kaynakça uyumunu</strong> denetler: metinde
                &ldquo;Demir (2020)&rdquo;, kaynakçada &ldquo;Demir, A.
                (2021)&rdquo; yazıyorsa yukarıda iki ayrı sorun görünür; oysa
                tek bir yıl uyuşmazlığıdır. Düzeltilmiş künye yazmaz; DOI, yıl
                ya da cilt numarası üretmesine izin verilmez.
              </p>
            </div>

            <div className="project-form-actions mt-sm">
              <button
                type="button"
                className="projects-primary-button"
                disabled={!asistanAcik || bekleniyor}
                onClick={() =>
                  basla(async () => {
                    setDenetim(null);
                    setDenetim(
                      await kaynakcaDenetle({
                        kaynaklar: result.academicVerification.map((item, index) => ({
                          sira: index + 1,
                          ham: item.reference,
                          durum: item.status,
                          bicimSorunlari: (result.references[index]?.issues ?? []).map(
                            (sorun) => `${sorun.field}: ${sorun.message}`,
                          ),
                          eslesmeBasligi: item.bestMatch?.title ?? null,
                        })),
                        eksikKaynaklar: result.crossCheck.citationsWithoutReference.map((c) => c.raw),
                        kullanilmayanKaynaklar: result.crossCheck.referencesWithoutCitation.map((r) => r.raw),
                        atiflar: (result.citations ?? []).map((c) => c.raw),
                      }),
                    );
                  })
                }
              >
                {bekleniyor ? "Denetleniyor…" : "Kaynakçayı Yorumlat"}
              </button>
            </div>

            {!asistanAcik && (
              <p className="muted text-base mt-sm">
                Asistan bu kurulumda kapalı; yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor.
              </p>
            )}

            {denetim?.hata && (
              <p className="tone-text mt-sm text-base" data-tone="danger" role="alert">{denetim.hata}</p>
            )}

            {denetim?.kirpilanlar && denetim.kirpilanlar.length > 0 && (
              <p className="muted text-base mt-sm">
                Uzunluk sınırı nedeniyle asistana gönderilemeyen bölümler: {denetim.kirpilanlar.join(", ")}.
              </p>
            )}

            {denetim?.bulgular && denetim.bulgular.length > 0 && (
              <ul className="ai-bulgu-listesi mt-sm">
                {denetim.bulgular.map((bulgu, index) => (
                  <li className="attention-item" data-tone={BULGU_TONU[bulgu.tur]} key={index}>
                    <strong>{BULGU_ETIKETI[bulgu.tur]}</strong>
                    <span>
                      <b>{bulgu.baslik}</b>
                      <br />
                      {bulgu.aciklama}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
