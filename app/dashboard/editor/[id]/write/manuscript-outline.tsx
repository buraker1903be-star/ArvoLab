"use client";

import { useState, type ReactNode } from "react";
import { Check, Circle, FileUp, ListChecks, Plus, Wand2 } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import YanKutu from "./yan-kutu";
import type { OutlineHeading, SectionStatus } from "./editor-navigation";

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

  return (
    <aside className="manuscript-outline" aria-label="Belge planı">
      {ust}

      <div className="yan-kutular">
        {sections.length > 0 ? (
          <YanKutu
            ikon={ListChecks}
            baslik="Bölümler"
            deger={`${sections.length - missing.length}/${sections.length}`}
            alt={missing.length ? `${missing.length} bölüm eksik` : "kılavuzun bölümleri tamam"}
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
          kicker="Kılavuz"
          title="Kılavuz bölümleri"
          description="Kılavuzun zorunlu bölümleri. Var olana basınca o bölüme gidilir; eksik olan kılavuzdaki sırasına göre eklenir."
        >
          <div className="stack">
          {documentEmpty ? (
            <button type="button" className="projects-primary-button outline-action" onClick={() => {
                setAcik(false);
                onTemplate();
              }}>
              <Wand2 size={15} aria-hidden="true" />
              Kılavuza göre taslak oluştur
            </button>
          ) : null}

          <ul className="outline-sections">
            {sections.map((item) => (
              <li key={item.section} data-found={item.heading ? "true" : "false"}>
                {item.heading ? (
                  <button type="button" onClick={() => {
                      setAcik(false);
                      onJump(item.heading!);
                    }} title="Bölüme git">
                    <Check size={14} aria-hidden="true" />
                    <span>{item.section}</span>
                  </button>
                ) : (
                  <button type="button" onClick={() => {
                      setAcik(false);
                      onInsert([item.section]);
                    }} title="Bu bölümü ekle">
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
              Eksik {missing.length} bölümü ekle
            </button>
          ) : null}
          </div>
        </Dialog>
      ) : null}

      {documentEmpty ? (
        <button type="button" className="projects-filter-button outline-action" onClick={onImport}>
          <FileUp size={15} aria-hidden="true" />
          Word dosyasından aktar
        </button>
      ) : null}
    </aside>
  );
}
