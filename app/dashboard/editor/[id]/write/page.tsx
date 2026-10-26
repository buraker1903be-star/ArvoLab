import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getManuscript } from "@/app/actions/manuscript";
import { calismaKilavuzu } from "@/lib/guideline-rules";
import { resolveGuidelineSync } from "@/lib/guideline-sync";
import { refreshImageUrls } from "@/lib/manuscript-images";
import { detectFormatLoss } from "@/lib/format-loss";
import { ozetOku, yapiSorunlariniTemizle } from "@/lib/kontrol-gecmisi";
import type { ManuscriptCheckResult } from "@/app/actions/manuscript";
import ManuscriptEditor from "./manuscript-editor";

// Bu sayfanın sunucu eylemleri (Word'den aktarma, resimli dönüştürme) büyük dosyalarda zaman alabilir.
export const maxDuration = 60;

/*
  "?teslim=<madde>" ile gelinirse editör teslim kontrolünü o maddede
  açıyor. Parametre SUNUCUDA okunuyor: istemcide okumak ya effect
  içinde state yazmayı (lint buna izin vermiyor, haklı olarak) ya da
  sayfayı bir Suspense sınırına sokan useSearchParams'ı gerektirirdi;
  ikincisi editörün ilk çizimini geciktiriyor.
*/
export default async function WriteManuscriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ teslim?: string }>;
}) {
  const { id } = await params;
  const { teslim } = await searchParams;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("academic_projects")
    .select("id, title, guideline_id, university, institute, department, project_type, citation_style, owner_id, assignee_id, due_date, status, ornek_atif")
    .eq("id", id)
    .maybeSingle();

  // Çalışma yoksa ya da kullanıcının erişimi yoksa (RLS) boş editör yerine 404.
  if (!project) notFound();

  const [guideline, manuscript, userResult, gecmisYaniti] = await Promise.all([
    /* Katalogda eşleşme yoksa öğrencinin kendi yüklediği kılavuz
       uygulanıyor (lib/guideline-rules.ts: calismaKilavuzu). */
    calismaKilavuzu(supabase, id, project.guideline_id),
    getManuscript(id),
    supabase.auth.getUser(),
    /* Kılavuz ve kaynakça kontrolü geçmişi: son 10 çalıştırma; en
       yenisinin tamamı açılışta gösteriliyor (migration 20261026202222).
       Okunamazsa editör geçmişsiz açılır, akış düşmez. */
    supabase
      .from("yazim_kontrolleri")
      .select("id, created_at, hata, uyari, eksik_bolum, kelime")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (gecmisYaniti.error) console.error("[kontrol] geçmiş okunamadı", gecmisYaniti.error.message);
  const gecmisSatirlari = gecmisYaniti.data ?? [];
  const kontrolGecmisi = gecmisSatirlari.map(ozetOku);
  // Tam sonuç (künye listesi büyük olabilir) yalnızca en yenisi için okunuyor.
  const { data: sonSatir } = gecmisSatirlari[0]
    ? await supabase.from("yazim_kontrolleri").select("sonuc, yapi").eq("id", gecmisSatirlari[0].id).maybeSingle()
    : { data: null };
  const sonKontrol = sonSatir
    ? { sonuc: sonSatir.sonuc as ManuscriptCheckResult, yapi: yapiSorunlariniTemizle(sonSatir.yapi) }
    : null;
  const sync = resolveGuidelineSync(guideline, manuscript);
  // Resim bağlantılarının süresi dolmasın: açılışta depo yolundan yeniden imzalanır.
  // Kabul edilen resim klasörleri: çalışmanın kendisi (yeni yol) ve yazarları (eski yol).
  const content = manuscript ? await refreshImageUrls(manuscript.content, [project.id, project.owner_id, project.assignee_id]) : null;
  // Eski kayıt hatasından etkilenen belge: kullanıcıya neyin kaybolduğu gösterilir.
  const formatLoss = manuscript ? detectFormatLoss(manuscript.content) : null;

  const user = userResult.data.user;
  let authorFullName = "";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    authorFullName = profile?.full_name ?? "";
  }

  return (
    /* "gb": diğer modül sayfaları gibi tam genişlik. Üç sütunlu düzende
       (araçlar, belge, kontroller) --content-max sınırı belgeyi daraltıyor,
       sayfa öbür ekranlardan dar görünüyordu. */
    <main className="dashboard-page gb">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Panelde yazma</span>
          <h1>{project.title ?? "Çalışma"}</h1>
          {/* Açıklama satırı kaldırıldı: otomatik kaydı belgenin üstündeki
              kayıt durumu zaten gösteriyor, andığı "Kontrol Et" düğmesinin
              adı ise artık "Kılavuz ve kaynakça kontrolü". */}
        </div>
        {/*
          Çıkış, çalışmanın KENDİ merkezine gidiyor — düz listeye değil.
          Literatür, kaynakça, belge ve analiz adımlarına oradan
          geçiliyor (calisma-serit.tsx); listeye dönmek kullanıcıyı
          bağlamdan çıkarıp aynı çalışmayı yeniden bulmaya zorluyordu.
          Tezin en uzun sürdüğü ekran, akışın geri kalanına en uzak
          ekran olmamalı.
        */}
        {/* Teslim kontrolü, Word, PDF ve kılavuz kontrolü düğmeleri editörden
            buraya, "Çalışma özeti"nin sağına yerleşir (manuscript-editor.tsx). */}
        <div className="cluster yazma-eylemleri" id="yazma-eylemleri">
          <Link href={`/dashboard/editor/${id}`} className="projects-filter-button">
            <ArrowLeft size={17} />
            Çalışma özeti
          </Link>
        </div>
      </section>

      <ManuscriptEditor
        projectId={id}
        acilacakMadde={teslim ?? null}
        kurumGirili={Boolean(project.university)}
        initialContent={content}
        formatLoss={formatLoss?.affected ? formatLoss : null}
        initialUpdatedAt={manuscript?.updatedAt ?? null}
        initialMargins={sync.margins}
        initialShowPageNumbers={sync.showPageNumbers}
        initialCoverPage={manuscript?.coverPage}
        guideline={guideline}
        guidelineSync={{ mode: sync.mode, source: sync.source, changes: sync.changes }}
        editHref={`/dashboard/editor/${id}/edit`}
        initialIncludeToc={manuscript?.includeToc ?? false}
        kontrolGecmisi={kontrolGecmisi}
        sonKontrol={sonKontrol}
        initialHeadingNumbering={sync.headingNumbering}
        dueDate={project.due_date ?? null}
        projectStatus={project.status ?? null}
        citationStyle={project.citation_style ?? "apa7"}
        ornekAtif={project.ornek_atif ?? null}
        projectDefaults={{
          title: project.title ?? "",
          university: project.university ?? "",
          institute: project.institute ?? "",
          department: project.department ?? "",
          authorName: authorFullName,
          projectType: project.project_type ?? "thesis",
        }}
      />
    </main>
  );
}
