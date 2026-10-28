"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw, Save } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import BosDurum from "@/app/dashboard/_components/bos-durum";
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
import { useCeviri, useDil, useTarihler } from "@/app/_components/dil-saglayici";
import { YEREL, type Metin } from "@/lib/dil";

interface CompareState {
  version: ManuscriptVersion;
  diff: TextDiff | null;
  error?: string;
}

const MAX_BLOCKS_SHOWN = 400;

const KIND_LABEL: Record<ManuscriptVersion["kind"], Metin> = {
  auto: { tr: "Otomatik", en: "Automatic" },
  manual: { tr: "Kaydedilen sürüm", en: "Saved version" },
  restore: { tr: "Geri yükleme öncesi", en: "Before restore" },
};

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
  const t = useCeviri();
  const dil = useDil();
  /* Eskiden toLocaleString("tr-TR") dilimsizdi; ortak biçim kullanıcının dilim ve dilinde. */
  const { tarihSaat: formatTime } = useTarihler();
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
        showToast("error", t({ tr: "Metin kaydedilemediği için sürüm oluşturulmadı.", en: "The version was not created because the text could not be saved." }));
        return;
      }
      const result = await saveNamedVersion(projectId, name);
      if (result.error) {
        showToast("error", result.error);
        return;
      }
      setLabel("");
      setReloadKey((key) => key + 1);
      showToast("success", t({ tr: `"${name}" sürümü kaydedildi.`, en: `Version "${name}" saved.` }));
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
    else setPreview({ id: version.id, text: result.text || t({ tr: "(boş metin)", en: "(empty text)" }) });
  };

  const restore = async (version: ManuscriptVersion) => {
    const tarih = formatTime(version.createdAt);
    if (
      !window.confirm(
        t({
          tr: `${tarih} tarihli sürüm geri yüklensin mi? Şu anki metin önce yedeklenir.`,
          en: `Restore the version from ${tarih}? The current text is backed up first.`,
        })
      )
    )
      return;
    setBusy(true);
    try {
      if (!(await flush())) {
        showToast("error", t({ tr: "Mevcut metin kaydedilemediği için geri yükleme yapılmadı.", en: "The restore was not performed because the current text could not be saved." }));
        return;
      }
      const result = await restoreManuscriptVersion(projectId, version.id);
      if (result.error) {
        showToast("error", result.error);
        return;
      }
      showToast("success", t({ tr: "Sürüm geri yüklendi.", en: "Version restored." }));
      onRestored();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      kicker={t({ tr: "Sürüm geçmişi", en: "Version history" })}
      title={t({ tr: "Önceki sürümler", en: "Previous versions" })}
      description={t({
        tr: "Yazarken en fazla 10 dakikada bir otomatik sürüm alınır. Önemli anları adlandırarak saklayabilirsiniz.",
        en: "While you write, a version is saved automatically at most every 10 minutes. You can name and keep important moments.",
      })}
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
            placeholder={t({ tr: "Örn. Danışmana gönderilen taslak", en: "E.g. Draft sent to advisor" })}
            aria-label={t({ tr: "Sürüm adı", en: "Version name" })}
          />
          <button type="submit" className="projects-primary-button" disabled={busy || !label.trim()}>
            <Save size={15} aria-hidden="true" />
            {t({ tr: "Sürüm kaydet", en: "Save version" })}
          </button>
        </form>

        {loadError ? <p className="alert" data-tone="danger" role="alert">{loadError}</p> : null}
        {versions === null ? (
          <p className="muted text-sm" aria-busy="true">{t({ tr: "Sürümler yükleniyor…", en: "Loading versions…" })}</p>
        ) : versions.length === 0 ? (
          <BosDurum
            kompakt
            ikon={History}
            aciklama={t({
              tr: "Henüz sürüm yok. Yazmaya devam ettikçe otomatik sürümler burada birikir; yukarıdan istediğiniz an adlı bir sürüm de kaydedebilirsiniz.",
              en: "No versions yet. Automatic versions build up here as you keep writing; you can also save a named version above at any time.",
            })}
          />
        ) : (
          <ul className="picker-list">
            {versions.map((version) => (
              <li key={version.id} className="picker-item-wrap">
                <div className="picker-item">
                  <button
                    type="button"
                    className="picker-main"
                    onClick={() => void showPreview(version)}
                    title={t({ tr: "Önizle", en: "Preview" })}
                  >
                    <strong>{version.label ?? t(KIND_LABEL[version.kind])}</strong>
                    <small>
                      {formatTime(version.createdAt)} ·{" "}
                      {t({
                        tr: `${version.wordCount.toLocaleString(YEREL[dil])} kelime`,
                        en: `${version.wordCount.toLocaleString(YEREL[dil])} words`,
                      })}
                      {version.label ? ` · ${t(KIND_LABEL[version.kind])}` : ""}
                      {version.authorName ? ` · ${version.authorName}` : ""}
                    </small>
                  </button>
                  <span className="cluster">
                    <button type="button" className="projects-filter-button" disabled={busy} onClick={() => void startCompare(version)}>
                      {t({ tr: "Karşılaştır", en: "Compare" })}
                    </button>
                    <button type="button" className="projects-filter-button" disabled={busy} onClick={() => void restore(version)}>
                      <RotateCcw size={14} aria-hidden="true" />
                      {t({ tr: "Geri yükle", en: "Restore" })}
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
  const t = useCeviri();
  const dil = useDil();
  const { tarihSaat: formatTime } = useTarihler();
  const sayi = (n: number) => n.toLocaleString(YEREL[dil]);
  return (
    <div className="stack">
      <button type="button" className="result-link compare-back" onClick={onBack}>
        {t({ tr: "← Sürümlere dön", en: "← Back to versions" })}
      </button>
      <p className="muted text-sm">
        {t({ tr: "", en: "Comparing " })}
        <strong>{version.label ?? t(KIND_LABEL[version.kind])}</strong> ({formatTime(version.createdAt)}){" "}
        {t({ tr: "ile şimdiki metin", en: "with the current text" })}
      </p>
      {error ? (
        <p className="alert" data-tone="danger" role="alert">{error}</p>
      ) : !diff ? (
        <p className="muted text-sm" aria-busy="true">{t({ tr: "Karşılaştırılıyor…", en: "Comparing…" })}</p>
      ) : diff.identical ? (
        <p className="tone-text" data-tone="success">{t({ tr: "Bu sürümden bu yana metinde değişiklik yok.", en: "The text has not changed since this version." })}</p>
      ) : (
        <>
          <div className="compare-stats">
            <span className="tone-text" data-tone="success">
              {t({ tr: `+${sayi(diff.stats.addedWords)} kelime`, en: `+${sayi(diff.stats.addedWords)} words` })}
            </span>
            <span className="tone-text" data-tone="danger">
              {t({ tr: `−${sayi(diff.stats.removedWords)} kelime`, en: `−${sayi(diff.stats.removedWords)} words` })}
            </span>
            <span className="muted">
              {t({
                tr: `${diff.stats.changedParagraphs} paragraf değişti · ${diff.stats.addedParagraphs} eklendi · ${diff.stats.removedParagraphs} silindi`,
                en: `${diff.stats.changedParagraphs} paragraphs changed · ${diff.stats.addedParagraphs} added · ${diff.stats.removedParagraphs} removed`,
              })}
            </span>
          </div>
          <ol className="diff-list" aria-label={t({ tr: "Değişiklikler", en: "Changes" })}>
            {diff.blocks.slice(0, MAX_BLOCKS_SHOWN).map((block, index) =>
              block.kind === "same" ? (
                <li key={index} className="diff-same">
                  {t({ tr: `… ${block.count} paragraf aynı …`, en: `… ${block.count} paragraphs unchanged …` })}
                </li>
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
            <p className="muted text-sm">
              {t({ tr: `İlk ${MAX_BLOCKS_SHOWN} fark gösteriliyor.`, en: `Showing the first ${MAX_BLOCKS_SHOWN} differences.` })}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
