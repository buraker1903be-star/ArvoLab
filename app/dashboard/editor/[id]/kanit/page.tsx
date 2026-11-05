import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { kanitMatrisiOku } from "@/app/actions/kanit";
import { kanitAsistaniAcik } from "@/app/actions/ai-kanit";
import { DESTEK_ETIKETI_METIN, DESTEK_TONU, KUNYE_ETIKETI_METIN, gecerliDestek, matrisOzeti, sonrakiAdim, type DestekDuzeyi, type KunyeDurumu } from "@/lib/kanit/durum";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import BosDurum from "@/app/dashboard/_components/bos-durum";
import SayfaBasligi from "@/app/dashboard/_components/sayfa/sayfa-basligi";
import SayfaEylemleri from "@/app/dashboard/_components/sayfa/sayfa-eylemleri";
import VeriTablosu from "@/app/dashboard/_components/sayfa/veri-tablosu";
import DurumGostergesi from "@/app/dashboard/_components/sayfa/durum-gostergesi";
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

/* Sıralamada "bakılması gereken önce" (artan): en zayıf hüküm başta. */
const DESTEK_SIRASI: DestekDuzeyi[] = ["celisiyor", "dogrulanamadi", "degerlendirilmedi", "dolayli", "kismen", "dogrudan"];
const KUNYE_SIRASI: KunyeDurumu[] = ["uyusmuyor", "dogrulanamadi", "kismen", "bakilmadi", "dogrulandi"];

