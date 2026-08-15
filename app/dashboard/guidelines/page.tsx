import { BookMarked, ExternalLink, Plus, Trash2 } from "lucide-react";
import { getGuidelines, createGuideline, deleteGuideline, approveGuideline } from "@/app/actions/guidelines";
import { getUniversities } from "@/app/actions/universities";

// Kılavuz tarama aracı dış URL çekip PDF ayrıştırabilir, zaman alabilir.
export const maxDuration = 60;
import { getCurrentProfile } from "@/app/actions/profile";
import { isOversightRole } from "@/lib/project-labels";
import GuidelineScanner from "./guideline-scanner";

const errorMessages: Record<string, string> = {
  "missing-university": "Üniversite adı zorunludur.",
  "save-failed": "Kılavuz kaydedilirken bir hata oluştu. Yetkinizi kontrol edin.",
};

const CITATION_LABELS: Record<string, string> = {
  apa7: "APA 7",
  vancouver: "Vancouver",
  chicago: "Chicago",
  ieee: "IEEE",
};

type GuidelinesPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function GuidelinesPage({ searchParams }: GuidelinesPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : null;

  const [guidelines, profile, universities] = await Promise.all([
    getGuidelines(),
    getCurrentProfile(),
    getUniversities(),
  ]);
  // Kılavuz ekleme/silme yalnızca Akademik Yönetici ve üzeri rollere açık
  // (proje dosyası Bölüm 5.6: kural sürümleri akademik yönetici onayıyla etkinleşir).
  const canManage =
    profile?.role === "academic_manager" ||
    profile?.role === "system_admin" ||
    profile?.role === "founder";

  async function handleDelete(guidelineId: string) {
    "use server";
    await deleteGuideline(guidelineId);
  }

  async function handleApprove(guidelineId: string) {
    "use server";
    await approveGuideline(guidelineId);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Referans veri</span>
          <h1 className="brand-type">Üniversite Tez Yazım Kılavuzları</h1>
          <p>
            Üniversitelerin zorunlu tuttuğu bölümler, kaynakça sistemi ve
            sayfa aralığı burada tutulur. Belge yükleme sırasında bu
            kurallara göre otomatik ön kontrol yapılabilir.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <p className="login-error" role="alert" style={{ marginBottom: 16 }}>
          {errorMessage}
        </p>
      ) : null}

      {canManage ? <GuidelineScanner /> : null}

      {canManage ? (
        <section className="project-form-card" style={{ marginBottom: 24 }}>
          <div className="project-form-heading">
            <h2>Yeni Kılavuz Ekle</h2>
            <p>Yalnızca Akademik Yönetici ve üzeri roller kılavuz ekleyebilir/güncelleyebilir.</p>
          </div>

          <form className="project-form-grid" action={createGuideline}>
            <label>
              <span>Üniversite adı</span>
              <input
                name="universityName"
                type="text"
                list="university-options-guideline"
                placeholder="Örn. Marmara Üniversitesi"
                autoComplete="off"
                required
              />
              <datalist id="university-options-guideline">
                {universities.map((u) => (
                  <option key={u.id} value={u.name} />
                ))}
              </datalist>
            </label>

            <label>
              <span>Enstitü (opsiyonel)</span>
              <input name="instituteName" type="text" placeholder="Sosyal Bilimler Enstitüsü" />
            </label>

            <label>
              <span>Sürüm etiketi</span>
              <input name="versionLabel" type="text" placeholder="2025 Güz" />
            </label>

            <label>
              <span>Kaynak URL (resmî kılavuz)</span>
              <input name="sourceUrl" type="url" placeholder="https://..." />
            </label>

            <label>
              <span>Kaynakça sistemi</span>
              <select name="citationStyle" defaultValue="apa7">
                <option value="apa7">APA 7</option>
                <option value="vancouver">Vancouver</option>
                <option value="chicago">Chicago</option>
                <option value="ieee">IEEE</option>
              </select>
            </label>

            <label>
              <span>Min. sayfa</span>
              <input name="minPages" type="number" min={0} placeholder="60" />
            </label>

            <label>
              <span>Maks. sayfa</span>
              <input name="maxPages" type="number" min={0} placeholder="150" />
            </label>

            <label className="project-form-full">
              <span>Zorunlu bölümler (virgülle ayırın)</span>
              <input
                name="requiredSections"
                type="text"
                placeholder="Giriş, Yöntem, Bulgular, Tartışma, Sonuç, Kaynakça"
              />
            </label>

            <label className="project-form-full">
              <span>Notlar</span>
              <textarea name="notes" rows={3} placeholder="Ek biçimsel notlar" />
            </label>

            <div className="project-form-actions" style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="projects-primary-button">
                <Plus size={16} />
                Kılavuzu kaydet
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {guidelines.length === 0 ? (
        <section className="project-form-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <BookMarked size={28} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ margin: 0, color: "var(--muted-foreground)" }}>
            Henüz kayıtlı bir üniversite kılavuzu yok.
          </p>
        </section>
      ) : (
        <section className="projects-list" aria-label="Kılavuz listesi">
          {guidelines.map((g) => (
            <article className="project-card" key={g.id}>
              <div className="project-card-main">
                <div>
                  <span className="project-status">{CITATION_LABELS[g.citation_style] ?? g.citation_style}</span>
                  <span className="project-status" style={{ marginLeft: 8 }}>
                    {g.analysis_status === "approved" ? "Onaylı" : g.analysis_status === "needs_review" ? "İnceleme gerekli" : g.analysis_status}
                  </span>
                  <h2>
                    {g.university_name}
                    {g.institute_name ? ` — ${g.institute_name}` : ""}
                  </h2>
                  <p>
                    {g.version_label ? `${g.version_label} · ` : ""}
                    {g.required_sections.length > 0
                      ? `Zorunlu bölümler: ${g.required_sections.join(", ")}`
                      : "Zorunlu bölüm tanımlanmadı"}
                  </p>
                </div>
              </div>

              <div className="project-card-meta">
                {g.min_pages || g.max_pages ? (
                  <span>
                    Sayfa aralığı: {g.min_pages ?? "—"}–{g.max_pages ?? "—"}
                  </span>
                ) : null}
                {g.source_url ? (
                  <a href={g.source_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <ExternalLink size={14} />
                    Resmî kaynak
                  </a>
                ) : null}
              </div>

              {canManage ? (
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  {g.analysis_status !== "approved" ? (
                    <form action={handleApprove.bind(null, g.id)}>
                      <button type="submit" className="projects-primary-button">Onayla ve uygula</button>
                    </form>
                  ) : null}
                  <form action={handleDelete.bind(null, g.id)}>
                    <button type="submit" className="projects-filter-button">
                      <Trash2 size={14} />
                      Sil
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
