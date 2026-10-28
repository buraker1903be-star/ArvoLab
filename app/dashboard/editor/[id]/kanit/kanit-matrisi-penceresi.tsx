import { Grid3x3, Plus } from "lucide-react";
import { kanitMatrisiOku } from "@/app/actions/kanit";
import { kanitAsistaniAcik } from "@/app/actions/ai-kanit";
import { DESTEK_ETIKETI_METIN, DESTEK_TONU, gecerliDestek, matrisOzeti, sonrakiAdim } from "@/lib/kanit/durum";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import IkiKartSecim from "@/app/dashboard/_components/iki-kart-secim";
import { IddiaEkleFormu, KanitAyrintisi } from "./kanit-parcalari";

/*
  KANIT MATRİSİ PENCERESİ (26.10.2026, kurum sahibinin isteği: "Kılavuz
  popup çok iyi, Kanıt matrisi için de aynısını yap").

  Çalışmalarım'daki durum kartından açılıyor; öğrenci sayfadan
  ayrılmadan iddialarını görüyor ve işliyor. Tam sayfadaki dokuz sütunlu
  tablo pencereye sığmıyor ve telefonda yana kayıyordu; burada her iddia
  tek satır: iddia, destek düzeyi ve sıradaki adım. Solda iddialar,
  sağda seçili iddianın zinciri ve bütün işlemleri (iki kart yan yana).
  Pencere içinde ikinci bir pencere açılmıyor: odak ve geri tuşu
  karışıyordu (kanit-parcalari.tsx, KanitPenceresi).

  Üstteki üç sayı kutusu tek cümleye indi (pencerenin açıklaması), "Tam
  tablo" bağlantısı kaldırıldı: Literatür ve Kaynakça pencereleriyle aynı
  sadelik. Tablo sayfası adresinde duruyor (personel ve eski bağlantılar).
*/
export default async function KanitMatrisiPenceresi({
  projectId,
  triggerClassName = "projects-filter-button button-compact",
}: {
  projectId: string;
  triggerClassName?: string;
}) {
  const [{ kayitlar, kaynaklar, okunamadi }, asistanAcik] = await Promise.all([kanitMatrisiOku(projectId), kanitAsistaniAcik()]);
  const t = await ceviri();
  const dil = await aktifDil();
  const kaynakHaritasi = new Map(kaynaklar.map((k) => [k.id, k]));
  const ozet = matrisOzeti(kayitlar);
  const bakilacak = ozet.celisen + ozet.zayif + ozet.degerlendirilmemis;

  return (
    <PanelDrawer
      triggerLabel={
        ozet.toplam
          ? t({ tr: `Kanıt matrisi · ${ozet.toplam}`, en: `Evidence matrix · ${ozet.toplam}` })
          : t({ tr: "Kanıt matrisi", en: "Evidence matrix" })
      }
      triggerIcon={<Grid3x3 size={15} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker={t({ tr: "Kanıt matrisi", en: "Evidence matrix" })}
      title={t({ tr: "İddialarınız ve kanıtları", en: "Your claims and their evidence" })}
      description={
        ozet.toplam
          ? t({
              tr: `${ozet.toplam} iddia · ${ozet.dogrudan} doğrudan destekleniyor · ${bakilacak} bakılacak · ${ozet.incelemeBekleyen} insan incelemesi bekliyor. Destek düzeyleri nihai akademik hüküm değildir.`,
              en: `${ozet.toplam} claims · ${ozet.dogrudan} directly supported · ${bakilacak} need attention · ${ozet.incelemeBekleyen} awaiting human review. Support levels are not a final academic judgment.`,
            })
          : t({
              tr: "Kaynak gerektiren temel iddialarınızı ekleyin; her biri için künye, kaynaktan metin ve destek düzeyi ayrı ayrı izlenir.",
              en: "Add the key claims that need sources; for each one, the reference, the text from the source and the support level are tracked separately.",
            })
      }
      boy="tam"
      basaridaKapan={false}
    >
      {okunamadi ? (
        <p className="alert mb-md" role="alert">
          {t({
            tr: "Kanıt kayıtları ya da kaynak listesi okunamadı; liste eksik olabilir. Sayfayı yenileyin.",
            en: "The evidence records or the source list could not be read; the list may be incomplete. Refresh the page.",
          })}
        </p>
      ) : null}


      {/*
        YAN YANA İKİ KART: solda iddialar (ve "İddia ekle"), sağda seçili
        iddianın zinciri ve bütün işlemleri. Kılavuz, Literatür ve
        Kaynakça pencereleriyle aynı düzen.
      */}
      <IkiKartSecim
        solBaslik={kayitlar.length ? t({ tr: `İddialar · ${kayitlar.length}`, en: `Claims · ${kayitlar.length}` }) : t({ tr: "İddialar", en: "Claims" })}
        solUst={
          /*
            İddia ekleme PENCERE İÇİNDE PENCERE (Literatür'deki "Manuel
            kaynak ekle" gibi): eskiden form sol kartın içinde açılıyor,
            listeyi aşağı itiyordu. Kaydedince iç pencere kapanır.
          */
          <PanelDrawer
            triggerLabel={t({ tr: "İddia ekle", en: "Add claim" })}
            triggerIcon={<Plus size={16} aria-hidden="true" />}
            triggerClassName={kayitlar.length ? "projects-filter-button" : "projects-primary-button"}
            kicker={t({ tr: "Kanıt matrisi", en: "Evidence matrix" })}
            title={t({ tr: "Yeni iddia", en: "New claim" })}
            description={t({
              tr: "Çalışmanızda kaynakla desteklenmesi gereken bir iddia. Kaynak listenizden bağlayın; künye ve kanıt kontrolleri ayrı ayrı yapılır.",
              en: "A claim in your work that needs to be supported by a source. Link it from your source list; reference and evidence checks are done separately.",
            })}
          >
            <IddiaEkleFormu projectId={projectId} kaynaklar={kaynaklar} />
          </PanelDrawer>
        }
        secenekler={kayitlar.map((k) => {
          const destek = gecerliDestek(k);
          return {
            id: k.id,
            satir: (
              <>
                <span className="kanit-kayit-govde">
                  <b>{k.iddia}</b>
                  <small>{[k.bolum, sonrakiAdim(k, dil)].filter(Boolean).join(" · ")}</small>
                </span>
                <span className="status-pill" data-tone={DESTEK_TONU[destek]}>
                  {t(DESTEK_ETIKETI_METIN[destek])}
                </span>
              </>
            ),
            ayrinti: (
              <>
                <span className="dashboard-kicker">
                  {k.bolum ? t({ tr: `Kanıt zinciri · ${k.bolum}`, en: `Evidence chain · ${k.bolum}` }) : t({ tr: "Kanıt zinciri", en: "Evidence chain" })}
                </span>
                <h3 className="pencere-kart-baslik">{k.iddia}</h3>
                <KanitAyrintisi
                  kayit={k}
                  kaynak={kaynakHaritasi.get(k.kaynak_id ?? "") ?? null}
                  projectId={projectId}
                  asistanAcik={asistanAcik}
                  kaynaklar={kaynaklar}
                />
              </>
            ),
          };
        })}
        bos={
          <ol className="kanit-adimlari">
            <li>
              <b>{t({ tr: "İddiayı ekleyin.", en: "Add the claim." })}</b>{" "}
              {t({ tr: "Tezinizde kaynakla desteklenmesi gereken cümle.", en: "A sentence in your thesis that needs to be supported by a source." })}
            </li>
            <li>
              <b>{t({ tr: "Kaynağını bağlayın.", en: "Link its source." })}</b>{" "}
              {t({
                tr: "Literatür listenizden; künyesi Crossref/OpenAlex'te doğrulanır.",
                en: "From your literature list; its reference is verified in Crossref/OpenAlex.",
              })}
            </li>
            <li>
              <b>{t({ tr: "Kaynaktan metni ekleyin.", en: "Add the text from the source." })}</b>{" "}
              {t({
                tr: "İddiayı destekleyen bölüm; destek düzeyini siz ya da asistan değerlendirir.",
                en: "The passage that supports the claim; you or the assistant assess the support level.",
              })}
            </li>
          </ol>
        }
      />

    </PanelDrawer>
  );
}