export default async function KanitMatrisiSayfasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await ceviri();
  const dil = await aktifDil();
  const { data: calisma, error } = await supabase.from("academic_projects").select("id, title, project_type").eq("id", id).maybeSingle();
  if (error) {
    return (
      <main className="dashboard-page">
        <p className="alert" role="alert">
          {t({ tr: "Çalışma okunamadı. Kaydınız yerinde duruyor; sayfayı yenileyin.", en: "The work could not be read. Your data is safe; refresh the page." })}
        </p>
      </main>
    );
  }
  if (!calisma) notFound();

  const [{ kayitlar, kaynaklar, okunamadi }, asistanAcik] = await Promise.all([kanitMatrisiOku(id), kanitAsistaniAcik()]);
  const kaynakHaritasi = new Map(kaynaklar.map((k) => [k.id, k]));
  const ozet = matrisOzeti(kayitlar);

  /*
    TEK EKRAN, İKİ KART (04.11.2026). Solda durum (üç sayı ve iddianın
    zinciri), sağda matris kendi kartında kayıyor; sayfa kaymıyor. Eskiden
    üç sayı kutusu tam genişlikte, matris altında ayrı bir bölümdü ve
    uzun matriste özet ekrandan çıkıyordu.
  */
  return (
    <main className="dashboard-page gb gb-tek-ekran">
      {/* Ortak sayfa başlığı (Signature OS 4.1). Tek birincil eylem: "İddia ekle". */}
      <SayfaBasligi
        sinif="calisma-basligi"
        ust={t({ tr: "Kanıt matrisi", en: "Evidence matrix" })}
        baslik={calisma.title}
        baslikTitle={calisma.title}
        aciklama={t({
          tr: "Önemli iddialarınız, dayandıkları kaynaklar ve kanıt durumları. Destek düzeyleri otomatik sistemin ya da sizin değerlendirmenizdir; nihai akademik hüküm değildir.",
          en: "Your key claims, the sources they rely on and their evidence status. Support levels are assessments by the automated system or by you; they are not a final academic judgment.",
        })}
        eylemler={
          <SayfaEylemleri
            birincil={
              <PanelDrawer
                triggerLabel={t({ tr: "İddia ekle", en: "Add claim" })}
                triggerIcon={<Plus size={16} aria-hidden="true" />}
                triggerClassName="projects-primary-button"
                kicker={t({ tr: "Kanıt matrisi", en: "Evidence matrix" })}
                title={t({ tr: "Yeni iddia", en: "New claim" })}
                description={t({
                  tr: "Çalışmanızda kaynakla desteklenmesi gereken bir iddia. Kaynak listenizden bağlayın; künye ve kanıt kontrolleri ayrı ayrı yapılır.",
                  en: "A claim in your work that needs to be supported by a source. Link it from your source list; reference and evidence checks are done separately.",
                })}
              >
                <IddiaEkleFormu projectId={id} kaynaklar={kaynaklar} />
              </PanelDrawer>
            }
          />
        }
      />

      <CalismaSekmeleri calisma={calisma} aktif="kanit" />

      {okunamadi && (
        <p className="alert mb-md" role="alert">
          {t({
            tr: "Kanıt kayıtları ya da kaynak listesi okunamadı; aşağıdaki liste eksik olabilir. Sayfayı yenileyin.",
            en: "The evidence records or the source list could not be read; the list below may be incomplete. Refresh the page.",
          })}
        </p>
      )}

      <section className="gb-sutunlar kanit-ikili" aria-label={t({ tr: "Kanıt durumu ve matris", en: "Evidence status and matrix" })}>
        <article className="gb-kart gb-sutun">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Durum", en: "Status" })}</h2>
              <p>{t({ tr: "Destek düzeyi nihai akademik hüküm değildir.", en: "Support levels are not a final academic judgment." })}</p>
            </div>
          </header>
          <dl className="kanit-durum">
            <div>
              <dt>{t({ tr: "İddia", en: "Claims" })}</dt>
              <dd>{ozet.toplam}</dd>
              <span>{t({ tr: `${ozet.dogrudan} doğrudan destekleniyor`, en: `${ozet.dogrudan} directly supported` })}</span>
            </div>
            <div data-tone={ozet.celisen + ozet.zayif + ozet.degerlendirilmemis ? "warning" : undefined}>
              <dt>{t({ tr: "Bakılması gereken", en: "Needs attention" })}</dt>
              <dd>{ozet.celisen + ozet.zayif + ozet.degerlendirilmemis}</dd>
              <span>
                {t({
                  tr: `${ozet.celisen} çelişen · ${ozet.zayif} kısmi/dolaylı · ${ozet.degerlendirilmemis} değerlendirilmedi`,
                  en: `${ozet.celisen} contradicting · ${ozet.zayif} partial/indirect · ${ozet.degerlendirilmemis} not assessed`,
                })}
              </span>
            </div>
            <div data-tone={ozet.incelemeBekleyen ? "danger" : undefined}>
              <dt>{t({ tr: "İnsan incelemesi", en: "Human review" })}</dt>
              <dd>{ozet.incelemeBekleyen}</dd>
              <span>{t({ tr: `${ozet.kunyeSorunlu} kaynakta künye sorunu`, en: `${ozet.kunyeSorunlu} sources with reference issues` })}</span>
            </div>
          </dl>
          <h3 className="kanit-zincir-baslik">{t({ tr: "Her iddianın zinciri", en: "Each claim's chain" })}</h3>
          <ol className="kanit-zincir-ozet">
            <li>{t({ tr: "İddia", en: "Claim" })}</li>
            <li>{t({ tr: "Atıf", en: "Citation" })}</li>
            <li>{t({ tr: "Kaynak kaydı", en: "Source record" })}</li>
            <li>{t({ tr: "Özgün yayın", en: "Original publication" })}</li>
            <li>{t({ tr: "Kanıt", en: "Evidence" })}</li>
            <li>{t({ tr: "Sonuç", en: "Result" })}</li>
          </ol>
          <p className="hint">
            {t({
              tr: "Matristeki bir iddiaya tıklayın: zincir ve bütün işlemler tek pencerede açılır; eksik halkalar kesik çizgiyle gösterilir.",
              en: "Click a claim in the matrix: its chain and all actions open in one window; missing links are shown with a dashed line.",
            })}
          </p>
        </article>

        <article className="gb-kart gb-sutun">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Matris", en: "Matrix" })}</h2>
              <p>
                {kayitlar.length
                  ? t({ tr: `${kayitlar.length} iddia`, en: `${kayitlar.length} ${kayitlar.length === 1 ? "claim" : "claims"}` })
                  : t({ tr: "Henüz iddia yok", en: "No claims yet" })}
              </p>
            </div>
          </header>
          {kayitlar.length === 0 ? (
            /* Boş durum (4.1): yönü yazan cümle ("sağ üstteki") kalktı —
               telefonda düğme sağ üstte değil, başlığın altında. */
            <BosDurum
              kompakt
              baslik={t({ tr: "Matriste henüz iddia yok", en: "No claims in the matrix yet" })}
              aciklama={t({
                tr: "Çalışmanızın kaynak gerektiren temel iddialarını “İddia ekle” ile ekleyin. Her iddia için künye doğrulaması, kaynaktan incelenen metin ve iddia–kanıt uyumu ayrı ayrı kaydedilir.",
                en: "Add the key claims in your work that need sources with “Add claim”. For each claim, reference verification, the text reviewed from the source and claim–evidence fit are recorded separately.",
              })}
            />
          ) : (
            /*
              Ortak veri tablosu (4.1). Eskiden tablo 960 piksele sabitti ve
              telefonda yalnızca "İddia" ile "Bölüm" görünüyordu; destek
              düzeyi, eksik kanıt ve önerilen düzeltme ekranın dışında
              kalıyordu. Telefonda artık her iddia, dokuz sütunun hepsi
              başlıklarıyla bir kart. Sıralama değerleri "bakılması
              gereken önce": artan sırada çelişen ve doğrulanamayan başta.
            */
            <VeriTablosu
              etiket={t({ tr: "Kanıt matrisi", en: "Evidence matrix" })}
              sutunlar={[
                { anahtar: "iddia", baslik: t({ tr: "İddia", en: "Claim" }), birincil: true, siralanabilir: true },
                { anahtar: "bolum", baslik: t({ tr: "Bölüm", en: "Section" }), siralanabilir: true },
                { anahtar: "kaynak", baslik: t({ tr: "Kaynak", en: "Source" }), siralanabilir: true },
                { anahtar: "kunye", baslik: t({ tr: "Kaynak doğrulaması", en: "Source verification" }), siralanabilir: true },
                { anahtar: "konum", baslik: t({ tr: "Kanıt konumu", en: "Evidence location" }) },
                { anahtar: "destek", baslik: t({ tr: "Destek düzeyi", en: "Support level" }), siralanabilir: true },
                { anahtar: "celisen", baslik: t({ tr: "Çelişen çalışmalar", en: "Contradicting studies" }) },
                { anahtar: "eksik", baslik: t({ tr: "Eksik kanıt", en: "Missing evidence" }) },
                { anahtar: "duzeltme", baslik: t({ tr: "Önerilen düzeltme", en: "Suggested fix" }) },
              ]}
              satirlar={kayitlar.map((k) => {
                const destek = gecerliDestek(k);
                const kunye = kunyeMetni(kaynakHaritasi.get(k.kaynak_id ?? ""));
                return {
                  id: k.id,
                  degerler: {
                    iddia: k.iddia,
                    bolum: k.bolum,
                    kaynak: kunye,
                    kunye: KUNYE_SIRASI.indexOf(k.kunye_durumu),
                    destek: DESTEK_SIRASI.indexOf(destek),
                  },
                  hucreler: {
                    iddia: (
                      <KanitPenceresi
                        kayit={k}
                        kaynak={kaynakHaritasi.get(k.kaynak_id ?? "") ?? null}
                        projectId={id}
                        asistanAcik={asistanAcik}
                        kaynaklar={kaynaklar}
                      />
                    ),
                    bolum: k.bolum ?? "—",
                    kaynak: kunye ?? (k.kaynak_id ? t({ tr: "Erişilemiyor", en: "Not accessible" }) : t({ tr: "Bağlanmadı", en: "Not linked" })),
                    kunye: t(KUNYE_ETIKETI_METIN[k.kunye_durumu]),
                    konum: k.alinti ? (k.konum ?? t({ tr: "Konum belirtilmedi", en: "Location not specified" })) : "—",
                    destek: (
                      <>
                        <DurumGostergesi ton={DESTEK_TONU[destek]} ne={t({ tr: "Destek düzeyi", en: "Support level" })}>
                          {t(DESTEK_ETIKETI_METIN[destek])}
                        </DurumGostergesi>
                        {k.degerlendiren === "asistan" && <small>{t({ tr: "otomatik", en: "automatic" })}</small>}
                      </>
                    ),
                    celisen: k.celisen ?? "—",
                    eksik: k.eksik_kanit ?? "—",
                    duzeltme: sonrakiAdim(k, dil),
                  },
                };
              })}
            />
          )}
        </article>
      </section>
    </main>
  );
}
