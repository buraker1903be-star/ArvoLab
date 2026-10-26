import Link from "next/link";
import { ChevronRight, Grid3x3, Plus } from "lucide-react";
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

  Tablo kalkmadı: danışmana göstermek ya da hepsini yan yana görmek için
  "Tam tablo" bağlantısı.
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
      description="Destek düzeyleri otomatik sistemin ya da sizin değerlendirmenizdir; nihai akademik hüküm değildir."
      boy="tam"
      basaridaKapan={false}
    >
      {okunamadi ? (
        <p className="alert mb-md" role="alert">
          Kanıt kayıtları ya da kaynak listesi okunamadı; liste eksik olabilir. Sayfayı yenileyin.
        </p>
      ) : null}

      <dl className="kanit-ozet">
        <div>
          <dt>İddia</dt>
          <dd>{ozet.toplam}</dd>
          <span>{ozet.dogrudan} doğrudan destekleniyor</span>
        </div>
        <div data-tone={bakilacak ? "warning" : undefined}>
          <dt>Bakılacak</dt>
          <dd>{bakilacak}</dd>
          <span>
            {ozet.celisen} çelişen · {ozet.zayif} kısmi/dolaylı · {ozet.degerlendirilmemis} değerlendirilmedi
          </span>
        </div>
        <div>
          <dt>İnsan incelemesi</dt>
          <dd>{ozet.incelemeBekleyen}</dd>
          <span>{ozet.kunyeSorunlu} kaynakta künye sorunu</span>
        </div>
      </dl>

      {/*
        YAN YANA İKİ KART: solda iddialar (ve "İddia ekle"), sağda seçili
        iddianın zinciri ve bütün işlemleri. Kılavuz, Literatür ve
        Kaynakça pencereleriyle aynı düzen.
      */}
      <IkiKartSecim
        solBaslik={kayitlar.length ? `İddialar · ${kayitlar.length}` : "İddialar"}
        solUst={
          /* Hiç iddia yoksa form açık gelir: yapılacak tek iş o. */
          <details className="form-details pencere-is" open={kayitlar.length === 0}>
            <summary>
              <Plus size={15} aria-hidden="true" /> İddia ekle
            </summary>
            <p className="muted text-sm">
              Çalışmanızda kaynakla desteklenmesi gereken bir iddia. Kaynak listenizden bağlayın; künye ve kanıt
              kontrolleri ayrı ayrı yapılır.
            </p>
            <IddiaEkleFormu projectId={projectId} kaynaklar={kaynaklar} />
          </details>
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
        bos="Soldan bir iddia ekleyin; zinciri ve kontrolleri burada görünür."
      />

      <Link href={`/dashboard/editor/${projectId}/kanit`} className="link-accent mt-md kanit-tam-tablo">
        Tam tabloyu aç <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </PanelDrawer>
  );
}
