import Link from "next/link";
import { ArrowLeft, PenLine } from "lucide-react";
import TarihSecici from "@/app/dashboard/_components/tarih-secici";
import { createProject } from "@/app/actions/projects";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import { getUniversities } from "@/app/actions/universities";
import ActionForm from "../../action-form";
import AcademicUnitFields from "./academic-unit-fields";
import { ceviri } from "@/lib/dil-sunucu";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Yeni çalışma", en: "New work" }) };
}

// Müşteri yalnızca başlığı ve kurumunu seçer; kılavuz otomatik bağlanır ve
// kayıttan sonra doğrudan editör açılır. Planlama alanları isteğe bağlıdır.
export default async function NewProjectPage() {
  const t = await ceviri();
  const { satirlar: universities, okunamadi: universiteOkunamadi } = await getUniversities();

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">{t({ tr: "Yeni kayıt", en: "New record" })}</span>
          <h1>{t({ tr: "Yeni Akademik Çalışma", en: "New Academic Work" })}</h1>
          <p>
            {t({
              tr: "Başlığı ve kurumunuzu seçin; tez yazım kılavuzunuz otomatik uygulanır ve editör açılır.",
              en: "Enter the title and choose your institution; your thesis writing guideline is applied automatically and the editor opens.",
            })}
          </p>
        </div>
        <Link href="/dashboard/editor" className="projects-filter-button">
          <ArrowLeft size={17} aria-hidden="true" />
          {t({ tr: "Çalışmalara dön", en: "Back to works" })}
        </Link>
      </section>

      <ActionForm action={createProject} className="project-form">
        <section className="project-form-card">
          <div className="project-form-heading">
            <h2>{t({ tr: "Çalışmanız", en: "Your work" })}</h2>
            <p>
              {t({
                tr: "Kurumunuzu listeden seçerseniz kılavuzun kuralları editöre kendiliğinden uygulanır.",
                en: "If you choose your institution from the list, the guideline's rules are applied to the editor automatically.",
              })}
            </p>
          </div>

          <div className="project-form-grid">
            <label className="project-form-full">
              <span>{t({ tr: "Çalışma başlığı", en: "Title of the work" })}</span>
              <input name="title" type="text" placeholder={t({ tr: "Örn. Öğretmenlerin Dijital Okuryazarlık Düzeyleri", en: "E.g. Teachers' Digital Literacy Levels" })} minLength={3} maxLength={240} required />
            </label>

            <label>
              <span>{t({ tr: "Çalışma türü", en: "Type of work" })}</span>
              <select name="type" defaultValue="thesis" required>
                <option value="thesis">{t({ tr: "Tez", en: "Thesis" })}</option>
                <option value="article">{t({ tr: "Makale", en: "Article" })}</option>
                <option value="project">{t({ tr: "Proje", en: "Project" })}</option>
                <option value="associate-professorship">{t({ tr: "Doçentlik dosyası", en: "Associate professorship file" })}</option>
              </select>
            </label>

            <label>
              <span>{t({ tr: "Kaynakça sistemi", en: "Citation system" })}</span>
              <select name="citationStyle" defaultValue="apa7">
                {STIL_SECENEKLERI.map((secenek) => (
                  <option key={secenek.deger} value={secenek.deger}>
                    {secenek.etiket}
                  </option>
                ))}
              </select>
              <small>{t({ tr: "Tezlerde onaylı kılavuz varsa ondan belirlenir.", en: "For theses, set by the approved guideline if there is one." })}</small>
            </label>

            {/* Liste okunamazsa form çalışmaya devam ediyor (alan serbest
                metin) ama kılavuz eşleşmesi yapılamıyor; kullanıcı sebebini
                bilmeliydi. */}
            {universiteOkunamadi ? (
              <p className="alert" data-tone="warning" role="alert">
                {t({
                  tr: "Üniversite listesi yüklenemedi. Adınızı yazarak devam edebilirsiniz; tez yazım kılavuzu bu turda otomatik eşleşmeyebilir, sonradan çalışma ayarlarından seçebilirsiniz.",
                  en: "The university list could not be loaded. You can continue by typing its name; the thesis writing guideline may not match automatically this time, and you can choose it later in the work settings.",
                })}
              </p>
            ) : null}
            <AcademicUnitFields universities={universities} />
          </div>
        </section>

        <details className="project-form-card form-details">
          <summary>
            <span>{t({ tr: "İsteğe bağlı bilgiler", en: "Optional details" })}</span>
            <small>
              {t({
                tr: "Araştırma yöntemi, teslim tarihi, öncelik ve notlar — sonradan da ekleyebilirsiniz.",
                en: "Research method, due date, priority and notes — you can add these later too.",
              })}
            </small>
          </summary>

          <div className="project-form-grid">
            <label>
              <span>{t({ tr: "Araştırma yöntemi", en: "Research method" })}</span>
              <select name="method" defaultValue="">
                <option value="">{t({ tr: "Belirtilmedi", en: "Not specified" })}</option>
                <option value="quantitative">{t({ tr: "Nicel", en: "Quantitative" })}</option>
                <option value="qualitative">{t({ tr: "Nitel", en: "Qualitative" })}</option>
                <option value="mixed">{t({ tr: "Karma", en: "Mixed" })}</option>
                <option value="review">{t({ tr: "Derleme", en: "Review" })}</option>
              </select>
            </label>

            <label>
              <span>{t({ tr: "Teslim tarihi", en: "Due date" })}</span>
              <TarihSecici name="dueDate" etiket={t({ tr: "Teslim tarihi", en: "Due date" })} />
            </label>

            <label>
              <span>{t({ tr: "Öncelik", en: "Priority" })}</span>
              <select name="priority" defaultValue="normal">
                <option value="low">{t({ tr: "Düşük", en: "Low" })}</option>
                <option value="normal">{t({ tr: "Normal", en: "Normal" })}</option>
                <option value="high">{t({ tr: "Yüksek", en: "High" })}</option>
                <option value="urgent">{t({ tr: "Acil", en: "Urgent" })}</option>
              </select>
            </label>

            <label className="project-form-full">
              <span>{t({ tr: "Konu ve çalışma notları", en: "Topic and work notes" })}</span>
              <textarea name="notes" rows={5} placeholder={t({
                  tr: "Araştırma konusu, kapsamı, danışman notları ve özel gereksinimler",
                  en: "Research topic, scope, advisor notes and special requirements",
                })} />
            </label>
          </div>
        </details>

        <div className="project-form-actions">
          <Link href="/dashboard/editor" className="projects-filter-button">
            {t({ tr: "İptal", en: "Cancel" })}
          </Link>
          <button type="submit" className="projects-primary-button">
            <PenLine size={17} />
            {t({ tr: "Oluştur ve yazmaya başla", en: "Create and start writing" })}
          </button>
        </div>
      </ActionForm>
    </main>
  );
}
