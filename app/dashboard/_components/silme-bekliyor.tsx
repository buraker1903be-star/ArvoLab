import { Download, RotateCcw } from "lucide-react";
import { hesapSilmeyiIptal } from "@/app/actions/hesap";
import { BEKLEME_GUNU, kalanGun, silinmeTarihi } from "@/lib/hesap-silme";
import ActionForm from "../action-form";

const tarih = (deger: Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(deger);

/*
  Silme talebi verilmiş hesabın gördüğü ekran; paneli tamamen kaplıyor
  (app/dashboard/layout.tsx).

  Neden otomatik geri getirmiyoruz: giriş yapmak tek başına talebi silseydi,
  hesabı ele geçirilmiş kullanıcı bir daha girdiğinde arada silme
  istendiğini HİÇ öğrenemezdi. Burada hem öğreniyor hem tek düğmeyle geri
  alıyor.

  "Verilerimi indir" bu ekranda da duruyor: veri hâlâ burada ve süre
  dolmadan alınabilmeli. Ayarlar sayfasına gidilemiyor, bağlantı oraya
  kalsaydı indirme fiilen kapanırdı.
*/
export default function SilmeBekliyor({ talep }: { talep: string }) {
  const kalan = kalanGun(talep);

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">Hesap silme</span>
          <h1>Hesabınız silinmek üzere</h1>
          <p>
            Silme talebiniz alındı. Çalışmalarınız, metinleriniz ve kaynaklarınız{" "}
            <strong>{tarih(silinmeTarihi(talep))}</strong> tarihinde kalıcı olarak silinecek —{" "}
            {kalan > 0 ? <>bugün dahil <strong>{kalan} gün</strong> kaldı</> : <>silme bugün yapılacak</>}.
            O ana kadar hiçbir şey silinmedi; vazgeçerseniz her şey olduğu gibi geri gelir.
          </p>
          <p>
            Silme tamamlandıktan sonra veriler geri getirilemez. Almak istediğiniz bir şey varsa
            şimdi indirin.
          </p>

          <div className="project-form-actions">
            <a className="projects-filter-button" href="/api/hesabim/verilerim" download>
              <Download size={16} aria-hidden="true" />
              Verilerimi indir
            </a>
          </div>

          <ActionForm action={hesapSilmeyiIptal} successMessage="Silme talebi iptal edildi.">
            <div className="project-form-actions">
              <button type="submit" className="projects-primary-button">
                <RotateCcw size={16} aria-hidden="true" />
                Vazgeç, hesabımı geri getir
              </button>
            </div>
          </ActionForm>

          <p className="tone-text" data-tone="warning">
            Bu talebi siz vermediyseniz hesabınıza başkası erişmiş olabilir: vazgeçtikten sonra
            Ayarlar&apos;dan şifrenizi değiştirin. Bekleme süresi {BEKLEME_GUNU} gündür.
          </p>
        </div>
      </section>
    </main>
  );
}
