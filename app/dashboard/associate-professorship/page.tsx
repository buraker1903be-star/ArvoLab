import Link from "next/link";
import { ClipboardList, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { kriterGruplari, puanGruplari, puanYazisi } from "@/lib/docentlik-ozeti";
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

  // Toplam ve grup toplamları yazdırılabilir dökümle AYNI fonksiyondan (lib/docentlik-ozeti.ts).
  const { toplam: totalPoints, gruplar } = puanGruplari(entries);

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
            <strong>Resmî ÜAK duyurusunun yerini tutmaz</strong>; kriterleri güncel tutmak Yönetici&apos;nin
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
            <span className="cluster">
            {!kayitOkunamadi && entries.length ? (
              /* Başvuru dosyasını hazırlarken elde tutulacak döküm: grup grup
                 faaliyetler ve toplamlar (app/print/docentlik). */
              <Link href="/print/docentlik" target="_blank" className="projects-filter-button button-compact">
                <Printer size={15} aria-hidden="true" /> Döküm
              </Link>
            ) : null}
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
                    <input name="unitCount" type="text" inputMode="decimal" defaultValue="1" placeholder="Örn. 1 ya da 0,5" required />
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
            </span>
          </header>

          {/* Okunamayan kayıtla hesaplanan toplam SIFIR değil, BİLİNMİYOR. */}
          <div className="kaynakca-puan" data-tone="neutral">
            <b>{kayitOkunamadi ? "—" : puanYazisi(totalPoints)}</b>
            <span>toplam puan</span>
          </div>
          {/* Grup başına puan ve toplamdaki payı: hangi alanın ağır bastığı tek bakışta. */}
          {!kayitOkunamadi && gruplar.length ? (
            <ul className="docentlik-dagilim" aria-label="Gruplara göre puan">
              {gruplar.map((g) => (
                <li key={g.grup}>
                  <span>{g.grup}</span>
                  <progress max={Math.max(totalPoints, 1)} value={g.toplam} aria-label={`${g.grup}: ${puanYazisi(g.toplam)} puan`} />
                  <b>{puanYazisi(g.toplam)}</b>
                </li>
              ))}
            </ul>
          ) : null}

          {!kriterOkunamadi && criteria.length === 0 ? (
            <p className="alert" data-tone="info">
              {canManageCriteria
                ? "Faaliyet eklenebilmesi için önce puanlama kriterleri tanımlanmalı. Sağdaki “Kriter ekle” ile başlayın."
                : "Faaliyet eklenebilmesi için önce kurumunuzun puanlama kriterleri tanımlanmalı. Yöneticinizden güncel ÜAK puanlarını girmesini isteyin."}
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
            gruplar.map((g) => (
            <section key={g.grup} className="docentlik-grup" aria-label={g.grup}>
            <h3 className="calisma-durum-alt docentlik-grup-baslik">
              <span>{g.grup}</span>
              <span className="muted">{g.kayitlar.length} kayıt · {puanYazisi(g.toplam)} puan</span>
            </h3>
            <ul className="kanit-kayitlari">
              {g.kayitlar.map((e) => {
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
                            {[e.criteria?.code, `${puanYazisi(e.unit_count)} birim × ${e.criteria ? puanYazisi(e.criteria.points_per_unit) : "?"} puan`]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        <span className="status-pill" data-tone="info">
                          {puanYazisi(e.computed_points)}
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
                                  type="text"
                                  inputMode="decimal"
                                  defaultValue={puanYazisi(e.unit_count)}
                                  required
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
            </section>
            ))
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
                description="Güncel resmî ÜAK duyurusundaki puan değerlerini girin. Bu bölüm yalnızca Yönetici ve üzeri rollere açıktır."
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
                    <input name="pointsPerUnit" type="text" inputMode="decimal" placeholder="Örn. 20 ya da 2,5" required />
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
            kriterGruplari(criteria).map((kg) => (
            <section key={kg.grup} className="docentlik-grup" aria-label={kg.grup}>
            <h3 className="calisma-durum-alt docentlik-grup-baslik">
              <span>{kg.grup}</span>
              <span className="muted">{kg.kriterler.length} kriter</span>
            </h3>
            <ul className="gb-liste">
              {kg.kriterler.map((c) => (
                <li key={c.id} className="gb-satir">
                  <span className="gb-satir-govde">
                    <b>
                      {c.code} — {c.label}
                    </b>
                    <small>{kriterKapsami(c)}</small>
                  </span>
                  <span className="status-pill" data-tone="neutral">
                    {puanYazisi(c.points_per_unit)} puan
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
                            <input name="pointsPerUnit" type="text" inputMode="decimal" defaultValue={puanYazisi(c.points_per_unit)} required />
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
            </section>
            ))
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
