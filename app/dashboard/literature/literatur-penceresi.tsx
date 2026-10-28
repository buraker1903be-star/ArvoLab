import { BookOpenCheck, ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  createLiteratureSource,
  deleteLiteratureSource,
  getLiteratureSources,
  updateLiteratureSource,
  updateLiteratureStatus,
} from "@/app/actions/literature";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import LiteraturCalismaAlani from "./literatur-calisma-alani";
import { KunyeAlanlari, NotAlani } from "./kaynak-parcalari";
import { ceviri } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";

/*
  LİTERATÜR PENCERESİ: Çalışmalarım'daki durum kartından, kartın
  çalışmasının kaynakları.

  ÖĞRENCİ GÖZÜYLE SADE (26.10.2026, kurum sahibinin isteği: "daha basit,
  kafa karıştırıcı olmasın"). İlk sürümde üç sayı kutusu, iki büyük araç
  (dizin araması ve tarama asistanı) ve her kaynakta üç durum düğmesi
  vardı. Öğrencinin bu pencerede yaptığı üç iş var; pencere yalnızca
  onları gösteriyor:

  1. Yeni kaynak aramak → solda arama, sağda sonuçlar, yan yana iki kart
     (yalnızca dizin araması; tarama asistanı Literatür sayfasında).
  2. Elindeki kaynağı eklemek → "Dizinlerde ara"nın yanında "Manuel
     kaynak ekle", pencere içinde pencere; dört alan (başlık, yazar,
     yıl, DOI), gerisi "Yayın bilgileri" altında.
  3. Okuduğunu işaretlemek → kaynağa tıklayınca TEK düğme: sıradaki
     adım ("Okudum", "Metinde kullandım"). Geri almak ikincil.

  Literatür sayfasına bağlantı ve boş liste açıklaması kaldırıldı:
  arama bu pencerede yapılıyor, boş liste kendini anlatıyor.

  Liste tek sıra: önce okunacaklar, sonra okunanlar, en son metinde
  kullanılanlar. Satırın işlemleri satırın içinde; pencere içinde ikinci
  pencere açılmıyor (odak ve geri tuşu karışıyordu).
*/

type Durum = "to_review" | "read" | "used";
const SIRA: Durum[] = ["to_review", "read", "used"];
const ETIKET: Record<Durum, { ad: Metin; ton: string }> = {
  to_review: { ad: { tr: "Okunacak", en: "To read" }, ton: "neutral" },
  read: { ad: { tr: "Okundu", en: "Read" }, ton: "info" },
  used: { ad: { tr: "Metinde", en: "Cited" }, ton: "success" },
};
const ILERI: Record<Durum, { durum: Durum; etiket: Metin } | null> = {
  to_review: { durum: "read", etiket: { tr: "Okudum", en: "I've read it" } },
  read: { durum: "used", etiket: { tr: "Metinde kullandım", en: "I cited it" } },
  used: null,
};
const GERI: Record<Durum, { durum: Durum; etiket: Metin } | null> = {
  to_review: null,
  read: { durum: "to_review", etiket: { tr: "Okunacaklara geri al", en: "Move back to “To read”" } },
  used: { durum: "read", etiket: { tr: "Kullanmadım, geri al", en: "Not cited, undo" } },
};

