import Link from "next/link";
import { ArrowLeft, CalendarDays, Save } from "lucide-react";

export default function NewProjectPage() {
  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Yeni kayıt</span>
          <h1 className="brand-type">Yeni Akademik Çalışma</h1>
          <p>Çalışmanın temel akademik ve operasyonel bilgilerini girin.</p>
        </div>
        <Link href="/dashboard/projects" className="projects-filter-button">
          <ArrowLeft size={17} />
          Çalışmalara dön
        </Link>
      </section>

      <form className="project-form">
        <section className="project-form-card">
          <div className="project-form-heading">
            <h2>Temel bilgiler</h2>
            <p>Çalışmanın adı, türü ve bağlı olduğu akademik kurumu belirleyin.</p>
          </div>

          <div className="project-form-grid">
            <label>
              <span>Çalışma başlığı</span>
              <input name="title" type="text" placeholder="Örn. Eğitim Bilimleri Yüksek Lisans Tezi" required />
            </label>

            <label>
              <span>Çalışma türü</span>
              <select name="type" defaultValue="">
                <option value="" disabled>Seçiniz</option>
                <option value="thesis">Tez</option>
                <option value="article">Makale</option>
                <option value="project">Proje</option>
                <option value="associate-professorship">Doçentlik dosyası</option>
              </select>
            </label>

            <label>
              <span>Üniversite</span>
              <input name="university" type="text" placeholder="Üniversite adı" />
            </label>

            <label>
              <span>Enstitü / Fakülte</span>
              <input name="institute" type="text" placeholder="Enstitü veya fakülte adı" />
            </label>

            <label>
              <span>Bölüm / Ana bilim dalı</span>
              <input name="department" type="text" placeholder="Bölüm adı" />
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
          </div>
        </section>

        <section className="project-form-card">
          <div className="project-form-heading">
            <h2>Yöntem ve planlama</h2>
            <p>Çalışmanın yöntemini, sorumlusunu ve teslim tarihini tanımlayın.</p>
          </div>

          <div className="project-form-grid">
            <label>
              <span>Araştırma yöntemi</span>
              <select name="method" defaultValue="">
                <option value="" disabled>Seçiniz</option>
                <option value="quantitative">Nicel</option>
                <option value="qualitative">Nitel</option>
                <option value="mixed">Karma</option>
                <option value="review">Derleme</option>
              </select>
            </label>

            <label>
              <span>Atanan çalışan</span>
              <input name="assignee" type="text" placeholder="Çalışan adı" />
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
              <textarea name="notes" rows={7} placeholder="Araştırma konusu, kapsamı, danışman notları ve özel gereksinimler" />
            </label>
          </div>
        </section>

        <div className="project-form-actions">
          <Link href="/dashboard/projects" className="projects-filter-button">İptal</Link>
          <button type="submit" className="projects-primary-button">
            <Save size={17} />
            Çalışmayı kaydet
          </button>
        </div>
      </form>
    </main>
  );
}
