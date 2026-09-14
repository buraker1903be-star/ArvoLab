"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw, Save } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { showToast } from "@/app/dashboard/_components/toast-events";
import {
  getVersionPreview,
  getVersionText,
  listManuscriptVersions,
  restoreManuscriptVersion,
  saveNamedVersion,
  type ManuscriptVersion,
} from "@/app/actions/manuscript-versions";
import { diffTexts, type TextDiff } from "@/lib/text-diff";

interface CompareState {
  version: ManuscriptVersion;
  diff: TextDiff | null;
  error?: string;
}

const MAX_BLOCKS_SHOWN = 400;

const KIND_LABEL: Record<ManuscriptVersion["kind"], string> = {
  auto: "Otomatik",
  manual: "Kaydedilen sürüm",
  restore: "Geri yükleme öncesi",
};

const formatTime = (value: string) =>
  new Date(value).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });

interface VersionsDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** İşlemden önce ekrandaki metni kaydeder; kaydedilemezse işlem yapılmaz */
  flush: () => Promise<boolean>;
  /** Geri yükleme bitince editör yeniden yüklenir */
  onRestored: () => void;
  /** Karşılaştırma için ekrandaki metnin düz hâli */
  getCurrentText: () => string;
}

// Sürüm geçmişi: otomatik (10 dakikada bir), adlandırılmış ve geri yükleme öncesi yedekler.
// Geri yükleme de geri alınabilir: mevcut hâl önce yedeklenir.
export default function VersionsDialog({ open, onClose, projectId, flush, onRestored, getCurrentText }: VersionsDialogProps) {
  const [versions, setVersions] = useState<ManuscriptVersion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ id: string; text: string } | null>(null);
  const [compare, setCompare] = useState<CompareState | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const result = await listManuscriptVersions(projectId);
      if (cancelled) return;
      setVersions(result.versions);
      setLoadError(result.error ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, reloadKey]);

  const close = () => {
    setPreview(null);
    setVersions(null);
    setCompare(null);
    onClose();
  };

  // Seçilen sürüm ile ekrandaki metin: paragraf ve kelime düzeyinde fark (tarayıcıda hesaplanır).
  const startCompare = async (version: ManuscriptVersion) => {
    setCompare({ version, diff: null });
    const result = await getVersionText(version.id);
    if (result.error) {
      setCompare({ version, diff: null, error: result.error });
      return;
    }
    setCompare({ version, diff: diffTexts(result.text ?? "", getCurrentText()) });
  };

  const saveVersion = async () => {
    const name = label.trim();
    if (!name) return;
    setBusy(true);
    try {
      if (!(await flush())) {
        showToast("error", "Metin kaydedilemediği için sürüm oluşturulmadı.");
        return;
      }
      const result = await saveNamedVersion(projectId, name);
      if (result.error) {
        showToast("error", result.error);
        return;
      }
      setLabel("");
      setReloadKey((key) => key + 1);
      showToast("success", `"${name}" sürümü kaydedildi.`);
    } finally {
      setBusy(false);
    }
  };

  const showPreview = async (version: ManuscriptVersion) => {
    if (preview?.id === version.id) {
      setPreview(null);
      return;
    }
    const result = await getVersionPreview(version.id);
    if (result.error) showToast("error", result.error);
    else setPreview({ id: version.id, text: result.text || "(boş metin)" });
  };

  const restore = async (version: ManuscriptVersion) => {
    if (!window.confirm(`${formatTime(version.createdAt)} tarihli sürüm geri yüklensin mi? Şu anki metin önce yedeklenir.`)) return;
    setBusy(true);
    try {
      if (!(await flush())) {
        showToast("error", "Mevcut metin kaydedilemediği için geri yükleme yapılmadı.");
        return;
      }
      const result = await restoreManuscriptVersion(projectId, version.id);
      if (result.error) {
        showToast("error", result.error);
        return;
      }
      showToast("success", "Sürüm geri yüklendi.");
      onRestored();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      kicker="Sürüm geçmişi"
      title="Önceki sürümler"
      description="Yazarken en fazla 10 dakikada bir otomatik sürüm alınır. Önemli anları adlandırarak saklayabilirsiniz."
    >
      {compare ? (
        <ComparePanel compare={compare} onBack={() => setCompare(null)} />
      ) : (
      <div className="stack">
        <form
          className="version-save"
          onSubmit={(event) => {
            event.preventDefault();
            void saveVersion();
          }}
        >
          <input
            className="picker-search"
            value={label}
            maxLength={120}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Örn. Danışmana gönderilen taslak"
            aria-label="Sürüm adı"
          />
          <button type="submit" className="projects-primary-button" disabled={busy || !label.trim()}>
            <Save size={15} aria-hidden="true" />
            Sürüm kaydet
          </button>
        </form>

        {loadError ? <p className="alert" data-tone="danger" role="alert">{loadError}</p> : null}
        {versions === null ? (
          <p className="muted text-sm" aria-busy="true">Sürümler yükleniyor…</p>
        ) : versions.length === 0 ? (
          <div className="empty-state">
            <History size={22} aria-hidden="true" />
            <p>Henüz sürüm yok. Yazmaya devam ettikçe otomatik sürümler burada birikir.</p>
          </div>
        ) : (
          <ul className="picker-list">
            {versions.map((version) => (
              <li key={version.id} className="picker-item-wrap">
                <div className="picker-item">
                  <button type="button" className="picker-main" onClick={() => void showPreview(version)} title="Önizle">
                    <strong>{version.label ?? KIND_LABEL[version.kind]}</strong>
                    <small>
                      {formatTime(version.createdAt)} · {version.wordCount.toLocaleString("tr-TR")} kelime
                      {version.label ? ` · ${KIND_LABEL[version.kind]}` : ""}
                      {version.authorName ? ` · ${version.authorName}` : ""}
                    </small>
                  </button>
                  <span className="cluster">
                    <button type="button" className="projects-filter-button" disabled={busy} onClick={() => void startCompare(version)}>
                      Karşılaştır
                    </button>
                    <button type="button" className="projects-filter-button" disabled={busy} onClick={() => void restore(version)}>
                      <RotateCcw size={14} aria-hidden="true" />
                      Geri yükle
                    </button>
                  </span>
                </div>
                {preview?.id === version.id ? <div className="version-preview">{preview.text}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
    </Dialog>
  );
}

function ComparePanel({ compare, onBack }: { compare: CompareState; onBack: () => void }) {
  const { version, diff, error } = compare;
  return (
    <div className="stack">
      <button type="button" className="result-link compare-back" onClick={onBack}>
        ← Sürümlere dön
      </button>
      <p className="muted text-sm">
        <strong>{version.label ?? KIND_LABEL[version.kind]}</strong> ({formatTime(version.createdAt)}) ile şimdiki metin
      </p>
      {error ? (
        <p className="alert" data-tone="danger" role="alert">{error}</p>
      ) : !diff ? (
        <p className="muted text-sm" aria-busy="true">Karşılaştırılıyor…</p>
      ) : diff.identical ? (
        <p className="tone-text" data-tone="success">Bu sürümden bu yana metinde değişiklik yok.</p>
      ) : (
        <>
          <div className="compare-stats">
            <span className="tone-text" data-tone="success">+{diff.stats.addedWords.toLocaleString("tr-TR")} kelime</span>
            <span className="tone-text" data-tone="danger">−{diff.stats.removedWords.toLocaleString("tr-TR")} kelime</span>
            <span className="muted">
              {diff.stats.changedParagraphs} paragraf değişti · {diff.stats.addedParagraphs} eklendi · {diff.stats.removedParagraphs} silindi
            </span>
          </div>
          <ol className="diff-list" aria-label="Değişiklikler">
            {diff.blocks.slice(0, MAX_BLOCKS_SHOWN).map((block, index) =>
              block.kind === "same" ? (
                <li key={index} className="diff-same">… {block.count} paragraf aynı …</li>
              ) : block.kind === "added" ? (
                <li key={index} className="diff-added"><ins>{block.text}</ins></li>
              ) : block.kind === "removed" ? (
                <li key={index} className="diff-removed"><del>{block.text}</del></li>
              ) : (
                <li key={index} className="diff-changed">
                  {block.parts.map((part, partIndex) =>
                    part.type === "same" ? (
                      <span key={partIndex}>{part.text}</span>
                    ) : part.type === "added" ? (
                      <ins key={partIndex}>{part.text}</ins>
                    ) : (
                      <del key={partIndex}>{part.text}</del>
                    )
                  )}
                </li>
              )
            )}
          </ol>
          {diff.blocks.length > MAX_BLOCKS_SHOWN ? (
            <p className="muted text-sm">İlk {MAX_BLOCKS_SHOWN} fark gösteriliyor.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
