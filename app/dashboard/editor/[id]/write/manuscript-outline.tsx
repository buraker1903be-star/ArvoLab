"use client";

import type { ReactNode } from "react";
import { Check, Circle, FileUp, Plus, Wand2 } from "lucide-react";
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
  /** Kılavuz bölümlerinden sonra gösterilen kartlar (içindekiler, bekleyen kaynaklar, yorumlar) */
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

  return (
    <aside className="manuscript-outline" aria-label="Belge planı">
      {ust}

      {sections.length > 0 ? (
        <section className="outline-card">
          <header className="outline-head">
            <strong>Kılavuz bölümleri</strong>
            <span className="muted text-sm">
              {sections.length - missing.length}/{sections.length}
            </span>
          </header>

          {documentEmpty ? (
            <button type="button" className="projects-primary-button outline-action" onClick={onTemplate}>
              <Wand2 size={15} aria-hidden="true" />
              Kılavuza göre taslak oluştur
            </button>
          ) : null}

          <ul className="outline-sections">
            {sections.map((item) => (
              <li key={item.section} data-found={item.heading ? "true" : "false"}>
                {item.heading ? (
                  <button type="button" onClick={() => onJump(item.heading!)} title="Bölüme git">
                    <Check size={14} aria-hidden="true" />
                    <span>{item.section}</span>
                  </button>
                ) : (
                  <button type="button" onClick={() => onInsert([item.section])} title="Bu bölümü ekle">
                    <Circle size={14} aria-hidden="true" />
                    <span>{item.section}</span>
                    <Plus size={14} aria-hidden="true" className="outline-add" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!documentEmpty && missing.length > 1 ? (
            <button type="button" className="projects-filter-button outline-action" onClick={() => onInsert(missing)}>
              <Plus size={15} aria-hidden="true" />
              Eksik {missing.length} bölümü ekle
            </button>
          ) : null}
        </section>
      ) : null}

      {documentEmpty ? (
        <button type="button" className="projects-filter-button outline-action" onClick={onImport}>
          <FileUp size={15} aria-hidden="true" />
          Word dosyasından aktar
        </button>
      ) : null}

      {children}
    </aside>
  );
}
