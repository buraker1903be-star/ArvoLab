import Link from "next/link";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import { YEREL, type Metin } from "@/lib/dil";
import { Check, FileText, MoreHorizontal, PenLine, Pencil, TriangleAlert, Upload } from "lucide-react";
import { calismaOzeti } from "@/app/actions/calisma-merkezi";
import { acikYapilacaklar, yapilacakTamamla } from "@/app/actions/yapilacaklar";
import { calismaAnalizleri } from "@/app/actions/analiz-sonuclari";
import { atifStiliniKilavuzaUydur } from "@/app/actions/projects";
import ActionForm from "../action-form";
import KilavuzPenceresi from "./[id]/kilavuz-penceresi";
import KanitMatrisiPenceresi from "./[id]/kanit/kanit-matrisi-penceresi";
import LiteraturPenceresi from "../literature/literatur-penceresi";
import KaynakcaPenceresi from "../citations/kaynakca-penceresi";
import AnalizPenceresi from "../analysis/analiz-penceresi";
import { CALISMA_OKUNAMADI, atifStiliCelisiyorMu, siradakiAdimlar } from "@/lib/calisma-ozeti";
import { siradakiIs } from "@/lib/siradaki-is";
import { eksikSatirlari, type EksikTuru, type KartIlerlemesi } from "@/lib/calisma-karti";
import { STIL_ETIKETLERI } from "@/lib/atif/stiller";
import { projectTypeLabel, statusLabel } from "@/lib/project-labels";
import { statusTone } from "@/lib/status-tone";
import type { DueInfo } from "@/lib/due-date";
import { ListeSatiri } from "../_components/genel-bakis";
import DeleteProjectButton from "./delete-project-button";
import TeslimPaketi from "../_components/teslim-paketi";
import TeslimTarihiFormu from "../_components/teslim-tarihi-formu";
import TezTakvimiPenceresi from "./tez-takvimi-penceresi";
import { takvimiGetir } from "@/app/actions/tez-takvimi";
import { kalanMetni, siradakiTas } from "@/lib/tez-takvimi";
import { trGunAnahtari } from "@/lib/tr-time";

/*
  ÇALIŞMALARIM — SAĞ KART: seçili çalışmanın durumu ve eksikleri.

  Eskiden ayrı bir "Çalışma merkezi" sayfası vardı; öğrenci için
  kaldırıldı ve geri kalan işleri buraya taşındı: kılavuz penceresi,
  "Kılavuza göre düzelt", öğrencinin seçtiği yapılacaklar, Literatür, Kaynakça
  ve Kanıt matrisi pencereleri ve Makale bağlantısı. Personelin çalışma özeti ([id]/page.tsx) aynı
  veriyi okuyor; veri aynı kaynaktan (calismaOzeti), sıradaki
  iş aynı kuraldan (lib/siradaki-is.ts), eksik listesi tek bir saf
  fonksiyondan (lib/calisma-karti.ts, eksikSatirlari). Burada ikinci bir
  "ne eksik" hesabı yazılmıyor: merkez ile bu kart aynı çalışma için
  farklı şey söylerse öğrenci ikisine de güvenmez.

  Yalnızca SEÇİLİ çalışma için okunuyor: calismaOzeti on kadar sorgu,
  her satır için çağırmak listeyi yavaşlatırdı.
*/

const TUR: Record<EksikTuru, { etiket: Metin; ton: string }> = {
  stil: { etiket: { tr: "Stil", en: "Style" }, ton: "danger" },
  eksik: { etiket: { tr: "Eksik", en: "Missing" }, ton: "danger" },
  tutarsizlik: { etiket: { tr: "Tutarsızlık", en: "Inconsistency" }, ton: "warning" },
  bakilacak: { etiket: { tr: "Bakılacak", en: "To review" }, ton: "warning" },
  asistan: { etiket: { tr: "Asistan", en: "Assistant" }, ton: "info" },
  yapilmadi: { etiket: { tr: "Yapılmadı", en: "Not done" }, ton: "neutral" },
};

