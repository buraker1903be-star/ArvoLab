"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookMarked } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { getLiteratureSources, type LiteratureSource } from "@/app/actions/literature";
import { formatInTextCitation, NUMERIC_STYLES, type CitationStyle } from "@/lib/citation-format";

const TYPE_LABEL: Record<string, string> = {
  article: "Makale",
  book: "Kitap",
  chapter: "Kitap bölümü",
  thesis: "Tez",
  report: "Rapor",
  website: "Web sitesi",
  other: "Diğer",
};

interface CiteDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  style: CitationStyle;
  onPick: (source: LiteratureSource) => void;
}

// Literatür taramasındaki kaynaklardan atıf: bu çalışmaya bağlı kaynaklar üstte.
export default function CiteDialog({ open, onClose, projectId, style, onPick }: CiteDialogProps) {
  const [sources, setSources] = useState<LiteratureSource[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const result = await getLiteratureSources();
      if (!cancelled) setSources(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    return (sources ?? [])
      .filter((source) =>
        !needle || [source.title, source.authors, source.year].some((value) => value?.toLocaleLowerCase("tr-TR").includes(needle))
      )
      .sort((a, b) => Number(b.project_id === projectId) - Number(a.project_id === projectId));
  }, [sources, query, projectId]);

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      kicker="Kaynaktan atıf"
      title="Atıf ekle"
      description={
        NUMERIC_STYLES.includes(style)
          ? "Seçtiğiniz kaynak imlecin olduğu yere numaralı atıf olarak eklenir ve Kaynakça'ya yazılır."
          : "Seçtiğiniz kaynak imlecin olduğu yere (Yazar, Yıl) biçiminde eklenir ve Kaynakça'ya yazılır."
      }
    >
      <div className="stack">
        <input
          className="picker-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Başlık, yazar ya da yıl ile ara"
          aria-label="Kaynak ara"
        />
        {sources === null ? (
          <p className="muted text-sm" aria-busy="true">Kaynaklar yükleniyor…</p>
        ) : sources.length === 0 ? (
          <div className="empty-state">
            <BookMarked size={22} aria-hidden="true" />
            <p>Literatür listenizde henüz kaynak yok.</p>
            <Link href="/dashboard/literature" className="projects-filter-button">Kaynak ekle</Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="muted text-sm">Aramanızla eşleşen kaynak yok.</p>
        ) : (
          <ul className="picker-list">
            {filtered.map((source) => (
              <li key={source.id}>
                <div className="picker-item">
                  <button
                    type="button"
                    className="picker-main"
                    onClick={() => {
                      onPick(source);
                      close();
                    }}
                  >
                    <strong>{source.title}</strong>
                    <small>
                      {[source.authors, source.year, TYPE_LABEL[source.source_type] ?? source.source_type].filter(Boolean).join(" · ")}
                      {source.project_id === projectId ? " · bu çalışma" : ""}
                    </small>
                  </button>
                  <span className="chip">{formatInTextCitation(source, style, 1)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
