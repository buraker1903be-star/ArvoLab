"use client";

import { useState, type ReactNode } from "react";
import { Check, Circle, FileUp, ListChecks, Plus, Wand2 } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import YanKutu from "./yan-kutu";
import type { OutlineHeading, SectionStatus } from "./editor-navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";

interface ManuscriptOutlineProps {
  /** En üstteki kart: kontrol düğmeleri, ilerleme ve çıktı (manuscript-editor.tsx) */
  ust?: ReactNode;
  sections: SectionStatus[];
  documentEmpty: boolean;
  onJump: (heading: OutlineHeading) => void;
  onInsert: (sections: string[]) => void;
  onTemplate: () => void;
  /** Word dosyasından aktarma penceresini açar */
  onImport: () => void;
  /** Kılavuz bölümleri kutusunun yanındaki küçük kutular (içindekiler, kaynaklar, yorumlar) */
  children?: ReactNode;
}

/*
  Yazarken yol gösteren sağ panel. Sıra (26.10.2026, kurum sahibinin
  isteği): kontrol kartı, kılavuz bölümleri, içindekiler, bekleyen
  kaynaklar, yorumlar. Eskiden "İlerleme" ayrı karttı ve "Belge planı"
  panelin altında her zaman açık uzun bir listeydi; ilerleme kontrol
  kartına, belge planı İçindekiler penceresine taşındı.
*/
export default function ManuscriptOutline({
  ust,
  sections,
  documentEmpty,
  onJump,
  onInsert,
  onTemplate,
  onImport,
  children,
}: ManuscriptOutlineProps) {
  const missing = sections.filter((item) => !item.heading).map((item) => item.section);
  const [acik, setAcik] = useState(false);
  const t = useCeviri();

  return (
    <aside className="manuscript-outline" aria-label={t({ tr: "Belge planı", en: "Document outline" })}>
      {ust}

      <div className="yan-kutular">
        {sections.length > 0 ? (
          <YanKutu
            ikon={ListChecks}
            baslik={t({ tr: "Bölümler", en: "Sections" })}
            deger={`${sections.length - missing.length}/${sections.length}`}
            alt={
              missing.length
                ? t({ tr: `${missing.length} bölüm eksik`, en: `${missing.length} sections missing` })
                : t({ tr: "kılavuzun bölümleri tamam", en: "all guideline sections present" })
            }
            ton={missing.length ? "warning" : "success"}
            onClick={() => setAcik(true)}
          />
        ) : null}
        {children}
      </div>

      {sections.length > 0 ? (
        <Dialog
          open={acik}
          onClose={() => setAcik(false)}
          kicker={t({ tr: "Kılavuz", en: "Guideline" })}
          title={t({ tr: "Kılavuz bölümleri", en: "Guideline sections" })}
          description={t({
            tr: "Kılavuzun zorunlu bölümleri. Var olana basınca o bölüme gidilir; eksik olan kılavuzdaki sırasına göre eklenir.",
            en: "The sections your guideline requires. Click an existing one to jump to it; a missing one is inserted in the guideline's order.",
          })}
        >
          <div className="stack">
          {documentEmpty ? (
            <button type="button" className="projects-primary-button outline-action" onClick={() => {
                setAcik(false);
                onTemplate();
              }}>
              <Wand2 size={15} aria-hidden="true" />
              {t({ tr: "Kılavuza göre taslak oluştur", en: "Create outline from guideline" })}
            </button>
          ) : null}

          <ul className="outline-sections">
            {sections.map((item) => (
              <li key={item.section} data-found={item.heading ? "true" : "false"}>
                {item.heading ? (
                  <button type="button" onClick={() => {
                      setAcik(false);
                      onJump(item.heading!);
                    }} title={t({ tr: "Bölüme git", en: "Go to section" })}>
                    <Check size={14} aria-hidden="true" />
                    <span>{item.section}</span>
                  </button>
                ) : (
                  <button type="button" onClick={() => {
                      setAcik(false);
                      onInsert([item.section]);
                    }} title={t({ tr: "Bu bölümü ekle", en: "Add this section" })}>
                    <Circle size={14} aria-hidden="true" />
                    <span>{item.section}</span>
                    <Plus size={14} aria-hidden="true" className="outline-add" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!documentEmpty && missing.length > 1 ? (
            <button type="button" className="projects-filter-button outline-action" onClick={() => {
                setAcik(false);
                onInsert(missing);
              }}>
              <Plus size={15} aria-hidden="true" />
              {t({ tr: `Eksik ${missing.length} bölümü ekle`, en: `Add ${missing.length} missing sections` })}
            </button>
          ) : null}
          </div>
        </Dialog>
      ) : null}

      {documentEmpty ? (
        <button type="button" className="projects-filter-button outline-action" onClick={onImport}>
          <FileUp size={15} aria-hidden="true" />
          {t({ tr: "Word dosyasından aktar", en: "Import from Word file" })}
        </button>
      ) : null}
    </aside>
  );
}
