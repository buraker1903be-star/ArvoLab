import { Download, ShieldAlert, Sparkles } from "lucide-react";
import BosDurum from "../_components/bos-durum";
import { getCurrentProfile } from "@/app/actions/profile";
import { asistanKayitlari, modelOzetleri } from "@/app/actions/ai-kayitlar";
import { KAYIT_ROLLERI, redEtiketi, YETENEK_ETIKETI_METIN } from "@/lib/ai/kayit-gorunum";
import { ADMIN_ROLES } from "@/lib/project-labels";
import type { Metadata } from "next";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Asistan Kayıtları", en: "Assistant Logs" }) };
}

/*
  Asistan kayıtları — iç ekip görünümü. İki soruya cevap verir:
  "hangi model daha iyi denetliyor" ve "ince ayar için elimizde ne var".
  Karar tahminle değil kullanıcı puanıyla verilsin diye model karşılaştırması
  en üstte.
*/

const PUAN_ETIKETI: Record<string, Metin> = {
  faydali: { tr: "Faydalı", en: "Helpful" },
  kismen: { tr: "Kısmen", en: "Partly" },
  faydasiz: { tr: "Faydasız", en: "Not helpful" },
};
const PUAN_TONU: Record<string, string> = { faydali: "success", kismen: "warning", faydasiz: "danger" };
const DURUM_ETIKETI: Record<string, Metin> = {
  completed: { tr: "Tamamlandı", en: "Completed" },
  rejected: { tr: "Reddedildi", en: "Rejected" },
  failed: { tr: "Başarısız", en: "Failed" },
};
const DURUM_TONU: Record<string, string> = { completed: "success", rejected: "warning", failed: "danger" };

const kisalt = (metin: string | null, sinir = 600) =>
  metin ? (metin.length > sinir ? `${metin.slice(0, sinir)}…` : metin) : "—";

