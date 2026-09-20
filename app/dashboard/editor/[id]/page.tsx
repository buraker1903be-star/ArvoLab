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
  Users,
} from "lucide-react";
import { calismaOzeti } from "@/app/actions/calisma-merkezi";
import { birimIlerlemesi, siradakiAdimlar } from "@/lib/calisma-ozeti";
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

const ADIM_SIMGESI: Record<string, typeof PenLine> = {
  literatur: BookOpenCheck,
  yazim: PenLine,
  kaynakca: Quote,
  belge: FileCheck2,
};

export default async function CalismaMerkezi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ozet = await calismaOzeti(id);
  if (!ozet) notFound();

  const { calisma, musvedde, literatur, kaynakca, belgeSayisi, danismanlikSayisi } = ozet;
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
          <small>Kaynakça uyumu</small>
          <strong>{kaynakca?.skor != null ? `${kaynakca.skor}/100` : "—"}</strong>
          <span>{kaynakca ? trTarihSaat(kaynakca.tarih) : "Henüz denetlenmedi"}</span>
        </article>
      </section>

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

      <section className="section mt-lg">
        <h2 className="section-title">Bağlı kayıtlar</h2>
        <div className="merkez-baglantilar">
          <Link href="/dashboard/documents" className="merkez-baglanti">
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
          <Link href="/dashboard/guidelines" className="merkez-baglanti">
            <BookOpenCheck size={18} aria-hidden="true" />
            <span>
              <b>Kılavuzlar</b>
              {calisma.university ? `${calisma.university} kurallarını kontrol edin` : "Kurum kılavuzunu seçin"}
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
