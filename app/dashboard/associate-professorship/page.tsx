import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import {
  getCriteria,
  createCriterion,
  updateCriterion,
  deleteCriterion,
  getMyScoreEntries,
  addScoreEntry,
  updateScoreEntry,
  deleteScoreEntry,
  type ScoringCriterion,
} from "@/app/actions/scoring";
import { getCurrentProfile } from "@/app/actions/profile";
import ActionForm from "../action-form";
import BosDurum from "../_components/bos-durum";
import PanelDrawer from "../_components/panel-drawer";

export default async function ScoringPage() {
  const [
    { satirlar: criteria, okunamadi: kriterOkunamadi },
    { satirlar: entries, okunamadi: kayitOkunamadi },
    profile,
  ] = await Promise.all([
    getCriteria(),
    getMyScoreEntries(),
    getCurrentProfile(),
  ]);

  const canManageCriteria =
    profile?.role === "academic_manager" ||
    profile?.role === "system_admin" ||
    profile?.role === "founder";
  const icEkip = profile?.role === "system_admin" || profile?.role === "founder";

  /*
    Kriterler kuruma ait olabiliyor (migration 20260924100032). Genel listeyi
    yalnızca iç ekip düzenler; kurum yöneticisi kendi kurumununkini düzenler.
    Yetkisi olmayan satıra düğme ÇİZİLMİYOR: düğmeyi gösterip "yetkiniz yok"
    demek, kullanıcıyı bir hata mesajına tıklatmaktır.
  */
  const kriterKapsami = (c: ScoringCriterion) =>
    c.organization_id === null
      ? "Genel"
      : c.organization_id === profile?.organization_id
        ? "Kurumunuz"
        : "Başka kurum";
  const kriterDuzenlenebilir = (c: ScoringCriterion) =>
    icEkip ||
    (profile?.role === "academic_manager" &&
      Boolean(c.organization_id) &&
      c.organization_id === profile?.organization_id);

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

  async function handleUpdateEntry(entryId: string, formData: FormData) {
    "use server";
    return updateScoreEntry(entryId, formData);
  }

  async function handleDeleteCriterion(criterionId: string) {
    "use server";
    return deleteCriterion(criterionId);
  }

  async function handleUpdateCriterion(criterionId: string, formData: FormData) {
    "use server";
    return updateCriterion(criterionId, formData);
  }

  /*
    Kaydın kriteri pasife alınmış olabilir — getCriteria yalnızca aktifleri
    döndürüyor. Listede yoksa kaydın kendi kriteri başa ekleniyor; yoksa
    kullanıcı düzenleme penceresinde kendi kriterini bulamaz ve yalnızca
    başlığı düzeltmek için başka bir kritere geçmek zorunda kalırdı.
  */
  const kriterSecenekleri = (kendi: ScoringCriterion | null) =>
    kendi && !criteria.some((c) => c.id === kendi.id) ? [kendi, ...criteria] : criteria;

  /*
    TEK EKRAN, İKİ KART (26.10.2026, diğer modüllerle aynı düzen). Eskiden
    üstte grup başına puan kutuları, altında her faaliyet için tam boy bir
    kart ve en altta kriter listesi vardı; on faaliyeti olan akademisyen
    toplamını görmek için yukarı, kriteri görmek için en aşağı iniyordu.
    Solda puan ve faaliyetler, sağda puanlamanın dayandığı kriterler.

    Modül yalnızca personelin başlatıcısında (lib/os/uygulamalar.ts):
    öğrencinin işi değil.
  */
  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>Doçentlik Puanı</h1>
          <p>
            Beyan ettiğiniz yayın ve faaliyetlere güncel puanlama kriterleri uygulanır.{" "}
            <strong>Resmî ÜAK duyurusunun yerini tutmaz</strong>; kriterleri güncel tutmak Akademik Yönetici&apos;nin
            sorumluluğundadır.
          </p>
        </div>
      </section>

      {kriterOkunamadi ? (
        <p className="alert" role="alert">
          Puanlama kriterleri okunamadı; faaliyet ekleme şu an kapalı. Kriterlerin tanımsız olduğu anlamına gelmez —
          sayfayı yenileyin.
        </p>
      ) : null}

      <section className="gb-sutunlar kaynaklar-ikili" aria-label="Doçentlik puanı">
        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>Faaliyetlerim</h2>
              <p>{entries.length ? `${entries.length} kayıt` : "Yayın, atıf, proje ve danışmanlıklarınız"}</p>
            </div>
            {/*
              Kriter yokken düğmenin yeri boş bırakılmıyor: sebebi söyleniyor.
            */}
            {!kriterOkunamadi && criteria.length > 0 ? (
              <PanelDrawer
                triggerLabel="Faaliyet ekle"
                triggerIcon={<Plus size={15} aria-hidden="true" />}
                triggerClassName="projects-primary-button button-compact"
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
          </header>

          {/* Okunamayan kayıtla hesaplanan toplam SIFIR değil, BİLİNMİYOR. */}
          <div className="kaynakca-puan" data-tone="neutral">
            <b>{kayitOkunamadi ? "—" : totalPoints.toFixed(1)}</b>
            <span>toplam puan</span>
          </div>
          {!kayitOkunamadi && Object.keys(groupedTotals).length ? (
            <div className="docentlik-gruplar">
              {Object.entries(groupedTotals).map(([group, points]) => (
                <span key={group} className="chip">
                  {group}: {points.toFixed(1)}
                </span>
              ))}
            </div>
          ) : null}

          {!kriterOkunamadi && criteria.length === 0 ? (
            <p className="alert" data-tone="info">
              {canManageCriteria
                ? "Faaliyet eklenebilmesi için önce puanlama kriterleri tanımlanmalı. Sağdaki “Kriter ekle” ile başlayın."
                : "Faaliyet eklenebilmesi için önce kurumunuzun puanlama kriterleri tanımlanmalı. Akademik Yönetici'nizden güncel ÜAK puanlarını girmesini isteyin."}
            </p>
          ) : null}

          {kayitOkunamadi ? (
            <p className="alert" data-tone="danger" role="alert">
              Faaliyet kayıtlarınız yüklenemedi. Puanınız eksik görünebilir; sayfayı yenileyin.
            </p>
          ) : entries.length === 0 ? (
            <BosDurum
              kompakt
              ikon={ClipboardList}
              aciklama="Henüz faaliyet eklemediniz. Yayın, atıf, proje ve tez danışmanlıklarınızı ekledikçe puanınız burada toplanır."
            />
          ) : (
            <ul className="kanit-kayitlari">
              {entries.map((e) => {
                /* Kriter değişmediği sürece uygulanacak birim puan kaydın
                   kendisinden gelir (lib/docentlik-puan.ts); kullanıcı hangi
                   puanla hesaplanacağını düzenlemeden önce görsün. */
                const korunanPuan =
                  e.unit_count > 0 ? Math.round((e.computed_points / e.unit_count) * 1e6) / 1e6 : null;
                return (
                  <li key={e.id}>
                    <details className="kanit-kayit">
                      <summary>
                        <span className="kanit-kayit-govde">
                          <b>{e.title}</b>
                          <small>
                            {[e.criteria?.code, e.criteria?.category_group, `${e.unit_count} birim × ${e.criteria?.points_per_unit ?? "?"} puan`]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        <span className="status-pill" data-tone="info">
                          {e.computed_points.toFixed(1)}
                        </span>
                      </summary>
                      <div className="kanit-kayit-ic">
                        {e.notes ? <p className="kaynak-not">{e.notes}</p> : null}
                        <div className="kanit-eylemler">
                          <PanelDrawer
                            triggerLabel="Düzenle"
                            triggerIcon={<Pencil size={14} aria-hidden="true" />}
                            triggerClassName="projects-filter-button button-compact"
                            kicker="Faaliyet kaydı"
                            title={e.title}
                            description={
                              korunanPuan === null
                                ? "Kriteri değiştirirseniz yeni kriterin güncel puanı uygulanır."
                                : `Kriteri değiştirmezseniz bu kaydın birim puanı (${korunanPuan} puan/birim) korunur — kriterin puanı sonradan değişmiş olsa bile. Kriteri değiştirirseniz yeni kriterin güncel puanı uygulanır.`
                            }
                          >
                            <ActionForm
                              className="project-form-grid"
                              action={handleUpdateEntry.bind(null, e.id)}
                              successMessage="Kayıt güncellendi."
                            >
                              {kriterOkunamadi ? (
                                <p className="alert project-form-full" data-tone="warning">
                                  Kriter listesi okunamadı; yalnızca bu kaydın kriteri gösteriliyor.
                                  Başka bir kritere geçmek için sayfayı yenileyin.
                                </p>
                              ) : null}
                              <label className="project-form-full">
                                <span>Kriter</span>
                                <select name="criteriaId" defaultValue={e.criteria_id} required>
                                  {kriterSecenekleri(e.criteria).map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.category_group ? `${c.category_group} · ` : ""}
                                      {c.code} — {c.label} ({c.points_per_unit} puan/birim)
                                      {c.is_active ? "" : " · pasife alındı"}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Başlık / açıklama</span>
                                <input name="title" type="text" defaultValue={e.title} required />
                              </label>
                              <label>
                                <span>Adet / birim sayısı</span>
                                <input
                                  name="unitCount"
                                  type="number"
                                  min={0.1}
                                  step={0.1}
                                  defaultValue={e.unit_count}
                                  inputMode="decimal"
                                />
                              </label>
                              <label className="project-form-full">
                                <span>Notlar</span>
                                <input name="notes" type="text" defaultValue={e.notes ?? ""} />
                              </label>
                              <div className="project-form-actions">
                                <button type="submit" className="projects-primary-button">
                                  Kaydet
                                </button>
                              </div>
                            </ActionForm>
                          </PanelDrawer>
                          <ActionForm
                            action={handleDeleteEntry.bind(null, e.id)}
                            confirmMessage={`"${e.title}" kaydını silmek istediğinize emin misiniz?`}
                            successMessage="Kayıt silindi."
                          >
                            <button type="submit" className="link-button">
                              <Trash2 size={14} aria-hidden="true" /> Kaydı sil
                            </button>
                          </ActionForm>
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>Puanlama kriterleri</h2>
              <p>{canManageCriteria ? "Güncel ÜAK duyurusundaki puan değerleri" : "Puanınızın dayandığı kriterler"}</p>
            </div>
            {canManageCriteria ? (
              <PanelDrawer
                triggerLabel="Kriter ekle"
                triggerIcon={<Plus size={15} aria-hidden="true" />}
                triggerClassName="projects-filter-button button-compact"
                kicker="Puanlama kriterleri"
                title="Yeni kriter ekle"
                description="Güncel resmî ÜAK duyurusundaki puan değerlerini girin. Bu bölüm yalnızca Akademik Yönetici ve üzeri rollere açıktır."
              >
                <ActionForm className="project-form-grid" action={createCriterion} successMessage="Kriter eklendi.">
                  {icEkip ? (
                    /* Varsayılan GENEL: genel satır herkese görünür, yanlışlıkla
                       kuruma yazılmış bir kriter diğer kullanıcılardan sessizce
                       gizlenirdi. Kurum yöneticisine sorulmuyor — başka seçeneği yok. */
                    <label className="project-form-full">
                      <span>Kapsam</span>
                      <select name="kapsam" defaultValue="genel">
                        <option value="genel">Genel — tüm kurumlar ve bireysel aboneler görür</option>
                        <option value="kurum">Yalnızca kendi kurumum</option>
                      </select>
                    </label>
                  ) : (
                    <p className="hint project-form-full">
                      Bu kriter yalnızca kurumunuzun kullanıcılarına görünür ve
                      yalnızca sizin kurumunuzun puanlamasını etkiler.
                    </p>
                  )}
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
            ) : null}
          </header>

          {criteria.length ? (
            <ul className="gb-liste">
              {criteria.map((c) => (
                <li key={c.id} className="gb-satir">
                  <span className="gb-satir-govde">
                    <b>
                      {c.code} — {c.label}
                    </b>
                    <small>{[c.category_group, kriterKapsami(c)].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className="status-pill" data-tone="neutral">
                    {c.points_per_unit} puan
                  </span>
                  {/* Yetkisi olmayan satıra düğme ÇİZİLMİYOR. */}
                  {canManageCriteria && kriterDuzenlenebilir(c) ? (
                    <>
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
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="gb-bos">Henüz puanlama kriteri tanımlanmadı.</p>
          )}
          {canManageCriteria && !icEkip ? (
            <p className="hint">Genel listeyi yalnızca Sistem Yöneticisi düzenler; siz kurumunuzun kriterlerini düzenlersiniz.</p>
          ) : null}
        </article>
      </section>
    </main>
  );
}
