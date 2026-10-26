import { Grid3x3, Plus } from "lucide-react";
import { kanitMatrisiOku } from "@/app/actions/kanit";
import { kanitAsistaniAcik } from "@/app/actions/ai-kanit";
import { DESTEK_ETIKETI, DESTEK_TONU, gecerliDestek, matrisOzeti, sonrakiAdim } from "@/lib/kanit/durum";
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
  const kaynakHaritasi = new Map(kaynaklar.map((k) => [k.id, k]));
  const ozet = matrisOzeti(kayitlar);
  const bakilacak = ozet.celisen + ozet.zayif + ozet.degerlendirilmemis;

  return (
    <PanelDrawer
      triggerLabel={ozet.toplam ? `Kanıt matrisi · ${ozet.toplam}` : "Kanıt matrisi"}
      triggerIcon={<Grid3x3 size={15} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker="Kanıt matrisi"
      title="İddialarınız ve kanıtları"
      description={
        ozet.toplam
          ? `${ozet.toplam} iddia · ${ozet.dogrudan} doğrudan destekleniyor · ${bakilacak} bakılacak · ${ozet.incelemeBekleyen} insan incelemesi bekliyor. Destek düzeyleri nihai akademik hüküm değildir.`
          : "Kaynak gerektiren temel iddialarınızı ekleyin; her biri için künye, kaynaktan metin ve destek düzeyi ayrı ayrı izlenir."
      }
      boy="tam"
      basaridaKapan={false}
    >
      {okunamadi ? (
        <p className="alert mb-md" role="alert">
          Kanıt kayıtları ya da kaynak listesi okunamadı; liste eksik olabilir. Sayfayı yenileyin.
        </p>
      ) : null}


      {/*
        YAN YANA İKİ KART: solda iddialar (ve "İddia ekle"), sağda seçili
        iddianın zinciri ve bütün işlemleri. Kılavuz, Literatür ve
        Kaynakça pencereleriyle aynı düzen.
      */}
      <IkiKartSecim
        solBaslik={kayitlar.length ? `İddialar · ${kayitlar.length}` : "İddialar"}
        solUst={
          /*
            İddia ekleme PENCERE İÇİNDE PENCERE (Literatür'deki "Manuel
            kaynak ekle" gibi): eskiden form sol kartın içinde açılıyor,
            listeyi aşağı itiyordu. Kaydedince iç pencere kapanır.
          */
          <PanelDrawer
            triggerLabel="İddia ekle"
            triggerIcon={<Plus size={16} aria-hidden="true" />}
            triggerClassName={kayitlar.length ? "projects-filter-button" : "projects-primary-button"}
            kicker="Kanıt matrisi"
            title="Yeni iddia"
            description="Çalışmanızda kaynakla desteklenmesi gereken bir iddia. Kaynak listenizden bağlayın; künye ve kanıt kontrolleri ayrı ayrı yapılır."
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
                  <small>{[k.bolum, sonrakiAdim(k)].filter(Boolean).join(" · ")}</small>
                </span>
                <span className="status-pill" data-tone={DESTEK_TONU[destek]}>
                  {DESTEK_ETIKETI[destek]}
                </span>
              </>
            ),
            ayrinti: (
              <>
                <span className="dashboard-kicker">{k.bolum ? `Kanıt zinciri · ${k.bolum}` : "Kanıt zinciri"}</span>
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
              <b>İddiayı ekleyin.</b> Tezinizde kaynakla desteklenmesi gereken cümle.
            </li>
            <li>
              <b>Kaynağını bağlayın.</b> Literatür listenizden; künyesi Crossref/OpenAlex&apos;te doğrulanır.
            </li>
            <li>
              <b>Kaynaktan metni ekleyin.</b> İddiayı destekleyen bölüm; destek düzeyini siz ya da asistan değerlendirir.
            </li>
          </ol>
        }
      />

    </PanelDrawer>
  );
}