export default async function CalismaDurumKarti({
  projectId,
  kelime,
  ilerleme,
  due,
  duzenleyebilir,
  silebilir,
  kilavuzAc,
  takvimAc = false,
}: {
  projectId: string;
  kelime: number | null;
  ilerleme: KartIlerlemesi | null;
  due: DueInfo | null;
  duzenleyebilir: boolean;
  silebilir: boolean;
  /** Yeni tezde kılavuz eşleşmediyse pencere açık gelir (createProject). */
  kilavuzAc: boolean;
  /** Ana sayfadaki "Takvim" bağlantısından gelindiyse takvim penceresi açık gelir. */
  takvimAc?: boolean;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarih } = await tarihler();
  const [ozet, yapilacaklar, analizler, takvim] = await Promise.all([
    calismaOzeti(projectId),
    acikYapilacaklar(projectId),
    calismaAnalizleri(projectId),
    takvimiGetir(projectId),
  ]);
  const bugun = trGunAnahtari();
  const siradakiKilometre = takvim ? siradakiTas(takvim, bugun) : null;
  /* Teze eklenmeyi bekleyen analizler de "Başka neler var"da: sıraya koyan öğrenci unutmasın. */
  const siradakiAnalizler = analizler.satirlar.filter((a) => a.teze_eklenecek && !a.teze_eklendi);
  const merkez = `/dashboard/editor/${projectId}`;

  if (!ozet || ozet === CALISMA_OKUNAMADI) {
    /* Okunamadı: kayıt yerinde, yalnızca özet çizilemiyor. Yazmaya
       dönmek yine mümkün olmalı. */
    return (
      <article className="gb-kart gb-sutun calisma-durum">
        <p className="gb-bos">
          {t({
            tr: "Bu çalışmanın durumu şu an okunamadı; kaydınız yerinde duruyor. Sayfayı yenileyin ya da doğrudan yazmaya dönün.",
            en: "This work's status could not be loaded right now; your record is safe. Refresh the page or go straight back to writing.",
          })}
        </p>
        <Link href={`${merkez}/write`} className="projects-primary-button button-compact">
          <PenLine size={15} aria-hidden="true" /> {t({ tr: "Yazmaya devam et", en: "Continue writing" })}
        </Link>
      </article>
    );
  }

  const { calisma, hazirlik, tutarsizliklar, kilavuz, uygulanan, kilavuzOkunamadi } = ozet;
  const makale = calisma.project_type === "article";
  const adimlar = siradakiAdimlar(ozet, dil);
  const maddeler = (hazirlik?.items ?? [])
    .filter((madde) => madde.status !== "ok")
    .sort((a, b) => (a.status === "todo" ? 0 : 1) - (b.status === "todo" ? 0 : 1));
  const sirada = siradakiIs({ calismaId: calisma.id, adimlar, eksikler: maddeler, kalanGun: due?.days ?? null, dil });
  const stil = (anahtar: string | null | undefined) => STIL_ETIKETLERI[anahtar ?? ""] ?? anahtar ?? "";
  /*
    Stil çelişkisi listede değil, düğmesiyle birlikte üstte: düzeltmesi
    tek tık ve yanlış stille yazmaya devam etmek her gün büyüyen bir hata.
    Düğme serbest seçim sunmuyor, yalnızca kılavuzun istediğine çeviriyor.
  */
  const stilUyarisi = atifStiliCelisiyorMu(ozet)
    ? t({
        tr: `Çalışmanız ${stil(calisma.citation_style)} olarak ayarlı, ${kilavuz?.kurum ?? "kurumunuzun"} kılavuzu ${stil(kilavuz?.atifStili)} istiyor.`,
        en: `Your work is set to ${stil(calisma.citation_style)}, but ${kilavuz?.kurum ? `the ${kilavuz.kurum}` : "your institution's"} guideline requires ${stil(kilavuz?.atifStili)}.`,
      })
    : null;
  const eksikler = eksikSatirlari({
    calismaId: calisma.id,
    stilUyarisi: null,
    maddeler,
    tutarsizliklar,
    /*
      Asistanın bulguları listeye KENDİLİĞİNDEN girmiyor (26.10.2026).
      Eskiden son kaynakça yorumunun her bulgusu "Asistan" rozetiyle
      burada çıkıyordu; öğrenci "Yapılacaklara ekle"ye basmadığı halde
      eklenmiş sanıyordu. Artık yalnızca kendi seçtiği bulgular, yapılacak
      olarak (calisma_yapilacaklari) görünüyor.
    */
    adimlar,
    sirada,
    dil,
  });

  return (
    <article className="gb-kart gb-sutun calisma-durum" aria-label={t({ tr: `${calisma.title}: durum`, en: `${calisma.title}: status` })}>
      <header className="calisma-durum-bas">
        <div>
          <span className="calisma-durum-ust">
            <span className="status-pill" data-tone={statusTone(calisma.status)}>
              {t(statusLabel(calisma.status))}
            </span>
            {[t(projectTypeLabel(calisma.project_type)), calisma.university].filter(Boolean).join(" · ")}
          </span>
          <h2>{calisma.title}</h2>
        </div>
        <div className="calisma-durum-eylemler">
          {/* Bitince tek tık: tez Word + kaynak PDF'leri + rapor (teslim-paketi.tsx). */}
          {kelime ? <TeslimPaketi projectId={calisma.id} /> : null}
          <Link href={`${merkez}/write`} className="projects-primary-button button-compact">
            <PenLine size={15} aria-hidden="true" />
            {kelime ? t({ tr: "Yazmaya devam et", en: "Continue writing" }) : t({ tr: "Yazmaya başla", en: "Start writing" })}
          </Link>
        </div>
      </header>

      <dl className="tez-olcumler calisma-olcumler">
        <div className="tez-olcu">
          <dt>{t({ tr: "Yazılan", en: "Written" })}</dt>
          <dd>
            {(kelime ?? 0).toLocaleString(YEREL[dil])}
            <small>{t({ tr: "kelime", en: "words" })}</small>
          </dd>
          <span title={ilerleme?.ipucu}>{ilerleme
              ? t({ tr: `%${ilerleme.yuzde} ${ilerleme.etiket}`, en: `${ilerleme.yuzde}% ${ilerleme.etiket}` })
              : t({ tr: "Hedef yok — kılavuz bağlanınca hesaplanır", en: "No target — calculated once a guideline is linked" })}</span>
        </div>
        <div className="tez-olcu" data-tone={due?.tone}>
          <dt>{t({ tr: "Teslim", en: "Due" })}</dt>
          {due ? (
            <>
              <dd>
                {Math.abs(due.days)}
                <small>{due.days < 0 ? t({ tr: "gün gecikti", en: "days overdue" }) : t({ tr: "gün", en: "days" })}</small>
              </dd>
              <span>{calisma.due_date ? tarih(calisma.due_date) : due.label}</span>
            </>
          ) : (
            <>
              <dd>—</dd>
              {duzenleyebilir && !calisma.due_date ? (
                /* Tarih yoksa kart ne kadar vakit kaldığını söyleyemiyor; burada seçilip kaydediliyor (28.10.2026). */
                <TeslimTarihiFormu projectId={calisma.id} bugun={bugun} />
              ) : (
                <span>{calisma.due_date ? tarih(calisma.due_date) : t({ tr: "Tarih belirtilmedi", en: "No date set" })}</span>
              )}
            </>
          )}
        </div>
        <div className="tez-olcu" data-tone={hazirlik && hazirlik.done === hazirlik.total ? "success" : undefined}>
          <dt>{t({ tr: "Teslim hazırlığı", en: "Submission readiness" })}</dt>
          <dd>
            {hazirlik ? `${hazirlik.done}/${hazirlik.total}` : "—"}
          </dd>
          <span>
            {hazirlik
              ? hazirlik.done === hazirlik.total
                ? t({ tr: "Otomatik denetimler temiz", en: "Automatic checks are clean" })
                : t({ tr: "madde hazır", en: "items ready" })
              : t({ tr: "Müsvedde henüz boş", en: "Manuscript is still empty" })}
          </span>
        </div>
      </dl>

      {stilUyarisi ? (
        <div className="asistan-uyari asistan-uyari-eylemli" data-tone="danger" role="alert">
          <span>
            <TriangleAlert size={16} aria-hidden="true" /> {stilUyarisi}
          </span>
          <ActionForm action={atifStiliniKilavuzaUydur.bind(null, calisma.id)} successMessage={t({ tr: "Atıf stili kılavuza göre güncellendi.", en: "Citation style updated to match the guideline." })}>
            <button type="submit" className="projects-filter-button button-compact">
              {t({ tr: "Kılavuza göre düzelt", en: "Fix per guideline" })}
            </button>
          </ActionForm>
        </div>
      ) : null}

      <div className="tez-simdi" data-aciliyet={sirada.aciliyet} data-bitti={sirada.bitti ? "true" : undefined}>
        <span className="sirada-etiket">{sirada.bitti ? t({ tr: "Durum", en: "Status" }) : t({ tr: "Şimdi", en: "Now" })}</span>
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

      {/* Takvimin sıradaki taşı (28.10.2026): plan varsa "şimdi"nin hemen altında. */}
      {siradakiKilometre ? (
        <p className="takvim-sirada" data-durum={siradakiKilometre.durum}>
          <span>{t({ tr: "Sıradaki kilometre taşı", en: "Next milestone" })}</span>
          <b>{siradakiKilometre.tas.baslik}</b>
          <small>
            {tarih(siradakiKilometre.tas.hedef_tarih)} · {kalanMetni(siradakiKilometre.durum, siradakiKilometre.kalanGun, dil)}
          </small>
        </p>
      ) : null}

      <h3 className="calisma-durum-alt">
        {eksikler.length + yapilacaklar.length + siradakiAnalizler.length
          ? t({
              tr: `Başka neler var · ${eksikler.length + yapilacaklar.length + siradakiAnalizler.length}`,
              en: `What else is there · ${eksikler.length + yapilacaklar.length + siradakiAnalizler.length}`,
            })
          : t({ tr: "Başka eksik görünmüyor", en: "Nothing else appears to be missing" })}
      </h3>
      {eksikler.length + yapilacaklar.length + siradakiAnalizler.length ? (
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
                {t({ tr: "Yapılacak", en: "To-do" })}
              </span>
              <ActionForm action={yapilacakTamamla.bind(null, madde.id)} successMessage={t({ tr: "Tamamlandı olarak işaretlendi.", en: "Marked as done." })}>
                <button type="submit" className="projects-filter-button button-compact" aria-label={t({ tr: `${madde.baslik}: yaptım`, en: `${madde.baslik}: done` })}>
                  <Check size={14} aria-hidden="true" /> {t({ tr: "Yaptım", en: "Done" })}
                </button>
              </ActionForm>
            </li>
          ))}
          {siradakiAnalizler.map((analiz) => (
            <ListeSatiri
              key={analiz.id}
              href={`${merkez}/write`}
              baslik={analiz.baslik}
              alt={t({
                tr: "Editörde araç çubuğundaki “Analiz sonucu ekle” ile imlecin olduğu yere ekleyin.",
                en: "In the editor, use “Insert analysis result” on the toolbar to add it at the cursor.",
              })}
              onizleme
              sag={
                <span className="status-pill" data-tone="info">
                  {t({ tr: "Teze eklenecek", en: "To add to thesis" })}
                </span>
              }
            />
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
                  {t(TUR[satir.tur].etiket)}
                </span>
              }
            />
          ))}
        </ul>
      ) : (
        <p className="gb-bos">
          {t({
            tr: "Kaydedilmiş metinde, kaynaklarda ve teslim listesinde açık bir madde yok. Otomatik denetim danışmanınızın kontrolünün yerini tutmaz.",
            en: "No open items in the saved text, sources or submission checklist. Automatic checks do not replace your advisor's review.",
          })}
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
            <FileText size={15} aria-hidden="true" /> {t({ tr: "Makale ve dergi", en: "Article and journal" })}
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
        {takvim ? (
          <TezTakvimiPenceresi
            projectId={calisma.id}
            projeTuru={calisma.project_type}
            taslar={takvim}
            teslimTarihi={calisma.due_date ?? null}
            bugun={bugun}
            duzenleyebilir={duzenleyebilir}
            acikBasla={takvimAc}
          />
        ) : null}
        {/* Çalışmanın birimleri iş akışı sırasıyla: literatür → kaynakça → kanıt → analiz. */}
        <LiteraturPenceresi projectId={calisma.id} projeAdi={calisma.title} />
        <KaynakcaPenceresi calisma={calisma} sonDenetim={ozet.kaynakca} />
        <KanitMatrisiPenceresi projectId={calisma.id} />
        <AnalizPenceresi projectId={calisma.id} projeAdi={calisma.title} />
        {/* Ayda bir yapılan işler menüde; menü yukarı açılıyor, kartın içinde kalıyor. */}
        <details className="kart-menu">
          <summary aria-label={t({ tr: `${calisma.title}: diğer işlemler`, en: `${calisma.title}: more actions` })}>
            <MoreHorizontal size={18} aria-hidden="true" />
          </summary>
          <div className="kart-menu-liste">
            {duzenleyebilir ? (
              <Link href={`${merkez}/edit`}>
                <Pencil size={15} aria-hidden="true" />
                {t({ tr: "Bilgileri düzenle", en: "Edit details" })}
              </Link>
            ) : null}
            <Link href={`/dashboard/documents?calisma=${calisma.id}`}>
              <Upload size={15} aria-hidden="true" />
              {t({ tr: "Belge yükle", en: "Upload document" })}
            </Link>
            {silebilir ? <DeleteProjectButton projectId={calisma.id} projectTitle={calisma.title} /> : null}
          </div>
        </details>
      </footer>
    </article>
  );
}
