import Link from "next/link";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  FileCheck2,
  ListChecks,
  PenLine,
  Quote,
  Settings2,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { calismaOzeti } from "@/app/actions/calisma-merkezi";
import { atifStiliniKilavuzaUydur } from "@/app/actions/projects";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import KilavuzPenceresi from "./kilavuz-penceresi";
import TeslimPaketi from "@/app/dashboard/_components/teslim-paketi";
import CalismaSekmeleri from "./calisma-sekmeleri";
import { getCurrentProfile } from "@/app/actions/profile";
import { sayfaGorunumu } from "@/lib/onizleme-sunucu";
import { calismaAdresi } from "@/lib/calisma-karti";
import ActionForm from "@/app/dashboard/action-form";
import { CALISMA_OKUNAMADI, atifStiliCelisiyorMu, birimIlerlemesi, siradakiAdimlar } from "@/lib/calisma-ozeti";
import { STIL_ETIKETLERI } from "@/lib/atif/stiller";
import { isOversightRole, projectTypeLabel, statusLabel, STAFF_ROLES } from "@/lib/project-labels";

/*
  ÇALIŞMA ÖZETİ (personel): bir tezin/makalenin bütün birimleri tek sayfada.

  ÖĞRENCİ BU SAYFAYI GÖRMÜYOR (26.10.2026, kurum sahibinin kararı:
  "Çalışma merkezi gereksiz bir sayfa değil mi, zaten karta
  yerleştirdik"). Özet, eksikler ve kılavuz Çalışmalarım'daki durum
  kartında (calisma-durum-karti.tsx); öğrenci bu adrese gelirse oraya,
  çalışması seçili olarak yönleniyor. Adres kalkmadı: editörden,
  birimlerin şeridinden ve eski bağlantılardan gelen yollar kırılmasın.

  Onay ve atama yetkisi olan personel burada kalıyor: Çalışmalarım'da
  onların düzeni liste kartları, sağda durum kartı yok.

  ArvoLab'ın birimleri veritabanında zaten bu çalışmaya bağlıydı
  (literature_sources, citation_checks, document_uploads,
  project_manuscripts, consultancy_requests) ama arayüzde birbirini
  görmüyordu: kullanıcı literatürü bir sayfada topluyor, kaynakçayı başka
  sayfada denetliyor, ikisinin aynı çalışmaya ait olduğunu yalnızca kendi
  aklında tutuyordu. Burası o bağı görünür kılar.
*/

const BULGU_TONU: Record<string, string> = { uyari: "danger", oneri: "warning", bilgi: "info" };
const BULGU_ETIKETI: Record<string, Metin> = {
  uyari: { tr: "Eksik", en: "Missing" },
  oneri: { tr: "Öneri", en: "Suggestion" },
  bilgi: { tr: "Not", en: "Note" },
};

const ADIM_SIMGESI: Record<string, typeof PenLine> = {
  literatur: BookOpenCheck,
  yazim: PenLine,
  kaynakca: Quote,
  belge: FileCheck2,
};

