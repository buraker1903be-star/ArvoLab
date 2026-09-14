import { BookOpenCheck, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import {
  getLiteratureSources,
  createLiteratureSource,
  updateLiteratureStatus,
  updateLiteratureSource,
  deleteLiteratureSource,
} from "@/app/actions/literature";
import { getMyProjects } from "@/app/actions/citation-check";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  article: "Makale",
  book: "Kitap",
  chapter: "Kitap bölümü",
  thesis: "Tez",
  report: "Rapor",
  website: "İnternet kaynağı",
  other: "Diğer",
};

const STATUS_LABELS: Record<string, string> = {
  to_review: "İncelenecek",
  read: "Okundu",
  used: "Kullanıldı",
};

export default async function LiteraturePage() {
  const [sources, projects] = await Promise.all([getLiteratureSources(), getMyProjects()]);

  const grouped = {
    to_review: sources.filter((s) => s.status === "to_review"),
    read: sources.filter((s) => s.status === "read"),
    used: sources.filter((s) => s.status === "used"),
  };

  async function handleAdvanceStatus(sourceId: string, nextStatus: string) {
    "use server";
    return updateLiteratureStatus(sourceId, nextStatus);
  }

  async function handleDelete(sourceId: string) {
    "use server";
    return deleteLiteratureSource(sourceId);
  }

  async function handleEdit(sourceId: string, formData: FormData) {
    "use server";
    return updateLiteratureSource(sourceId, formData);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Literatür</span>
          <h1>Literatür Taraması</h1>
          <p>
            Bulduğunuz kaynakları buraya kaydedin, okuma durumunu takip edin.
            Bu araç kaynak özeti ya da yorum ÜRETMEZ — yalnızca kendi
            bulduğunuz kaynakların listesini tutmanıza yardımcı olur.
          </p>
        </div>
        <PanelDrawer
          triggerLabel="Yeni kaynak"
          triggerIcon={<Plus size={16} aria-hidden="true" />}
          kicker="Literatür"
          title="Yeni kaynak ekle"
          description="Taramada bulduğunuz bir kaynağı kaydedin."
        >
          <ActionForm className="project-form-grid" action={createLiteratureSource} successMessage="Kaynak eklendi.">
            <label className="project-form-full">
              <span>Başlık</span>
              <input name="title" type="text" placeholder="Kaynağın başlığı" required />
            </label>

            <label>
              <span>Yazar(lar)</span>
              <input name="authors" type="text" placeholder="Yılmaz, A. ve Demir, B." />
            </label>

            <label>
              <span>Yıl</span>
              <input name="year" type="text" inputMode="numeric" placeholder="2023" />
            </label>

            <label>
              <span>Kaynak türü</span>
              <select name="sourceType" defaultValue="article">
                {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>DOI / URL</span>
              <input name="doiOrUrl" type="text" placeholder="https://doi.org/..." />
            </label>

            {projects.length > 0 && (
              <label>
                <span>Bağlı çalışma (opsiyonel)</span>
                <select name="projectId" defaultValue="">
                  <option value="">Seçili çalışma yok</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              <span>Durum</span>
              <select name="status" defaultValue="to_review">
                <option value="to_review">İncelenecek</option>
                <option value="read">Okundu</option>
                <option value="used">Kullanıldı</option>
              </select>
            </label>

            <label className="project-form-full">
              <span>Notlar</span>
              <textarea name="notes" rows={3} placeholder="Kaynakla ilgili kendi notlarınız" />
            </label>

            <div className="project-form-actions">
              <button type="submit" className="projects-primary-button">
                <Plus size={16} aria-hidden="true" />
                Kaynağı ekle
              </button>
            </div>
          </ActionForm>
        </PanelDrawer>
      </section>

      {(["to_review", "read", "used"] as const).map((statusKey) => (
        <section key={statusKey} className="section">
          <h2 className="section-title">
            <BookOpenCheck size={16} aria-hidden="true" />
            {STATUS_LABELS[statusKey]} ({grouped[statusKey].length})
          </h2>
          {grouped[statusKey].length === 0 ? (
            <p className="muted text-base">Bu durumda kaynak yok.</p>
          ) : (
            <div className="projects-list">
              {grouped[statusKey].map((s) => (
                <article className="project-card" key={s.id}>
                  <div className="project-card-main">
                    <div>
                      <span className="status-pill">{SOURCE_TYPE_LABELS[s.source_type]}</span>
                      <h2>{s.title}</h2>
                      <p>
                        {s.authors || "Yazar belirtilmedi"}
                        {s.year ? ` · ${s.year}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="project-card-meta">
                    {s.doi_or_url ? (
                      <a href={s.doi_or_url} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} aria-hidden="true" />
                        Kaynağa git
                      </a>
                    ) : null}
                    {s.notes ? <span>{s.notes}</span> : null}
                  </div>

                  <div className="cluster cluster-spaced">
                    {statusKey !== "to_review" && (
                      <ActionForm action={handleAdvanceStatus.bind(null, s.id, "to_review")} successMessage="İncelenecek olarak işaretlendi.">
                        <button type="submit" className="projects-filter-button">
                          İncelenecek yap
                        </button>
                      </ActionForm>
                    )}
                    {statusKey !== "read" && (
                      <ActionForm action={handleAdvanceStatus.bind(null, s.id, "read")} successMessage="Okundu olarak işaretlendi.">
                        <button type="submit" className="projects-filter-button">
                          Okundu yap
                        </button>
                      </ActionForm>
                    )}
                    {statusKey !== "used" && (
                      <ActionForm action={handleAdvanceStatus.bind(null, s.id, "used")} successMessage="Kullanıldı olarak işaretlendi.">
                        <button type="submit" className="projects-primary-button">
                          Kullanıldı yap
                        </button>
                      </ActionForm>
                    )}
                    <PanelDrawer
                      triggerLabel="Düzenle"
                      triggerIcon={<Pencil size={14} aria-hidden="true" />}
                      triggerClassName="projects-filter-button"
                      kicker="Kaynağı düzenle"
                      title={s.title}
                    >
                      <ActionForm className="project-form-grid" action={handleEdit.bind(null, s.id)} successMessage="Kaynak güncellendi.">
                        <label className="project-form-full">
                          <span>Başlık</span>
                          <input name="title" type="text" defaultValue={s.title} required />
                        </label>
                        <label>
                          <span>Yazar(lar)</span>
                          <input name="authors" type="text" defaultValue={s.authors ?? ""} />
                        </label>
                        <label>
                          <span>Yıl</span>
                          <input name="year" type="text" inputMode="numeric" defaultValue={s.year ?? ""} />
                        </label>
                        <label>
                          <span>Kaynak türü</span>
                          <select name="sourceType" defaultValue={s.source_type}>
                            {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>DOI / URL</span>
                          <input name="doiOrUrl" type="text" defaultValue={s.doi_or_url ?? ""} />
                        </label>
                        <label className="project-form-full">
                          <span>Notlar</span>
                          <textarea name="notes" rows={3} defaultValue={s.notes ?? ""} />
                        </label>
                        <div className="project-form-actions">
                          <button type="submit" className="projects-primary-button">
                            Kaydet
                          </button>
                        </div>
                      </ActionForm>
                    </PanelDrawer>
                    <ActionForm
                      action={handleDelete.bind(null, s.id)}
                      confirmMessage={`"${s.title}" kaynağını silmek istediğinize emin misiniz?`}
                      successMessage="Kaynak silindi."
                    >
                      <button type="submit" className="projects-filter-button" aria-label="Kaynağı sil">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </ActionForm>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
