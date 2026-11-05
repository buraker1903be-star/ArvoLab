import { CalismaBaglamiYayinla } from "../_components/calisma-baglami";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { etikKaydiOku } from "@/lib/etik/oku";
import { analizEtikUyarisi } from "@/lib/etik/durum";
import { BarChart3, FileText, Trash2 } from "lucide-react";
import AnalysisTools from "./analysis-tools";
import AnalizSecici from "./analiz-secici";
import { analizAsistaniAcik } from "@/app/actions/ai-analiz";
import { getMyProjects } from "@/app/actions/citation-check";
import { analizSonucuSil, calismaAnalizleri, getAnalizSonuclari } from "@/app/actions/analiz-sonuclari";
import { analizEtiketi } from "@/lib/analiz-turleri";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import PanelDrawer from "../_components/panel-drawer";
import SayfaBasligi from "../_components/sayfa/sayfa-basligi";
import SayfaEylemleri from "../_components/sayfa/sayfa-eylemleri";
import CalismaSecici from "../_components/calisma-secici";
import CalismaSecimDurumu from "../_components/calisma-secim-durumu";
import { calismaSec } from "@/lib/calisma-secimi";
import ActionForm from "../action-form";
import BosDurum from "../_components/bos-durum";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Analiz Merkezi", en: "Analysis Centre" }) };
}

