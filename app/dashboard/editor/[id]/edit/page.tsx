import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Save } from "lucide-react";
import { getProjectForEdit, updateProject } from "@/app/actions/projects";
import { getAuthContext } from "@/lib/auth-guards";
import {
  OVERSIGHT_ONLY_STATUSES,
  PROJECT_STATUSES,
  isOversightRole,
  projectTypeLabel,
  statusLabel,
} from "@/lib/project-labels";
import ActionForm from "../../../action-form";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, ctx] = await Promise.all([getProjectForEdit(id), getAuthContext()]);
  if (!project || !ctx) notFound();

  const canOversee = isOversightRole(ctx.role);
  const canEdit = canOversee || project.owner_id === ctx.user.id || project.assignee_id === ctx.user.id;
  if (!canEdit) notFound();

  // Kontrolör onayı gerektiren durumlar (Teslime hazır, Teslim edildi) yalnızca
  // denetim rolleri tarafından seçilebilir; veritabanı tetikleyicisi de bunu zorunlu kılar.
  const lockedByApproval = !canOversee && OVERSIGHT_ONLY_STATUSES.includes(project.status);
  const statusOptions = PROJECT_STATUSES.filter(
    (status) => canOversee || !OVERSIGHT_ONLY_STATUSES.includes(status) || status === project.status
  );

  async function handleUpdate(formData: FormData) {
    "use server";
    return updateProject(id, formData);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">{projectTypeLabel(project.project_type)}</span>
          <h1 className="brand-type">Çalışmayı düzenle</h1>
          <p>Çalışmanın planlama bilgilerini, durumunu ve ilerlemesini güncelleyin.</p>
        </div>
        <Link href="/dashboard/editor" className="projects-filter-button">
          <ArrowLeft size={17} />
          Çalışmalara dön
        </Link>
      </section>

      <ActionForm action={handleUpdate} className="project-form" successMessage="Çalışma güncellendi.">
        <section className="project-form-card">
          <div className="project-form-heading">
            <h2>Temel bilgiler</h2>
            <p>
              Çalışma türü ve kurum bilgisi kılavuz eşleştirmesini belirlediği için buradan değiştirilemez.
              {project.university ? ` Kurum: ${project.university}.` : ""}
            </p>
          </div>

          <div className="project-form-grid">
            <label className="project-form-full">
              <span>Çalışma başlığı</span>
              <input name="title" type="text" defaultValue={project.title} minLength={3} maxLength={240} required />
            </label>

            <label>
              <span>Kaynakça sistemi</span>
              <select name="citationStyle" defaultValue={project.citation_style} disabled={!!project.guideline_id}>
                <option value="apa7">APA 7</option>
                <option value="vancouver">Vancouver</option>
                <option value="chicago">Chicago</option>
                <option value="ieee">IEEE</option>
              </select>
              {project.guideline_id ? (
                <small style={{ color: "var(--muted-foreground)" }}>Onaylı kılavuza göre belirlenir.</small>
              ) : null}
            </label>

            <label>
              <span>Araştırma yöntemi</span>
              <select name="method" defaultValue={project.research_method ?? ""}>
                <option value="">Belirtilmedi</option>
                <option value="quantitative">Nicel</option>
                <option value="qualitative">Nitel</option>
                <option value="mixed">Karma</option>
                <option value="review">Derleme</option>
              </select>
            </label>
          </div>
        </section>

        <section className="project-form-card">
          <div className="project-form-heading">
            <h2>Durum ve planlama</h2>
            <p>
              {lockedByApproval
                ? `Bu çalışma "${statusLabel(project.status)}" durumunda; durumu yalnızca Kontrolör ve üzeri roller değiştirebilir.`
                : "Durum ve ilerleme, ana sayfadaki özet istatistiklere yansır."}
            </p>
          </div>

          <div className="project-form-grid">
            <label>
              <span>Durum</span>
              <select name="status" defaultValue={project.status} disabled={lockedByApproval}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>İlerleme (%)</span>
              <input name="progress" type="number" min={0} max={100} step={5} defaultValue={project.progress} required />
            </label>

            <label>
              <span>Teslim tarihi</span>
              <div className="project-date-field">
                <CalendarDays size={17} />
                <input name="dueDate" type="date" defaultValue={project.due_date ?? ""} />
              </div>
            </label>

            <label>
              <span>Öncelik</span>
              <select name="priority" defaultValue={project.priority}>
                <option value="low">Düşük</option>
                <option value="normal">Normal</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </label>

            <label className="project-form-full">
              <span>Konu ve çalışma notları</span>
              <textarea name="notes" rows={6} defaultValue={project.notes ?? ""} />
            </label>
          </div>
        </section>

        <div className="project-form-actions">
          <Link href="/dashboard/editor" className="projects-filter-button">
            İptal
          </Link>
          <button type="submit" className="projects-primary-button">
            <Save size={17} />
            Değişiklikleri kaydet
          </button>
        </div>
      </ActionForm>
    </main>
  );
}
