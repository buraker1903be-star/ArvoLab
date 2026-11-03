"use client";

import { Save } from "lucide-react";
import TarihSecici from "@/app/dashboard/_components/tarih-secici";
import { updateProject, type ProjectEditData } from "@/app/actions/projects";
import type { University } from "@/app/actions/universities";
import { OVERSIGHT_ONLY_STATUSES, PROJECT_STATUSES, statusLabel } from "@/lib/project-labels";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import ActionForm from "../../action-form";
import AcademicUnitFields from "../new/academic-unit-fields";
import { useCeviri } from "@/app/_components/dil-saglayici";

export type CalismaDuzenlemeVerisi = {
  project: ProjectEditData;
  universities: University[];
  guidelineLabel: string | null;
  canOversee: boolean;
};

/*
  ÇALIŞMA BİLGİLERİ FORMU — TEK KOPYA (03.11.2026).

  Hem /dashboard/editor/[id]/edit sayfası hem Çalışmalarım kartındaki
  "Bilgileri düzenle" penceresi bunu çiziyor. Form iki yerde ayrı
  yazılsaydı biri güncellenir, öteki unutulurdu (kılavuz penceresindeki
  gerekçenin aynısı).
*/
export default function CalismaDuzenleFormu({ veri, iptal }: { veri: CalismaDuzenlemeVerisi; iptal?: React.ReactNode }) {
  const t = useCeviri();
  const { project, universities, guidelineLabel, canOversee } = veri;
  // Kontrolör onayı gerektiren durumlar (Teslime hazır, Teslim edildi) yalnızca
  // denetim rolleri tarafından seçilebilir; veritabanı tetikleyicisi de bunu zorunlu kılar.
  const lockedByApproval = !canOversee && OVERSIGHT_ONLY_STATUSES.includes(project.status);
  const statusOptions = PROJECT_STATUSES.filter(
    (status) => canOversee || !OVERSIGHT_ONLY_STATUSES.includes(status) || status === project.status,
  );

  return (
    <ActionForm
      action={(formData) => updateProject(project.id, formData)}
      className="project-form"
      successMessage={t({ tr: "Çalışma güncellendi.", en: "Work updated." })}
    >
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
            initialGuidelineLabel={guidelineLabel}
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
                diyordu. Düzeltme yolu Çalışmalarım'daki kartın
                "Kılavuza göre düzelt" düğmesi.
              */
              <small>
                {t({
                  tr: "Kılavuz bağlı olduğu için burada değiştirilmez; uyuşmazlık varsa Çalışmalarım'daki çalışma kartından düzeltin.",
                  en: "It can't be changed here because a guideline is linked; if there is a mismatch, fix it from the work's card in My works.",
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
        {iptal}
        <button type="submit" className="projects-primary-button">
          <Save size={17} />
          {t({ tr: "Değişiklikleri kaydet", en: "Save changes" })}
        </button>
      </div>
    </ActionForm>
  );
}
