import Link from "next/link";
import { BookOpenCheck, ChevronRight, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import {
  createLiteratureSource,
  deleteLiteratureSource,
  getLiteratureSources,
  updateLiteratureSource,
  updateLiteratureStatus,
} from "@/app/actions/literature";
import { literaturAsistaniAcik } from "@/app/actions/ai-literatur";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import LiteraturCalismaAlani from "./literatur-calisma-alani";
import { KunyeAlanlari, NotAlani, SOURCE_TYPE_LABELS, STATUS_LABELS } from "./kaynak-parcalari";

/*
  LİTERATÜR PENCERESİ (26.10.2026, kurum sahibinin isteği: "Kanıt matrisi
  ve Kılavuz olduğu yere aynı şekilde, aynı çalışmaya ait Literatür ve
  Kaynakça açılır pencereleri").

  Yalnızca BU çalışmanın kaynakları. Literatür sayfası kullanıcının bütün
  kaynaklarını gösteriyor (çalışmaya bağlamadan ekleyenler kaybetmesin
  diye); kartın penceresi ise kartın çalışmasını anlatıyor. Yeni kaynak
  ve dizinden eklenen kayıt bu çalışmaya bağlı geliyor.

  Satırın işlemleri satırın içinde açılır bölümde; pencere içinde ikinci
  bir pencere açılmıyor (kanıt matrisindeki gerekçe: odak ve geri tuşu
  karışıyordu).
*/

const SIRA = ["to_review", "read", "used"] as const;
/* Satırdaki tek tık: akışın bir sonraki adımı. Geri almak düzenle bölümünde. */
const SONRAKI: Record<string, { durum: string; etiket: string } | null> = {
  to_review: { durum: "read", etiket: "Okudum" },
  read: { durum: "used", etiket: "Kullandım" },
  used: null,
};

export default async function LiteraturPenceresi({ projectId, projeAdi }: { projectId: string; projeAdi: string }) {
  const [{ satirlar, okunamadi }, asistanAcik] = await Promise.all([getLiteratureSources(), literaturAsistaniAcik()]);
  const kaynaklar = satirlar.filter((kaynak) => kaynak.project_id === projectId);
  const gruplar = Object.fromEntries(SIRA.map((durum) => [durum, kaynaklar.filter((k) => k.status === durum)])) as Record<
    (typeof SIRA)[number],
    typeof kaynaklar
  >;

  return (
    <PanelDrawer
      triggerLabel={kaynaklar.length ? `Literatür · ${kaynaklar.length}` : "Literatür"}
      triggerIcon={<BookOpenCheck size={15} aria-hidden="true" />}
      triggerClassName="projects-filter-button button-compact"
      kicker="Literatür"
      title="Bu çalışmanın kaynakları"
      description="Bulduğunuz kaynakları kaydedin ve okuma durumunu izleyin. Bu araç kaynak özeti ya da yorum üretmez."
      boy="genis"
      basaridaKapan={false}
    >
      {okunamadi ? (
        <p className="alert mb-md" data-tone="danger" role="alert">
          Kaynak listeniz yüklenemedi. Kayıtlarınız yerinde duruyor; sayfayı yenileyin.
        </p>
      ) : null}

      <dl className="kanit-ozet">
        {SIRA.map((durum) => (
          <div key={durum}>
            <dt>{STATUS_LABELS[durum]}</dt>
            <dd>{gruplar[durum].length}</dd>
          </div>
        ))}
      </dl>

      <div className="pencere-bolumleri mt-md">
        {/* Hiç kaynak yoksa ilk iş kaynak bulmak; o bölüm açık gelir. */}
        <details className="form-details" open={kaynaklar.length === 0}>
          <summary>
            <Search size={15} aria-hidden="true" /> Kaynak bul
          </summary>
          <LiteraturCalismaAlani projeler={[{ id: projectId, title: projeAdi }]} asistanAcik={asistanAcik} secilenCalisma={projectId} />
        </details>
        <details className="form-details">
          <summary>
            <Plus size={15} aria-hidden="true" /> Elle kaynak ekle
          </summary>
          <ActionForm className="project-form-grid" action={createLiteratureSource} successMessage="Kaynak eklendi.">
            <input type="hidden" name="projectId" value={projectId} />
            <KunyeAlanlari />
            <label>
              <span>Durum</span>
              <select name="status" defaultValue="to_review">
                {SIRA.map((durum) => (
                  <option key={durum} value={durum}>
                    {STATUS_LABELS[durum]}
                  </option>
                ))}
              </select>
            </label>
            <NotAlani />
            <div className="project-form-actions">
              <button type="submit" className="projects-primary-button">
                <Plus size={16} aria-hidden="true" /> Kaynağı ekle
              </button>
            </div>
          </ActionForm>
        </details>
      </div>

      {SIRA.map((durum) =>
        gruplar[durum].length ? (
          <section key={durum} className="mt-md">
            <h3 className="pencere-grup-baslik">
              {STATUS_LABELS[durum]} · {gruplar[durum].length}
            </h3>
            <ul className="kanit-kayitlari">
              {gruplar[durum].map((kaynak) => {
                const sonraki = SONRAKI[durum];
                return (
                  <li key={kaynak.id}>
                    <details className="kanit-kayit">
                      <summary>
                        <span className="kanit-kayit-govde">
                          <b>{kaynak.title}</b>
                          <small>
                            {[SOURCE_TYPE_LABELS[kaynak.source_type], kaynak.authors || "Yazar belirtilmedi", kaynak.year, kaynak.container_title]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                      </summary>
                      <div className="kanit-kayit-ic">
                        {kaynak.notes ? <p className="kaynak-not">{kaynak.notes}</p> : null}
                        <div className="kanit-eylemler">
                          {SIRA.filter((d) => d !== durum).map((d) => (
                            <ActionForm
                              key={d}
                              action={updateLiteratureStatus.bind(null, kaynak.id, d)}
                              successMessage={`${STATUS_LABELS[d]} olarak işaretlendi.`}
                            >
                              <button type="submit" className={d === sonraki?.durum ? "projects-primary-button button-compact" : "projects-filter-button button-compact"}>
                                {d === sonraki?.durum ? sonraki.etiket : STATUS_LABELS[d]}
                              </button>
                            </ActionForm>
                          ))}
                          {kaynak.doi_or_url ? (
                            <a className="projects-filter-button button-compact" href={kaynak.doi_or_url} target="_blank" rel="noreferrer">
                              <ExternalLink size={14} aria-hidden="true" /> Kaynağa git
                            </a>
                          ) : null}
                        </div>
                        <details className="form-details mt-sm">
                          <summary>Künyeyi düzenle</summary>
                          <ActionForm className="project-form-grid" action={updateLiteratureSource.bind(null, kaynak.id)} successMessage="Kaynak güncellendi.">
                            <KunyeAlanlari kaynak={kaynak} />
                            <NotAlani kaynak={kaynak} />
                            <div className="project-form-actions">
                              <button type="submit" className="projects-primary-button">
                                Kaydet
                              </button>
                            </div>
                          </ActionForm>
                        </details>
                        <ActionForm
                          className="mt-sm"
                          action={deleteLiteratureSource.bind(null, kaynak.id)}
                          confirmMessage={`"${kaynak.title}" kaynağını silmek istediğinize emin misiniz?`}
                          successMessage="Kaynak silindi."
                        >
                          <button type="submit" className="projects-filter-button button-compact button-danger">
                            <Trash2 size={14} aria-hidden="true" /> Kaynağı sil
                          </button>
                        </ActionForm>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null,
      )}

      <Link href={`/dashboard/literature?calisma=${projectId}`} className="link-accent mt-md kanit-tam-tablo">
        Bütün kaynaklarım <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </PanelDrawer>
  );
}
