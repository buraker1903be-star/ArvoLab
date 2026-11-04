"use client";

import { useState } from "react";
import { Check, Circle, FileUp, ListChecks, Plus, Wand2 } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import YanKutu from "./yan-kutu";
import type { OutlineHeading, SectionStatus } from "./editor-navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";

interface ManuscriptOutlineProps {
  sections: SectionStatus[];
  documentEmpty: boolean;
  onJump: (heading: OutlineHeading) => void;
  onInsert: (sections: string[]) => void;
  onTemplate: () => void;
  /** Word dosyasından aktarma penceresini açar */
  onImport: () => void;
}

/*
  KILAVUZ BÖLÜMLERİ: yazım panelinin "Teslim" görünümünde bir satır ve
  penceresi. Eskiden bu bileşen "İncele" panelinin kendisiydi (kabuk,
  başlık, kontrol kartı ve öteki kutular onun çocuklarıydı); Signature
  OS Phase 2'de panel tek bir bileşene (yan-panel.tsx) geçti ve burada
  yalnızca bölümlerin işi kaldı.
*/
export default function ManuscriptOutline({
  sections,
  documentEmpty,
  onJump,
  onInsert,
  onTemplate,
  onImport,
}: ManuscriptOutlineProps) {
  const missing = sections.filter((item) => !item.heading).map((item) => item.section);
  const [acik, setAcik] = useState(false);
  const t = useCeviri();

  return (
    <>
        {sections.length > 0 ? (
          <YanKutu
            ikon={ListChecks}
            baslik={t({ tr: "Bölümler", en: "Sections" })}
            aciklama={t({ tr: "Kılavuzun zorunlu bölümleri var mı; eksik olanı kılavuzdaki sırasıyla ekler.", en: "Checks the guideline's required sections; adds missing ones in order." })}
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
    </>
  );
}
