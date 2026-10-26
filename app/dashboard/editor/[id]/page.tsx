import Link from "next/link";
import { notFound } from "next/navigation";
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
import { calismaKilavuzu } from "@/lib/guideline-rules";
import { bicimOzeti } from "@/lib/kilavuz-dogrulama";
import { kilavuzuKaldir } from "@/app/actions/calisma-kilavuzu";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import KilavuzYukle from "./kilavuz-yukle";
import CalismaSekmeleri from "./calisma-sekmeleri";
import { createClient } from "@/lib/supabase/server";
import ActionForm from "@/app/dashboard/action-form";
import { CALISMA_OKUNAMADI, atifStiliCelisiyorMu, birimIlerlemesi, siradakiAdimlar } from "@/lib/calisma-ozeti";
import { STIL_ETIKETLERI } from "@/lib/atif/stiller";
import { projectTypeLabel, statusLabel } from "@/lib/project-labels";
import { trTarih, trTarihSaat } from "@/lib/tr-time";

/*
  Çalışma merkezi: bir tezin/makalenin bütün birimleri tek sayfada.

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

export default async function CalismaMerkezi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
            <Link href="/dashboard/support" className="projects-filter-button">Uygulama Destek</Link>
          </div>
        </article>
      </main>
    );
  }
  if (!ozet) notFound();

  const { calisma, danismanlikSayisi, asistan, kilavuz, kilavuzOkunamadi, tutarsizliklar, hazirlik } = ozet;
  const stilCelisiyor = atifStiliCelisiyorMu(ozet);
  // Eksikler önce, bakılması gerekenler sonra (ana sayfadaki sıralamanın aynısı).
  const eksikMaddeler = (hazirlik?.items ?? [])
    .filter((madde) => madde.status !== "ok")
    .sort((a, b) => (a.status === "todo" ? 0 : 1) - (b.status === "todo" ? 0 : 1));
  /*
    EKRANDA GÖRÜNEN KILAVUZ, UYGULANAN kılavuzdur. ozet.kilavuz
    yalnızca kataloğa bakıyor; öğrenci kendi kılavuzunu yüklediyse
    editörde kurallar işliyor ama bu kart "bulunamadı" diyordu.
  */
  const uygulanan = await calismaKilavuzu(await createClient(), calisma.id, calisma.guideline_id);

  /*
    Biçim kuralları doğrulama ekranındakiyle AYNI cümlelerle yazılıyor
    (lib/kilavuz-dogrulama). Öğrenci onayladığı satırı burada tanıyor;
    iki ayrı yazım, aynı kuralı iki ayrı kural gibi gösterirdi.
  */
  const bicimSatirlari = uygulanan ? bicimOzeti(uygulanan.settings) : [];

  const adimlar = siradakiAdimlar(ozet);
  const ilerleme = birimIlerlemesi(adimlar);

  const eksikSayisi = eksikMaddeler.filter((madde) => madde.status === "todo").length;
  const teslimNotu =
    [eksikSayisi ? `${eksikSayisi} eksik` : "", eksikMaddeler.length - eksikSayisi ? `${eksikMaddeler.length - eksikSayisi} bakılacak` : ""]
      .filter(Boolean)
      .join(" · ") || "Bütün maddeler hazır";
  const kilavuzNotu = uygulanan
    ? uygulanan.dogrulandi
      ? uygulanan.label
      : "Kendi yüklediğiniz kılavuz kullanılıyor"
    : kilavuzOkunamadi
      ? "Kılavuz aranamadı; sayfayı yenileyin"
      : calisma.university
        ? "Onaylı kılavuz yok — kendi kılavuzunuzu yükleyin"
        : "Çalışma ayarlarından kurumu girin";

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

          {/*
            KILAVUZ TEK PENCEREDE. Eskiden "bağlı kayıtlar"daki karo
            kataloğa gidiyordu, yüklenen kılavuz ve yükleme teklifi ise iki
            ayrı bölümdü. Öğrencinin yüklediği kılavuz katalogda DEĞİL
            (çalışmaya bağlı ayrı tablo); karo onu kataloğa göndermemeli.
            Kılavuz okunamadıysa yükleme teklif edilmiyor: geçici bir
            arıza, kurumunun kılavuzu olan öğrenciye kendi dosyasını
            yükletmemeli.
          */}
          <PanelDrawer
            triggerLabel="Yazım kılavuzu"
            triggerNote={kilavuzNotu}
            triggerIcon={<BookOpenCheck size={18} aria-hidden="true" />}
            triggerClassName="merkez-baglanti"
            kicker="Tez yazım kılavuzu"
            title={uygulanan ? uygulanan.label : "Kılavuz"}
            description={
              uygulanan
                ? uygulanan.dogrulandi
                  ? "Kurumunuzun onaylı kılavuzu; kurallar editörde kendiliğinden uygulanıyor."
                  : "Kurallar yüklediğiniz dosyadan çıkarıldı ve sizin onayınızla uygulanıyor; kurumunuzun resmî onayından geçmedi."
                : "Kurumunuzun onaylı kılavuzu henüz eklenmemiş."
            }
            boy="genis"
            basaridaKapan={false}
          >
            {uygulanan ? (
              <div className="kilavuz-bicim">
                <ul>
                  <li>Kaynakça sistemi: {STIL_ETIKETLERI[uygulanan.citationStyle] ?? uygulanan.citationStyle}</li>
                  {uygulanan.requiredSections.length > 0 ? <li>Zorunlu bölümler: {uygulanan.requiredSections.join(", ")}</li> : null}
                  {uygulanan.minPages || uygulanan.maxPages ? (
                    <li>
                      Uzunluk: {uygulanan.minPages ?? "?"}–{uygulanan.maxPages ?? "?"} sayfa
                    </li>
                  ) : null}
                  {bicimSatirlari.map((satir) => (
                    <li key={satir}>{satir}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {uygulanan?.dogrulandi ? (
              <Link href="/dashboard/guidelines" className="projects-filter-button mt-sm">
                Kılavuz kataloğunu aç
              </Link>
            ) : null}

            {uygulanan && !uygulanan.dogrulandi ? (
              <>
                {/*
                  Onay metni ÖLÇÜLEREK yazıldı: kılavuz kalkınca sayfa düzeni
                  geri dönmüyor (lib/guideline-sync, mode:"none"). "Biçiminiz
                  bozulacak" demek olmayan bir şeyden korkuturdu.
                */}
                <ActionForm
                  className="mt-sm"
                  action={kilavuzuKaldir}
                  confirmMessage="Kılavuz kaldırılsın mı? Belgenizin sayfa düzeni olduğu gibi kalır; yalnızca belge kontrolü ve teslim listesi kurallara göre denetlenemez olur."
                  successMessage="Kılavuz kaldırıldı."
                >
                  <input type="hidden" name="projectId" value={calisma.id} />
                  <button type="submit" className="button-danger">
                    Kılavuzu kaldır
                  </button>
                </ActionForm>
                <details className="form-details mt-md">
                  <summary>Başka dosya yükle</summary>
                  <KilavuzYukle projectId={calisma.id} />
                </details>
              </>
            ) : null}

            {!uygulanan && !kilavuzOkunamadi ? (
              <>
                <p className="muted">
                  Kendi kılavuzunuzu yükleyin; kuralları okuyup size onaylatayım, sonra editörde kendiliğinden
                  uygulansın. Bu, kurumunuzun resmî onayı yerine geçmez.
                </p>
                <KilavuzYukle projectId={calisma.id} />
              </>
            ) : null}
          </PanelDrawer>

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
