import { BarChart3 } from "lucide-react";
import { calismaAnalizleri } from "@/app/actions/analiz-sonuclari";
import { analizAsistaniAcik } from "@/app/actions/ai-analiz";
import { getMyProjects } from "@/app/actions/citation-check";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import AnalizSecici from "./analiz-secici";
import { ceviri } from "@/lib/dil-sunucu";

/*
  ANALİZ PENCERESİ (26.10.2026, kurum sahibinin isteği: "Analiz butonu,
  açılan pencerede kartlar halinde hangi analiz yöntemi uygulanacağı
  sorulmalı … Excel'i yükleyip arka planda analiz yapan yapay zeka
  öğrenciyi bilgilendirmeli … sonucu teze ekleme sırasına koymalı").

  Çalışmalarım kartından açılıyor; Kılavuz, Literatür, Kaynakça ve Kanıt
  matrisi pencereleriyle aynı düzen: solda veri, yöntem kartları ve
  sonuç; sağda bu çalışmanın analizleri ve teze ekleme sırası. Öğrenci
  başka bir pencereye ya da programa gönderilmiyor.

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
  const t = await ceviri();
  const [{ satirlar: analizler, okunamadi: analizOkunamadi }, asistanAcik, { satirlar: calismalar }] = await Promise.all([
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
      triggerLabel={sirada ? t({ tr: `Analiz · ${sirada}`, en: `Analysis · ${sirada}` }) : t({ tr: "Analiz", en: "Analysis" })}
      triggerIcon={<BarChart3 size={15} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker={t({ tr: "Analiz", en: "Analysis" })}
      title={t({ tr: "Verinizi analiz edin", en: "Analyse your data" })}
      description={
        sirada
          ? t({
              tr: `${sirada} sonuç teze eklenmeyi bekliyor; editörde "Analiz ekle" ile imlecin olduğu yere eklenir.`,
              en: `${sirada} result(s) waiting to be added to the thesis; in the editor, "Add analysis" inserts them at the cursor.`,
            })
          : t({
              tr: "Excel ya da CSV dosyanızı yükleyin, analizi seçin; ArvoLab hesaplar, asistan sonucu okur. Sonucu teze ekleme sırasına koyun.",
              en: "Upload your Excel or CSV file and choose an analysis; ArvoLab computes it and the assistant reads the result. Then queue the result for your thesis.",
            })
      }
      boy="tam"
      basaridaKapan={false}
    >
      {analizOkunamadi ? (
        <p className="alert" role="alert">
          {t({
            tr: "Kayıtlı analizleriniz okunamadı; aşağıdaki liste eksik görünebilir. Kayıtlarınız yerinde duruyor — pencereyi kapatıp yeniden açın.",
            en: "Your saved analyses could not be loaded; the list below may be incomplete. Your records are safe — close and reopen this window.",
          })}
        </p>
      ) : null}
      <AnalizSecici projectId={projectId} calisma={calisma} asistanAcik={asistanAcik} analizler={analizler} />
    </PanelDrawer>
  );
}
