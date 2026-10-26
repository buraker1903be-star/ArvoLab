import Link from "next/link";
import { Check, FileText, MoreHorizontal, PenLine, Pencil, TriangleAlert, Upload } from "lucide-react";
import { calismaOzeti } from "@/app/actions/calisma-merkezi";
import { acikYapilacaklar, yapilacakTamamla } from "@/app/actions/yapilacaklar";
import { atifStiliniKilavuzaUydur } from "@/app/actions/projects";
import ActionForm from "../action-form";
import KilavuzPenceresi from "./[id]/kilavuz-penceresi";
import KanitMatrisiPenceresi from "./[id]/kanit/kanit-matrisi-penceresi";
import LiteraturPenceresi from "../literature/literatur-penceresi";
import KaynakcaPenceresi from "../citations/kaynakca-penceresi";
import { CALISMA_OKUNAMADI, atifStiliCelisiyorMu, siradakiAdimlar } from "@/lib/calisma-ozeti";
import { siradakiIs } from "@/lib/siradaki-is";
import { eksikSatirlari, type EksikTuru, type KartIlerlemesi } from "@/lib/calisma-karti";
import { STIL_ETIKETLERI } from "@/lib/atif/stiller";
import { projectTypeLabel, statusLabel } from "@/lib/project-labels";
import { statusTone } from "@/lib/status-tone";
import type { DueInfo } from "@/lib/due-date";
import { trTarih } from "@/lib/tr-time";
import { ListeSatiri } from "../_components/genel-bakis";
import DeleteProjectButton from "./delete-project-button";

/*
  ÇALIŞMALARIM — SAĞ KART: seçili çalışmanın durumu ve eksikleri.

  Eskiden ayrı bir "Çalışma merkezi" sayfası vardı; öğrenci için
  kaldırıldı ve geri kalan işleri buraya taşındı: kılavuz penceresi,
  "Kılavuza göre düzelt", asistanın son bulguları, Literatür, Kaynakça
  ve Kanıt matrisi pencereleri ve Makale bağlantısı. Personelin çalışma özeti ([id]/page.tsx) aynı
  veriyi okuyor; veri aynı kaynaktan (calismaOzeti), sıradaki
  iş aynı kuraldan (lib/siradaki-is.ts), eksik listesi tek bir saf
  fonksiyondan (lib/calisma-karti.ts, eksikSatirlari). Burada ikinci bir
  "ne eksik" hesabı yazılmıyor: merkez ile bu kart aynı çalışma için
  farklı şey söylerse öğrenci ikisine de güvenmez.

  Yalnızca SEÇİLİ çalışma için okunuyor: calismaOzeti on kadar sorgu,
  her satır için çağırmak listeyi yavaşlatırdı.
*/

const TUR: Record<EksikTuru, { etiket: string; ton: string }> = {
  stil: { etiket: "Stil", ton: "danger" },
  eksik: { etiket: "Eksik", ton: "danger" },
  tutarsizlik: { etiket: "Tutarsızlık", ton: "warning" },
  bakilacak: { etiket: "Bakılacak", ton: "warning" },
  asistan: { etiket: "Asistan", ton: "info" },
  yapilmadi: { etiket: "Yapılmadı", ton: "neutral" },
};

