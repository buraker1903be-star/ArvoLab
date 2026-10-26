import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { kanitMatrisiOku } from "@/app/actions/kanit";
import { kanitAsistaniAcik } from "@/app/actions/ai-kanit";
import { DESTEK_ETIKETI, DESTEK_TONU, KUNYE_ETIKETI, gecerliDestek, matrisOzeti, sonrakiAdim } from "@/lib/kanit/durum";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import CalismaSekmeleri from "../calisma-sekmeleri";
import { IddiaEkleFormu, KanitPenceresi, kunyeMetni } from "./kanit-parcalari";

/*
  KANIT MATRİSİ: çalışmanın önemli iddiaları, kaynakları ve kanıt durumları.

  Kullanıcı bir iddiayı açtığında zinciri görür:
    iddia → metin içi atıf → kaynak kaydı → özgün yayın → kanıt → sonuç
  Eksik halka eksik yazılır; tahminle doldurulmaz (lib/kanit/durum.ts).

  Destek düzeyleri otomatik sistemin ya da kullanıcının değerlendirmesidir,
  nihai akademik hüküm değildir; sayfanın başında ve her otomatik hükmün
  yanında bu söyleniyor.
*/

export default async function KanitMatrisiSayfasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: calisma, error } = await supabase.from("academic_projects").select("id, title, project_type").eq("id", id).maybeSingle();
  if (error) {
    return (
      <main className="dashboard-page">
        <p className="alert" role="alert">Çalışma okunamadı. Kaydınız yerinde duruyor; sayfayı yenileyin.</p>
      </main>
    );
  }
  if (!calisma) notFound();

  const [{ kayitlar, kaynaklar, okunamadi }, asistanAcik] = await Promise.all([kanitMatrisiOku(id), kanitAsistaniAcik()]);
  const kaynakHaritasi = new Map(kaynaklar.map((k) => [k.id, k]));
  const ozet = matrisOzeti(kayitlar);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Kanıt matrisi</span>
          <h1>{calisma.title}</h1>
          <p>
            Önemli iddialarınızı, dayandıkları kaynakları ve kanıt durumlarını tek yerde izleyin. Destek düzeyleri
            otomatik sistemin ya da sizin değerlendirmenizdir; nihai akademik hüküm değildir.
          </p>
        </div>
        <div className="merkez-ust-eylemler">
          <PanelDrawer
            triggerLabel="İddia ekle"
            triggerIcon={<Plus size={16} aria-hidden="true" />}
            triggerClassName="projects-primary-button"
            kicker="Kanıt matrisi"
            title="Yeni iddia"
            description="Çalışmanızda kaynakla desteklenmesi gereken bir iddia. Kaynak listenizden bağlayın; künye ve kanıt kontrolleri ayrı ayrı yapılır."
          >
            <IddiaEkleFormu projectId={id} kaynaklar={kaynaklar} />
          </PanelDrawer>
        </div>
      </section>

      <CalismaSekmeleri calisma={calisma} aktif="kanit" />

      {okunamadi && (
        <p className="alert mb-md" role="alert">
          Kanıt kayıtları ya da kaynak listesi okunamadı; aşağıdaki liste eksik olabilir. Sayfayı yenileyin.
        </p>
      )}

      <section className="merkez-ozet">
        <article className="merkez-kutu">
          <small>İddia</small>
          <strong>{ozet.toplam}</strong>
          <span>{ozet.dogrudan} doğrudan destekleniyor</span>
        </article>
        <article className="merkez-kutu">
          <small>Bakılması gereken</small>
          <strong>{ozet.celisen + ozet.zayif + ozet.degerlendirilmemis}</strong>
          <span>
            {ozet.celisen} çelişen · {ozet.zayif} kısmi/dolaylı · {ozet.degerlendirilmemis} değerlendirilmedi
          </span>
        </article>
        <article className="merkez-kutu">
          <small>İnsan incelemesi</small>
          <strong>{ozet.incelemeBekleyen}</strong>
          <span>{ozet.kunyeSorunlu} kaynakta künye sorunu</span>
        </article>
      </section>

      {kayitlar.length === 0 ? (
        <section className="empty-state mt-lg">
          <p className="empty-state-baslik">Matriste henüz iddia yok</p>
          <p className="muted">
            Çalışmanızın kaynak gerektiren temel iddialarını ekleyin. Her iddia için künye doğrulaması, kaynaktan
            incelenen metin ve iddia–kanıt uyumu ayrı ayrı kaydedilir.
          </p>
        </section>
      ) : (
        <>
          <section className="section mt-lg">
            <h2 className="section-title">Matris</h2>
            <p className="muted text-base">
              Bir iddiaya tıklayın: zinciri (iddia → atıf → kaynak kaydı → özgün yayın → kanıt → sonuç) ve bütün
              işlemler tek pencerede açılır. Eksik halkalar kesik çizgiyle gösterilir.
            </p>
            <div className="kanit-matris-sarici">
              <table className="kanit-matris">
                <thead>
                  <tr>
                    <th>İddia</th>
                    <th>Bölüm</th>
                    <th>Kaynak</th>
                    <th>Kaynak doğrulaması</th>
                    <th>Kanıt konumu</th>
                    <th>Destek düzeyi</th>
                    <th>Çelişen çalışmalar</th>
                    <th>Eksik kanıt</th>
                    <th>Önerilen düzeltme</th>
                  </tr>
                </thead>
                <tbody>
                  {kayitlar.map((k) => {
                    const destek = gecerliDestek(k);
                    return (
                      <tr key={k.id}>
                        <td>
                          <KanitPenceresi
                            kayit={k}
                            kaynak={kaynakHaritasi.get(k.kaynak_id ?? "") ?? null}
                            projectId={id}
                            asistanAcik={asistanAcik}
                            kaynaklar={kaynaklar}
                          />
                        </td>
                        <td>{k.bolum ?? "—"}</td>
                        <td>{kunyeMetni(kaynakHaritasi.get(k.kaynak_id ?? "")) ?? (k.kaynak_id ? "Erişilemiyor" : "Bağlanmadı")}</td>
                        <td>{KUNYE_ETIKETI[k.kunye_durumu]}</td>
                        <td>{k.alinti ? k.konum ?? "Konum belirtilmedi" : "—"}</td>
                        <td>
                          <span className="status-pill" data-tone={DESTEK_TONU[destek]}>{DESTEK_ETIKETI[destek]}</span>
                          {k.degerlendiren === "asistan" && <small>otomatik</small>}
                        </td>
                        <td>{k.celisen ?? "—"}</td>
                        <td>{k.eksik_kanit ?? "—"}</td>
                        <td>{sonrakiAdim(k)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

        </>
      )}
    </main>
  );
}
