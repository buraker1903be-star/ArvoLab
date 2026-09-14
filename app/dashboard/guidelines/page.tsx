import { BookMarked, ExternalLink, FilePenLine, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  getGuidelines,
  createGuideline,
  deleteGuideline,
  approveGuideline,
  updateGuidelineRules,
  updateGuidelineDetails,
} from "@/app/actions/guidelines";
import { getUniversities } from "@/app/actions/universities";

// Kılavuz tarama aracı dış URL çekip PDF ayrıştırabilir, zaman alabilir.
export const maxDuration = 60;
import { getCurrentProfile } from "@/app/actions/profile";
import GuidelineScanner from "./guideline-scanner";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import { statusTone } from "@/lib/status-tone";

const CITATION_LABELS: Record<string, string> = {
  apa7: "APA 7",
  vancouver: "Vancouver",
  chicago: "Chicago",
  ieee: "IEEE",
};

const REVIEW_FONTS = ["Times New Roman", "Arial", "Calibri", "Cambria", "Garamond", "Georgia", "Verdana", "Book Antiqua"];

export default async function GuidelinesPage() {
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
    return deleteGuideline(guidelineId);
  }

  async function handleApprove(guidelineId: string) {
    "use server";
    return approveGuideline(guidelineId);
  }

  async function handleRuleUpdate(guidelineId: string, formData: FormData) {
    "use server";
    return updateGuidelineRules(guidelineId, formData);
  }

  async function handleDetailsUpdate(guidelineId: string, formData: FormData) {
    "use server";
    return updateGuidelineDetails(guidelineId, formData);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Referans veri</span>
          <h1>Üniversite Tez Yazım Kılavuzları</h1>
          <p>
            Üniversitelerin zorunlu tuttuğu bölümler, kaynakça sistemi ve
            sayfa aralığı burada tutulur. Belge yükleme sırasında bu
            kurallara göre otomatik ön kontrol yapılabilir.
          </p>
        </div>
        {canManage ? (
          <PanelDrawer
            triggerLabel="Yeni kılavuz"
            triggerIcon={<Plus size={16} aria-hidden="true" />}
            kicker="Referans veri"
            title="Yeni kılavuz ekle"
            description="Kayıt, projelerde kullanılmadan önce akademik onaya düşer."
          >
            <ActionForm className="project-form-grid" action={createGuideline} successMessage="Kılavuz eklendi; onay bekliyor.">
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
                  {Object.entries(CITATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
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

              <div className="project-form-actions">
                <button type="submit" className="projects-primary-button">
                  <Plus size={16} aria-hidden="true" />
                  Kılavuzu kaydet
                </button>
              </div>
            </ActionForm>
          </PanelDrawer>
        ) : null}
      </section>

      {canManage ? (
        <>
          {/* Yeni ve düzenleme pencerelerindeki üniversite alanlarının önerileri */}
          <datalist id="university-options-guideline">
            {universities.map((u) => (
              <option key={u.id} value={u.name} />
            ))}
          </datalist>
          <GuidelineScanner />
        </>
      ) : null}

      {guidelines.length === 0 ? (
        <section className="empty-state">
          <BookMarked size={28} aria-hidden="true" />
          <p>Henüz kayıtlı bir üniversite kılavuzu yok.</p>
        </section>
      ) : (
        <section className="projects-list" aria-label="Kılavuz listesi">
          {guidelines.map((g) => {
            const margins = (g.extracted_rules?.margins_cm ?? {}) as Record<string, unknown>;
            const guidelineName = `${g.university_name}${g.institute_name ? ` — ${g.institute_name}` : ""}`;
            return (
              <article className="project-card" key={g.id}>
                <div className="project-card-main">
                  <div>
                    <div className="pill-row">
                      <span className="status-pill">{CITATION_LABELS[g.citation_style] ?? g.citation_style}</span>
                      <span className="status-pill" data-tone={statusTone(g.analysis_status)}>
                        {g.analysis_status === "approved"
                          ? "Onaylı"
                          : g.analysis_status === "needs_review"
                            ? "İnceleme gerekli"
                            : g.analysis_status}
                      </span>
                    </div>
                    <h2>{guidelineName}</h2>
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
                    <a href={g.source_url} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} aria-hidden="true" />
                      Resmî kaynak
                    </a>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="cluster cluster-spaced">
                    {g.analysis_status !== "approved" ? (
                      <ActionForm action={handleApprove.bind(null, g.id)} successMessage="Kılavuz onaylandı ve uygulandı.">
                        <button type="submit" className="projects-primary-button">Onayla ve uygula</button>
                      </ActionForm>
                    ) : null}

                    <PanelDrawer
                      triggerLabel="Kuralları düzenle"
                      triggerIcon={<SlidersHorizontal size={14} aria-hidden="true" />}
                      triggerClassName="projects-filter-button"
                      kicker="Biçim kuralları"
                      title={guidelineName}
                      description="Kaydedince kılavuz yeniden onaya düşer; projelerde kullanılabilmesi için yeniden onaylayın."
                    >
                      <ActionForm
                        className="guideline-review-form"
                        action={handleRuleUpdate.bind(null, g.id)}
                        successMessage="Kurallar kaydedildi; yeniden onay gerekiyor."
                      >
                        <label>
                          <span>Kaynakça sistemi</span>
                          <select name="citationStyle" defaultValue={g.citation_style}>
                            {Object.entries(CITATION_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Yazı tipi</span>
                          <select name="fontFamily" defaultValue={String(g.extracted_rules?.font_family ?? "Times New Roman")}>
                            {REVIEW_FONTS.map((font) => (
                              <option key={font}>{font}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Punto</span>
                          <input name="fontSizePt" type="number" min="8" max="24" step="0.5" defaultValue={Number(g.extracted_rules?.font_size_pt ?? 12)} required />
                        </label>
                        <label>
                          <span>Satır aralığı</span>
                          <input name="lineSpacing" type="number" min="1" max="3" step="0.15" defaultValue={Number(g.extracted_rules?.line_spacing ?? 1.5)} required />
                        </label>
                        {(["Top", "Bottom", "Left", "Right"] as const).map((side) => {
                          const key = side.toLowerCase() as "top" | "bottom" | "left" | "right";
                          const labels = { top: "Üst boşluk (cm)", bottom: "Alt boşluk (cm)", left: "Sol boşluk (cm)", right: "Sağ boşluk (cm)" };
                          return (
                            <label key={side}>
                              <span>{labels[key]}</span>
                              <input name={`margin${side}`} type="number" min="0" max="10" step="0.1" defaultValue={Number(margins[key] ?? 2.5)} required />
                            </label>
                          );
                        })}
                        <label className="guideline-review-full">
                          <span>Zorunlu bölümler</span>
                          <input name="requiredSections" defaultValue={g.required_sections.join(", ")} placeholder="Giriş, Yöntem, Bulgular, Sonuç, Kaynakça" required />
                        </label>
                        <label className="guideline-review-check checkbox-label">
                          <input name="showPageNumbers" type="checkbox" defaultChecked={g.extracted_rules?.show_page_numbers !== false} />
                          <span>Sayfa numarası kullan</span>
                        </label>
                        <label className="guideline-review-full">
                          <span>İnceleme notu</span>
                          <textarea name="reviewNotes" rows={2} defaultValue={g.review_notes ?? ""} />
                        </label>
                        <div className="project-form-actions guideline-review-full">
                          <button type="submit" className="projects-primary-button">Kuralları kaydet</button>
                        </div>
                      </ActionForm>
                    </PanelDrawer>

                    <PanelDrawer
                      triggerLabel="Bilgileri düzenle"
                      triggerIcon={<FilePenLine size={14} aria-hidden="true" />}
                      triggerClassName="projects-filter-button"
                      kicker="Kılavuz bilgileri"
                      title={guidelineName}
                      description="Üniversite ya da enstitü değişirse kılavuz yeniden onaya düşer."
                    >
                      <ActionForm
                        className="guideline-review-form"
                        action={handleDetailsUpdate.bind(null, g.id)}
                        successMessage="Kılavuz bilgileri kaydedildi."
                      >
                        <label className="guideline-review-full">
                          <span>Üniversite adı</span>
                          <input
                            name="universityName"
                            type="text"
                            list="university-options-guideline"
                            defaultValue={g.university_name}
                            autoComplete="off"
                            required
                          />
                        </label>
                        <label>
                          <span>Enstitü</span>
                          <input name="instituteName" type="text" defaultValue={g.institute_name ?? ""} />
                        </label>
                        <label>
                          <span>Sürüm etiketi</span>
                          <input name="versionLabel" type="text" defaultValue={g.version_label ?? ""} />
                        </label>
                        <label>
                          <span>Min. sayfa</span>
                          <input name="minPages" type="number" min={0} defaultValue={g.min_pages ?? ""} />
                        </label>
                        <label>
                          <span>Maks. sayfa</span>
                          <input name="maxPages" type="number" min={0} defaultValue={g.max_pages ?? ""} />
                        </label>
                        <label className="guideline-review-full">
                          <span>Kaynak URL (resmî kılavuz)</span>
                          <input name="sourceUrl" type="url" defaultValue={g.source_url ?? ""} />
                        </label>
                        <label className="guideline-review-full">
                          <span>Notlar</span>
                          <textarea name="notes" rows={2} defaultValue={g.notes ?? ""} />
                        </label>
                        <div className="project-form-actions guideline-review-full">
                          <button type="submit" className="projects-primary-button">Bilgileri kaydet</button>
                        </div>
                      </ActionForm>
                    </PanelDrawer>

                    <ActionForm
                      action={handleDelete.bind(null, g.id)}
                      confirmMessage={`${g.university_name} kılavuzunu silmek istediğinize emin misiniz?`}
                      successMessage="Kılavuz silindi."
                    >
                      <button type="submit" className="projects-filter-button">
                        <Trash2 size={14} aria-hidden="true" />
                        Sil
                      </button>
                    </ActionForm>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
