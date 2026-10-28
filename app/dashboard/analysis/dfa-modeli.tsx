"use client";

import { Plus, Trash2 } from "lucide-react";
import SutunSecimi from "./sutun-secimi";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  DFA MODEL TANIMI (27.10.2026): faktörler ve maddeleri.

  AMOS'ta yol şeması çizilerek kurulan model burada liste: her faktörün
  adı ve maddeleri. Bir madde yalnızca BİR faktöre yüklenir (basit yapı);
  başka bir faktörde işaretlenince öncekinden kalkar — iki faktöre birden
  yazılan madde öğrencinin kastetmediği bir çapraz yük olurdu.
*/
export type DfaFaktoru = { ad: string; maddeler: string[] };

export default function DfaModeli({
  sutunlar,
  faktorler,
  degistir,
  hataKovaryanslari,
  hataKovaryanslariniDegistir,
}: {
  sutunlar: string[];
  faktorler: DfaFaktoru[];
  degistir: (yeni: DfaFaktoru[]) => void;
  /** Değişiklik indekslerinden eklenen hata kovaryansları (madde adı çiftleri). */
  hataKovaryanslari: [string, string][];
  hataKovaryanslariniDegistir: (yeni: [string, string][]) => void;
}) {
  const t = useCeviri();
  const faktorAdi = (f: DfaFaktoru, k: number) => f.ad || t({ tr: `${k + 1}. faktör`, en: `Factor ${k + 1}` });
  const guncelle = (k: number, yeni: Partial<DfaFaktoru>) =>
    degistir(
      faktorler.map((f, i) => {
        if (i === k) return { ...f, ...yeni };
        // Bu faktöre eklenen madde diğerlerinden çıkar.
        return yeni.maddeler ? { ...f, maddeler: f.maddeler.filter((m) => !yeni.maddeler!.includes(m)) } : f;
      }),
    );

  return (
    <div className="project-form-full dfa-modeli">
      <p className="hint">
        {t({
          tr: "Her faktörün adını yazın ve maddelerini işaretleyin (AFA sonucunuz ya da ölçeğin özgün yapısı). Bir madde yalnızca bir faktöre ait olabilir; ters maddeleri önce Veri hazırlama bölümünde çevirin.",
          en: "Name each factor and tick its items (from your EFA result or the scale's original structure). An item can belong to only one factor; reverse-score negatively worded items first under Data preparation.",
        })}
      </p>
      {faktorler.map((f, k) => (
        <div key={k} className="dfa-faktor">
          <div className="cluster">
            <label>
              <span>{t({ tr: `${k + 1}. faktörün adı`, en: `Name of factor ${k + 1}` })}</span>
              <input value={f.ad} maxLength={40} onChange={(e) => guncelle(k, { ad: e.target.value })} />
            </label>
            {faktorler.length > 1 ? (
              <button
                type="button"
                className="projects-filter-button button-compact"
                aria-label={t({ tr: `${faktorAdi(f, k)}: kaldır`, en: `${faktorAdi(f, k)}: remove` })}
                onClick={() => degistir(faktorler.filter((_, i) => i !== k))}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <SutunSecimi
            etiket={t({ tr: `${faktorAdi(f, k)} maddeleri`, en: `${faktorAdi(f, k)} items` })}
            sutunlar={sutunlar}
            secili={f.maddeler}
            degistir={(m) => guncelle(k, { maddeler: m })}
          />
        </div>
      ))}
      {hataKovaryanslari.length ? (
        <div className="dfa-faktor">
          <strong className="text-sm">{t({ tr: "Serbest bırakılan hata kovaryansları", en: "Freed error covariances" })}</strong>
          <ul className="turetilen-sutunlar">
            {hataKovaryanslari.map(([a, b], k) => (
              <li key={`${a}-${b}`} className="cluster">
                <span>
                  {a} ↔ {b}
                </span>
                <button
                  type="button"
                  className="projects-filter-button button-compact"
                  aria-label={t({ tr: `${a} ↔ ${b}: kaldır`, en: `${a} ↔ ${b}: remove` })}
                  onClick={() => hataKovaryanslariniDegistir(hataKovaryanslari.filter((_, i) => i !== k))}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {faktorler.length < 8 ? (
        <button
          type="button"
          className="projects-filter-button button-compact"
          onClick={() => degistir([...faktorler, { ad: `F${faktorler.length + 1}`, maddeler: [] }])}
        >
          <Plus size={14} aria-hidden="true" /> {t({ tr: "Faktör ekle", en: "Add factor" })}
        </button>
      ) : null}
    </div>
  );
}