export default async function LiteraturPenceresi({
  projectId,
  projeAdi,
  triggerLabel,
  triggerClassName = "projects-filter-button button-compact",
}: {
  projectId: string;
  projeAdi: string;
  /** Kaynaklar sayfasında düğme "Kaynak bul" diyor; kartta sayıyı taşıyor. */
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const t = await ceviri();
  const { satirlar, okunamadi } = await getLiteratureSources();
  const kaynaklar = satirlar
    .filter((kaynak) => kaynak.project_id === projectId)
    .sort((a, b) => SIRA.indexOf(a.status as Durum) - SIRA.indexOf(b.status as Durum));
  const say = (durum: Durum) => kaynaklar.filter((kaynak) => kaynak.status === durum).length;

  return (
    <PanelDrawer
      triggerLabel={triggerLabel ?? (kaynaklar.length ? `${t({ tr: "Literatür", en: "Literature" })} · ${kaynaklar.length}` : t({ tr: "Literatür", en: "Literature" }))}
      triggerIcon={<BookOpenCheck size={15} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker={t({ tr: "Literatür", en: "Literature" })}
      title={t({ tr: "Bu çalışmanın kaynakları", en: "Sources for this work" })}
      description={
        kaynaklar.length
          ? t({
              tr: `${kaynaklar.length} kaynak · ${say("to_review")} okunacak · ${say("read")} okundu · ${say("used")} metinde kullanıldı`,
              en: `${kaynaklar.length} ${kaynaklar.length === 1 ? "source" : "sources"} · ${say("to_review")} to read · ${say("read")} read · ${say("used")} cited in the text`,
            })
          : t({
              tr: "Henüz bu çalışmaya bağlı kaynak yok. Aşağıdan arayın ya da elinizdekini ekleyin.",
              en: "No sources are linked to this work yet. Search below or add one you have.",
            })
      }
      boy="tam"
      basaridaKapan={false}
    >
      {okunamadi ? (
        <p className="alert mb-md" data-tone="danger" role="alert">
          {t({
            tr: "Kaynak listeniz yüklenemedi. Kayıtlarınız yerinde duruyor; sayfayı yenileyin.",
            en: "Couldn't load your sources. Your records are safe; refresh the page.",
          })}
        </p>
      ) : null}

      {/*
        İKİ KART YAN YANA: solda arama (yanında "Manuel kaynak ekle"),
        sağda sonuçlar. Bu çalışmanın kaynakları altta, tam genişlikte.
      */}
      <LiteraturCalismaAlani
        projeler={[{ id: projectId, title: projeAdi }]}
        asistanAcik={false}
        secilenCalisma={projectId}
        yalnizArama
        aramaYaninda={
          /*
            Manuel ekleme PENCERE İÇİNDE PENCERE (kurum sahibinin isteği):
            arama düğmesinin yanında; form arama kartını uzatmıyor ve
            kaydedince kendiliğinden kapanıyor, Literatür penceresi açık kalıyor.
          */
          <PanelDrawer
            triggerLabel={t({ tr: "Manuel kaynak ekle", en: "Add source manually" })}
            triggerIcon={<Plus size={16} aria-hidden="true" />}
            triggerClassName="projects-filter-button"
            kicker={t({ tr: "Literatür", en: "Literature" })}
            title={t({ tr: "Manuel kaynak ekle", en: "Add source manually" })}
            description={t({ tr: "Elinizdeki kaynağın bilgilerini girin; bu çalışmaya bağlanır.", en: "Enter the details of your source; it will be linked to this work." })}
          >
            <ActionForm className="project-form-grid" action={createLiteratureSource} successMessage={t({ tr: "Kaynak eklendi.", en: "Source added." })}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="status" value="to_review" />
              <KunyeAlanlari kisa />
              <div className="project-form-actions">
                <button type="submit" className="projects-primary-button">
                  <Plus size={16} aria-hidden="true" /> {t({ tr: "Ekle", en: "Add" })}
                </button>
              </div>
            </ActionForm>
          </PanelDrawer>
        }
      />

      {kaynaklar.length ? (
        <>
          <h3 className="pencere-grup-baslik mt-lg">{t({ tr: "Bu çalışmanın kaynakları", en: "Sources for this work" })} · {kaynaklar.length}</h3>
          <ul className="kanit-kayitlari">
          {kaynaklar.map((kaynak) => {
            const durum = (SIRA.includes(kaynak.status as Durum) ? kaynak.status : "to_review") as Durum;
            const ileri = ILERI[durum];
            const geri = GERI[durum];
            return (
              <li key={kaynak.id}>
                <details className="kanit-kayit">
                  <summary>
                    <span className="kanit-kayit-govde">
                      <b>{kaynak.title}</b>
                      <small>{[kaynak.authors || t({ tr: "Yazar belirtilmedi", en: "No author given" }), kaynak.year].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className="status-pill" data-tone={ETIKET[durum].ton}>
                      {t(ETIKET[durum].ad)}
                    </span>
                  </summary>
                  <div className="kanit-kayit-ic">
                    {kaynak.notes ? <p className="kaynak-not">{kaynak.notes}</p> : null}
                    <div className="kanit-eylemler">
                      {ileri ? (
                        <ActionForm action={updateLiteratureStatus.bind(null, kaynak.id, ileri.durum)} successMessage={t({ tr: "Kaydedildi.", en: "Saved." })}>
                          <button type="submit" className="projects-primary-button button-compact">
                            {t(ileri.etiket)}
                          </button>
                        </ActionForm>
                      ) : null}
                      {kaynak.doi_or_url ? (
                        <a className="projects-filter-button button-compact" href={kaynak.doi_or_url} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} aria-hidden="true" /> {t({ tr: "Kaynağı aç", en: "Open source" })}
                        </a>
                      ) : null}
                      {geri ? (
                        <ActionForm action={updateLiteratureStatus.bind(null, kaynak.id, geri.durum)} successMessage={t({ tr: "Geri alındı.", en: "Undone." })}>
                          <button type="submit" className="link-button">
                            {t(geri.etiket)}
                          </button>
                        </ActionForm>
                      ) : null}
                    </div>
                    <details className="form-details mt-sm">
                      <summary>{t({ tr: "Düzenle ya da sil", en: "Edit or delete" })}</summary>
                      <ActionForm className="project-form-grid mt-sm" action={updateLiteratureSource.bind(null, kaynak.id)} successMessage={t({ tr: "Kaynak güncellendi.", en: "Source updated." })}>
                        <KunyeAlanlari kaynak={kaynak} kisa />
                        <NotAlani kaynak={kaynak} />
                        <div className="project-form-actions project-form-full">
                          <button type="submit" className="projects-primary-button button-compact">
                            {t({ tr: "Kaydet", en: "Save" })}
                          </button>
                        </div>
                      </ActionForm>
                      <ActionForm
                        className="mt-sm"
                        action={deleteLiteratureSource.bind(null, kaynak.id)}
                        confirmMessage={t({ tr: `"${kaynak.title}" kaynağını silmek istediğinize emin misiniz?`, en: `Are you sure you want to delete "${kaynak.title}"?` })}
                        successMessage={t({ tr: "Kaynak silindi.", en: "Source deleted." })}
                      >
                        <button type="submit" className="projects-filter-button button-compact button-danger">
                          <Trash2 size={14} aria-hidden="true" /> {t({ tr: "Kaynağı sil", en: "Delete source" })}
                        </button>
                      </ActionForm>
                    </details>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
        </>
      ) : null}

    </PanelDrawer>
  );
}
