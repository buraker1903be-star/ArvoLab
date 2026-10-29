import Link from "next/link";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import TarihSecici from "@/app/dashboard/_components/tarih-secici";
import { getProjectForEdit, updateProject } from "@/app/actions/projects";
import { getAuthContext } from "@/lib/auth-guards";
import { CALISMA_OKUNAMADI } from "@/lib/calisma-ozeti";
import {
  OVERSIGHT_ONLY_STATUSES,
  PROJECT_STATUSES,
  isOversightRole,
  projectTypeLabel,
  statusLabel,
} from "@/lib/project-labels";
import ActionForm from "../../../action-form";
import { getUniversities } from "@/app/actions/universities";
import { calismaKilavuzu, kilavuzGorunenAdi } from "@/lib/guideline-rules";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import AcademicUnitFields from "../../new/academic-unit-fields";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Çalışmayı düzenle", en: "Edit work" }) };
}

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await ceviri();
  const { id } = await params;
  const [project, ctx, { satirlar: universities }] = await Promise.all([getProjectForEdit(id), getAuthContext(), getUniversities()]);
  /* Okunamadı ile bulunamadı AYRI: çalışma merkezindeki (../page.tsx) ile
     aynı ayrım. Geçici bir arızada 404 çizmek, kullanıcıya tezinin
     olmadığını söylemekti. */
  if (project === CALISMA_OKUNAMADI) {
    return (
      <main className="dashboard-page">
        <article className="resume-card" role="alert">
          <span className="dashboard-kicker">{t({ tr: "Bağlantı sorunu", en: "Connection problem" })}</span>
          <div className="resume-heading">
            <h2>{t({ tr: "Çalışma yüklenemedi", en: "The work could not be loaded" })}</h2>
            <p>
              {t({
                tr: "Kaydınız yerinde duruyor. Sayfayı yenileyin; sorun sürerse destekten bildirin.",
                en: "Your record is safe. Refresh the page; if the problem persists, report it to support.",
              })}
            </p>
          </div>
          <div className="cluster">
            <Link href={`/dashboard/editor/${id}`} className="projects-filter-button">
              {t({ tr: "Çalışma özeti", en: "Work overview" })}
            </Link>
            <Link href="/dashboard/expert-requests" className="projects-filter-button">
              {t({ tr: "Uygulama Destek", en: "App Support" })}
            </Link>
          </div>
        </article>
      </main>
    );
  }
  if (!project || !ctx) notFound();
  const guideline = await calismaKilavuzu(ctx.supabase, project.id, project.guideline_id);

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
          <span className="dashboard-kicker">{t(projectTypeLabel(project.project_type))}</span>
          <h1>{t({ tr: "Çalışmayı düzenle", en: "Edit work" })}</h1>
          <p>{t({ tr: "Çalışmanın planlama bilgilerini, durumunu ve ilerlemesini güncelleyin.", en: "Update the work's planning details, status and progress." })}</p>
        </div>
        {/* Yazım ekranıyla aynı: çıkış çalışmanın kendi merkezine.
            Düzenlemeyi bitiren kullanıcı listeye değil, çalıştığı teze
            dönmek istiyor. */}
        <Link href={`/dashboard/editor/${id}`} className="projects-filter-button">
          <ArrowLeft size={17} aria-hidden="true" />
          {t({ tr: "Çalışma özeti", en: "Work overview" })}
        </Link>
      </section>

      <ActionForm action={handleUpdate} className="project-form" successMessage={t({ tr: "Çalışma güncellendi.", en: "Work updated." })}>
        <section className="project-form-card">
          <div className="project-form-heading">
            <h2>{t({ tr: "Temel bilgiler", en: "Basic details" })}</h2>
            <p>
              {t({
                tr: "Tezlerde tez yazım kılavuzu seçtiğiniz kuruma göre otomatik belirlenir; kurumu değiştirirseniz kılavuz ve kaynakça sistemi yeniden eşleştirilir.",
                en: "For theses, the writing guideline is determined automatically from the institution you choose; if you change the institution, the guideline and citation system are matched again.",
              })}
            </p>
          </div>

          <div className="project-form-grid">
            <label className="project-form-full">
              <span>{t({ tr: "Çalışma başlığı", en: "Title of the work" })}</span>
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
              initialGuidelineLabel={guideline ? `${kilavuzGorunenAdi(guideline.label, await aktifDil())} · ${guideline.citationStyle.toUpperCase()}` : null}
            />

            <label>
              <span>{t({ tr: "Kaynakça sistemi", en: "Citation system" })}</span>
              <select name="citationStyle" defaultValue={project.citation_style} disabled={!!project.guideline_id}>
                {STIL_SECENEKLERI.map((secenek) => (
                  <option key={secenek.deger} value={secenek.deger}>
                    {secenek.etiket}
                  </option>
                ))}
              </select>
              {project.guideline_id ? (
                /*
                  Metin, kılavuzun sürümü değişince yanıltıcı oluyordu:
                  stil kılavuz BAĞLANIRKEN yazılıyor, sonradan yeni bir
                  sürüm başka bir stille onaylanırsa çalışma eski
                  stilde kalıyor ve alan yine "kılavuza göre belirlenir"
                  diyordu. Düzeltme yolu Çalışma Merkezi'ndeki
                  "Kılavuza göre düzelt" düğmesi.
                */
                <small>
                  {t({
                    tr: "Kılavuz bağlı olduğu için burada değiştirilmez; uyuşmazlık varsa Çalışma Merkezi'nden düzeltin.",
                    en: "It can't be changed here because a guideline is linked; if there is a mismatch, fix it from the work overview.",
                  })}
                </small>
              ) : null}
            </label>

            <label>
              <span>{t({ tr: "Araştırma yöntemi", en: "Research method" })}</span>
              <select name="method" defaultValue={project.research_method ?? ""}>
                <option value="">{t({ tr: "Belirtilmedi", en: "Not specified" })}</option>
                <option value="quantitative">{t({ tr: "Nicel", en: "Quantitative" })}</option>
                <option value="qualitative">{t({ tr: "Nitel", en: "Qualitative" })}</option>
                <option value="mixed">{t({ tr: "Karma", en: "Mixed" })}</option>
                <option value="review">{t({ tr: "Derleme", en: "Review" })}</option>
              </select>
            </label>
          </div>
        </section>

        <section className="project-form-card">
          <div className="project-form-heading">
            <h2>{t({ tr: "Durum ve planlama", en: "Status and planning" })}</h2>
            <p>
              {lockedByApproval
                ? t({
                    tr: `Bu çalışma "${t(statusLabel(project.status))}" durumunda; durumu yalnızca Kontrolör ve üzeri roller değiştirebilir.`,
                    en: `This work is "${t(statusLabel(project.status))}"; only Controller and higher roles can change its status.`,
                  })
                : t({ tr: "Durum ve ilerleme, ana sayfadaki özet istatistiklere yansır.", en: "Status and progress are reflected in the summary on the home page." })}
            </p>
          </div>

          <div className="project-form-grid">
            <label>
              <span>{t({ tr: "Durum", en: "Status" })}</span>
              <select name="status" defaultValue={project.status} disabled={lockedByApproval}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {t(statusLabel(status))}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{t({ tr: "İlerleme (%)", en: "Progress (%)" })}</span>
              <input name="progress" type="number" min={0} max={100} step={1} defaultValue={project.progress} required />
              {project.guideline_id ? (
                <small className="muted text-sm">
                  {t({
                    tr: "Yazdıkça kılavuzun bölümlerine ve sayfa sınırına göre otomatik güncellenir.",
                    en: "Updated automatically as you write, based on the guideline's sections and page limit.",
                  })}
                </small>
              ) : null}
            </label>

            <label>
              <span>{t({ tr: "Teslim tarihi", en: "Due date" })}</span>
              <TarihSecici name="dueDate" deger={project.due_date} etiket={t({ tr: "Teslim tarihi", en: "Due date" })} />
            </label>

            <label>
              <span>{t({ tr: "Öncelik", en: "Priority" })}</span>
              <select name="priority" defaultValue={project.priority}>
                <option value="low">{t({ tr: "Düşük", en: "Low" })}</option>
                <option value="normal">{t({ tr: "Normal", en: "Normal" })}</option>
                <option value="high">{t({ tr: "Yüksek", en: "High" })}</option>
                <option value="urgent">{t({ tr: "Acil", en: "Urgent" })}</option>
              </select>
            </label>

            <label className="project-form-full">
              <span>{t({ tr: "Konu ve çalışma notları", en: "Topic and work notes" })}</span>
              <textarea name="notes" rows={6} defaultValue={project.notes ?? ""} />
            </label>
          </div>
        </section>

        <div className="project-form-actions">
          <Link href="/dashboard/editor" className="projects-filter-button">
            {t({ tr: "İptal", en: "Cancel" })}
          </Link>
          <button type="submit" className="projects-primary-button">
            <Save size={17} />
            {t({ tr: "Değişiklikleri kaydet", en: "Save changes" })}
          </button>
        </div>
      </ActionForm>
    </main>
  );
}
