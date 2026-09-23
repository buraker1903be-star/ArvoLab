import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  FileCheck2,
  PenLine,
  Quote,
  Settings2,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { calismaOzeti } from "@/app/actions/calisma-merkezi";
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

  const { calisma, musvedde, literatur, kaynakca, belgeSayisi, danismanlikSayisi, asistan, kilavuz, kilavuzOkunamadi, tutarsizliklar, hazirlik } = ozet;
  const stilCelisiyor = atifStiliCelisiyorMu(ozet);
  // Eksikler önce, bakılması gerekenler sonra (ana sayfadaki sıralamanın aynısı).
  const eksikMaddeler = (hazirlik?.items ?? [])
    .filter((madde) => madde.status !== "ok")
    .sort((a, b) => (a.status === "todo" ? 0 : 1) - (b.status === "todo" ? 0 : 1));
  const adimlar = siradakiAdimlar(ozet);
  const ilerleme = birimIlerlemesi(adimlar);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">
            {projectTypeLabel(calisma.project_type)}
          </span>
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

      <section className="merkez-ozet">
        <article className="merkez-kutu">
          <small>Durum</small>
          <strong>{statusLabel(calisma.status)}</strong>
          <span>Birim ilerlemesi %{ilerleme}</span>
        </article>
        <article className="merkez-kutu">
          <small>Müsvedde</small>
          <strong>{(musvedde?.kelime ?? 0).toLocaleString("tr-TR")} kelime</strong>
          <span>{musvedde ? `Son kayıt ${trTarihSaat(musvedde.guncellendi)}` : "Henüz yazılmadı"}</span>
        </article>
        <article className="merkez-kutu">
          <small>Literatür</small>
          <strong>{literatur.toplam} kaynak</strong>
          <span>
            {literatur.okunan} okundu · {literatur.kullanilan} kullanıldı
          </span>
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
        <article className="merkez-kutu">
          <small>Kaynakça uyumu</small>
          <strong>{kaynakca?.skor != null ? `${kaynakca.skor}/100` : "—"}</strong>
          <span>{kaynakca ? trTarihSaat(kaynakca.tarih) : "Henüz denetlenmedi"}</span>
        </article>
      </section>

      {stilCelisiyor && (
        <p className="asistan-uyari" data-tone="danger" role="alert">
          <TriangleAlert size={16} aria-hidden="true" /> Çalışmanız{" "}
          <b>{STIL_ETIKETLERI[calisma.citation_style] ?? calisma.citation_style}</b> olarak ayarlı, ancak{" "}
          {kilavuz?.kurum} kılavuzu{" "}
          <b>{STIL_ETIKETLERI[kilavuz?.atifStili ?? ""] ?? kilavuz?.atifStili}</b> istiyor. Çalışma ayarlarından
          düzeltin ya da kılavuzun bu çalışma için geçerli olmadığını doğrulayın.
        </p>
      )}

      {tutarsizliklar.length > 0 && (
        <section className="section mt-lg">
          <h2 className="section-title">Birimler arası tutarsızlıklar</h2>
          <p className="muted text-base">
            Metniniz ile literatür listeniz karşılaştırıldı. Bu denetim kendiliğinden çalışır;
            hiçbir şey yapıştırmanız gerekmez.
          </p>
          <ul className="asistan-bulgular mt-sm">
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
        </section>
      )}

      <section className="section mt-lg">
        <h2 className="section-title">Bu çalışmanın birimleri</h2>
        <p className="muted text-base">
          Her adım ilgili bölüme götürür. Literatür, kaynakça ve belgeler bu çalışmaya bağlı kaydedilir;
          asistan da aynı bağlamı kullanır.
        </p>
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
                </span>
                <Link href={adim.href} className="merkez-adim-baglanti">
                  {adim.tamam ? "Görüntüle" : "Başla"} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {asistan.sonBulgular.length > 0 && (
        <section className="section mt-lg">
          <h2 className="section-title">Asistanın son bulguları</h2>
          <ul className="asistan-bulgular mt-sm">
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
        </section>
      )}

      {eksikMaddeler.length > 0 && (
        <section className="section mt-lg">
          <h2 className="section-title">Teslim öncesi bakılacaklar</h2>
          <p className="muted text-base">
            Editördeki &ldquo;Teslim kontrolü&rdquo; ile aynı liste; kaydedilmiş metinden hesaplanır.
          </p>
          <ul className="asistan-bulgular mt-sm">
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
        </section>
      )}

      <section className="section mt-lg">
        <h2 className="section-title">Bağlı kayıtlar</h2>
        <div className="merkez-baglantilar">
          <Link href={`/dashboard/documents?calisma=${calisma.id}`} className="merkez-baglanti">
            <FileCheck2 size={18} aria-hidden="true" />
            <span>
              <b>Belge kontrolü</b>
              {belgeSayisi ? `${belgeSayisi} belge yüklendi` : "Henüz belge yok"}
            </span>
          </Link>
          <Link href="/dashboard/expert-requests" className="merkez-baglanti">
            <Users size={18} aria-hidden="true" />
            <span>
              <b>Uzman desteği</b>
              {danismanlikSayisi ? `${danismanlikSayisi} talep açıldı` : "Talep yok"}
            </span>
          </Link>
          <Link href={`/dashboard/analysis?calisma=${calisma.id}`} className="merkez-baglanti">
            <Sparkles size={18} aria-hidden="true" />
            <span>
              <b>Asistan denetimi</b>
              {asistan.toplam ? `${asistan.toplam} denetim bu çalışmaya bağlı` : "Analiz ve kaynakça denetlenmedi"}
            </span>
          </Link>
          <Link href="/dashboard/guidelines" className="merkez-baglanti">
            <BookOpenCheck size={18} aria-hidden="true" />
            <span>
              <b>Kılavuzlar</b>
              {kilavuz
                ? `${kilavuz.baslik ?? "Tez yazım kılavuzu"}${kilavuz.surum ? ` · ${kilavuz.surum}` : ""}`
                : kilavuzOkunamadi
                  ? "Kılavuz aranamadı; sayfayı yenileyin"
                  : calisma.university
                    ? `${calisma.university} için onaylı kılavuz bulunamadı`
                    : "Çalışma ayarlarından kurumu girin"}
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