export default async function AsistanKayitlariSayfasi() {
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarihSaat } = await tarihler();
  const saniye = (ms: number | null) =>
    ms ? t({ tr: `${(ms / 1000).toFixed(1)} sn`, en: `${(ms / 1000).toFixed(1)} s` }) : "—";
  const profile = await getCurrentProfile();
  if (!profile || !KAYIT_ROLLERI.includes(profile.role)) {
    return (
      <main className="dashboard-page">
        {/* Yetki reddi de ortak kalıpta: iki sayfada iki ayrı elle
            yazılmış blok vardı ve ikisinde de geri dönüş yolu yoktu —
            kullanıcı menüden başka bir yere tıklamak zorunda kalıyordu. */}
        <BosDurum
          ikon={ShieldAlert}
          baslik={t({ tr: "Bu sayfa size kapalı", en: "You don't have access to this page" })}
          aciklama={t({
            tr: "Bu sayfaya yalnızca iç ekip (Sistem Yöneticisi ve Kurucu) erişebilir.",
            en: "Only the internal team (System Administrator and Founder) can access this page.",
          })}
          eylem={{ etiket: t({ tr: "Ana sayfaya dön", en: "Back to home" }), href: "/dashboard" }}
        />
      </main>
    );
  }

  const [
    { satirlar: kayitlar, okunamadi: kayitOkunamadi },
    { satirlar: modeller, okunamadi: modelOkunamadi },
  ] = await Promise.all([asistanKayitlari(50), modelOzetleri()]);
  const puanlanan = modeller.reduce((toplam, model) => toplam + model.puanlanan, 0);
  /* İndirme bağlantısı varsayılan olarak YALNIZCA "faydalı"ları veriyor
     (app/api/asistan/egitim-kumesi). Eskiden "kısmen" de sayılıyor, sayfa
     indirilen dosyadan büyük bir küme vaat ediyordu. */
  const faydali = modeller.reduce((toplam, model) => toplam + model.faydali, 0);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Asistan Kayıtları", en: "Assistant Logs" })}</h1>
          <p>
            {t({
              tr: "Her asistan çalışması burada saklanıyor: modele gönderilen bağlam, ham yanıt ve kullanıcının değerlendirmesi. Bu kayıtlar ArvoLab'ın kendi modelini eğitecek veridir — asıl varlık model değil, bu tablo. Reddedilen yanıtlar da nedeniyle duruyor; modelin nerede yanıldığı, doğru yanıtları kadar öğreticidir.",
              en: "Every assistant run is stored here: the context sent to the model, the raw response and the user's rating. These records are the data that will train ArvoLab's own model — the real asset is this table, not the model. Rejected responses are kept with their reason; where the model went wrong is as instructive as its correct answers.",
            })}
          </p>
        </div>
        {/* Sayfa da dosya da yalnızca iç ekibe açık (26.10.2026'ya kadar
            sayfa Kontrolör'e de açıktı). Koşul ADMIN_ROLES'ta kalıyor:
            sayfa kümesi yeniden genişlerse dosya genişlemesin — rota da
            aynı kuralı uyguluyor. */}
        {ADMIN_ROLES.includes(profile.role) ? (
          <a className="projects-primary-button" href="/api/asistan/egitim-kumesi" download>
            <Download size={16} aria-hidden="true" /> {t({ tr: "Eğitim kümesini indir", en: "Download training set" })}
          </a>
        ) : null}
      </section>

      <section className="section">
        <h2 className="section-title">{t({ tr: "Model karşılaştırması", en: "Model comparison" })}</h2>
        {modelOkunamadi ? (
          <p className="alert" role="alert">
            {t({
              tr: "Model karşılaştırması okunamadı. Hiç çalışma kaydedilmediği anlamına gelmez; eksik veriyle model kararı vermeyin — sayfayı yenileyin.",
              en: "The model comparison could not be loaded. This does not mean no runs were recorded; don't make model decisions on incomplete data — refresh the page.",
            })}
          </p>
        ) : modeller.length === 0 ? (
          <BosDurum
            kompakt
            ikon={Sparkles}
            aciklama={t({
              tr: "Henüz asistan çalışması kaydedilmedi. Abonelerin her sorgusu burada modele göre toplanır; Sonnet ile Haiku'yu karşılaştırmak için kullanılır.",
              en: "No assistant runs recorded yet. Every subscriber query is aggregated here by model; it is used to compare Sonnet and Haiku.",
            })}
          />
        ) : (
          <div className="table-scroll" role="region" aria-label={t({ tr: "Model karşılaştırma tablosu", en: "Model comparison table" })} tabIndex={0}>
            <table className="stats-result-table">
              <thead>
                <tr>
                  <th>{t({ tr: "Model", en: "Model" })}</th>
                  <th>{t({ tr: "Çalışma", en: "Runs" })}</th>
                  <th>{t({ tr: "Tamamlanan", en: "Completed" })}</th>
                  <th>{t({ tr: "Reddedilen", en: "Rejected" })}</th>
                  <th>{t({ tr: "Başarısız", en: "Failed" })}</th>
                  <th>{t({ tr: "Faydalı", en: "Helpful" })}</th>
                  <th>{t({ tr: "Kısmen", en: "Partly" })}</th>
                  <th>{t({ tr: "Faydasız", en: "Not helpful" })}</th>
                  <th>{t({ tr: "Ort. süre", en: "Avg. time" })}</th>
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
        {/* Okunamayan özetten çıkan 0, "hiç puanlanmadı" cümlesini verirdi:
            iç ekibe eğitim kümesi hakkında yanlış bir haber. */}
        <p className="muted text-base mt-sm">
          {modelOkunamadi
            ? t({ tr: "Puanlama özeti şu an çıkarılamıyor.", en: "The rating summary is not available right now." })
            : puanlanan === 0
              ? t({
                  tr: "Henüz hiçbir çalışma puanlanmadı. Puan olmadan eğitim kümesi derlenemez: “model ne dedi” tek başına veri değildir, “iyi miydi” bilgisi gerekir.",
                  en: "No runs have been rated yet. A training set cannot be compiled without ratings: “what the model said” is not data on its own; you also need “was it good”.",
                })
              : t({
                  tr: `${puanlanan} çalışma puanlandı, ${faydali} tanesi eğitim kümesine uygun. Modeller arasında karar vermek için her birinden yeterli puan biriktirin.`,
                  en: `${puanlanan} runs rated, ${faydali} of them suitable for the training set. Collect enough ratings for each model before choosing between them.`,
                })}
        </p>
      </section>

      <section className="section mt-lg">
        <h2 className="section-title">{t({ tr: "Son çalışmalar", en: "Recent runs" })}</h2>
        {kayitOkunamadi ? (
          <p className="alert" role="alert">
            {t({
              tr: "Asistan kayıtları okunamadı. Kayıt olmadığı anlamına gelmez — sayfayı yenileyin.",
              en: "The assistant logs could not be loaded. This does not mean there are none — refresh the page.",
            })}
          </p>
        ) : kayitlar.length === 0 ? (
          <BosDurum
            kompakt
            ikon={Sparkles}
            aciklama={t({
              tr: "Henüz asistan çalışması yok. Bir abone analiz, kaynakça ya da literatür asistanını çalıştırdığında girdi ve çıktısı burada görünür.",
              en: "No assistant runs yet. When a subscriber runs the analysis, reference list or literature assistant, its input and output appear here.",
            })}
          />
        ) : (
          <div className="projects-list">
            {kayitlar.map((kayit) => (
              <article className="project-card" key={kayit.id}>
                <div className="project-card-main">
                  <div>
                    {/* Yetenek adı veritabanından geliyor; listede olmayan (eski/yeni) bir ad düşürmesin. */}
                    <h2>{YETENEK_ETIKETI_METIN[kayit.capability] ? t(YETENEK_ETIKETI_METIN[kayit.capability]) : kayit.capability}</h2>
                    <p>
                      {tarihSaat(kayit.created_at)} · {kayit.model ?? t({ tr: "model bilinmiyor", en: "unknown model" })} · {saniye(kayit.duration_ms)}
                      {kayit.prompt_chars
                        ? t({
                            tr: ` · ${kayit.prompt_chars} + ${kayit.output_chars ?? 0} karakter`,
                            en: ` · ${kayit.prompt_chars} + ${kayit.output_chars ?? 0} characters`,
                          })
                        : ""}
                    </p>
                  </div>
                  <div className="asistan-kayit-etiketler">
                    <span className="status-pill" data-tone={DURUM_TONU[kayit.status]}>
                      {DURUM_ETIKETI[kayit.status] ? t(DURUM_ETIKETI[kayit.status]) : kayit.status}
                      {kayit.reject_reason ? ` · ${redEtiketi(kayit.reject_reason, dil)}` : ""}
                    </span>
                    {kayit.rating && (
                      <span className="status-pill" data-tone={PUAN_TONU[kayit.rating] ?? "neutral"}>
                        {PUAN_ETIKETI[kayit.rating] ? t(PUAN_ETIKETI[kayit.rating]) : kayit.rating}
                      </span>
                    )}
                  </div>
                </div>
                <details className="asistan-kayit-detay">
                  <summary>{t({ tr: "Bağlamı ve yanıtı göster", en: "Show context and response" })}</summary>
                  <h3 className="result-heading">{t({ tr: "Modele gönderilen bağlam", en: "Context sent to the model" })}</h3>
                  <pre>{kisalt(kayit.context, 1500)}</pre>
                  <h3 className="result-heading">{t({ tr: "Ham yanıt", en: "Raw response" })}</h3>
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
