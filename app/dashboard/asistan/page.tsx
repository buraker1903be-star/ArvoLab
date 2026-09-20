import { Download, ShieldAlert } from "lucide-react";
import { getCurrentProfile } from "@/app/actions/profile";
import { asistanKayitlari, modelOzetleri } from "@/app/actions/ai-kayitlar";
import { KAYIT_ROLLERI, RED_ETIKETI, YETENEK_ETIKETI } from "@/lib/ai/kayit-gorunum";
import { trTarihSaat } from "@/lib/tr-time";

/*
  Asistan kayıtları — iç ekip görünümü. İki soruya cevap verir:
  "hangi model daha iyi denetliyor" ve "ince ayar için elimizde ne var".
  Karar tahminle değil kullanıcı puanıyla verilsin diye model karşılaştırması
  en üstte.
*/

const PUAN_ETIKETI: Record<string, string> = { faydali: "Faydalı", kismen: "Kısmen", faydasiz: "Faydasız" };
const PUAN_TONU: Record<string, string> = { faydali: "success", kismen: "warning", faydasiz: "danger" };
const DURUM_ETIKETI: Record<string, string> = { completed: "Tamamlandı", rejected: "Reddedildi", failed: "Başarısız" };
const DURUM_TONU: Record<string, string> = { completed: "success", rejected: "warning", failed: "danger" };

const saniye = (ms: number | null) => (ms ? `${(ms / 1000).toFixed(1)} sn` : "—");
const kisalt = (metin: string | null, sinir = 600) =>
  metin ? (metin.length > sinir ? `${metin.slice(0, sinir)}…` : metin) : "—";

export default async function AsistanKayitlariSayfasi() {
  const profile = await getCurrentProfile();
  if (!profile || !KAYIT_ROLLERI.includes(profile.role)) {
    return (
      <main className="dashboard-page">
        <section className="empty-state">
          <ShieldAlert size={28} aria-hidden="true" />
          <p>Bu sayfaya yalnızca Kontrolör, Akademik Yönetici, Sistem Yöneticisi ve Kurucu erişebilir.</p>
        </section>
      </main>
    );
  }

  const [kayitlar, modeller] = await Promise.all([asistanKayitlari(50), modelOzetleri()]);
  const puanlanan = modeller.reduce((toplam, model) => toplam + model.puanlanan, 0);
  const faydali = modeller.reduce((toplam, model) => toplam + model.faydali + model.kismen, 0);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Asistan</span>
          <h1>Asistan Kayıtları</h1>
          <p>
            Her asistan çalışması burada saklanıyor: modele gönderilen bağlam,
            ham yanıt ve kullanıcının değerlendirmesi. Bu kayıtlar ArvoLab&apos;ın
            kendi modelini eğitecek veridir — asıl varlık model değil, bu tablo.
            Reddedilen yanıtlar da nedeniyle duruyor; modelin nerede yanıldığı,
            doğru yanıtları kadar öğreticidir.
          </p>
        </div>
        <a className="projects-primary-button" href="/api/asistan/egitim-kumesi" download>
          <Download size={16} aria-hidden="true" /> Eğitim kümesini indir
        </a>
      </section>

      <section className="section">
        <h2 className="section-title">Model karşılaştırması</h2>
        {modeller.length === 0 ? (
          <p className="dash-empty">Henüz kayıt yok.</p>
        ) : (
          <div className="table-scroll">
            <table className="stats-result-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Çalışma</th>
                  <th>Tamamlanan</th>
                  <th>Reddedilen</th>
                  <th>Başarısız</th>
                  <th>Faydalı</th>
                  <th>Kısmen</th>
                  <th>Faydasız</th>
                  <th>Ort. süre</th>
                </tr>
              </thead>
              <tbody>
                {modeller.map((model) => (
                  <tr key={model.model}>
                    <td>{model.model}</td>
                    <td>{model.toplam}</td>
                    <td>{model.tamamlanan}</td>
                    <td>{model.reddedilen}</td>
                    <td>{model.basarisiz}</td>
                    <td>{model.faydali}</td>
                    <td>{model.kismen}</td>
                    <td>{model.faydasiz}</td>
                    <td>{saniye(model.ortSure)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted text-base mt-sm">
          {puanlanan === 0
            ? "Henüz hiçbir çalışma puanlanmadı. Puan olmadan eğitim kümesi derlenemez: “model ne dedi” tek başına veri değildir, “iyi miydi” bilgisi gerekir."
            : `${puanlanan} çalışma puanlandı, ${faydali} tanesi eğitim kümesine uygun. Modeller arasında karar vermek için her birinden yeterli puan biriktirin.`}
        </p>
      </section>

      <section className="section mt-lg">
        <h2 className="section-title">Son çalışmalar</h2>
        {kayitlar.length === 0 ? (
          <p className="dash-empty">Henüz kayıt yok.</p>
        ) : (
          <div className="projects-list">
            {kayitlar.map((kayit) => (
              <article className="project-card" key={kayit.id}>
                <div className="project-card-main">
                  <div>
                    <h2>{YETENEK_ETIKETI[kayit.capability] ?? kayit.capability}</h2>
                    <p>
                      {trTarihSaat(kayit.created_at)} · {kayit.model ?? "model bilinmiyor"} · {saniye(kayit.duration_ms)}
                      {kayit.prompt_chars ? ` · ${kayit.prompt_chars} + ${kayit.output_chars ?? 0} karakter` : ""}
                    </p>
                  </div>
                  <div className="asistan-kayit-etiketler">
                    <span className="status-pill" data-tone={DURUM_TONU[kayit.status]}>
                      {DURUM_ETIKETI[kayit.status] ?? kayit.status}
                      {kayit.reject_reason ? ` · ${RED_ETIKETI[kayit.reject_reason] ?? kayit.reject_reason}` : ""}
                    </span>
                    {kayit.rating && (
                      <span className="status-pill" data-tone={PUAN_TONU[kayit.rating] ?? "neutral"}>
                        {PUAN_ETIKETI[kayit.rating] ?? kayit.rating}
                      </span>
                    )}
                  </div>
                </div>
                <details className="asistan-kayit-detay">
                  <summary>Bağlamı ve yanıtı göster</summary>
                  <h3 className="result-heading">Modele gönderilen bağlam</h3>
                  <pre>{kisalt(kayit.context, 1500)}</pre>
                  <h3 className="result-heading">Ham yanıt</h3>
                  <pre>{kisalt(kayit.output, 1500)}</pre>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
