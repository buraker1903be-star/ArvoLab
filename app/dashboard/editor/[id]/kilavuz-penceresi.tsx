import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import ActionForm from "@/app/dashboard/action-form";
import { kilavuzuKaldir } from "@/app/actions/calisma-kilavuzu";
import { STIL_ETIKETLERI } from "@/lib/atif/stiller";
import { bicimOzeti } from "@/lib/kilavuz-dogrulama";
import type { AppliedGuideline } from "@/lib/guideline-rules";
import KilavuzYukle from "./kilavuz-yukle";

/*
  KILAVUZ TEK PENCEREDE. Çalışmalarım'daki durum kartı ve personelin
  çalışma özeti aynı pencereyi açıyor; içerik iki yerde ayrı yazılsaydı
  biri güncellenir, öteki unutulurdu.

  Öğrencinin yüklediği kılavuz katalogda DEĞİL (çalışmaya bağlı ayrı
  tablo); pencere onu kataloğa göndermiyor. Kılavuz okunamadıysa yükleme
  teklif edilmiyor: geçici bir arıza, kurumunun kılavuzu olan öğrenciye
  kendi dosyasını yükletmemeli.

  Biçim kuralları doğrulama ekranındakiyle AYNI cümlelerle yazılıyor
  (lib/kilavuz-dogrulama): öğrenci onayladığı satırı burada tanıyor.
*/
export default function KilavuzPenceresi({
  calisma,
  uygulanan,
  kilavuzOkunamadi,
  triggerClassName = "merkez-baglanti",
  acikBasla = false,
  kisa = false,
}: {
  calisma: { id: string; university: string | null };
  uygulanan: AppliedGuideline | null;
  kilavuzOkunamadi: boolean;
  triggerClassName?: string;
  acikBasla?: boolean;
  /** Dar yerlerde (kartın alt satırı) düğme tek satır: ikinci satırdaki not yazılmaz. */
  kisa?: boolean;
}) {
  const bicimSatirlari = uygulanan ? bicimOzeti(uygulanan.settings) : [];
  const not = uygulanan
    ? uygulanan.dogrulandi
      ? uygulanan.label
      : "Kendi yüklediğiniz kılavuz kullanılıyor"
    : kilavuzOkunamadi
      ? "Kılavuz aranamadı; sayfayı yenileyin"
      : calisma.university
        ? "Onaylı kılavuz yok — kendi kılavuzunuzu yükleyin"
        : "Çalışma ayarlarından kurumu girin";

  return (
    <PanelDrawer
      triggerLabel={kisa ? (uygulanan ? "Kılavuz" : "Kılavuzu yükle") : "Yazım kılavuzu"}
      triggerNote={kisa ? undefined : not}
      triggerIcon={<BookOpenCheck size={18} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker="Tez yazım kılavuzu"
      title={uygulanan ? uygulanan.label : "Kılavuzunuzu yükleyin"}
      description={
        uygulanan
          ? uygulanan.dogrulandi
            ? "Kurumunuzun onaylı kılavuzu; kurallar editörde kendiliğinden uygulanıyor."
            : "Kurallar yüklediğiniz dosyadan çıkarıldı ve sizin onayınızla uygulanıyor; kurumunuzun resmî onayından geçmedi."
          : "Kurumunuzun onaylı kılavuzu katalogda yok. Elinizdeki kılavuzu yükleyin; sayfa düzeni, zorunlu bölümler ve kaynakça sistemi editöre kendiliğinden uygulansın. Bu, kurumunuzun resmî onayı yerine geçmez."
      }
      boy="tam"
      basaridaKapan={false}
      acikBasla={acikBasla}
    >
      {/*
        YAN YANA İKİ KART: solda editöre uygulanan kurallar, sağda
        kılavuzu yükleme ya da değiştirme. Literatür, Kaynakça ve Kanıt
        matrisi pencereleriyle aynı düzen.
      */}
      <div className="pencere-iki-kart">
        <section className="pencere-kart">
          <h3 className="pencere-kart-baslik">Uygulanan kurallar</h3>
          {uygulanan ? (
            <div className="kilavuz-bicim">
              <ul>
                <li>Kaynakça sistemi: {STIL_ETIKETLERI[uygulanan.citationStyle] ?? uygulanan.citationStyle}</li>
                {uygulanan.requiredSections.length > 0 ? <li>Zorunlu bölümler: {uygulanan.requiredSections.join(", ")}</li> : null}
                {uygulanan.minPages || uygulanan.maxPages ? (
                  <li>
                    Uzunluk: {uygulanan.minPages ?? "?"}–{uygulanan.maxPages ?? "?"} sayfa
                  </li>
                ) : null}
                {bicimSatirlari.map((satir) => (
                  <li key={satir}>{satir}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <p className="muted text-sm">Henüz kılavuz yok. Yüklediğinizde şunlar editöre kendiliğinden uygulanır:</p>
              <div className="kilavuz-bicim">
                <ul>
                  <li>Sayfa düzeni: kenar boşlukları, yazı tipi, satır aralığı</li>
                  <li>Zorunlu bölümler: teslim listesinde eksik olanlar söylenir</li>
                  <li>Kaynakça sistemi: APA, IEEE, Chicago…</li>
                </ul>
              </div>
            </>
          )}
        </section>

        <section className="pencere-kart">
          <h3 className="pencere-kart-baslik">{uygulanan ? "Kılavuzu değiştir" : "Kılavuzunuzu yükleyin"}</h3>
          {uygulanan?.dogrulandi ? (
            <>
              <p className="muted text-sm">
                Kurumunuzun onaylı kılavuzu kullanılıyor; değiştirmeniz gerekmiyor. Kurumunuz yanlışsa çalışma
                ayarlarından düzeltin.
              </p>
              <Link href="/dashboard/guidelines" className="projects-filter-button button-compact">
                Kılavuz kataloğunu aç
              </Link>
            </>
          ) : null}

          {uygulanan && !uygulanan.dogrulandi ? (
            <>
              <p className="muted text-sm">Yeni bir dosya yüklerseniz kurallar onunla değişir.</p>
              <KilavuzYukle projectId={calisma.id} />
              {/*
                Onay metni ÖLÇÜLEREK yazıldı: kılavuz kalkınca sayfa düzeni
                geri dönmüyor (lib/guideline-sync, mode:"none"). "Biçiminiz
                bozulacak" demek olmayan bir şeyden korkuturdu.
              */}
              <ActionForm
                className="mt-sm"
                action={kilavuzuKaldir}
                confirmMessage="Kılavuz kaldırılsın mı? Belgenizin sayfa düzeni olduğu gibi kalır; yalnızca belge kontrolü ve teslim listesi kurallara göre denetlenemez olur."
                successMessage="Kılavuz kaldırıldı."
              >
                <input type="hidden" name="projectId" value={calisma.id} />
                <button type="submit" className="link-button">
                  Kılavuzu kaldır
                </button>
              </ActionForm>
            </>
          ) : null}

          {!uygulanan && !kilavuzOkunamadi ? <KilavuzYukle projectId={calisma.id} /> : null}
          {!uygulanan && kilavuzOkunamadi ? (
            <p className="muted text-sm">Kılavuz aranamadı; sayfayı yenileyin. Geçici bir arızada dosya yüklemeniz gerekmez.</p>
          ) : null}
        </section>
      </div>
    </PanelDrawer>
  );
}
