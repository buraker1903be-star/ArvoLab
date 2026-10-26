"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListMinus, ListPlus, Trash2 } from "lucide-react";
import { analizSirasi, analizSonucuSil, type CalismaAnalizi } from "@/app/actions/analiz-sonuclari";
import { PROGRAM_KARTLARI, YONTEM_KARTLARI, type AnalizAraci } from "@/lib/analiz-betik";
import { analizEtiketi, type AnalizTuru } from "@/lib/analiz-turleri";
import type { BicimKarari } from "@/lib/sayi-bicimi";
import { trTarih } from "@/lib/tr-time";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import { showToast } from "@/app/dashboard/_components/toast-events";
import DataAnalyzer from "./data-analyzer";

/*
  Analiz penceresinin içi (analiz-penceresi.tsx). Solda iki adım:
  program kartı, yöntem kartı. Yönteme basınca veri yükleme ve hesap iç
  pencerede açılır; seçilen program yalnızca sonucun yanında verilen
  betiğin dilini belirler. Sağda bu çalışmanın analizleri: teze
  eklenecekler başta.
*/
export default function AnalizSecici({
  projectId,
  calisma,
  asistanAcik,
  analizler,
}: {
  projectId: string;
  calisma: { id: string; title: string; sayiBicimi?: BicimKarari };
  asistanAcik: boolean;
  analizler: CalismaAnalizi[];
}) {
  const [arac, setArac] = useState<AnalizAraci>("spss");
  const [tur, setTur] = useState<AnalizTuru | null>(null);
  const program = PROGRAM_KARTLARI.find((k) => k.anahtar === arac)!;

  const sirada = analizler.filter((a) => a.teze_eklenecek && !a.teze_eklendi);
  const eklenen = analizler.filter((a) => a.teze_eklendi);
  const digerleri = analizler.filter((a) => !a.teze_eklenecek && !a.teze_eklendi);

  return (
    <div className="pencere-iki-kart">
      <section className="pencere-kart">
        <h3 className="pencere-kart-baslik">1. Program</h3>
        <div className="analiz-kartlari" data-boy="program">
          {PROGRAM_KARTLARI.map((k) => (
            <button
              key={k.anahtar}
              type="button"
              className="analiz-karti"
              aria-pressed={k.anahtar === arac}
              disabled={k.desteklenmiyor}
              title={k.desteklenmiyor ? k.aciklama : undefined}
              onClick={() => k.anahtar !== "ansys" && setArac(k.anahtar)}
            >
              <b>{k.ad}</b>
              {k.desteklenmiyor ? <small>Desteklenmiyor</small> : null}
            </button>
          ))}
        </div>
        {/* Seçili programın ne verdiği tek satırda; ANSYS'in neden kapalı olduğu da burada okunur. */}
        <p className="hint">{program.aciklama} ANSYS mühendislik simülasyonudur, ArvoLab çalıştıramaz.</p>

        <h3 className="pencere-kart-baslik">2. Yöntem</h3>
        <div className="analiz-kartlari">
          {YONTEM_KARTLARI.map((k) => (
            <button key={k.tur} type="button" className="analiz-karti" onClick={() => setTur(k.tur)}>
              <b>{k.ad}</b>
              <small>{k.aciklama}</small>
            </button>
          ))}
        </div>

        {/*
          Tek iç pencere, seçilen yöntemle açılır. key= ile her seçimde
          yeniden kurulur: önceki yöntemin değişken seçimi ve sonucu yeni
          yöntemin altında kalmasın (React 19: etkide setState yok).
        */}
        <PanelDrawer
          tetiksiz
          triggerLabel="Analiz"
          acik={tur !== null}
          onAcikDegis={(acik) => {
            if (!acik) setTur(null);
          }}
          boy="tam"
          kicker={`${program.ad} · ${calisma.title}`}
          title={tur ? analizEtiketi(tur) : "Analiz"}
          description="Dosyanızı yükleyin, değişkenleri seçin, analizi çalıştırın. Asistan sonucu okuyup eksikleri söyler; sonucu teze ekleme sırasına koyabilirsiniz."
          basaridaKapan={false}
        >
          {tur ? (
            <DataAnalyzer
              key={`${arac}-${tur}`}
              calismalar={[calisma]}
              secilenCalisma={projectId}
              pencere={{ arac, tur, asistanAcik }}
            />
          ) : null}
        </PanelDrawer>
      </section>

      <section className="pencere-kart pencere-sonuc" aria-live="polite">
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
