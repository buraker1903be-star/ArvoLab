import Link from "next/link";
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
import { trTarih, trTarihSaat } from "@/lib/tr-time";

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
const BULGU_ETIKETI: Record<string, string> = { uyari: "Eksik", oneri: "Öneri", bilgi: "Not" };

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
          <span className="dashboard-kicker">Bağlantı sorunu</span>
          <div className="resume-heading">
            <h2>Çalışma yüklenemedi</h2>
            <p>Kaydınız yerinde duruyor. Sayfayı yenileyin; sorun sürerse destekten bildirin.</p>
          </div>
          <div className="cluster">
            <Link href="/dashboard/editor" className="projects-filter-button">Çalışmalarım</Link>
            <Link href="/dashboard/expert-requests" className="projects-filter-button">Uygulama Destek</Link>
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
  const adimlar = siradakiAdimlar(ozet);
  const ilerleme = birimIlerlemesi(adimlar);

  const eksikSayisi = eksikMaddeler.filter((madde) => madde.status === "todo").length;
  const teslimNotu =
    [eksikSayisi ? `${eksikSayisi} eksik` : "", eksikMaddeler.length - eksikSayisi ? `${eksikMaddeler.length - eksikSayisi} bakılacak` : ""]
      .filter(Boolean)
      .join(" · ") || "Bütün maddeler hazır";
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
          <span className="dashboard-kicker">{projectTypeLabel(calisma.project_type)}</span>
          <h1>{calisma.title}</h1>
          <p>
            {[calisma.university, calisma.institute, calisma.department].filter(Boolean).join(" · ") ||
              "Kurum bilgisi girilmemiş"}
            {calisma.due_date ? ` · Teslim: ${trTarih(calisma.due_date)}` : ""}
          </p>
        </div>
        <div className="merkez-ust-eylemler">
          <Link href={`/dashboard/editor/${calisma.id}/write`} className="projects-primary-button">
            <PenLine size={16} aria-hidden="true" /> Yazmaya devam et
          </Link>
          <Link href={`/dashboard/editor/${calisma.id}/edit`} className="projects-filter-button">
            <Settings2 size={16} aria-hidden="true" /> Çalışma ayarları
          </Link>
          {/* Kurum çalışanı da teslim paketini buradan indirir (kurum sahibinin isteği). */}
          <TeslimPaketi projectId={calisma.id} className="projects-filter-button" />
        </div>
      </section>

      <CalismaSekmeleri calisma={calisma} aktif="merkez" />

      <section className="merkez-ozet">
        <article className="merkez-kutu">
          <small>Durum</small>
          <strong>{statusLabel(calisma.status)}</strong>
          <span>Birim ilerlemesi %{ilerleme}</span>
        </article>
        <article className="merkez-kutu">
          <small>Teslim hazırlığı</small>
          <strong>{hazirlik ? `${hazirlik.done}/${hazirlik.total}` : "—"}</strong>
          <span>{hazirlik ? (hazirlik.done === hazirlik.total ? "Hazır görünüyor" : "madde hazır") : "Müsvedde yok"}</span>
        </article>
        <article className="merkez-kutu">
          <small>Asistan denetimi</small>
          <strong>{asistan.toplam}</strong>
          <span>{asistan.sonTarih ? `Son: ${trTarihSaat(asistan.sonTarih)}` : "Henüz denetim yok"}</span>
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
            Çalışmanız <b>{STIL_ETIKETLERI[calisma.citation_style] ?? calisma.citation_style}</b> olarak ayarlı,
            ancak {kilavuz?.kurum} kılavuzu{" "}
            <b>{STIL_ETIKETLERI[kilavuz?.atifStili ?? ""] ?? kilavuz?.atifStili}</b> istiyor. Kılavuz bu çalışma
            için geçerli değilse çalışma ayarlarından kurumu düzeltin.
          </span>
          <ActionForm
            action={atifStiliniKilavuzaUydur.bind(null, calisma.id)}
            successMessage="Atıf stili kılavuza göre güncellendi."
          >
            <button type="submit" className="projects-filter-button button-compact">
              Kılavuza göre düzelt
            </button>
          </ActionForm>
        </div>
      )}

      <section className="section mt-lg">
        <h2 className="section-title">Sıradaki adımlar</h2>
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
                  {adim.zaman ? <small>Son hareket: {trTarihSaat(adim.zaman)}</small> : null}
                </span>
                <Link href={adim.href} className="merkez-adim-baglanti">
                  {adim.tamam ? "Görüntüle" : "Başla"} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="section">
        <h2 className="section-title">Kontroller ve kayıtlar</h2>
        <div className="calisma-karolari">
          {hazirlik ? (
            <PanelDrawer
              triggerLabel="Teslim öncesi bakılacaklar"
              triggerNote={teslimNotu}
              triggerIcon={<ListChecks size={18} aria-hidden="true" />}
              triggerClassName="merkez-baglanti"
              kicker="Teslim hazırlığı"
              title="Teslim öncesi bakılacaklar"
              description="Editördeki “Teslim kontrolü” ile aynı liste; kaydedilmiş metinden hesaplanır."
              basaridaKapan={false}
            >
              {eksikMaddeler.length ? (
                <ul className="asistan-bulgular">
                  {eksikMaddeler.map((madde) => (
                    <li className="asistan-bulgu" data-tone={madde.status === "todo" ? "danger" : "warning"} key={madde.id}>
                      <span className="asistan-bulgu-etiket">{madde.status === "todo" ? "Eksik" : "Bakılacak"}</span>
                      <span className="asistan-bulgu-metin">
                        <b>{madde.label}</b>
                        {madde.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Kaydedilmiş metinde eksik bir madde görünmüyor.</p>
              )}
            </PanelDrawer>
          ) : null}

          {/* Metin ile literatür listesinin karşılaştırması kendiliğinden çalışır; boşsa karo çizilmez. */}
          {tutarsizliklar.length > 0 && (
            <PanelDrawer
              triggerLabel="Birimler arası tutarsızlıklar"
              triggerNote={`${tutarsizliklar.length} tutarsızlık`}
              triggerIcon={<TriangleAlert size={18} aria-hidden="true" />}
              triggerClassName="merkez-baglanti"
              kicker="Otomatik karşılaştırma"
              title="Birimler arası tutarsızlıklar"
              description="Metniniz ile literatür listeniz karşılaştırıldı; hiçbir şey yapıştırmanız gerekmez."
              basaridaKapan={false}
            >
              <ul className="asistan-bulgular">
                {tutarsizliklar.map((sorun) => (
                  <li className="asistan-bulgu" data-tone="warning" key={sorun.tur}>
                    <span className="asistan-bulgu-etiket">Tutarsızlık</span>
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
              triggerLabel="Asistanın son bulguları"
              triggerNote={`${asistan.sonBulgular.length} bulgu`}
              triggerIcon={<Sparkles size={18} aria-hidden="true" />}
              triggerClassName="merkez-baglanti"
              kicker="Asistan"
              title="Asistanın son bulguları"
              basaridaKapan={false}
            >
              <ul className="asistan-bulgular">
                {asistan.sonBulgular.map((bulgu, index) => (
                  <li className="asistan-bulgu" data-tone={BULGU_TONU[bulgu.tur] ?? "info"} key={index}>
                    <span className="asistan-bulgu-etiket">{BULGU_ETIKETI[bulgu.tur] ?? "Not"}</span>
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
              <b>Uzman desteği</b>
              {danismanlikSayisi ? `${danismanlikSayisi} talep açıldı` : "Talep yok"}
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
