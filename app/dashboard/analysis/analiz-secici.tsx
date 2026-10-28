"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListMinus, ListPlus, Trash2 } from "lucide-react";
import { analizSirasi, analizSonucuSil, type CalismaAnalizi } from "@/app/actions/analiz-sonuclari";
import { analizEtiketi } from "@/lib/analiz-turleri";
import type { BicimKarari } from "@/lib/sayi-bicimi";
import { useCeviri, useDil, useTarihler } from "@/app/_components/dil-saglayici";
import { showToast } from "@/app/dashboard/_components/toast-events";
import DataAnalyzer from "./data-analyzer";

/*
  Analiz penceresinin içi (analiz-penceresi.tsx). İki kart, tek yer:
  solda dosya, yöntem kartları, sonuç ve asistanın notları (DataAnalyzer
  pencere kipi); sağda bu çalışmanın analizleri, teze eklenecekler başta.

  Eskiden solda program ve yöntem kartları vardı, yöntem iç pencerede
  açılıyor ve her yöntemde dosya yeniden yükleniyordu (aynı gün, ilk
  sürüm). Öğrenci iki pencere arasında gidip geliyordu.
*/
export default function AnalizSecici({
  projectId,
  calisma,
  asistanAcik,
  analizler,
  sayfa = false,
}: {
  projectId: string;
  calisma: { id: string; title: string; sayiBicimi?: BicimKarari };
  asistanAcik: boolean;
  analizler: CalismaAnalizi[];
  /*
    Analiz Merkezi sayfasında: aynı iki kart, pencere yerine sayfanın
    kaymayan tek ekranında (gb-tek-ekran); uzun içerik kartın içinde kayar.
  */
  sayfa?: boolean;
}) {
  const t = useCeviri();
  const sirada = analizler.filter((a) => a.teze_eklenecek && !a.teze_eklendi);
  const eklenen = analizler.filter((a) => a.teze_eklendi);
  const digerleri = analizler.filter((a) => !a.teze_eklenecek && !a.teze_eklendi);

  return (
    <div className={sayfa ? "gb-sutunlar analiz-ikili" : "pencere-iki-kart"}>
      <section className={sayfa ? "gb-kart gb-sutun kayan-kart" : "pencere-kart"}>
        <DataAnalyzer calismalar={[calisma]} secilenCalisma={projectId} pencere={{ asistanAcik }} />
      </section>

      <section className={sayfa ? "gb-kart gb-sutun kayan-kart" : "pencere-kart pencere-sonuc"} aria-live="polite">
        <h3 className="pencere-kart-baslik">{sirada.length ? t({ tr: `Teze eklenecekler · ${sirada.length}`, en: `To add to thesis · ${sirada.length}` }) : t({ tr: "Teze eklenecekler", en: "To add to thesis" })}</h3>
        {sirada.length ? (
          <ul className="secim-listesi">
            {sirada.map((a) => (
              <AnalizSatiri key={a.id} analiz={a} />
            ))}
          </ul>
        ) : (
          <p className="gb-bos">
            {t({
              tr: "Henüz sırada sonuç yok. Analizi çalıştırdıktan sonra \"Teze ekleme sırasına koy\"a basın; sonuç editörde \"Analiz ekle\" ile imlecin olduğu yere eklenir.",
              en: "No results queued yet. After running an analysis, press \"Queue for thesis\"; in the editor, \"Add analysis\" inserts the result at the cursor.",
            })}
          </p>
        )}

        {digerleri.length ? (
          <>
            <h3 className="pencere-kart-baslik">{t({ tr: "Kaydedilen analizler", en: "Saved analyses" })} · {digerleri.length}</h3>
            <ul className="secim-listesi">
              {digerleri.map((a) => (
                <AnalizSatiri key={a.id} analiz={a} />
              ))}
            </ul>
          </>
        ) : null}

        {eklenen.length ? (
          <>
            <h3 className="pencere-kart-baslik">{t({ tr: "Teze eklenenler", en: "Added to thesis" })} · {eklenen.length}</h3>
            <ul className="secim-listesi">
              {eklenen.map((a) => (
                <AnalizSatiri key={a.id} analiz={a} />
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}

function AnalizSatiri({ analiz }: { analiz: CalismaAnalizi }) {
  const t = useCeviri();
  const dil = useDil();
  const { tarih } = useTarihler();
  const router = useRouter();
  const [bekleniyor, basla] = useTransition();
  const sirada = analiz.teze_eklenecek && !analiz.teze_eklendi;

  const calistir = (islem: () => Promise<{ error?: string }>, basari: string) =>
    basla(async () => {
      const sonuc = await islem();
      if (sonuc.error) {
        showToast("error", sonuc.error);
        return;
      }
      showToast("success", basari);
      router.refresh();
    });

  return (
    <li className="analiz-satiri">
      <details>
        <summary>
          <span className="kanit-kayit-govde">
            <b>{analiz.baslik}</b>
            <small>
              {analizEtiketi(analiz.analiz_turu, dil)} · {tarih(analiz.created_at)}
              {analiz.teze_eklendi
                ? t({ tr: ` · teze eklendi ${tarih(analiz.teze_eklendi)}`, en: ` · added to thesis ${tarih(analiz.teze_eklendi)}` })
                : ""}
            </small>
          </span>
        </summary>
        <p className="analiz-apa">{analiz.apa_metni}</p>
      </details>
      <span className="analiz-satiri-eylem">
        {sirada ? (
          <button
            type="button"
            className="projects-filter-button button-compact"
            disabled={bekleniyor}
            onClick={() => calistir(() => analizSirasi(analiz.id, false), t({ tr: "Sıradan çıkarıldı.", en: "Removed from queue." }))}
          >
            <ListMinus size={14} aria-hidden="true" /> {t({ tr: "Sıradan çıkar", en: "Remove from queue" })}
          </button>
        ) : (
          <button
            type="button"
            className="projects-filter-button button-compact"
            disabled={bekleniyor}
            onClick={() => calistir(() => analizSirasi(analiz.id, true), t({ tr: "Teze ekleme sırasına kondu.", en: "Queued for the thesis." }))}
          >
            {analiz.teze_eklendi ? <Check size={14} aria-hidden="true" /> : <ListPlus size={14} aria-hidden="true" />}
            {analiz.teze_eklendi ? t({ tr: "Yeniden sıraya koy", en: "Queue again" }) : t({ tr: "Sıraya koy", en: "Add to queue" })}
          </button>
        )}
        <button
          type="button"
          className="projects-filter-button button-compact"
          aria-label={t({ tr: `${analiz.baslik}: sil`, en: `${analiz.baslik}: delete` })}
          disabled={bekleniyor}
          onClick={() => {
            if (!window.confirm(t({ tr: "Bu analiz sonucu silinsin mi? Tezinize eklenmiş metin değişmez.", en: "Delete this analysis result? Text already added to your thesis will not change." }))) return;
            calistir(() => analizSonucuSil(analiz.id), t({ tr: "Silindi.", en: "Deleted." }));
          }}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}
