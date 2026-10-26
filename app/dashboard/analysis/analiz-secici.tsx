"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListMinus, ListPlus, Trash2 } from "lucide-react";
import { analizSirasi, analizSonucuSil, type CalismaAnalizi } from "@/app/actions/analiz-sonuclari";
import { analizEtiketi } from "@/lib/analiz-turleri";
import type { BicimKarari } from "@/lib/sayi-bicimi";
import { trTarih } from "@/lib/tr-time";
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
  const sirada = analizler.filter((a) => a.teze_eklenecek && !a.teze_eklendi);
  const eklenen = analizler.filter((a) => a.teze_eklendi);
  const digerleri = analizler.filter((a) => !a.teze_eklenecek && !a.teze_eklendi);

  return (
    <div className={sayfa ? "gb-sutunlar analiz-ikili" : "pencere-iki-kart"}>
      <section className={sayfa ? "gb-kart gb-sutun kayan-kart" : "pencere-kart"}>
        <DataAnalyzer calismalar={[calisma]} secilenCalisma={projectId} pencere={{ asistanAcik }} />
      </section>

      <section className={sayfa ? "gb-kart gb-sutun kayan-kart" : "pencere-kart pencere-sonuc"} aria-live="polite">
        <h3 className="pencere-kart-baslik">{sirada.length ? `Teze eklenecekler · ${sirada.length}` : "Teze eklenecekler"}</h3>
        {sirada.length ? (
          <ul className="secim-listesi">
            {sirada.map((a) => (
              <AnalizSatiri key={a.id} analiz={a} />
            ))}
          </ul>
        ) : (
          <p className="gb-bos">
            Henüz sırada sonuç yok. Analizi çalıştırdıktan sonra &quot;Teze ekleme sırasına koy&quot;a basın; sonuç
            editörde &quot;Analiz ekle&quot; ile imlecin olduğu yere eklenir.
          </p>
        )}

        {digerleri.length ? (
          <>
            <h3 className="pencere-kart-baslik">Kaydedilen analizler · {digerleri.length}</h3>
            <ul className="secim-listesi">
              {digerleri.map((a) => (
                <AnalizSatiri key={a.id} analiz={a} />
              ))}
            </ul>
          </>
        ) : null}

        {eklenen.length ? (
          <>
            <h3 className="pencere-kart-baslik">Teze eklenenler · {eklenen.length}</h3>
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
              {analizEtiketi(analiz.analiz_turu)} · {trTarih(analiz.created_at)}
              {analiz.teze_eklendi ? ` · teze eklendi ${trTarih(analiz.teze_eklendi)}` : ""}
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
            onClick={() => calistir(() => analizSirasi(analiz.id, false), "Sıradan çıkarıldı.")}
          >
            <ListMinus size={14} aria-hidden="true" /> Sıradan çıkar
          </button>
        ) : (
          <button
            type="button"
            className="projects-filter-button button-compact"
            disabled={bekleniyor}
            onClick={() => calistir(() => analizSirasi(analiz.id, true), "Teze ekleme sırasına kondu.")}
          >
            {analiz.teze_eklendi ? <Check size={14} aria-hidden="true" /> : <ListPlus size={14} aria-hidden="true" />}
            {analiz.teze_eklendi ? "Yeniden sıraya koy" : "Sıraya koy"}
          </button>
        )}
        <button
          type="button"
          className="projects-filter-button button-compact"
          aria-label={`${analiz.baslik}: sil`}
          disabled={bekleniyor}
          onClick={() => {
            if (!window.confirm("Bu analiz sonucu silinsin mi? Tezinize eklenmiş metin değişmez.")) return;
            calistir(() => analizSonucuSil(analiz.id), "Silindi.");
          }}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}
