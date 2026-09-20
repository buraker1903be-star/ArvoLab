import { ClipboardList, GraduationCap, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
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
import BosDurum from "../_components/bos-durum";
import PanelDrawer from "../_components/panel-drawer";

export default async function ScoringPage() {
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
        {criteria.length > 0 ? (
          <PanelDrawer
            triggerLabel="Faaliyet ekle"
            triggerIcon={<Plus size={16} aria-hidden="true" />}
            kicker="Doçentlik"
            title="Yeni faaliyet ekle"
            description="Yayınınızı veya faaliyetinizi ilgili kritere göre kaydedin."
          >
            <ActionForm className="project-form-grid" action={addScoreEntry} successMessage="Faaliyet eklendi.">
              <label className="project-form-full">
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
                <input name="unitCount" type="number" min={0.1} step={0.1} defaultValue={1} inputMode="decimal" />
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
            </ActionForm>
          </PanelDrawer>
        ) : null}
      </section>

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
              ? "Henüz puanlama kriteri tanımlanmadı. Aşağıdaki “Kriter ekle” düğmesiyle ilk kriteri ekleyin."
              : "Henüz puanlama kriteri tanımlanmadı. Akademik Yönetici'nizden kriterleri girmesini isteyin."}
          </p>
        </section>
      ) : null}

      <section className="section">
        <h2 className="section-title">Kayıtlı Faaliyetleriniz</h2>
        {entries.length === 0 ? (
          /* Eskiden bölüm tamamen gizleniyordu; kullanıcı kaydın nereye
             gideceğini göremiyordu. */
          <BosDurum
            kompakt
            ikon={ClipboardList}
            aciklama="Henüz faaliyet eklemediniz. Yayın, atıf, proje ve tez danışmanlıklarınızı ekledikçe doçentlik puanınız burada toplanır."
          />
        ) : (
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
                  successMessage="Kayıt silindi."
                >
                  <button type="submit" className="projects-filter-button">
                    <Trash2 size={14} aria-hidden="true" />
                    Kaydı sil
                  </button>
                </ActionForm>
              </article>
            ))}
          </div>
        )}
      </section>

      {canManageCriteria ? (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">
              <Settings2 size={16} aria-hidden="true" />
              Puanlama Kriterleri
            </h2>
            <PanelDrawer
              triggerLabel="Kriter ekle"
              triggerIcon={<Plus size={16} aria-hidden="true" />}
              triggerClassName="projects-filter-button"
              kicker="Puanlama kriterleri"
              title="Yeni kriter ekle"
              description="Güncel resmi ÜAK duyurusundaki puan değerlerini girin. Bu bölüm yalnızca Akademik Yönetici ve üzeri rollere açıktır."
            >
              <ActionForm className="project-form-grid" action={createCriterion} successMessage="Kriter eklendi.">
                <label>
                  <span>Kriter kodu</span>
                  <input name="code" type="text" placeholder="Örn. A1" required />
                </label>
                <label>
                  <span>Birim başına puan</span>
                  <input name="pointsPerUnit" type="number" step={0.1} min={0} inputMode="decimal" required />
                </label>
                <label className="project-form-full">
                  <span>Etiket</span>
                  <input name="label" type="text" placeholder="Örn. SCI-E indeksli makale" required />
                </label>
                <label>
                  <span>Kategori grubu</span>
                  <input name="categoryGroup" type="text" placeholder="Örn. Makaleler" />
                </label>
                <label>
                  <span>Notlar</span>
                  <input name="notes" type="text" placeholder="Kaynak, şart, açıklama" />
                </label>
                <div className="project-form-actions">
                  <button type="submit" className="projects-primary-button">
                    <Plus size={16} aria-hidden="true" />
                    Kriteri kaydet
                  </button>
                </div>
              </ActionForm>
            </PanelDrawer>
          </div>

          {criteria.length > 0 ? (
            <div className="project-form-card">
              {criteria.map((c) => (
                <div key={c.id} className="list-row text-base">
                  <div className="cluster cluster-between">
                    <span>
                      <strong>{c.code}</strong> — {c.label} ({c.points_per_unit} puan)
                      {c.category_group ? <span className="muted"> · {c.category_group}</span> : null}
                    </span>
                    <div className="cluster">
                      <PanelDrawer
                        triggerLabel="Düzenle"
                        triggerIcon={<Pencil size={13} aria-hidden="true" />}
                        triggerClassName="projects-filter-button button-compact"
                        kicker="Kriteri düzenle"
                        title={`${c.code} — ${c.label}`}
                        description="Puan değişikliği yalnızca bundan sonra eklenen faaliyetlere uygulanır; mevcut kayıtlar eklendikleri andaki puanla korunur."
                      >
                        <ActionForm
                          className="project-form-grid"
                          action={handleUpdateCriterion.bind(null, c.id)}
                          successMessage="Kriter güncellendi."
                        >
                          <label className="project-form-full">
                            <span>Etiket</span>
                            <input name="label" type="text" defaultValue={c.label} required />
                          </label>
                          <label>
                            <span>Kategori grubu</span>
                            <input name="categoryGroup" type="text" defaultValue={c.category_group ?? ""} />
                          </label>
                          <label>
                            <span>Birim başına puan</span>
                            <input name="pointsPerUnit" type="number" step={0.1} min={0} inputMode="decimal" defaultValue={c.points_per_unit} required />
                          </label>
                          <label className="project-form-full">
                            <span>Notlar</span>
                            <input name="notes" type="text" defaultValue={c.notes ?? ""} />
                          </label>
                          <div className="project-form-actions">
                            <button type="submit" className="projects-primary-button">
                              Kaydet
                            </button>
                          </div>
                        </ActionForm>
                      </PanelDrawer>
                      <ActionForm
                        action={handleDeleteCriterion.bind(null, c.id)}
                        confirmMessage={`"${c.code}" kriterini silmek istediğinize emin misiniz? Bu kritere bağlı kullanıcı kayıtları varsa kriter silinmez, pasife alınır (geçmiş puanlar korunur).`}
                        successMessage="Kriter kaldırıldı."
                      >
                        <button type="submit" className="projects-filter-button button-compact" aria-label={`${c.code} kriterini sil`}>
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </ActionForm>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
