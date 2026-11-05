"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { PANEL_GORUNUMLERI, type PanelBicimi, type PanelGorunumu } from "@/lib/yazim-yan-panel";

/*
  YAZIM EKRANININ TEK SAĞ PANELİ (Signature OS Phase 2, 04.11.2026).
  Kararlar lib/yazim-yan-panel.ts'te (birim testli); burada çizim,
  klavye ve odak.

  Sekmeler WAI-ARIA sekme deseni: yalnızca seçili sekme Tab sırasında,
  sekmeler arası ok tuşları, Home/End. Görünümler kapanınca SÖKÜLMÜYOR,
  gizleniyor: asistanla yarım kalan sohbet başka sekmeye bakıp dönünce
  kaybolmasın.

  Tablet ve telefonda panel belgenin üstüne açılan bir sayfa: Esc kapatır
  ve odak paneli açan düğmeye döner. Kipli değil (belge arkada kalır ve
  kaydırılabilir), bu yüzden odak tuzağı yok — telefonda alttan açılan
  sayfa ekranın %85'i, üstteki boşluğa dokunmak da kapatır.
*/

export type PanelSekmesi = { id: PanelGorunumu; etiket: string; ikon: LucideIcon; rozet?: string };

/* Ekran sınıfı kancası 4.1'de ortak bileşenlere taşındı (_components/ekran-sinifi.ts). */

export default function YanPanel({
  acik,
  bicim,
  gorunum,
  sekmeler,
  onGorunum,
  onKapat,
  icerik,
}: {
  acik: boolean;
  bicim: PanelBicimi;
  gorunum: PanelGorunumu;
  sekmeler: PanelSekmesi[];
  onGorunum: (gorunum: PanelGorunumu) => void;
  onKapat: () => void;
  /** Her görünümün içeriği; null olan görünüm henüz kurulmamıştır (ör. asistan ilk açılışa kadar). */
  icerik: Record<PanelGorunumu, ReactNode>;
}) {
  const t = useCeviri();
  const kimlik = useId();
  const sekmeRefleri = useRef<Partial<Record<PanelGorunumu, HTMLButtonElement | null>>>({});
  const acan = useRef<Element | null>(null);

  /*
    Sayfa biçiminde açılınca odak seçili sekmeye gelir, kapanınca açan
    düğmeye döner. Sütun biçiminde odak yerinde kalır: masaüstünde panel
    belgenin yanında, açılması yazanın imlecini çalmamalı.
  */
  useEffect(() => {
    if (!acik || bicim !== "sayfa") return;
    acan.current = document.activeElement;
    sekmeRefleri.current[gorunum]?.focus();
    return () => {
      if (acan.current instanceof HTMLElement && document.contains(acan.current)) acan.current.focus();
    };
    // Görünüm değişince odak yeniden çekilmesin: yalnızca açılış ve kapanış.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik, bicim]);

  const tusla = (olay: KeyboardEvent<HTMLDivElement>) => {
    const sira = sekmeler.map((s) => s.id);
    const i = sira.indexOf(gorunum);
    let hedef: PanelGorunumu | null = null;
    if (olay.key === "ArrowRight" || olay.key === "ArrowDown") hedef = sira[(i + 1) % sira.length];
    else if (olay.key === "ArrowLeft" || olay.key === "ArrowUp") hedef = sira[(i - 1 + sira.length) % sira.length];
    else if (olay.key === "Home") hedef = sira[0];
    else if (olay.key === "End") hedef = sira[sira.length - 1];
    if (!hedef) return;
    olay.preventDefault();
    onGorunum(hedef);
    sekmeRefleri.current[hedef]?.focus();
  };

  return (
    <>
      {acik && bicim === "sayfa" ? (
        <button type="button" className="yan-panel-ortu" tabIndex={-1} aria-label={t({ tr: "Paneli kapat", en: "Close panel" })} onClick={onKapat} />
      ) : null}
      <aside
        id="yazim-yan-panel"
        className="yan-panel"
        data-bicim={bicim}
        hidden={!acik}
        aria-label={t({ tr: "Yazım paneli", en: "Writing panel" })}
        onKeyDown={(olay) => {
          if (olay.key === "Escape" && bicim === "sayfa" && !olay.defaultPrevented && !document.querySelector("dialog[open], .drawer-root.open")) {
            olay.preventDefault();
            onKapat();
          }
        }}
      >
        <header className="yan-panel-bas">
          <div className="yan-panel-sekmeler" role="tablist" aria-label={t({ tr: "Panel görünümleri", en: "Panel views" })} onKeyDown={tusla}>
            {sekmeler.map((s) => {
              const secili = s.id === gorunum;
              const Ikon = s.ikon;
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    sekmeRefleri.current[s.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${kimlik}-sekme-${s.id}`}
                  aria-selected={secili}
                  aria-controls={`${kimlik}-gorunum-${s.id}`}
                  tabIndex={secili ? 0 : -1}
                  onClick={() => onGorunum(s.id)}
                >
                  <Ikon size={15} aria-hidden="true" />
                  <span>{s.etiket}</span>
                  {s.rozet ? <small className="yan-panel-rozet">{s.rozet}</small> : null}
                </button>
              );
            })}
          </div>
          <button type="button" className="yan-panel-kapat" onClick={onKapat} aria-label={t({ tr: "Paneli kapat", en: "Close panel" })} title={t({ tr: "Paneli kapat", en: "Close panel" })}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        {PANEL_GORUNUMLERI.map((g) =>
          icerik[g] === null ? null : (
            <div
              key={g}
              role="tabpanel"
              id={`${kimlik}-gorunum-${g}`}
              aria-labelledby={`${kimlik}-sekme-${g}`}
              className="yan-panel-govde"
              data-gorunum={g}
              hidden={g !== gorunum}
            >
              {icerik[g]}
            </div>
          ),
        )}
      </aside>
    </>
  );
}
