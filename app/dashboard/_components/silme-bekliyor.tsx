import { Download, RotateCcw } from "lucide-react";
import { hesapSilmeyiIptal } from "@/app/actions/hesap";
import { BEKLEME_GUNU, kalanGun, silinmeTarihi } from "@/lib/hesap-silme";
import ActionForm from "../action-form";
import { aktifDil } from "@/lib/dil-sunucu";
import { ceviriciKur, YEREL, type Dil } from "@/lib/dil";

// Türkiye saatiyle: dilimsiz biçimleyici sunucuda UTC günü yazıyor, gece verilen
// talepte kalıcı silme günü bir gün erken görünüyordu. Silme Türkiye gününe göre
// işlendiği için İngilizcede de aynı dilim kullanılıyor; yalnızca yazım değişiyor.
const tarih = (deger: Date, dil: Dil) =>
  new Intl.DateTimeFormat(YEREL[dil], { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(deger);

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
export default async function SilmeBekliyor({ talep }: { talep: string }) {
  const kalan = kalanGun(talep);
  const dil = await aktifDil();
  const t = ceviriciKur(dil);
  const gun = <strong>{tarih(silinmeTarihi(talep), dil)}</strong>;

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">{t({ tr: "Hesap silme", en: "Account deletion" })}</span>
          <h1>{t({ tr: "Hesabınız silinmek üzere", en: "Your account is scheduled for deletion" })}</h1>
          {dil === "tr" ? (
            <p>
              Silme talebiniz alındı. Çalışmalarınız, metinleriniz ve kaynaklarınız {gun} tarihinde kalıcı olarak
              silinecek — {kalan > 0 ? <>bugün dahil <strong>{kalan} gün</strong> kaldı</> : <>silme bugün yapılacak</>}.
              O ana kadar hiçbir şey silinmedi; vazgeçerseniz her şey olduğu gibi geri gelir.
            </p>
          ) : (
            <p>
              Your deletion request has been received. Your works, texts and sources will be permanently deleted on {gun} —{" "}
              {kalan > 0 ? (
                <>
                  <strong>
                    {kalan} {kalan === 1 ? "day" : "days"}
                  </strong>{" "}
                  left, including today
                </>
              ) : (
                <>deletion happens today</>
              )}
              . Nothing has been deleted yet; if you change your mind, everything comes back as it was.
            </p>
          )}
          <p>
            {t({
              tr: "Silme tamamlandıktan sonra veriler geri getirilemez. Almak istediğiniz bir şey varsa şimdi indirin.",
              en: "Once deletion is complete, the data cannot be recovered. If there is anything you want to keep, download it now.",
            })}
          </p>

          <div className="project-form-actions">
            <a className="projects-filter-button" href="/api/hesabim/verilerim" download>
              <Download size={16} aria-hidden="true" />
              {t({ tr: "Verilerimi indir", en: "Download my data" })}
            </a>
          </div>

          <ActionForm action={hesapSilmeyiIptal} successMessage={t({ tr: "Silme talebi iptal edildi.", en: "Deletion request canceled." })}>
            <div className="project-form-actions">
              <button type="submit" className="projects-primary-button">
                <RotateCcw size={16} aria-hidden="true" />
                {t({ tr: "Vazgeç, hesabımı geri getir", en: "Cancel and restore my account" })}
              </button>
            </div>
          </ActionForm>

          <p className="tone-text" data-tone="warning">
            {t({
              tr: `Bu talebi siz vermediyseniz hesabınıza başkası erişmiş olabilir: vazgeçtikten sonra Ayarlar'dan şifrenizi değiştirin. Bekleme süresi ${BEKLEME_GUNU} gündür.`,
              en: `If you did not make this request, someone else may have accessed your account: after canceling, change your password in Settings. The waiting period is ${BEKLEME_GUNU} days.`,
            })}
          </p>
        </div>
      </section>
    </main>
  );
}
