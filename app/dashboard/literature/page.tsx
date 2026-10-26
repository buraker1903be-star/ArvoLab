import { BookMarked, BookOpenCheck, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import {
  getLiteratureSources,
  createLiteratureSource,
  updateLiteratureStatus,
  updateLiteratureSource,
  deleteLiteratureSource,
} from "@/app/actions/literature";
import { getMyProjects } from "@/app/actions/citation-check";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import LiteraturCalismaAlani from "./literatur-calisma-alani";
import { literaturAsistaniAcik } from "@/app/actions/ai-literatur";
import CalismaSerit from "../_components/calisma-serit";
import BosDurum from "../_components/bos-durum";
import { KunyeAlanlari, NotAlani, SOURCE_TYPE_LABELS, STATUS_LABELS } from "./kaynak-parcalari";

/* Akışın hangi aşaması olduğunu söyleyen boş durum metinleri. */
const BOS_METIN = {
  to_review: "İncelenecek kaynak yok. Yeni bulduğunuz kaynakları buraya ekleyin; okuduktan sonra durumunu değiştirirsiniz.",
  read: "Okunmuş kaynak yok. İncelediğiniz kaynağın durumunu “Okundu” yapın; böylece hangilerini bitirdiğinizi izleyebilirsiniz.",
  used: "Metinde kullanılan kaynak yok. Bir kaynağa atıf yaptığınızda durumunu “Kullanıldı” yapın; kaynakça denetimi bu işareti kullanır.",
} as const;

export default async function LiteraturePage({
  searchParams,
}: {
  searchParams: Promise<{ calisma?: string }>;
}) {
  // Çalışma merkezinden gelindiğinde hangi çalışma için çalışıldığı belli;
  // kullanıcı her seferinde listeden seçmek zorunda kalmasın.
  const { calisma: secilenCalisma } = await searchParams;
  // Anahtar yoksa düğme boşuna tıklanmasın; karar sunucuda verilir çünkü
  // ortam değişkeni istemciye taşınmaz (AGENTS.md: sırlar NEXT_PUBLIC_ değil).
  const [
    { satirlar: sources, okunamadi: kaynakOkunamadi },
    { satirlar: projects, okunamadi: calismaOkunamadi },
    asistanAcik,
  ] = await Promise.all([
    getLiteratureSources(),
    getMyProjects(),
    literaturAsistaniAcik(),
  ]);

  /*
    Şerit "bu çalışmadasınız" diyor ama liste kullanıcının BÜTÜN
    kaynaklarını gösteriyor ve satırlar hangi çalışmaya ait olduğunu
    söylemiyordu: ekosistem vaadinin gözle görülür koptuğu yer burasıydı.

    Liste daraltılmıyor — kaynağı çalışmaya bağlamadan ekleyen kullanıcı
    onları kaybederdi. Bunun yerine her satır kendi çalışmasını yazıyor
    ve seçili çalışmanınkiler başa alınıyor.
  */
  const calismaAdi = new Map(projects.map((proje) => [proje.id, proje.title]));
  const buCalismaninKaynagi = (kaynak: { project_id?: string | null }) =>
    Boolean(secilenCalisma) && kaynak.project_id === secilenCalisma;
  const sirala = <T extends { project_id?: string | null }>(liste: T[]) =>
    [...liste].sort((a, b) => Number(buCalismaninKaynagi(b)) - Number(buCalismaninKaynagi(a)));

  const grouped = {
    to_review: sirala(sources.filter((s) => s.status === "to_review")),
    read: sirala(sources.filter((s) => s.status === "read")),
    used: sirala(sources.filter((s) => s.status === "used")),
  };

  async function handleAdvanceStatus(sourceId: string, nextStatus: string) {
    "use server";
    return updateLiteratureStatus(sourceId, nextStatus);
  }

  async function handleDelete(sourceId: string) {
    "use server";
    return deleteLiteratureSource(sourceId);
  }

  async function handleEdit(sourceId: string, formData: FormData) {
    "use server";
    return updateLiteratureSource(sourceId, formData);
  }

  return (
    <main className="dashboard-page">
      <CalismaSerit calismaId={secilenCalisma} aktif="literatur" />
      <section className="projects-header">
        <div>
          <h1>Literatür Taraması</h1>
          <p>
            Bulduğunuz kaynakları buraya kaydedin, okuma durumunu takip edin.
            Bu araç kaynak özeti ya da yorum ÜRETMEZ — yalnızca kendi
            bulduğunuz kaynakların listesini tutmanıza yardımcı olur.
          </p>
        </div>
        <PanelDrawer
          triggerLabel="Yeni kaynak"
          triggerIcon={<Plus size={16} aria-hidden="true" />}
          kicker="Literatür"
          title="Yeni kaynak ekle"
          description="Taramada bulduğunuz bir kaynağı kaydedin."
        >
          <ActionForm className="project-form-grid" action={createLiteratureSource} successMessage="Kaynak eklendi.">
            <KunyeAlanlari />

            {projects.length > 0 && (
              <label>
                <span>Bağlı çalışma (opsiyonel)</span>
                <select name="projectId" defaultValue="">
                  <option value="">Seçili çalışma yok</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              <span>Durum</span>
              <select name="status" defaultValue="to_review">
                <option value="to_review">İncelenecek</option>
                <option value="read">Okundu</option>
                <option value="used">Kullanıldı</option>
              </select>
            </label>

            <NotAlani />

            <div className="project-form-actions">
              <button type="submit" className="projects-primary-button">
                <Plus size={16} aria-hidden="true" />
                Kaynağı ekle
              </button>
            </div>
          </ActionForm>
        </PanelDrawer>
      </section>
      {/*
        Çalışma listesi okunamadı. Sessiz kalınsaydı seçiciler boş görünür,
        kullanıcı çalışmalarının silindiğini sanırdı (lib/liste-sonucu.ts).
      */}
      {calismaOkunamadi ? (
        <p className="alert mb-md" role="alert">
          Çalışma listeniz okunamadı; aşağıdaki çalışma seçimleri eksik
          görünebilir. Çalışmalarınızın silindiği anlamına gelmez — sayfayı
          yenileyin.
        </p>
      ) : null}

      <LiteraturCalismaAlani
        projeler={projects.map((proje) => ({ id: proje.id, title: proje.title }))}
        asistanAcik={asistanAcik}
        secilenCalisma={secilenCalisma ?? null}
      />

      {/*
        Okuma başarısızsa bunu SÖYLÜYORUZ. Eskiden liste boş geliyor ve üç
        grup da "henüz kaynak yok" diyordu: kullanıcı topladığı literatürü
        kaybettiğini sanıyordu.
      */}
      {kaynakOkunamadi && (
        <p className="alert" data-tone="danger" role="alert">
          Kaynak listeniz yüklenemedi. Kayıtlarınız yerinde duruyor; sayfayı yenileyin.
        </p>
      )}

      {(["to_review", "read", "used"] as const).map((statusKey) => (
        <section key={statusKey} className="section">
          <h2 className="section-title">
            <BookOpenCheck size={16} aria-hidden="true" />
            {STATUS_LABELS[statusKey]} ({grouped[statusKey].length})
          </h2>
          {grouped[statusKey].length === 0 ? (
            /* Her grup için ayrı cümle: "kaynak yok" üç yerde aynı görünüp
               kullanıcıya bir şey anlatmıyordu; akışın hangi aşaması olduğu
               söyleniyor. */
            <BosDurum kompakt ikon={BookMarked} aciklama={BOS_METIN[statusKey]} />
          ) : (
            /*
              Kaynaklar KART değil, kompakt satır. Eskiden her kaynak tam
              boy bir project-card idi: 40 kaynaklı bir çalışmada sayfa
              metrelerce uzuyor, kullanıcı aradığı künyeyi bulamıyordu.
              Kaynak taranmak içindir, okunmak için değil.
            */
            <div className="kaynak-listesi">
              {grouped[statusKey].map((s) => (
                <article className="kaynak-satiri" key={s.id}>
                  <div className="kaynak-govde">
                    <div className="kaynak-baslik">
                      <span className="chip">{SOURCE_TYPE_LABELS[s.source_type]}</span>
                      <h3>{s.title}</h3>
                    </div>
                    <p className="kaynak-kunye">
                      {s.authors || "Yazar belirtilmedi"}
                      {s.year ? ` · ${s.year}` : ""}
                      {s.container_title ? ` · ${s.container_title}` : ""}
                      {s.doi_or_url ? (
                        <>
                          {" · "}
                          <a href={s.doi_or_url} target="_blank" rel="noreferrer">
                            <ExternalLink size={13} aria-hidden="true" />
                            Kaynağa git
                          </a>
                        </>
                      ) : null}
                    </p>
                    {/* Hangi çalışmaya ait: belgeler ekranı bunu zaten
                        yazıyordu, literatür yazmıyordu. */}
                    <p className="hint">
                      {s.project_id
                        ? calismaAdi.get(s.project_id) ?? "Silinmiş çalışma"
                        : "Çalışmaya bağlı değil"}
                      {buCalismaninKaynagi(s) ? " · bu çalışma" : ""}
                    </p>
                    {s.notes ? <p className="kaynak-not">{s.notes}</p> : null}
                  </div>

                  <div className="kaynak-eylemler">
                    {statusKey !== "to_review" && (
                      <ActionForm action={handleAdvanceStatus.bind(null, s.id, "to_review")} successMessage="İncelenecek olarak işaretlendi.">
                        <button type="submit" className="projects-filter-button button-compact">
                          İncelenecek
                        </button>
                      </ActionForm>
                    )}
                    {statusKey !== "read" && (
                      <ActionForm action={handleAdvanceStatus.bind(null, s.id, "read")} successMessage="Okundu olarak işaretlendi.">
                        <button type="submit" className="projects-filter-button button-compact">
                          Okundu
                        </button>
                      </ActionForm>
                    )}
                    {statusKey !== "used" && (
                      <ActionForm action={handleAdvanceStatus.bind(null, s.id, "used")} successMessage="Kullanıldı olarak işaretlendi.">
                        <button type="submit" className="projects-filter-button button-compact">
                          Kullanıldı
                        </button>
                      </ActionForm>
                    )}
                    <PanelDrawer
                      triggerLabel="Düzenle"
                      triggerIcon={<Pencil size={14} aria-hidden="true" />}
                      triggerClassName="projects-filter-button button-compact"
                      kicker="Kaynağı düzenle"
                      title={s.title}
                    >
                      <ActionForm className="project-form-grid" action={handleEdit.bind(null, s.id)} successMessage="Kaynak güncellendi.">
                        <KunyeAlanlari kaynak={s} />
                        <NotAlani kaynak={s} />
                        <div className="project-form-actions">
                          <button type="submit" className="projects-primary-button">
                            Kaydet
                          </button>
                        </div>
                      </ActionForm>
                    </PanelDrawer>
                    <ActionForm
                      action={handleDelete.bind(null, s.id)}
                      confirmMessage={`"${s.title}" kaynağını silmek istediğinize emin misiniz?`}
                      successMessage="Kaynak silindi."
                    >
                      <button type="submit" className="projects-filter-button button-compact" aria-label="Kaynağı sil">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </ActionForm>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
