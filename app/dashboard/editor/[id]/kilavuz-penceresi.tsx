import { BookOpenCheck } from "lucide-react";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import ActionForm from "@/app/dashboard/action-form";
import { kilavuzuKaldir } from "@/app/actions/calisma-kilavuzu";
import { STIL_ETIKETLERI } from "@/lib/atif/stiller";
import { bicimOzeti } from "@/lib/kilavuz-dogrulama";
import type { AppliedGuideline } from "@/lib/guideline-rules";
import KilavuzYukle from "./kilavuz-yukle";
import OrnekAtifFormu from "./ornek-atif-formu";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";

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
export default async function KilavuzPenceresi({
  calisma,
  uygulanan,
  kilavuzOkunamadi,
  triggerClassName = "merkez-baglanti",
  acikBasla = false,
  kisa = false,
}: {
  calisma: { id: string; university: string | null; ornek_atif?: string | null; guideline_id?: string | null };
  uygulanan: AppliedGuideline | null;
  kilavuzOkunamadi: boolean;
  triggerClassName?: string;
  acikBasla?: boolean;
  /** Dar yerlerde (kartın alt satırı) düğme tek satır: ikinci satırdaki not yazılmaz. */
  kisa?: boolean;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const bicimSatirlari = uygulanan ? bicimOzeti(uygulanan.settings, dil) : [];
  const not = uygulanan
    ? uygulanan.dogrulandi
      ? uygulanan.label
      : t({ tr: "Kendi yüklediğiniz kılavuz kullanılıyor", en: "Using the guideline you uploaded" })
    : kilavuzOkunamadi
      ? t({ tr: "Kılavuz aranamadı; sayfayı yenileyin", en: "Couldn't look up the guideline; refresh the page" })
      : calisma.university
        ? t({ tr: "Onaylı kılavuz yok — kendi kılavuzunuzu yükleyin", en: "No approved guideline — upload your own" })
        : t({ tr: "Çalışma ayarlarından kurumu girin", en: "Enter the institution in the work settings" });

  return (
    <PanelDrawer
      triggerLabel={
        kisa
          ? uygulanan
            ? t({ tr: "Kılavuz", en: "Guideline" })
            : t({ tr: "Kılavuzu yükle", en: "Upload guideline" })
          : t({ tr: "Yazım kılavuzu", en: "Writing guideline" })
      }
      triggerNote={kisa ? undefined : not}
      triggerIcon={<BookOpenCheck size={18} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker={t({ tr: "Tez yazım kılavuzu", en: "Thesis writing guideline" })}
      title={uygulanan ? uygulanan.label : t({ tr: "Kılavuzunuzu yükleyin", en: "Upload your guideline" })}
      description={
        uygulanan
          ? uygulanan.dogrulandi
            ? t({
                tr: "Kurumunuzun onaylı kılavuzu; kurallar editörde kendiliğinden uygulanıyor.",
                en: "Your institution's approved guideline; the rules are applied in the editor automatically.",
              })
            : t({
                tr: "Kurallar yüklediğiniz dosyadan çıkarıldı ve sizin onayınızla uygulanıyor; kurumunuzun resmî onayından geçmedi.",
                en: "The rules were extracted from the file you uploaded and are applied with your approval; they have not been officially approved by your institution.",
              })
          : t({
              tr: "Kurumunuzun onaylı kılavuzu katalogda yok. Elinizdeki kılavuzu yükleyin; sayfa düzeni, zorunlu bölümler ve kaynakça sistemi editöre kendiliğinden uygulansın. Bu, kurumunuzun resmî onayı yerine geçmez.",
              en: "Your institution's approved guideline is not in the catalog. Upload the guideline you have so that page layout, required sections and the citation system are applied to the editor automatically. This does not replace your institution's official approval.",
            })
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
          <h3 className="pencere-kart-baslik">{t({ tr: "Uygulanan kurallar", en: "Applied rules" })}</h3>
          {uygulanan ? (
            <div className="kilavuz-bicim">
              <ul>
                <li>
                  {t({ tr: "Kaynakça sistemi:", en: "Citation system:" })} {STIL_ETIKETLERI[uygulanan.citationStyle] ?? uygulanan.citationStyle}
                </li>
                {uygulanan.requiredSections.length > 0 ? <li>
                    {t({ tr: "Zorunlu bölümler:", en: "Required sections:" })} {uygulanan.requiredSections.join(", ")}
                  </li> : null}
                {uygulanan.minPages || uygulanan.maxPages ? (
                  <li>
                    {t({
                      tr: `Uzunluk: ${uygulanan.minPages ?? "?"}–${uygulanan.maxPages ?? "?"} sayfa`,
                      en: `Length: ${uygulanan.minPages ?? "?"}–${uygulanan.maxPages ?? "?"} pages`,
                    })}
                  </li>
                ) : null}
                {bicimSatirlari.map((satir) => (
                  <li key={satir}>{satir}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <p className="muted text-sm">
                {t({
                  tr: "Henüz kılavuz yok. Yüklediğinizde şunlar editöre kendiliğinden uygulanır:",
                  en: "No guideline yet. Once you upload one, these are applied to the editor automatically:",
                })}
              </p>
              <div className="kilavuz-bicim">
                <ul>
                  <li>{t({ tr: "Sayfa düzeni: kenar boşlukları, yazı tipi, satır aralığı", en: "Page layout: margins, font, line spacing" })}</li>
                  <li>{t({ tr: "Zorunlu bölümler: teslim listesinde eksik olanlar söylenir", en: "Required sections: missing ones are flagged in the submission checklist" })}</li>
                  <li>{t({ tr: "Kaynakça sistemi: APA, IEEE, Chicago…", en: "Citation system: APA, IEEE, Chicago…" })}</li>
                </ul>
              </div>
            </>
          )}
          {/* TYK'nın atıf örneği: stil adının söylemediği noktalama (lib/atif/tyk.ts). */}
          <OrnekAtifFormu projectId={calisma.id} mevcut={calisma.ornek_atif ?? null} />
        </section>

        <section className="pencere-kart">
          <h3 className="pencere-kart-baslik">{uygulanan ? t({ tr: "Kılavuzu değiştir", en: "Change guideline" }) : t({ tr: "Kılavuzunuzu yükleyin", en: "Upload your guideline" })}</h3>
          {/* Katalog bağlantısı yok: katalog personelin sayfası (lib/os/uygulamalar.ts). */}
          {/*
            KILAVUZ HER DURUMDA DEĞİŞTİRİLEBİLİR (02.11.2026, kurum sahibinin
            isteği). Eskiden kurumun onaylı kılavuzu bağlıyken burada yalnızca
            "değiştirmeniz gerekmiyor" yazıyordu; enstitü yeni sürüm yayımladığında
            ya da eşleşme yanlış olduğunda öğrencinin yolu yoktu. Yüklenen kılavuz
            öncelikli (lib/guideline-rules.ts); kaldırılınca onaylı olan geri gelir.
          */}
          {uygulanan?.dogrulandi ? (
            <>
              <p className="muted text-sm">
                {t({
                  tr: "Kurumunuzun onaylı kılavuzu kullanılıyor. Enstitünüz daha yeni bir sürüm yayımladıysa ya da farklı bir kılavuza tabiyseniz kendi dosyanızı yükleyin; yüklediğiniz kılavuz bu çalışmada onaylı olanın yerine geçer.",
                  en: "Your institution's approved guideline is in use. If your graduate school has published a newer version or you follow a different guideline, upload your own file; it replaces the approved one for this work.",
                })}
              </p>
              <KilavuzYukle projectId={calisma.id} />
            </>
          ) : null}

          {uygulanan && !uygulanan.dogrulandi ? (
            <>
              <p className="muted text-sm">
                {calisma.guideline_id
                  ? t({
                      tr: "Yeni bir dosya yüklerseniz kurallar onunla değişir. Kılavuzunuzu kaldırırsanız kurumunuzun onaylı kılavuzu yeniden uygulanır.",
                      en: "If you upload a new file, the rules change with it. If you remove your guideline, your institution's approved guideline applies again.",
                    })
                  : t({ tr: "Yeni bir dosya yüklerseniz kurallar onunla değişir.", en: "If you upload a new file, the rules change with it." })}
              </p>
              <KilavuzYukle projectId={calisma.id} />
              {/*
                Onay metni ÖLÇÜLEREK yazıldı: kılavuz kalkınca sayfa düzeni
                geri dönmüyor (lib/guideline-sync, mode:"none"). "Biçiminiz
                bozulacak" demek olmayan bir şeyden korkuturdu.
              */}
              <ActionForm
                className="mt-sm"
                action={kilavuzuKaldir}
                confirmMessage={t({
                  tr: "Kılavuz kaldırılsın mı? Belgenizin sayfa düzeni olduğu gibi kalır; yalnızca belge kontrolü ve teslim listesi kurallara göre denetlenemez olur.",
                  en: "Remove the guideline? Your document's page layout stays as it is; only the document check and submission checklist can no longer be checked against the rules.",
                })}
                successMessage={t({ tr: "Kılavuz kaldırıldı.", en: "Guideline removed." })}
              >
                <input type="hidden" name="projectId" value={calisma.id} />
                <button type="submit" className="link-button">
                  {t({ tr: "Kılavuzu kaldır", en: "Remove guideline" })}
                </button>
              </ActionForm>
            </>
          ) : null}

          {!uygulanan && !kilavuzOkunamadi ? <KilavuzYukle projectId={calisma.id} /> : null}
          {!uygulanan && kilavuzOkunamadi ? (
            <p className="muted text-sm">
              {t({
                tr: "Kılavuz aranamadı; sayfayı yenileyin. Geçici bir arızada dosya yüklemeniz gerekmez.",
                en: "Couldn't look up the guideline; refresh the page. You don't need to upload a file because of a temporary failure.",
              })}
            </p>
          ) : null}
        </section>
      </div>
    </PanelDrawer>
  );
}
