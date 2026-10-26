import Link from "next/link";
import { BookOpenCheck, ChevronRight, ExternalLink, Plus, Trash2 } from "lucide-react";
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
  2. Elindeki kaynağı eklemek → arama kartının altında; dört alan
     (başlık, yazar, yıl, DOI), gerisi "Yayın bilgileri" altında.
  3. Okuduğunu işaretlemek → kaynağa tıklayınca TEK düğme: sıradaki
     adım ("Okudum", "Metinde kullandım"). Geri almak ikincil.

  Liste tek sıra: önce okunacaklar, sonra okunanlar, en son metinde
  kullanılanlar. Satırın işlemleri satırın içinde; pencere içinde ikinci
  pencere açılmıyor (odak ve geri tuşu karışıyordu).
*/

type Durum = "to_review" | "read" | "used";
const SIRA: Durum[] = ["to_review", "read", "used"];
const ETIKET: Record<Durum, { ad: string; ton: string }> = {
  to_review: { ad: "Okunacak", ton: "neutral" },
  read: { ad: "Okundu", ton: "info" },
  used: { ad: "Metinde", ton: "success" },
};
const ILERI: Record<Durum, { durum: Durum; etiket: string } | null> = {
  to_review: { durum: "read", etiket: "Okudum" },
  read: { durum: "used", etiket: "Metinde kullandım" },
  used: null,
};
const GERI: Record<Durum, { durum: Durum; etiket: string } | null> = {
  to_review: null,
  read: { durum: "to_review", etiket: "Okunacaklara geri al" },
  used: { durum: "read", etiket: "Kullanmadım, geri al" },
};

export default async function LiteraturPenceresi({ projectId, projeAdi }: { projectId: string; projeAdi: string }) {
  const { satirlar, okunamadi } = await getLiteratureSources();
  const kaynaklar = satirlar
    .filter((kaynak) => kaynak.project_id === projectId)
    .sort((a, b) => SIRA.indexOf(a.status as Durum) - SIRA.indexOf(b.status as Durum));
  const say = (durum: Durum) => kaynaklar.filter((kaynak) => kaynak.status === durum).length;

  return (
    <PanelDrawer
      triggerLabel={kaynaklar.length ? `Literatür · ${kaynaklar.length}` : "Literatür"}
      triggerIcon={<BookOpenCheck size={15} aria-hidden="true" />}
      triggerClassName="projects-filter-button button-compact"
      kicker="Literatür"
      title="Bu çalışmanın kaynakları"
      description={
        kaynaklar.length
          ? `${kaynaklar.length} kaynak · ${say("to_review")} okunacak · ${say("read")} okundu · ${say("used")} metinde kullanıldı`
          : "Henüz bu çalışmaya bağlı kaynak yok. Aşağıdan arayın ya da elinizdekini ekleyin."
      }
      boy="tam"
      basaridaKapan={false}
    >
      {okunamadi ? (
        <p className="alert mb-md" data-tone="danger" role="alert">
          Kaynak listeniz yüklenemedi. Kayıtlarınız yerinde duruyor; sayfayı yenileyin.
        </p>
      ) : null}

      {/*
        İKİ KART YAN YANA: solda arama (ve altında elle ekleme), sağda
        sonuçlar. Bu çalışmanın kaynakları altta, tam genişlikte.
      */}
      <LiteraturCalismaAlani
        projeler={[{ id: projectId, title: projeAdi }]}
        asistanAcik={false}
        secilenCalisma={projectId}
        yalnizArama
        solEk={
          <details className="form-details pencere-is mt-md">
            <summary>
              <Plus size={15} aria-hidden="true" /> Elimdeki kaynağı ekle
            </summary>
            <ActionForm className="project-form-grid mt-sm" action={createLiteratureSource} successMessage="Kaynak eklendi.">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="status" value="to_review" />
              <KunyeAlanlari kisa />
              <div className="project-form-actions project-form-full">
                <button type="submit" className="projects-primary-button">
                  <Plus size={16} aria-hidden="true" /> Ekle
                </button>
              </div>
            </ActionForm>
          </details>
        }
      />

      <h3 className="pencere-grup-baslik mt-lg">
        {kaynaklar.length ? `Bu çalışmanın kaynakları · ${kaynaklar.length}` : "Bu çalışmanın kaynakları"}
      </h3>
      {kaynaklar.length === 0 ? <p className="muted text-sm">Henüz kaynak yok. Arama sonuçlarından “Listeme ekle” dediğiniz kaynaklar burada birikir.</p> : null}
      {kaynaklar.length ? (
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
                      <small>{[kaynak.authors || "Yazar belirtilmedi", kaynak.year].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className="status-pill" data-tone={ETIKET[durum].ton}>
                      {ETIKET[durum].ad}
                    </span>
                  </summary>
                  <div className="kanit-kayit-ic">
                    {kaynak.notes ? <p className="kaynak-not">{kaynak.notes}</p> : null}
                    <div className="kanit-eylemler">
                      {ileri ? (
                        <ActionForm action={updateLiteratureStatus.bind(null, kaynak.id, ileri.durum)} successMessage="Kaydedildi.">
                          <button type="submit" className="projects-primary-button button-compact">
                            {ileri.etiket}
                          </button>
                        </ActionForm>
                      ) : null}
                      {kaynak.doi_or_url ? (
                        <a className="projects-filter-button button-compact" href={kaynak.doi_or_url} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} aria-hidden="true" /> Kaynağı aç
                        </a>
                      ) : null}
                      {geri ? (
                        <ActionForm action={updateLiteratureStatus.bind(null, kaynak.id, geri.durum)} successMessage="Geri alındı.">
                          <button type="submit" className="link-button">
                            {geri.etiket}
                          </button>
                        </ActionForm>
                      ) : null}
                    </div>
                    <details className="form-details mt-sm">
                      <summary>Düzenle ya da sil</summary>
                      <ActionForm className="project-form-grid mt-sm" action={updateLiteratureSource.bind(null, kaynak.id)} successMessage="Kaynak güncellendi.">
                        <KunyeAlanlari kaynak={kaynak} kisa />
                        <NotAlani kaynak={kaynak} />
                        <div className="project-form-actions project-form-full">
                          <button type="submit" className="projects-primary-button button-compact">
                            Kaydet
                          </button>
                        </div>
                      </ActionForm>
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
                    </details>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Link href={`/dashboard/literature?calisma=${projectId}`} className="link-accent mt-md kanit-tam-tablo">
        Literatür sayfası: tarama asistanı ve bütün kaynaklarım <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </PanelDrawer>
  );
}