/*
  ANALİZ MERKEZİ — TEK EKRAN, İKİ KART (26.10.2026, Kaynaklar sayfasıyla
  aynı düzen).

  Eskiden sayfa alt alta dört bölümdü: veri yükleme ve "SPSS tarzı
  kapsamlı rapor", test seçimi, SPSS çıktısı biçimlendirici ile kod
  kitabı denetimi, en altta kaydedilen sonuçlar kartları. Öğrenci
  sonucunu bulmak için sayfayı metrelerce kaydırıyordu ve sonuç
  çalışmasına bağlanmadan kaydedilebiliyordu.

  Şimdi Çalışmalarım kartının Analiz penceresinin AYNISI sayfada: solda
  veri, yöntem kartları, sonuç ve asistanın notları; sağda seçili
  çalışmanın analizleri ve teze ekleme sırası. Hazır SPSS çıktısını
  biçimlendirme ve kod kitabı denetimi başlıktaki pencerede.

  Eskiden çalışmaya bağlanmadan kaydedilmiş sonuçlar kaybolmasın diye
  başlıkta ayrı bir pencerede listeleniyor.
*/
export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ calisma?: string }>;
}) {
  const { calisma: istenen } = await searchParams;
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarih } = await tarihler();
  const [asistanAcik, { satirlar: calismalar, okunamadi: calismaOkunamadi }, { satirlar: bagsizlar, okunamadi: sonucOkunamadi }] = await Promise.all([
    analizAsistaniAcik(),
    getMyProjects(),
    getAnalizSonuclari(),
  ]);

  /*
    Adresteki çalışma yoksa BAŞKA ÇALIŞMAYA GEÇİLMEZ (4.3.5, B1; lib/calisma-secimi.ts).
    Eskiden listedeki ilk çalışma sessizce açılıyordu: başka bir çalışmanın
    verisi görünüyor, oraya ekleme yapılabiliyordu.
  */
  const secim = calismaSec(calismalar, istenen, calismaOkunamadi);
  const calisma = secim.tur === "secili" ? secim.calisma : null;
  const [{ satirlar: analizler, okunamadi: analizOkunamadi }, etik] = calisma
    ? await Promise.all([calismaAnalizleri(calisma.id), createClient().then((s) => etikKaydiOku(s, calisma.id))])
    : [{ satirlar: [], okunamadi: false }, null];
  /* Etik kurul tarih kilidi (lib/etik/durum.ts): veri yüklenen yerde hatırlatılır. */
  const etikUyarisi = analizEtikUyarisi(etik);

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      {/* Adreste çalışma seçiliyse (?calisma=) gezinme o çalışmanın bölümlerini gösterir (Phase 3, os-gezinme.tsx). */}
      {calisma && secim.tur === "secili" && secim.adrestenMi ? <CalismaBaglamiYayinla id={calisma.id} baslik={calisma.title} tur={calisma.project_type} /> : null}
      {/*
        Ortak sayfa başlığı (Signature OS 4.1). Başlıkta BİRİNCİL eylem yok:
        Analiz Merkezi'nin ana işi sayfanın içindeki veri yükleme alanı;
        başlığa bir "yükle" düğmesi daha koymak aynı işi iki yerde
        gösterirdi. "Hazır çıktıyı biçimlendir" ikincil (SPSS'te yapılmış
        analizin çıktısı ve kod kitabı denetimi: ayrı iş, sayfayı uzatmasın
        diye pencerede); eski Analiz Merkezi'nden kalan bağsız sonuçlar
        seyrek, "⋯" menüsünde.
      */}
      <SayfaBasligi
        baslik={t({ tr: "Analiz Merkezi", en: "Analysis Centre" })}
        aciklama={
          calisma
            ? t({ tr: "Testleri ArvoLab hesaplar; asistan sonucu okur, sayı üretmez.", en: "ArvoLab computes the tests; the assistant reads the result and never produces numbers." })
            : t({ tr: "Verinizi yükleyin, analizi seçin; testleri ArvoLab hesaplar.", en: "Upload your data and choose an analysis; ArvoLab computes the tests." })
        }
        baglam={calisma ? <CalismaSecici calismalar={calismalar} secili={calisma.id} yol="/dashboard/analysis" /> : null}
        eylemler={
          <SayfaEylemleri
            ikincil={[
              <PanelDrawer
                key="hazir-cikti"
                triggerLabel={t({ tr: "Hazır çıktıyı biçimlendir", en: "Format existing output" })}
                triggerIcon={<FileText size={15} aria-hidden="true" />}
                triggerClassName="projects-filter-button button-compact"
                kicker={t({ tr: "Analiz", en: "Analysis" })}
                title={t({ tr: "SPSS çıktısını biçimlendirin", en: "Format SPSS output" })}
                description={t({
                  tr: "Analizi başka programda yaptıysanız çıktıdaki değerleri yapıştırın; çalışmanızın kılavuzuna göre raporlama biçimine çevrilir.",
                  en: "If you ran the analysis in another program, paste the values from its output; they are converted to the reporting style required by your project's guideline.",
                })}
                boy="genis"
                basaridaKapan={false}
              >
                <AnalysisTools
                  key={calisma?.id ?? ""}
                  asistanAcik={asistanAcik}
                  calismalar={calismalar}
                  secilenCalisma={calisma?.id ?? ""}
                />
              </PanelDrawer>,
            ]}
            tasma={[
              bagsizlar.length ? (
                <PanelDrawer
                  key="bagsiz-sonuclar"
                  triggerLabel={t({ tr: "Bağlı olmayan sonuçlar", en: "Unlinked results" })}
                  triggerClassName="projects-filter-button button-compact"
                  kicker={t({ tr: "Analiz", en: "Analysis" })}
                  title={t({ tr: "Çalışmaya bağlı olmayan sonuçlar", en: "Results not linked to a project" })}
                  description={t({
                    tr: "Eski Analiz Merkezi'nde çalışma seçilmeden kaydedilmiş sonuçlar. Kayıtlar düzenlenemez; gerekmiyorsa silin.",
                    en: "Results saved in the old Analysis Centre without choosing a project. Records cannot be edited; delete them if you no longer need them.",
                  })}
                  boy="genis"
                  basaridaKapan={false}
                >
                  <ul className="gb-liste">
                    {bagsizlar.map((s) => (
                      <li key={s.id} className="analiz-satiri">
                        <details>
                          <summary>
                            <span className="kanit-kayit-govde">
                              <b>{s.baslik}</b>
                              <small>
                                {analizEtiketi(s.analiz_turu, dil)} · {tarih(s.created_at)}
                              </small>
                            </span>
                          </summary>
                          <p className="analiz-apa">{s.apa_metni}</p>
                        </details>
                        <ActionForm
                          action={analizSonucuSil.bind(null, s.id)}
                          confirmMessage={t({ tr: `"${s.baslik}" kaydı silinsin mi? Geri alınamaz.`, en: `Delete "${s.baslik}"? This cannot be undone.` })}
                          successMessage={t({ tr: "Sonuç silindi.", en: "Result deleted." })}
                        >
                          <button type="submit" className="projects-filter-button button-compact" aria-label={t({ tr: `${s.baslik}: sil`, en: `${s.baslik}: delete` })}>
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </ActionForm>
                      </li>
                    ))}
                  </ul>
                </PanelDrawer>
              ) : null,
            ]}
          />
        }
      >
        {etikUyarisi && calisma ? (
          <p className="alert" data-tone={etikUyarisi.ton} role={etikUyarisi.ton === "danger" ? "alert" : "status"}>
            {t(etikUyarisi.metin)}{" "}
            <Link href={`/dashboard/editor/${calisma.id}/etik`}>{t({ tr: "Etik kurul sekmesi", en: "Ethics tab" })}</Link>
          </p>
        ) : null}
      </SayfaBasligi>

      {calismaOkunamadi || analizOkunamadi || sonucOkunamadi ? (
        <p className="alert" role="alert">
          {calismaOkunamadi
            ? t({
                tr: "Çalışma listeniz okunamadı; aşağısı eksik görünebilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.",
                en: "Your project list could not be loaded; what follows may look incomplete. Your records are safe — refresh the page.",
              })
            : t({
                tr: "Kayıtlı analizleriniz okunamadı; aşağısı eksik görünebilir. Kayıtlarınız yerinde duruyor — sayfayı yenileyin.",
                en: "Your saved analyses could not be loaded; what follows may look incomplete. Your records are safe — refresh the page.",
              })}
        </p>
      ) : null}

      {calisma ? (
        <AnalizSecici
          key={calisma.id}
          projectId={calisma.id}
          calisma={calisma}
          asistanAcik={asistanAcik}
          analizler={analizler}
          sayfa
        />
      ) : secim.tur === "bulunamadi" || secim.tur === "secim-gerekli" ? (
        <CalismaSecimDurumu
          tur={secim.tur}
          calismalar={calismalar}
          yol="/dashboard/analysis"
          bolum={{ ad: { tr: "Analizler", en: "Analyses" }, hal: { tr: "analizlerini", en: "analyses" } }}
        />
      ) : (
        <BosDurum
          ikon={BarChart3}
          baslik={t({ tr: "Önce bir çalışma başlatın", en: "Start a project first" })}
          aciklama={t({
            tr: "Analiz sonuçları bir çalışmaya bağlı tutulur: sayılar o çalışmanın kılavuzundaki biçimle yazılır ve editörde tezinize eklenir.",
            en: "Analysis results are kept with a project: numbers are written in the style of that project's guideline and added to your thesis in the editor.",
          })}
          eylem={{ etiket: t({ tr: "Yeni çalışma", en: "New project" }), href: "/dashboard/editor?yeni=1" }}
        />
      )}
    </main>
  );
}
