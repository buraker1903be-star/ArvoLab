"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookMarked, Search } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { createCitationSource, getLiteratureSources, lookupDoi, type LiteratureSource } from "@/app/actions/literature";
import { formatInTextCitation, formatReferenceParts, NUMERIC_STYLES, type CitationStyle } from "@/lib/citation-format";

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

interface NewSourceForm {
  doi: string;
  title: string;
  authors: string;
  year: string;
  sourceType: string;
  containerTitle: string;
  volume: string;
  issue: string;
  pages: string;
  publisher: string;
}

const EMPTY_FORM: NewSourceForm = {
  doi: "",
  title: "",
  authors: "",
  year: "",
  sourceType: "article",
  containerTitle: "",
  volume: "",
  issue: "",
  pages: "",
  publisher: "",
};

// Atıf: literatür listesinden seç ya da yeni kaynak ekle (DOI ile bilgiler Crossref'ten dolar).
export default function CiteDialog({ open, onClose, projectId, style, onPick }: CiteDialogProps) {
  const [tab, setTab] = useState<"list" | "new">("list");
  const [sources, setSources] = useState<LiteratureSource[] | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<NewSourceForm>(EMPTY_FORM);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const preview = useMemo(() => {
    if (!form.title.trim()) return "";
    return formatReferenceParts(
      {
        title: form.title,
        authors: form.authors || null,
        year: form.year || null,
        source_type: form.sourceType,
        doi_or_url: form.doi || null,
        container_title: form.containerTitle || null,
        volume: form.volume || null,
        issue: form.issue || null,
        pages: form.pages || null,
        publisher: form.publisher || null,
      },
      style,
      (sources?.length ?? 0) + 1
    )
      .map((part) => part.text)
      .join("");
  }, [form, style, sources]);

  const close = () => {
    setQuery("");
    setForm(EMPTY_FORM);
    setTab("list");
    onClose();
  };

  const set = (key: keyof NewSourceForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const fetchDoi = async () => {
    if (!form.doi.trim()) return;
    setLooking(true);
    try {
      const result = await lookupDoi(form.doi);
      if (result.error || !result.metadata) {
        showToast("error", result.error ?? "Kaynak bilgileri alınamadı.");
        return;
      }
      const meta = result.metadata;
      setForm({
        doi: meta.doi,
        title: meta.title,
        authors: meta.authors ?? "",
        year: meta.year ?? "",
        sourceType: meta.sourceType,
        containerTitle: meta.containerTitle ?? "",
        volume: meta.volume ?? "",
        issue: meta.issue ?? "",
        pages: meta.pages ?? "",
        publisher: meta.publisher ?? "",
      });
      showToast("success", "Kaynak bilgileri dolduruldu; kontrol edip kaydedin.");
    } finally {
      setLooking(false);
    }
  };

  const saveAndCite = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const result = await createCitationSource({ ...form, doiOrUrl: form.doi || null, projectId });
      if (result.error || !result.source) {
        showToast("error", result.error ?? "Kaynak kaydedilemedi.");
        return;
      }
      onPick(result.source);
      close();
    } finally {
      setSaving(false);
    }
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
        <div className="segmented" role="tablist" aria-label="Kaynak seçimi">
          <button type="button" role="tab" aria-selected={tab === "list"} className={tab === "list" ? "is-active" : undefined} onClick={() => setTab("list")}>
            Listemden
          </button>
          <button type="button" role="tab" aria-selected={tab === "new"} className={tab === "new" ? "is-active" : undefined} onClick={() => setTab("new")}>
            Yeni kaynak
          </button>
        </div>

        {tab === "list" ? (
          <>
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
                <p>Literatür listenizde henüz kaynak yok. “Yeni kaynak” ile DOI&apos;den hemen ekleyebilirsiniz.</p>
                <button type="button" className="projects-filter-button" onClick={() => setTab("new")}>Yeni kaynak ekle</button>
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
                          {[source.authors, source.year, source.container_title, TYPE_LABEL[source.source_type] ?? source.source_type]
                            .filter(Boolean)
                            .join(" · ")}
                          {source.project_id === projectId ? " · bu çalışma" : ""}
                        </small>
                      </button>
                      <span className="chip">{formatInTextCitation(source, style, 1)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/dashboard/literature" className="muted text-sm">Literatür listesini yönet →</Link>
          </>
        ) : (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void saveAndCite();
            }}
          >
            <div className="doi-row">
              <input
                className="picker-search"
                value={form.doi}
                onChange={set("doi")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void fetchDoi();
                  }
                }}
                placeholder="DOI yapıştırın (ör. 10.1016/j.compedu.2021.104...)"
                aria-label="DOI"
              />
              <button type="button" className="projects-filter-button" onClick={() => void fetchDoi()} disabled={looking || !form.doi.trim()}>
                <Search size={15} aria-hidden="true" />
                {looking ? "Getiriliyor…" : "Bilgileri getir"}
              </button>
            </div>

            <div className="cite-form-grid">
              <label className="dialog-field cite-form-full">
                <span>Başlık *</span>
                <input className="picker-search" value={form.title} onChange={set("title")} required />
              </label>
              <label className="dialog-field cite-form-full">
                <span>Yazarlar</span>
                <input className="picker-search" value={form.authors} onChange={set("authors")} placeholder="Yılmaz, A., & Demir, B." />
              </label>
              <label className="dialog-field">
                <span>Yıl</span>
                <input className="picker-search" value={form.year} onChange={set("year")} inputMode="numeric" placeholder="2023" />
              </label>
              <label className="dialog-field">
                <span>Tür</span>
                <select className="picker-search" value={form.sourceType} onChange={set("sourceType")}>
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dialog-field cite-form-full">
                <span>{form.sourceType === "chapter" ? "Kitap adı" : "Dergi adı"}</span>
                <input className="picker-search" value={form.containerTitle} onChange={set("containerTitle")} />
              </label>
              <label className="dialog-field">
                <span>Cilt</span>
                <input className="picker-search" value={form.volume} onChange={set("volume")} />
              </label>
              <label className="dialog-field">
                <span>Sayı</span>
                <input className="picker-search" value={form.issue} onChange={set("issue")} />
              </label>
              <label className="dialog-field">
                <span>Sayfalar</span>
                <input className="picker-search" value={form.pages} onChange={set("pages")} placeholder="45–67" />
              </label>
              <label className="dialog-field">
                <span>Yayınevi</span>
                <input className="picker-search" value={form.publisher} onChange={set("publisher")} />
              </label>
            </div>

            {preview ? (
              <p className="cite-preview">
                <span className="muted text-sm">Kaynakçada şöyle görünecek:</span>
                <br />
                {preview}
              </p>
            ) : null}

            <button type="submit" className="projects-primary-button" disabled={saving || !form.title.trim()}>
              {saving ? "Kaydediliyor…" : "Kaydet ve atıf ekle"}
            </button>
          </form>
        )}
      </div>
    </Dialog>
  );
}
