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
import { getUniversities } from "@/app/actions/universities";
import { loadAppliedGuideline } from "@/lib/guideline-rules";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import AcademicUnitFields from "../../new/academic-unit-fields";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, ctx, universities] = await Promise.all([getProjectForEdit(id), getAuthContext(), getUniversities()]);
  if (!project || !ctx) notFound();
  const guideline = await loadAppliedGuideline(ctx.supabase, project.guideline_id);

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
          <h1>Çalışmayı düzenle</h1>
          <p>Çalışmanın planlama bilgilerini, durumunu ve ilerlemesini güncelleyin.</p>
        </div>
        <Link href="/dashboard/editor" className="projects-filter-button">
          <ArrowLeft size={17} aria-hidden="true" />
          Çalışmalara dön
        </Link>
      </section>

      <ActionForm action={handleUpdate} className="project-form" successMessage="Çalışma güncellendi.">
        <section className="project-form-card">
          <div className="project-form-heading">
            <h2>Temel bilgiler</h2>
            <p>
              Tezlerde tez yazım kılavuzu seçtiğiniz kuruma göre otomatik belirlenir; kurumu değiştirirseniz
              kılavuz ve kaynakça sistemi yeniden eşleştirilir.
            </p>
          </div>

          <div className="project-form-grid">
            <label className="project-form-full">
              <span>Çalışma başlığı</span>
              <input name="title" type="text" defaultValue={project.title} minLength={3} maxLength={240} required />
            </label>

            <AcademicUnitFields
              universities={universities}
              initial={{
                university: project.university ?? "",
                universityId: project.university_id,
                institute: project.institute ?? "",
                academicUnitId: project.academic_unit_id,
                department: project.department ?? "",
                departmentId: project.department_id,
              }}
              initialGuidelineLabel={guideline ? `${guideline.label} · ${guideline.citationStyle.toUpperCase()}` : null}
            />

            <label>
              <span>Kaynakça sistemi</span>
              <select name="citationStyle" defaultValue={project.citation_style} disabled={!!project.guideline_id}>
                {STIL_SECENEKLERI.map((secenek) => (
                  <option key={secenek.deger} value={secenek.deger}>
                    {secenek.etiket}
                  </option>
                ))}
              </select>
              {project.guideline_id ? (
                <small>Onaylı kılavuza göre belirlenir.</small>
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
              <input name="progress" type="number" min={0} max={100} step={1} defaultValue={project.progress} required />
              {project.guideline_id ? (
                <small className="muted text-sm">Yazdıkça kılavuzun bölümlerine ve sayfa sınırına göre otomatik güncellenir.</small>
              ) : null}
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
