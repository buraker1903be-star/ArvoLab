"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { sekmeTusu } from "@/lib/os5/bilesen";

/*
  SEKMELER (Signature OS 5). Bugün uygulamada ortak bir sekme bileşeni
  yok; her ekran kendi sekmesini yazmış. WAI-ARIA "tabs" kalıbı: yalnızca
  seçili sekme Tab sırasında (roving tabindex), ok tuşları dolaşır ve
  seçer, panel sekmeye aria-labelledby ile bağlı.
*/
export type Sekme = { kimlik: string; etiket: string; icerik: ReactNode };

export function Sekmeler({ sekmeler, etiket, baslangic }: { sekmeler: Sekme[]; etiket: string; baslangic?: string }) {
  const kok = useId();
  const [secili, setSecili] = useState(baslangic ?? sekmeler[0]?.kimlik);
  const dugmeler = useRef<(HTMLButtonElement | null)[]>([]);
  const sira = Math.max(0, sekmeler.findIndex((s) => s.kimlik === secili));

  const tus = (olay: KeyboardEvent<HTMLDivElement>) => {
    const yeni = sekmeTusu(olay.key, sira, sekmeler.length);
    if (yeni === null) return;
    olay.preventDefault();
    setSecili(sekmeler[yeni].kimlik);
    dugmeler.current[yeni]?.focus();
  };

  return (
    <div>
      <div className="os5-sekme-listesi" role="tablist" aria-label={etiket} onKeyDown={tus}>
        {sekmeler.map((s, i) => {
          const seciliMi = i === sira;
          return (
            <button
              key={s.kimlik}
              ref={(el) => {
                dugmeler.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${kok}-sekme-${s.kimlik}`}
              aria-selected={seciliMi}
              aria-controls={`${kok}-panel-${s.kimlik}`}
              tabIndex={seciliMi ? 0 : -1}
              className="os5-sekme"
              onClick={() => setSecili(s.kimlik)}
            >
              {s.etiket}
            </button>
          );
        })}
      </div>
      {sekmeler.map((s, i) => (
        <div
          key={s.kimlik}
          role="tabpanel"
          id={`${kok}-panel-${s.kimlik}`}
          aria-labelledby={`${kok}-sekme-${s.kimlik}`}
          tabIndex={0}
          hidden={i !== sira}
          className="os5-sekme-paneli"
        >
          {s.icerik}
        </div>
      ))}
    </div>
  );
}
