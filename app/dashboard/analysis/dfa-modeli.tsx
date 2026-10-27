"use client";

import { Plus, Trash2 } from "lucide-react";
import SutunSecimi from "./sutun-secimi";

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
}: {
  sutunlar: string[];
  faktorler: DfaFaktoru[];
  degistir: (yeni: DfaFaktoru[]) => void;
}) {
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
        Her faktörün adını yazın ve maddelerini işaretleyin (AFA sonucunuz ya da ölçeğin özgün yapısı). Bir madde yalnızca
        bir faktöre ait olabilir; ters maddeleri önce Veri hazırlama bölümünde çevirin.
      </p>
      {faktorler.map((f, k) => (
        <div key={k} className="dfa-faktor">
          <div className="cluster">
            <label>
              <span>{k + 1}. faktörün adı</span>
              <input value={f.ad} maxLength={40} onChange={(e) => guncelle(k, { ad: e.target.value })} />
            </label>
            {faktorler.length > 1 ? (
              <button
                type="button"
                className="projects-filter-button button-compact"
                aria-label={`${f.ad || `${k + 1}. faktör`}: kaldır`}
                onClick={() => degistir(faktorler.filter((_, i) => i !== k))}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <SutunSecimi
            etiket={`${f.ad || `${k + 1}. faktör`} maddeleri`}
            sutunlar={sutunlar}
            secili={f.maddeler}
            degistir={(m) => guncelle(k, { maddeler: m })}
          />
        </div>
      ))}
      {faktorler.length < 8 ? (
        <button
          type="button"
          className="projects-filter-button button-compact"
          onClick={() => degistir([...faktorler, { ad: `F${faktorler.length + 1}`, maddeler: [] }])}
        >
          <Plus size={14} aria-hidden="true" /> Faktör ekle
        </button>
      ) : null}
    </div>
  );
}