export default async function CalismaDurumKarti({
  projectId,
  kelime,
  ilerleme,
  due,
  duzenleyebilir,
  silebilir,
  kilavuzAc,
}: {
  projectId: string;
  kelime: number | null;
  ilerleme: KartIlerlemesi | null;
  due: DueInfo | null;
  duzenleyebilir: boolean;
  silebilir: boolean;
  /** Yeni tezde kılavuz eşleşmediyse pencere açık gelir (createProject). */
  kilavuzAc: boolean;
}) {
  const [ozet, yapilacaklar] = await Promise.all([calismaOzeti(projectId), acikYapilacaklar(projectId)]);
  const merkez = `/dashboard/editor/${projectId}`;

  if (!ozet || ozet === CALISMA_OKUNAMADI) {
    /* Okunamadı: kayıt yerinde, yalnızca özet çizilemiyor. Yazmaya
       dönmek yine mümkün olmalı. */
    return (
      <article className="gb-kart gb-sutun calisma-durum">
        <p className="gb-bos">
          Bu çalışmanın durumu şu an okunamadı; kaydınız yerinde duruyor. Sayfayı yenileyin ya da doğrudan
          yazmaya dönün.
        </p>
        <Link href={`${merkez}/write`} className="projects-primary-button button-compact">
          <PenLine size={15} aria-hidden="true" /> Yazmaya devam et
        </Link>
      </article>
    );
  }

  const { calisma, hazirlik, tutarsizliklar, kilavuz, uygulanan, kilavuzOkunamadi, asistan } = ozet;
  const makale = calisma.project_type === "article";
  const adimlar = siradakiAdimlar(ozet);
  const maddeler = (hazirlik?.items ?? [])
    .filter((madde) => madde.status !== "ok")
    .sort((a, b) => (a.status === "todo" ? 0 : 1) - (b.status === "todo" ? 0 : 1));
  const sirada = siradakiIs({ calismaId: calisma.id, adimlar, eksikler: maddeler, kalanGun: due?.days ?? null });
  const stil = (anahtar: string | null | undefined) => STIL_ETIKETLERI[anahtar ?? ""] ?? anahtar ?? "";
  /*
    Stil çelişkisi listede değil, düğmesiyle birlikte üstte: düzeltmesi
    tek tık ve yanlış stille yazmaya devam etmek her gün büyüyen bir hata.
    Düğme serbest seçim sunmuyor, yalnızca kılavuzun istediğine çeviriyor.
  */
  const stilUyarisi = atifStiliCelisiyorMu(ozet)
    ? `Çalışmanız ${stil(calisma.citation_style)} olarak ayarlı, ${kilavuz?.kurum ?? "kurumunuzun"} kılavuzu ${stil(kilavuz?.atifStili)} istiyor.`
    : null;
  const eksikler = eksikSatirlari({
    calismaId: calisma.id,
    stilUyarisi: null,
    maddeler,
    tutarsizliklar,
    asistanBulgulari: asistan.sonBulgular,
    adimlar,
    sirada,
  });

  return (
    <article className="gb-kart gb-sutun calisma-durum" aria-label={`${calisma.title}: durum`}>
      <header className="calisma-durum-bas">
        <div>
          <span className="calisma-durum-ust">
            <span className="status-pill" data-tone={statusTone(calisma.status)}>
              {statusLabel(calisma.status)}
            </span>
            {[projectTypeLabel(calisma.project_type), calisma.university].filter(Boolean).join(" · ")}
          </span>
          <h2>{calisma.title}</h2>
        </div>
        <Link href={`${merkez}/write`} className="projects-primary-button button-compact">
          <PenLine size={15} aria-hidden="true" />
          {kelime ? "Yazmaya devam et" : "Yazmaya başla"}
        </Link>
      </header>

      <dl className="tez-olcumler calisma-olcumler">
        <div className="tez-olcu">
          <dt>Yazılan</dt>
          <dd>
            {(kelime ?? 0).toLocaleString("tr-TR")}
            <small>kelime</small>
          </dd>
          <span title={ilerleme?.ipucu}>{ilerleme ? `%${ilerleme.yuzde} ${ilerleme.etiket}` : "Hedef yok — kılavuz bağlanınca hesaplanır"}</span>
        </div>
        <div className="tez-olcu" data-tone={due?.tone}>
          <dt>Teslim</dt>
          {due ? (
            <>
              <dd>
                {Math.abs(due.days)}
                <small>{due.days < 0 ? "gün gecikti" : "gün"}</small>
              </dd>
              <span>{calisma.due_date ? trTarih(calisma.due_date) : due.label}</span>
            </>
          ) : (
            <>
              <dd>—</dd>
              {duzenleyebilir && !calisma.due_date ? (
                /* Tarih yoksa kart ne kadar vakit kaldığını söyleyemiyor; eklemek tek tık. */
                <Link href={`${merkez}/edit`} className="link-accent">
                  Teslim tarihi ekle
                </Link>
              ) : (
                <span>{calisma.due_date ? trTarih(calisma.due_date) : "Tarih belirtilmedi"}</span>
              )}
            </>
          )}
        </div>
        <div className="tez-olcu" data-tone={hazirlik && hazirlik.done === hazirlik.total ? "success" : undefined}>
          <dt>Teslim hazırlığı</dt>
          <dd>
            {hazirlik ? `${hazirlik.done}/${hazirlik.total}` : "—"}
          </dd>
          <span>{hazirlik ? (hazirlik.done === hazirlik.total ? "Otomatik denetimler temiz" : "madde hazır") : "Müsvedde henüz boş"}</span>
        </div>
      </dl>

      {stilUyarisi ? (
        <div className="asistan-uyari asistan-uyari-eylemli" data-tone="danger" role="alert">
          <span>
            <TriangleAlert size={16} aria-hidden="true" /> {stilUyarisi}
          </span>
          <ActionForm action={atifStiliniKilavuzaUydur.bind(null, calisma.id)} successMessage="Atıf stili kılavuza göre güncellendi.">
            <button type="submit" className="projects-filter-button button-compact">
              Kılavuza göre düzelt
            </button>
          </ActionForm>
        </div>
      ) : null}

      <div className="tez-simdi" data-aciliyet={sirada.aciliyet} data-bitti={sirada.bitti ? "true" : undefined}>
        <span className="sirada-etiket">{sirada.bitti ? "Durum" : "Şimdi"}</span>
        <div className="sirada-govde">
          <b>{sirada.baslik}</b>
          <span>{sirada.aciklama}</span>
        </div>
        {/* İş bittiyse düğme bu kartın kendisine gidiyordu; çizilmiyor. */}
        {sirada.bitti ? null : (
          <Link href={sirada.href} className="projects-primary-button button-compact">
            {sirada.eylem}
          </Link>
        )}
      </div>

      <h3 className="calisma-durum-alt">
        {eksikler.length + yapilacaklar.length
          ? `Başka neler var · ${eksikler.length + yapilacaklar.length}`
          : "Başka eksik görünmüyor"}
      </h3>
      {eksikler.length + yapilacaklar.length ? (
        <ul className="gb-liste">
          {/*
            Öğrencinin kendi eklediği maddeler (kaynakça asistanının
            bulgularından "Yapılacaklara ekle") başta: kendisi seçti, en
            önce onları görmeli. Satır bağlantı değil; "Yaptım" düğmesi var.
          */}
          {yapilacaklar.map((madde) => (
            <li key={madde.id} className="yapilacak-satir">
              <span className="gb-satir-govde">
                <b>{madde.baslik}</b>
                {madde.aciklama ? <small className="gb-onizleme">{madde.aciklama}</small> : null}
              </span>
              <span className="status-pill" data-tone="info">
                Yapılacak
              </span>
              <ActionForm action={yapilacakTamamla.bind(null, madde.id)} successMessage="Tamamlandı olarak işaretlendi.">
                <button type="submit" className="projects-filter-button button-compact" aria-label={`${madde.baslik}: yaptım`}>
                  <Check size={14} aria-hidden="true" /> Yaptım
                </button>
              </ActionForm>
            </li>
          ))}
          {eksikler.map((satir) => (
            <ListeSatiri
              key={satir.anahtar}
              href={satir.href}
              baslik={satir.baslik}
              alt={satir.aciklama || undefined}
              onizleme
              sag={
                <span className="status-pill" data-tone={TUR[satir.tur].ton}>
                  {TUR[satir.tur].etiket}
                </span>
              }
            />
          ))}
        </ul>
      ) : (
        <p className="gb-bos">
          Kaydedilmiş metinde, kaynaklarda ve teslim listesinde açık bir madde yok. Otomatik denetim danışmanınızın
          kontrolünün yerini tutmaz.
        </p>
      )}

      <footer className="calisma-durum-alt-serit">
        {/*
          Tezde kılavuz penceresi; makalede kılavuzun karşılığı derginin
          kuralları ve onların yeri makale çalışma alanı (orada doğrulama
          değil, kontrol tarihi tutuluyor — lib/makale/).
        */}
        {makale ? (
          <Link href={`${merkez}/makale`} className="projects-filter-button button-compact">
            <FileText size={15} aria-hidden="true" /> Makale ve dergi
          </Link>
        ) : (
          <KilavuzPenceresi
            calisma={calisma}
            uygulanan={uygulanan}
            kilavuzOkunamadi={kilavuzOkunamadi}
            triggerClassName={uygulanan ? "projects-filter-button button-compact" : "projects-primary-button button-compact"}
            kisa
            acikBasla={kilavuzAc && !uygulanan}
          />
        )}
        {/* Çalışmanın birimleri iş akışı sırasıyla: literatür → kaynakça → kanıt. */}
        <LiteraturPenceresi projectId={calisma.id} projeAdi={calisma.title} />
        <KaynakcaPenceresi calisma={calisma} sonDenetim={ozet.kaynakca} />
        <KanitMatrisiPenceresi projectId={calisma.id} />
        {/* Ayda bir yapılan işler menüde; menü yukarı açılıyor, kartın içinde kalıyor. */}
        <details className="kart-menu">
          <summary aria-label={`${calisma.title}: diğer işlemler`}>
            <MoreHorizontal size={18} aria-hidden="true" />
          </summary>
          <div className="kart-menu-liste">
            {duzenleyebilir ? (
              <Link href={`${merkez}/edit`}>
                <Pencil size={15} aria-hidden="true" />
                Bilgileri düzenle
              </Link>
            ) : null}
            <Link href={`/dashboard/documents?calisma=${calisma.id}`}>
              <Upload size={15} aria-hidden="true" />
              Belge yükle
            </Link>
            {silebilir ? <DeleteProjectButton projectId={calisma.id} projectTitle={calisma.title} /> : null}
          </div>
        </details>
      </footer>
    </article>
  );
}
