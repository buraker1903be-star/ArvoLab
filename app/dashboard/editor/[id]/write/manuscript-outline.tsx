"use client";

import type { ReactNode } from "react";
import { Check, Circle, FileUp, ListTree, Plus, Wand2 } from "lucide-react";
import type { OutlineHeading, SectionStatus } from "./editor-navigation";
import type { PageRangeTone } from "@/lib/page-estimate";

interface ManuscriptOutlineProps {
  headings: OutlineHeading[];
  sections: SectionStatus[];
  words: number;
  pages: number;
  minPages: number | null;
  maxPages: number | null;
  pageTone: PageRangeTone;
  documentEmpty: boolean;
  figures: number;
  tables: number;
  onJump: (heading: OutlineHeading) => void;
  onInsert: (sections: string[]) => void;
  onTemplate: () => void;
  /** Word dosyasından aktarma penceresini açar */
  onImport: () => void;
  /** İlerleme kartından sonra gösterilen ek kartlar (ör. yorumlar) */
  children?: ReactNode;
}

const PAGE_HINT: Record<PageRangeTone, string> = {
  neutral: "",
  warning: "Kılavuzun alt sınırına henüz ulaşılmadı",
  success: "Kılavuzun sayfa aralığında",
  danger: "Kılavuzun üst sınırını aşıyor",
};

// Yazarken yol gösteren yan panel: belge planı, kılavuzun zorunlu bölümleri
// (eksikler tek tıkla doğru yere eklenir) ve sayfa hedefi.
export default function ManuscriptOutline({
  headings,
  sections,
  words,
  pages,
  minPages,
  maxPages,
  pageTone,
  documentEmpty,
  figures,
  tables,
  onJump,
  onInsert,
  onTemplate,
  onImport,
  children,
}: ManuscriptOutlineProps) {
  const missing = sections.filter((item) => !item.heading).map((item) => item.section);
  const target = maxPages ?? minPages;
  const progress = target ? Math.min(100, Math.round((pages / target) * 100)) : 0;

  return (
    <aside className="manuscript-outline" aria-label="Belge planı">
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

      <section className="outline-card">
        <header className="outline-head">
          <strong>İlerleme</strong>
        </header>
        {documentEmpty ? (
          <button type="button" className="projects-filter-button outline-action" onClick={onImport}>
            <FileUp size={15} aria-hidden="true" />
            Word dosyasından aktar
          </button>
        ) : null}
        <p className="outline-stat">
          <span>{words.toLocaleString("tr-TR")} kelime</span>
          <span>≈ {pages} sayfa</span>
        </p>
        {target ? (
          <>
            <div className="outline-progress" data-tone={pageTone} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="muted text-sm">
              Kılavuz: {minPages ? `en az ${minPages}` : ""}
              {minPages && maxPages ? ", " : ""}
              {maxPages ? `en fazla ${maxPages}` : ""} sayfa
              {PAGE_HINT[pageTone] ? ` · ${PAGE_HINT[pageTone]}` : ""}
            </p>
          </>
        ) : null}
        {figures || tables ? (
          <p className="muted text-sm">
            {[tables ? `${tables} tablo` : null, figures ? `${figures} şekil` : null].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <p className="muted text-micro">Tahmin; şekil, tablo ve kapak dahil değildir.</p>
      </section>

      {children}

      <section className="outline-card">
        <header className="outline-head">
          <strong>
            <ListTree size={15} aria-hidden="true" /> Belge planı
          </strong>
        </header>
        {headings.length > 0 ? (
          <ol className="outline-headings">
            {headings.map((heading) => (
              <li key={heading.pos} data-level={heading.level}>
                <button type="button" onClick={() => onJump(heading)}>
                  {heading.text || "(başlıksız)"}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted text-sm">Başlık ekledikçe (H1–H3) plan burada oluşur; tıklayarak bölümler arasında gezinebilirsiniz.</p>
        )}
      </section>
    </aside>
  );
}