export default async function CalismaMerkezi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarih, tarihSaat } = await tarihler();
  const [{ id }, sorgu, profil] = await Promise.all([params, searchParams, getCurrentProfile()]);
  // Yeni tezde kılavuz eşleşmediyse kayıt buraya ?kilavuz=1 ile geliyor (createProject).
  const kilavuzAc = sorgu.kilavuz === "1";
  const gorunum = await sayfaGorunumu({
    rol: profil?.role,
    personelRolu: profil?.role ? STAFF_ROLES.includes(profil.role) : false,
    kurumVar: Boolean(profil?.organization_id),
  });
  if (!(isOversightRole(profil?.role) && gorunum.personel)) redirect(calismaAdresi(id, { kilavuz: kilavuzAc }));

  const ozet = await calismaOzeti(id);
  /*
    Okunamadı ile bulunamadı AYRI. Eskiden ikisi de notFound() çiziyordu:
    geçici bir arızada kullanıcıya tezinin olmadığı söyleniyordu. Kayıt
    yerinde; söylenmesi gereken tek şey okumanın başarısız olduğu.
  */
  if (ozet === CALISMA_OKUNAMADI) {
    return (
      <main className="dashboard-page">
        <article className="resume-card" role="alert">
          <span className="dashboard-kicker">{t({ tr: "Bağlantı sorunu", en: "Connection problem" })}</span>
          <div className="resume-heading">
            <h2>{t({ tr: "Çalışma yüklenemedi", en: "The work could not be loaded" })}</h2>
            <p>
              {t({
                tr: "Kaydınız yerinde duruyor. Sayfayı yenileyin; sorun sürerse destekten bildirin.",
                en: "Your record is safe. Refresh the page; if the problem persists, report it to support.",
              })}
            </p>
          </div>
          <div className="cluster">
            <Link href="/dashboard/editor" className="projects-filter-button">
              {t({ tr: "Çalışmalarım", en: "My works" })}
            </Link>
            <Link href="/dashboard/expert-requests" className="projects-filter-button">
              {t({ tr: "Uygulama Destek", en: "App Support" })}
            </Link>
          </div>
        </article>
      </main>
    );
  }
  if (!ozet) notFound();

  const { calisma, danismanlikSayisi, asistan, kilavuz, kilavuzOkunamadi, tutarsizliklar, hazirlik, uygulanan } = ozet;
  const stilCelisiyor = atifStiliCelisiyorMu(ozet);
  // Eksikler önce, bakılması gerekenler sonra (ana sayfadaki sıralamanın aynısı).
  const eksikMaddeler = (hazirlik?.items ?? [])
    .filter((madde) => madde.status !== "ok")
    .sort((a, b) => (a.status === "todo" ? 0 : 1) - (b.status === "todo" ? 0 : 1));
  const adimlar = siradakiAdimlar(ozet, dil);
  const ilerleme = birimIlerlemesi(adimlar);

  const eksikSayisi = eksikMaddeler.filter((madde) => madde.status === "todo").length;
  const teslimNotu =
    [
      eksikSayisi ? t({ tr: `${eksikSayisi} eksik`, en: `${eksikSayisi} missing` }) : "",
      eksikMaddeler.length - eksikSayisi
        ? t({ tr: `${eksikMaddeler.length - eksikSayisi} bakılacak`, en: `${eksikMaddeler.length - eksikSayisi} to review` })
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || t({ tr: "Bütün maddeler hazır", en: "All items ready" });
  /*
    SADE MERKEZ (26.10.2026, kurum sahibinin isteği: "kalabalık
    karmaşık yapıdan kurtulalım, ArvoOS gibi açılır pencereler").

    Sayfa eskiden yedi bölümü alt alta diziyordu: tutarsızlıklar,
    birimler, asistan bulguları, teslim listesi, bağlı kayıtlar ve iki
    ayrı kılavuz kartı. Öğrencinin her gün baktığı iki şey — özet ve
    sıradaki adımlar — sayfanın ortasında kayboluyordu. Şimdi sayfada
    yalnızca onlar duruyor; geri kalanı ArvoOS'taki gibi karolar ve
    tıklayınca açılan pencereler. Karo, içinde ne olduğunu ikinci
    satırda SÖYLÜYOR ("3 madde eksik"): pencereyi açmadan bakılması
    gerekip gerekmediği anlaşılsın.
  */
  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">{t(projectTypeLabel(calisma.project_type))}</span>
          <h1>{calisma.title}</h1>
          <p>
            {[calisma.university, calisma.institute, calisma.department].filter(Boolean).join(" · ") ||
              t({ tr: "Kurum bilgisi girilmemiş", en: "No institution entered" })}
            {calisma.due_date ? t({ tr: ` · Teslim: ${tarih(calisma.due_date)}`, en: ` · Due: ${tarih(calisma.due_date)}` }) : ""}
          </p>
        </div>
        <div className="merkez-ust-eylemler">
          <Link href={`/dashboard/editor/${calisma.id}/write`} className="projects-primary-button">
            <PenLine size={16} aria-hidden="true" /> {t({ tr: "Yazmaya devam et", en: "Continue writing" })}
          </Link>
          <Link href={`/dashboard/editor/${calisma.id}/edit`} className="projects-filter-button">
            <Settings2 size={16} aria-hidden="true" /> {t({ tr: "Çalışma ayarları", en: "Work settings" })}
          </Link>
          {/* Kurum çalışanı da teslim paketini buradan indirir (kurum sahibinin isteği). */}
          <TeslimPaketi projectId={calisma.id} className="projects-filter-button" />
        </div>
      </section>

      <CalismaSekmeleri calisma={calisma} aktif="merkez" />

      <section className="merkez-ozet">
        <article className="merkez-kutu">
          <small>{t({ tr: "Durum", en: "Status" })}</small>
          <strong>{t(statusLabel(calisma.status))}</strong>
          <span>{t({ tr: `Birim ilerlemesi %${ilerleme}`, en: `Unit progress ${ilerleme}%` })}</span>
        </article>
        <article className="merkez-kutu">
          <small>{t({ tr: "Teslim hazırlığı", en: "Submission readiness" })}</small>
          <strong>{hazirlik ? `${hazirlik.done}/${hazirlik.total}` : "—"}</strong>
          <span>
            {hazirlik
              ? hazirlik.done === hazirlik.total
                ? t({ tr: "Hazır görünüyor", en: "Looks ready" })
                : t({ tr: "madde hazır", en: "items ready" })
              : t({ tr: "Müsvedde yok", en: "No manuscript" })}
          </span>
        </article>
        <article className="merkez-kutu">
          <small>{t({ tr: "Asistan denetimi", en: "Assistant checks" })}</small>
          <strong>{asistan.toplam}</strong>
          <span>
            {asistan.sonTarih
              ? t({ tr: `Son: ${tarihSaat(asistan.sonTarih)}`, en: `Last: ${tarihSaat(asistan.sonTarih)}` })
              : t({ tr: "Henüz denetim yok", en: "No checks yet" })}
          </span>
        </article>
      </section>

      {/*
        UYARI DÜZELTİLEBİLİR: stil, kılavuz bağlanırken tetikleyiciyle
        yazılıyor; kılavuzun yeni sürümü başka bir stille onaylanınca
        çalışma eski stilde kalıyor. Düğme serbest seçim sunmuyor,
        yalnızca kılavuzun istediğine çeviriyor. Karoya taşınmadı: yanlış
        stille yazmaya devam etmek her gün büyüyen bir hata.
      */}
      {stilCelisiyor && (
        <div className="asistan-uyari asistan-uyari-eylemli mt-md" data-tone="danger" role="alert">
          <span>
            <TriangleAlert size={16} aria-hidden="true" />{" "}
            {dil === "en" ? (
              <>
                Your work is set to <b>{STIL_ETIKETLERI[calisma.citation_style] ?? calisma.citation_style}</b>, but the{" "}
                {kilavuz?.kurum} guideline requires <b>{STIL_ETIKETLERI[kilavuz?.atifStili ?? ""] ?? kilavuz?.atifStili}</b>. If
                the guideline does not apply to this work, correct the institution in the work settings.
              </>
            ) : (
              <>
                Çalışmanız <b>{STIL_ETIKETLERI[calisma.citation_style] ?? calisma.citation_style}</b> olarak ayarlı,
                ancak {kilavuz?.kurum} kılavuzu{" "}
                <b>{STIL_ETIKETLERI[kilavuz?.atifStili ?? ""] ?? kilavuz?.atifStili}</b> istiyor. Kılavuz bu çalışma
                için geçerli değilse çalışma ayarlarından kurumu düzeltin.
              </>
            )}
          </span>
          <ActionForm
            action={atifStiliniKilavuzaUydur.bind(null, calisma.id)}
            successMessage={t({ tr: "Atıf stili kılavuza göre güncellendi.", en: "Citation style updated to match the guideline." })}
          >
            <button type="submit" className="projects-filter-button button-compact">
              {t({ tr: "Kılavuza göre düzelt", en: "Fix per guideline" })}
            </button>
          </ActionForm>
        </div>
      )}

      <section className="section mt-lg">
        <h2 className="section-title">{t({ tr: "Sıradaki adımlar", en: "Next steps" })}</h2>
        <ol className="merkez-adimlar mt-md">
          {adimlar.map((adim) => {
            const Simge = ADIM_SIMGESI[adim.anahtar] ?? PenLine;
            return (
              <li className="merkez-adim" data-tamam={adim.tamam} key={adim.anahtar}>
                <span className="merkez-adim-simge" aria-hidden="true">
                  {adim.tamam ? <Check size={16} /> : <Simge size={16} />}
                </span>
                <span className="merkez-adim-metin">
                  <b>{adim.baslik}</b>
                  {adim.aciklama}
                  {adim.zaman ? (
                    <small>{t({ tr: `Son hareket: ${tarihSaat(adim.zaman)}`, en: `Last activity: ${tarihSaat(adim.zaman)}` })}</small>
                  ) : null}
                </span>
                <Link href={adim.href} className="merkez-adim-baglanti">
                  {adim.tamam ? t({ tr: "Görüntüle", en: "View" }) : t({ tr: "Başla", en: "Start" })} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="section">
        <h2 className="section-title">{t({ tr: "Kontroller ve kayıtlar", en: "Checks and records" })}</h2>
        <div className="calisma-karolari">
          {hazirlik ? (
            <PanelDrawer
              triggerLabel={t({ tr: "Teslim öncesi bakılacaklar", en: "To review before submission" })}
              triggerNote={teslimNotu}
              triggerIcon={<ListChecks size={18} aria-hidden="true" />}
              triggerClassName="merkez-baglanti"
              kicker={t({ tr: "Teslim hazırlığı", en: "Submission readiness" })}
              title={t({ tr: "Teslim öncesi bakılacaklar", en: "To review before submission" })}
              description={t({
                tr: "Editördeki “Teslim kontrolü” ile aynı liste; kaydedilmiş metinden hesaplanır.",
                en: "The same list as “Submission check” in the editor; calculated from the saved text.",
              })}
              basaridaKapan={false}
            >
              {eksikMaddeler.length ? (
                <ul className="asistan-bulgular">
                  {eksikMaddeler.map((madde) => (
                    <li className="asistan-bulgu" data-tone={madde.status === "todo" ? "danger" : "warning"} key={madde.id}>
                      <span className="asistan-bulgu-etiket">{madde.status === "todo" ? t({ tr: "Eksik", en: "Missing" }) : t({ tr: "Bakılacak", en: "To review" })}</span>
                      <span className="asistan-bulgu-metin">
                        <b>{madde.label}</b>
                        {madde.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{t({ tr: "Kaydedilmiş metinde eksik bir madde görünmüyor.", en: "No missing items in the saved text." })}</p>
              )}
            </PanelDrawer>
          ) : null}

          {/* Metin ile literatür listesinin karşılaştırması kendiliğinden çalışır; boşsa karo çizilmez. */}
          {tutarsizliklar.length > 0 && (
            <PanelDrawer
              triggerLabel={t({ tr: "Birimler arası tutarsızlıklar", en: "Inconsistencies between units" })}
              triggerNote={t({
                tr: `${tutarsizliklar.length} tutarsızlık`,
                en: `${tutarsizliklar.length} inconsistenc${tutarsizliklar.length === 1 ? "y" : "ies"}`,
              })}
              triggerIcon={<TriangleAlert size={18} aria-hidden="true" />}
              triggerClassName="merkez-baglanti"
              kicker={t({ tr: "Otomatik karşılaştırma", en: "Automatic comparison" })}
              title={t({ tr: "Birimler arası tutarsızlıklar", en: "Inconsistencies between units" })}
              description={t({
                tr: "Metniniz ile literatür listeniz karşılaştırıldı; hiçbir şey yapıştırmanız gerekmez.",
                en: "Your text was compared with your literature list; you don't need to paste anything.",
              })}
              basaridaKapan={false}
            >
              <ul className="asistan-bulgular">
                {tutarsizliklar.map((sorun) => (
                  <li className="asistan-bulgu" data-tone="warning" key={sorun.tur}>
                    <span className="asistan-bulgu-etiket">{t({ tr: "Tutarsızlık", en: "Inconsistency" })}</span>
                    <span className="asistan-bulgu-metin">
                      <b>{sorun.baslik}</b>
                      {sorun.aciklama}
                    </span>
                  </li>
                ))}
              </ul>
            </PanelDrawer>
          )}

          {asistan.sonBulgular.length > 0 && (
            <PanelDrawer
              triggerLabel={t({ tr: "Asistanın son bulguları", en: "Assistant's latest findings" })}
              triggerNote={t({
                tr: `${asistan.sonBulgular.length} bulgu`,
                en: `${asistan.sonBulgular.length} finding${asistan.sonBulgular.length === 1 ? "" : "s"}`,
              })}
              triggerIcon={<Sparkles size={18} aria-hidden="true" />}
              triggerClassName="merkez-baglanti"
              kicker={t({ tr: "Asistan", en: "Assistant" })}
              title={t({ tr: "Asistanın son bulguları", en: "Assistant's latest findings" })}
              basaridaKapan={false}
            >
              <ul className="asistan-bulgular">
                {asistan.sonBulgular.map((bulgu, index) => (
                  <li className="asistan-bulgu" data-tone={BULGU_TONU[bulgu.tur] ?? "info"} key={index}>
                    <span className="asistan-bulgu-etiket">{t(BULGU_ETIKETI[bulgu.tur] ?? BULGU_ETIKETI.bilgi)}</span>
                    <span className="asistan-bulgu-metin">
                      <b>{bulgu.baslik}</b>
                      {bulgu.aciklama}
                    </span>
                  </li>
                ))}
              </ul>
            </PanelDrawer>
          )}

          <KilavuzPenceresi
            calisma={calisma}
            uygulanan={uygulanan}
            kilavuzOkunamadi={kilavuzOkunamadi}
            acikBasla={kilavuzAc}
          />

          <Link href="/dashboard/expert-requests" className="merkez-baglanti">
            <Users size={18} aria-hidden="true" />
            <span>
              <b>{t({ tr: "Uzman desteği", en: "Expert support" })}</b>
              {danismanlikSayisi
                ? t({
                    tr: `${danismanlikSayisi} talep açıldı`,
                    en: `${danismanlikSayisi} request${danismanlikSayisi === 1 ? "" : "s"} opened`,
                  })
                : t({ tr: "Talep yok", en: "No requests" })}
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
