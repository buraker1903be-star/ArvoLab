import { GraduationCap, Plus, Settings2, Trash2 } from "lucide-react";
import {
  getCriteria,
  createCriterion,
  updateCriterion,
  deleteCriterion,
  getMyScoreEntries,
  addScoreEntry,
  deleteScoreEntry,
} from "@/app/actions/scoring";
import { getCurrentProfile } from "@/app/actions/profile";
import ActionForm from "../action-form";

const errorMessages: Record<string, string> = {
  forbidden: "Kriter eklemek için Akademik Yönetici veya üzeri bir rol gerekir.",
  "invalid-points": "Birim başına puan 0 veya daha büyük bir sayı olmalıdır.",
  "invalid-unit": "Adet / birim sayısı 0'dan büyük bir sayı olmalıdır.",
  "missing-fields": "Kod, etiket ve puan alanları zorunludur.",
  "duplicate-code": "Bu kriter kodu zaten kullanılıyor.",
  "save-failed": "Kriter kaydedilirken bir hata oluştu.",
  "missing-entry-fields": "Kriter ve başlık alanları zorunludur.",
  "invalid-criterion": "Seçilen kriter bulunamadı.",
  "save-entry-failed": "Kayıt eklenirken bir hata oluştu.",
};

type ScoringPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ScoringPage({ searchParams }: ScoringPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : null;

  const [criteria, entries, profile] = await Promise.all([
    getCriteria(),
    getMyScoreEntries(),
    getCurrentProfile(),
  ]);

  const canManageCriteria =
    profile?.role === "academic_manager" ||
    profile?.role === "system_admin" ||
    profile?.role === "founder";

  const totalPoints = entries.reduce((sum, e) => sum + e.computed_points, 0);

  const groupedTotals = entries.reduce<Record<string, number>>((acc, e) => {
    const group = e.criteria?.category_group || "Diğer";
    acc[group] = (acc[group] ?? 0) + e.computed_points;
    return acc;
  }, {});

  async function handleDeleteEntry(entryId: string) {
    "use server";
    return deleteScoreEntry(entryId);
  }

  async function handleDeleteCriterion(criterionId: string) {
    "use server";
    return deleteCriterion(criterionId);
  }

  async function handleUpdateCriterion(criterionId: string, formData: FormData) {
    "use server";
    return updateCriterion(criterionId, formData);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Kariyer süreci</span>
          <h1>Doçentlik Puan Hesaplayıcı</h1>
          <p>
            Kendi beyan ettiğiniz yayın ve faaliyetlere, kurumunuzun girdiği
            güncel puanlama kriterlerini uygulayarak toplam puanınızı
            hesaplar. <strong>Resmi ÜAK duyurusunun yerini tutmaz</strong> —
            kriterler alana ve döneme göre değiştiği için puan değerlerini
            güncel tutmak Akademik Yönetici&apos;nin sorumluluğundadır.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <p className="alert" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="dashboard-stats mb-lg" aria-label="Puan özeti">
        <article className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <GraduationCap size={20} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div>
            <strong>{totalPoints.toFixed(1)}</strong>
            <span>Toplam puan</span>
          </div>
        </article>
        {Object.entries(groupedTotals).map(([group, points]) => (
          <article className="dashboard-stat-card" key={group}>
            <div className="dashboard-stat-icon">
              <GraduationCap size={20} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div>
              <strong>{points.toFixed(1)}</strong>
              <span>{group}</span>
            </div>
          </article>
        ))}
      </section>

      {criteria.length === 0 ? (
        <section className="empty-state mb-lg">
          <p>
            {canManageCriteria
              ? "Henüz puanlama kriteri tanımlanmadı. Aşağıdan ilk kriteri ekleyin."
              : "Henüz puanlama kriteri tanımlanmadı. Akademik Yönetici'nizden kriterleri girmesini isteyin."}
          </p>
        </section>
      ) : (
        <section className="project-form-card mb-lg">
          <div className="project-form-heading">
            <h2>Yeni Faaliyet Ekle</h2>
            <p>Yayınınızı veya faaliyetinizi ilgili kritere göre kaydedin.</p>
          </div>

          <form className="project-form-grid" action={addScoreEntry}>
            <label>
              <span>Kriter</span>
              <select name="criteriaId" defaultValue="" required>
                <option value="" disabled>
                  Seçiniz
                </option>
                {criteria.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_group ? `${c.category_group} · ` : ""}
                    {c.code} — {c.label} ({c.points_per_unit} puan/birim)
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Başlık / açıklama</span>
              <input name="title" type="text" placeholder="Yayın veya faaliyetin adı" required />
            </label>

            <label>
              <span>Adet / birim sayısı</span>
              <input name="unitCount" type="number" min={0.1} step={0.1} defaultValue={1} />
            </label>

            <label className="project-form-full">
              <span>Notlar</span>
              <input name="notes" type="text" placeholder="Dergi adı, yayın yılı vb." />
            </label>

            <div className="project-form-actions">
              <button type="submit" className="projects-primary-button">
                <Plus size={16} aria-hidden="true" />
                Kaydı ekle
              </button>
            </div>
          </form>
        </section>
      )}

      {entries.length > 0 && (
        <section className="section">
          <h2 className="section-title">Kayıtlı Faaliyetleriniz</h2>
          <div className="projects-list">
            {entries.map((e) => (
              <article className="project-card" key={e.id}>
                <div className="project-card-main">
                  <div>
                    <span className="status-pill">
                      {e.criteria?.code} {e.criteria?.category_group ? `· ${e.criteria.category_group}` : ""}
                    </span>
                    <h2>{e.title}</h2>
                    <p>
                      {e.unit_count} birim × {e.criteria?.points_per_unit ?? "?"} puan
                      {e.notes ? ` · ${e.notes}` : ""}
                    </p>
                  </div>
                  <div className="project-progress">
                    <strong>{e.computed_points.toFixed(1)}</strong>
                  </div>
                </div>
                <ActionForm
                  action={handleDeleteEntry.bind(null, e.id)}
                  className="mt-sm"
                  confirmMessage={`"${e.title}" kaydını silmek istediğinize emin misiniz?`}
                >
                  <button type="submit" className="projects-filter-button">
                    <Trash2 size={14} aria-hidden="true" />
                    Kaydı sil
                  </button>
                </ActionForm>
              </article>
            ))}
          </div>
        </section>
      )}

      {canManageCriteria ? (
        <section className="project-form-card">
          <div className="project-form-heading">
            <h2>
              <Settings2 size={16} aria-hidden="true" />
              Puanlama Kriterlerini Yönet
            </h2>
            <p>
              Bu bölüm yalnızca Akademik Yönetici ve üzeri rollere açıktır.
              Güncel resmi ÜAK duyurusundaki puan değerlerini buraya girin.
            </p>
          </div>

          <form className="project-form-grid" action={createCriterion}>
            <label>
              <span>Kriter kodu</span>
              <input name="code" type="text" placeholder="Örn. A1" required />
            </label>
            <label>
              <span>Etiket</span>
              <input name="label" type="text" placeholder="Örn. SCI-E indeksli makale" required />
            </label>
            <label>
              <span>Kategori grubu</span>
              <input name="categoryGroup" type="text" placeholder="Örn. Makaleler" />
            </label>
            <label>
              <span>Birim başına puan</span>
              <input name="pointsPerUnit" type="number" step={0.1} min={0} required />
            </label>
            <label className="project-form-full">
              <span>Notlar</span>
              <input name="notes" type="text" placeholder="Kaynak, şart, açıklama" />
            </label>
            <div className="project-form-actions">
              <button type="submit" className="projects-primary-button">
                <Plus size={16} aria-hidden="true" />
                Kriteri kaydet
              </button>
            </div>
          </form>

          {criteria.length > 0 && (
            <div className="mt-lg">
              {criteria.map((c) => (
                <div key={c.id} className="list-row text-base">
                  <div className="cluster cluster-between">
                    <span>
                      <strong>{c.code}</strong> — {c.label} ({c.points_per_unit} puan)
                    </span>
                    <ActionForm
                      action={handleDeleteCriterion.bind(null, c.id)}
                      confirmMessage={`"${c.code}" kriterini silmek istediğinize emin misiniz? Bu kritere bağlı kullanıcı kayıtları varsa kriter silinmez, pasife alınır (geçmiş puanlar korunur).`}
                    >
                      <button type="submit" className="projects-filter-button" aria-label={`${c.code} kriterini sil`}>
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </ActionForm>
                  </div>
                  <details className="guideline-review-details">
                    <summary>Düzenle</summary>
                    <ActionForm
                      className="guideline-review-form"
                      action={handleUpdateCriterion.bind(null, c.id)}
                      successMessage="Kriter güncellendi."
                    >
                      <label>
                        <span>Etiket</span>
                        <input name="label" type="text" defaultValue={c.label} required />
                      </label>
                      <label>
                        <span>Kategori grubu</span>
                        <input name="categoryGroup" type="text" defaultValue={c.category_group ?? ""} />
                      </label>
                      <label>
                        <span>Birim başına puan</span>
                        <input name="pointsPerUnit" type="number" step={0.1} min={0} defaultValue={c.points_per_unit} required />
                      </label>
                      <label>
                        <span>Notlar</span>
                        <input name="notes" type="text" defaultValue={c.notes ?? ""} />
                      </label>
                      <p className="guideline-review-full hint">
                        Puan değişikliği yalnızca bundan sonra eklenen faaliyetlere uygulanır; mevcut kayıtlar
                        eklendikleri andaki puanla korunur.
                      </p>
                      <button type="submit" className="projects-filter-button">Kaydet</button>
                    </ActionForm>
                  </details>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
