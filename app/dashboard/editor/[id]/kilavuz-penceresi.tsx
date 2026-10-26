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
      boy="genis"
      basaridaKapan={false}
      acikBasla={acikBasla}
    >
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
      ) : null}

      {uygulanan?.dogrulandi ? (
        <Link href="/dashboard/guidelines" className="projects-filter-button mt-sm">
          Kılavuz kataloğunu aç
        </Link>
      ) : null}

      {uygulanan && !uygulanan.dogrulandi ? (
        <>
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
            <button type="submit" className="button-danger">
              Kılavuzu kaldır
            </button>
          </ActionForm>
          <details className="form-details mt-md">
            <summary>Başka dosya yükle</summary>
            <KilavuzYukle projectId={calisma.id} />
          </details>
        </>
      ) : null}

      {!uygulanan && !kilavuzOkunamadi ? <KilavuzYukle projectId={calisma.id} /> : null}
    </PanelDrawer>
  );
}
