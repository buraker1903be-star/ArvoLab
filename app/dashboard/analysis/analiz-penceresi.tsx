import { BarChart3 } from "lucide-react";
import { calismaAnalizleri } from "@/app/actions/analiz-sonuclari";
import { analizAsistaniAcik } from "@/app/actions/ai-analiz";
import { getMyProjects } from "@/app/actions/citation-check";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import AnalizSecici from "./analiz-secici";

/*
  ANALİZ PENCERESİ (26.10.2026, kurum sahibinin isteği: "Analiz butonu,
  açılan pencerede kartlar halinde hangi analiz yöntemi uygulanacağı
  sorulmalı … Excel'i yükleyip arka planda analiz yapan yapay zeka
  öğrenciyi bilgilendirmeli … sonucu teze ekleme sırasına koymalı").

  Çalışmalarım kartından açılıyor; Kılavuz, Literatür, Kaynakça ve Kanıt
  matrisi pencereleriyle aynı düzen: solda seçim (program ve yöntem
  kartları), sağda bu çalışmanın analizleri ve teze ekleme sırası.
  Yönteme basınca veri yükleme ve hesap İÇ PENCEREDE açılıyor.

  Hesabı yapay zeka YAPMIYOR: testler ArvoLab'ın istatistik motorunda
  (lib/stats-*.ts) tarayıcıda hesaplanıyor. Asistan sonucu okuyup
  eksikleri söylüyor; sayı üretemez (AGENTS.md). Uydurulmuş bir p değeri
  tezde en ağır hata olurdu, bu yüzden iş bölümü böyle.
*/
export default async function AnalizPenceresi({
  projectId,
  projeAdi,
  triggerClassName = "projects-filter-button button-compact",
}: {
  projectId: string;
  projeAdi: string;
  triggerClassName?: string;
}) {
  const [analizler, asistanAcik, { satirlar: calismalar }] = await Promise.all([
    calismaAnalizleri(projectId),
    analizAsistaniAcik(),
    getMyProjects(),
  ]);
  /* Sayı biçimi çalışmanın kılavuzundan; çalışma sahibin listesinde
     yoksa (personel bakıyorsa) varsayılan biçim uygulanır. */
  const calisma = calismalar.find((c) => c.id === projectId) ?? { id: projectId, title: projeAdi };
  const sirada = analizler.filter((a) => a.teze_eklenecek && !a.teze_eklendi).length;

  return (
    <PanelDrawer
      triggerLabel={sirada ? `Analiz · ${sirada}` : "Analiz"}
      triggerIcon={<BarChart3 size={15} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker="Analiz"
      title="Verinizi analiz edin"
      description={
        sirada
          ? `${sirada} sonuç teze eklenmeyi bekliyor; editörde "Analiz ekle" ile imlecin olduğu yere eklenir.`
          : "Programı ve yöntemi seçin, Excel ya da CSV dosyanızı yükleyin. Sonucu teze ekleme sırasına koyabilirsiniz."
      }
      boy="tam"
      basaridaKapan={false}
    >
      <AnalizSecici projectId={projectId} calisma={calisma} asistanAcik={asistanAcik} analizler={analizler} />
    </PanelDrawer>
  );
}
