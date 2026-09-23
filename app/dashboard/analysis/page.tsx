import { FileBarChart, Trash2 } from "lucide-react";
import DataAnalyzer from "./data-analyzer";
import AnalysisTools from "./analysis-tools";
import { analizAsistaniAcik } from "@/app/actions/ai-analiz";
import { getMyProjects } from "@/app/actions/citation-check";
import { getAnalizSonuclari, analizSonucuSil } from "@/app/actions/analiz-sonuclari";
import { analizEtiketi } from "@/lib/analiz-turleri";
import CalismaSerit from "../_components/calisma-serit";
import ActionForm from "../action-form";
import BosDurum from "../_components/bos-durum";

const tarih = (deger: string) =>
  new Date(deger).toLocaleDateString("tr-TR", { dateStyle: "medium" });

export default async function AnalysisPage({
  searchParams,
}: {
  // Çalışma merkezinden "Analiz" adımıyla gelindiğinde çalışma hazır seçili gelsin.
  searchParams: Promise<{ calisma?: string }>;
}) {
  // Anahtar yoksa düğme boşuna tıklanmasın; karar sunucuda verilir çünkü
  // ortam değişkeni istemciye taşınmaz (AGENTS.md: sırlar NEXT_PUBLIC_ değil).
  const [
    asistanAcik,
    { satirlar: calismalar, okunamadi: calismaOkunamadi },
    { satirlar: sonuclar, okunamadi: sonucOkunamadi },
    { calisma: secilenCalisma },
  ] = await Promise.all([
    analizAsistaniAcik(),
    getMyProjects(),
    getAnalizSonuclari(),
    searchParams,
  ]);
  /*
    Gelen kimlik listede yoksa yok sayılır: seçili görünmeyen bir değerle
    açılan <select> kullanıcıya "seçim yaptım" izlenimi verirdi.
    key= ile bileşen yeniden kurulur; başlangıç durumu etkiyle değil
    yeniden kurulumla güncellenir (React 19: etkide setState yasak).
  */
  const hazirCalisma = calismalar.some((c) => c.id === secilenCalisma) ? secilenCalisma! : "";
  const calismaAdi = new Map(calismalar.map((calisma) => [calisma.id, calisma.title]));

  async function handleSil(id: string) {
    "use server";
    return analizSonucuSil(id);
  }

  return (
    <main className="dashboard-page">
      <CalismaSerit calismaId={hazirCalisma || undefined} aktif="analiz" />
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Analiz merkezi</span>
          <h1>Veri Analizi ve İstatistik Asistanı</h1>
          <p>
            Excel/CSV verinizi yükleyip gerçek istatistiksel testler
            çalıştırabilir, ya da SPSS&apos;ten kopyaladığınız hazır çıktıyı
            APA 7 biçimine çevirebilirsiniz. Sistem sayısal sonucu hesaplar
            ve anlamlılığı işaretler; bulguların araştırma bağlamındaki
            yorumu her zaman size/uzmanınıza aittir.
          </p>
        </div>
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

      <div className="stack">
        <DataAnalyzer calismalar={calismalar} secilenCalisma={hazirCalisma} />
        <AnalysisTools
          key={hazirCalisma}
          asistanAcik={asistanAcik}
          calismalar={calismalar}
          secilenCalisma={hazirCalisma}
        />
      </div>

      {/*
        Eskiden bu ekran hiçbir şey biriktirmiyordu: kaynakça denetiminin ve
        belgelerin geçmişi varken ürünün en ağır modülünün yoktu, kullanıcı
        sekmeyi kapatınca elinde bir şey kalmıyordu.
      */}
      <section className="section">
        <h2 className="section-title">
          <FileBarChart size={16} aria-hidden="true" />
          Kaydettiğiniz Sonuçlar
        </h2>
        {sonucOkunamadi ? (
          <p className="alert" role="alert">
            Kaydettiğiniz sonuçlar yüklenemedi. Hiç kaydınız olmadığı anlamına
            gelmez — sayfayı yenileyin.
          </p>
        ) : sonuclar.length === 0 ? (
          <BosDurum
            kompakt
            ikon={FileBarChart}
            aciklama="Henüz kaydedilmiş sonuç yok. Bir analiz çalıştırıp “Sonucu kaydet” dediğinizde çıktısı burada birikir; yüklediğiniz veri dosyası sunucuya hiç gitmez."
          />
        ) : (
          <div className="projects-list">
            {sonuclar.map((sonuc) => (
              <article className="project-card" key={sonuc.id}>
                <div className="project-card-main">
                  <div>
                    <span className="status-pill">{analizEtiketi(sonuc.analiz_turu)}</span>
                    <h3>{sonuc.baslik}</h3>
                    <p>
                      {tarih(sonuc.created_at)}
                      {" · "}
                      {/* Çalışma silinmiş olabilir: project_id null'a düşer ama
                          sonucun kendisi durur (migration 20260924100024). */}
                      {sonuc.project_id
                        ? calismaAdi.get(sonuc.project_id) ?? "Silinmiş çalışma"
                        : "Çalışmaya bağlı değil"}
                    </p>
                  </div>
                </div>
                <p className="analiz-kayit-metni">{sonuc.apa_metni}</p>
                <ActionForm
                  action={handleSil.bind(null, sonuc.id)}
                  className="mt-sm"
                  confirmMessage={`"${sonuc.baslik}" kaydını silmek istediğinize emin misiniz? Kayıtlar düzenlenemediği için silinen sonuç geri alınamaz; analizi yeniden çalıştırmanız gerekir.`}
                  successMessage="Sonuç silindi."
                >
                  <button type="submit" className="projects-filter-button">
                    <Trash2 size={14} aria-hidden="true" />
                    Sil
                  </button>
                </ActionForm>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
