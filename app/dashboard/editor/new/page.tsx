import Link from "next/link";
import { ArrowLeft, CalendarDays, PenLine } from "lucide-react";
import { createProject } from "@/app/actions/projects";
import { getUniversities } from "@/app/actions/universities";
import ActionForm from "../../action-form";
import AcademicUnitFields from "./academic-unit-fields";

// Müşteri yalnızca başlığı ve kurumunu seçer; kılavuz otomatik bağlanır ve
// kayıttan sonra doğrudan editör açılır. Planlama alanları isteğe bağlıdır.
export default async function NewProjectPage() {
  const universities = await getUniversities();

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Yeni kayıt</span>
          <h1>Yeni Akademik Çalışma</h1>
          <p>Başlığı ve kurumunuzu seçin; tez yazım kılavuzunuz otomatik uygulanır ve editör açılır.</p>
        </div>
        <Link href="/dashboard/editor" className="projects-filter-button">
          <ArrowLeft size={17} aria-hidden="true" />
          Çalışmalara dön
        </Link>
      </section>

      <ActionForm action={createProject} className="project-form">
        <section className="project-form-card">
          <div className="project-form-heading">
            <h2>Çalışmanız</h2>
            <p>Kurumunuzu listeden seçerseniz kılavuzun kuralları editöre kendiliğinden uygulanır.</p>
          </div>

          <div className="project-form-grid">
            <label className="project-form-full">
              <span>Çalışma başlığı</span>
              <input name="title" type="text" placeholder="Örn. Öğretmenlerin Dijital Okuryazarlık Düzeyleri" minLength={3} maxLength={240} required />
            </label>

            <label>
              <span>Çalışma türü</span>
              <select name="type" defaultValue="thesis" required>
                <option value="thesis">Tez</option>
                <option value="article">Makale</option>
                <option value="project">Proje</option>
                <option value="associate-professorship">Doçentlik dosyası</option>
              </select>
            </label>

            <label>
              <span>Kaynakça sistemi</span>
              <select name="citationStyle" defaultValue="apa7">
                <option value="apa7">APA 7</option>
                <option value="vancouver">Vancouver</option>
                <option value="chicago">Chicago</option>
                <option value="ieee">IEEE</option>
              </select>
              <small>Tezlerde onaylı kılavuz varsa ondan belirlenir.</small>
            </label>

            <AcademicUnitFields universities={universities} />
          </div>
        </section>

        <details className="project-form-card form-details">
          <summary>
            <span>İsteğe bağlı bilgiler</span>
            <small>Araştırma yöntemi, teslim tarihi, öncelik ve notlar — sonradan da ekleyebilirsiniz.</small>
          </summary>

          <div className="project-form-grid">
            <label>
              <span>Araştırma yöntemi</span>
              <select name="method" defaultValue="">
                <option value="">Belirtilmedi</option>
                <option value="quantitative">Nicel</option>
                <option value="qualitative">Nitel</option>
                <option value="mixed">Karma</option>
                <option value="review">Derleme</option>
              </select>
            </label>

            <label>
              <span>Teslim tarihi</span>
              <div className="project-date-field">
                <CalendarDays size={17} />
                <input name="dueDate" type="date" />
              </div>
            </label>

            <label>
              <span>Öncelik</span>
              <select name="priority" defaultValue="normal">
                <option value="low">Düşük</option>
                <option value="normal">Normal</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </label>

            <label className="project-form-full">
              <span>Konu ve çalışma notları</span>
              <textarea name="notes" rows={5} placeholder="Araştırma konusu, kapsamı, danışman notları ve özel gereksinimler" />
            </label>
          </div>
        </details>

        <div className="project-form-actions">
          <Link href="/dashboard/editor" className="projects-filter-button">İptal</Link>
          <button type="submit" className="projects-primary-button">
            <PenLine size={17} />
            Oluştur ve yazmaya başla
          </button>
        </div>
      </ActionForm>
    </main>
  );
}
