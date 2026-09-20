import { getMyProjects, getMyCitationChecks } from "@/app/actions/citation-check";
import CitationCheckForm from "./citation-check-form";
import { trTarihSaat } from "@/lib/tr-time";
import { kaynakcaAsistaniAcik } from "@/app/actions/ai-kaynakca";
import CalismaSerit from "../_components/calisma-serit";
import BosDurum from "../_components/bos-durum";
import { History } from "lucide-react";

export default async function CitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ calisma?: string }>;
}) {
  // Çalışma merkezinden gelindiğinde çalışma hazır seçili gelsin.
  const { calisma: secilenCalisma } = await searchParams;
  // Anahtar yoksa düğme boşuna tıklanmasın; karar sunucuda verilir çünkü
  // ortam değişkeni istemciye taşınmaz (AGENTS.md: sırlar NEXT_PUBLIC_ değil).
  const [projects, history, asistanAcik] = await Promise.all([
    getMyProjects(),
    getMyCitationChecks(),
    kaynakcaAsistaniAcik(),
  ]);

  return (
    <main className="dashboard-page">
      <CalismaSerit calismaId={secilenCalisma} aktif="kaynakca" />
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Kaynakça</span>
          <h1>Kaynakça ve Atıf Doğrulama</h1>
          <p>
            Kaynakçanızı APA 7 biçimi, metin içi atıf tutarlılığı ve gerçek akademik
            kayıt eşleşmesi açısından denetleyin.
          </p>
          <details className="sayfa-detay">
            <summary>Denetim neye bakar?</summary>
            <p>
              Crossref ve OpenAlex sonuçları DOI bilgisiyle karşılaştırılır; her kaynak için
              Google Scholar araması da sunulur. Tam bir belgeyi (.docx/.pdf) incelemek için{" "}
              <a href="/dashboard/documents" className="link-accent">
                Belge Kontrol
              </a>{" "}
              sayfasını kullanın.
            </p>
          </details>
        </div>
      </section>

      <CitationCheckForm projects={projects} asistanAcik={asistanAcik} secilenCalisma={secilenCalisma ?? null} />

      <section className="section mt-lg">
        <h2 className="section-title">Son Kontroller</h2>
        {history.length === 0 ? (
          /* Eskiden bölüm tamamen gizleniyordu: yeni kullanıcı sayfada
             formdan başka bir şey görmüyor, geçmişin birikeceğini
             bilmiyordu. */
          <BosDurum
            kompakt
            ikon={History}
            aciklama="Henüz kaynakça denetimi yapmadınız. Her denetimin APA uyum puanı ve tarihi burada birikir; ilerlemenizi karşılaştırabilirsiniz."
          />
        ) : (
          /* Geçmiş, kart yığını değil kompakt satır: burada okunacak bir
             şey yok, karşılaştırılacak bir puan var. */
          <div className="denetim-listesi">
            {history.map((historyItem) => {
              const skor = historyItem.compliance_score;
              // Eşikler kullanıcıya renkle DEĞİL, metinle de söylenir.
              const ton = skor === null ? "neutral" : skor >= 85 ? "success" : skor >= 60 ? "warning" : "danger";
              return (
                <article className="denetim-satiri" key={historyItem.id}>
                  <div className="denetim-govde">
                    <strong>{historyItem.project_title || "İsimsiz kontrol"}</strong>
                    <span>{trTarihSaat(historyItem.created_at)}</span>
                  </div>
                  <div className="denetim-skor" data-tone={ton}>
                    <span className="denetim-skor-deger">{skor ?? "—"}</span>
                    <span className="denetim-skor-birim">/100 APA uyumu</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
