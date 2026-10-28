"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { createClient } from "@/lib/supabase/client";
import { importWordDocument } from "@/app/actions/manuscript-import";
import { saveNamedVersion } from "@/app/actions/manuscript-versions";
import type { DocxImportStats } from "@/lib/docx-import";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { Cevirici } from "@/lib/dil";

export type ImportMode = "append" | "replace";

const MAX_DOCX_BYTES = 20 * 1024 * 1024;

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  documentEmpty: boolean;
  /** Ekrandaki metni kaydeder (değiştirmeden önce sürüm almak için) */
  flush: () => Promise<boolean>;
  onImported: (html: string, mode: ImportMode, stats?: DocxImportStats) => void;
}

function summary(stats: DocxImportStats, t: Cevirici) {
  const parts = [
    stats.headings ? t({ tr: `${stats.headings} başlık`, en: `${stats.headings} headings` }) : null,
    stats.tables ? t({ tr: `${stats.tables} tablo`, en: `${stats.tables} tables` }) : null,
    stats.images ? t({ tr: `${stats.images} resim`, en: `${stats.images} images` }) : null,
    stats.footnotes ? t({ tr: `${stats.footnotes} dipnot`, en: `${stats.footnotes} footnotes` }) : null,
    stats.captions ? t({ tr: `${stats.captions} şekil/tablo başlığı`, en: `${stats.captions} figure/table captions` }) : null,
    stats.tocLines
      ? t({ tr: `eski içindekiler listesi (${stats.tocLines} satır) kaldırıldı`, en: `old table of contents (${stats.tocLines} lines) removed` })
      : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : t({ tr: "metin", en: "text" });
}

// Word'den aktarma: dosya tarayıcıdan doğrudan depoya yüklenir, sunucu dönüştürür,
// içerik editöre eklenir ve otomatik kayıtla saklanır.
export default function ImportDialog({ open, onClose, projectId, documentEmpty, flush, onImported }: ImportDialogProps) {
  const t = useCeviri();
  const [mode, setMode] = useState<ImportMode>("append");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (file: File) => {
    if (!/\.docx$/i.test(file.name)) {
      showToast(
        "error",
        t({
          tr: "Yalnızca .docx biçimindeki Word dosyaları aktarılabilir (.doc ise Word'de .docx olarak kaydedin).",
          en: "Only Word files in .docx format can be imported (if it is .doc, save it as .docx in Word).",
        })
      );
      return;
    }
    if (file.size > MAX_DOCX_BYTES) {
      showToast("error", t({ tr: "Word dosyası 20 MB sınırını aşıyor.", en: "The Word file exceeds the 20 MB limit." }));
      return;
    }
    const effectiveMode: ImportMode = documentEmpty ? "replace" : mode;
    setBusy(true);
    try {
      if (effectiveMode === "replace" && !documentEmpty) {
        setStep(t({ tr: "Mevcut metin sürüm olarak saklanıyor…", en: "Saving the current text as a version…" }));
        if (!(await flush())) {
          showToast("error", t({ tr: "Mevcut metin kaydedilemediği için aktarma yapılmadı.", en: "The import was not performed because the current text could not be saved." }));
          return;
        }
        const version = await saveNamedVersion(projectId, t({ tr: "Word aktarımı öncesi", en: "Before Word import" }));
        if (version.error) {
          showToast("error", version.error);
          return;
        }
      }

      setStep(t({ tr: "Dosya yükleniyor…", en: "Uploading file…" }));
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", t({ tr: "Oturumunuz sona erdi. Yeniden giriş yapın.", en: "Your session has expired. Please sign in again." }));
        return;
      }
      const path = `${user.id}/imports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("project-files").upload(path, file, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });
      if (uploadError) {
        console.error(uploadError);
        showToast("error", t({ tr: "Dosya yüklenemedi. Yeniden deneyin.", en: "The file could not be uploaded. Try again." }));
        return;
      }

      setStep(t({ tr: "Word dosyası dönüştürülüyor…", en: "Converting Word file…" }));
      const result = await importWordDocument(projectId, path);
      if (result.error || !result.html) {
        showToast("error", result.error ?? t({ tr: "Word dosyası dönüştürülemedi.", en: "The Word file could not be converted." }));
        return;
      }
      onImported(result.html, effectiveMode, result.stats);
      const ozet = summary(result.stats!, t);
      const atlanan = result.stats?.skippedImages ?? 0;
      showToast(
        "success",
        atlanan
          ? t({ tr: `Word dosyası aktarıldı: ${ozet} (${atlanan} resim aktarılamadı).`, en: `Word file imported: ${ozet} (${atlanan} images could not be imported).` })
          : t({ tr: `Word dosyası aktarıldı: ${ozet}.`, en: `Word file imported: ${ozet}.` })
      );
      onClose();
    } catch {
      showToast("error", t({ tr: "Aktarma sırasında bağlantı sorunu oluştu.", en: "A connection problem occurred during the import." }));
    } finally {
      setBusy(false);
      setStep("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      kicker={t({ tr: "Word'den aktar", en: "Import from Word" })}
      title={t({ tr: "Word dosyasını editöre al", en: "Bring a Word file into the editor" })}
      description={t({
        tr: "Başlıklar, listeler, tablolar, dipnotlar, resimler ve şekil/tablo başlıkları korunur. Yazı tipi ve boşluklar kılavuzunuza göre uygulanır. Eski içindekiler, tablolar ve şekiller listesi kaldırılır; güncelleri Word çıktısında kendiliğinden oluşur.",
        en: "Headings, lists, tables, footnotes, images and figure/table captions are preserved. Font and spacing follow your guideline. The old table of contents and lists of tables and figures are removed; up-to-date ones are generated automatically in the Word export.",
      })}
    >
      <div className="stack">
        {!documentEmpty ? (
          <fieldset className="import-modes" disabled={busy}>
            <legend className="muted text-sm">{t({ tr: "Mevcut metin ne olsun?", en: "What should happen to the current text?" })}</legend>
            <label className="checkbox-label">
              <input type="radio" name="import-mode" checked={mode === "append"} onChange={() => setMode("append")} />
              <span>{t({ tr: "Sonuna ekle", en: "Append to the end" })}</span>
            </label>
            <label className="checkbox-label">
              <input type="radio" name="import-mode" checked={mode === "replace"} onChange={() => setMode("replace")} />
              <span>{t({ tr: "Yerine koy (mevcut metin önce sürüm geçmişine kaydedilir)", en: "Replace (the current text is saved to version history first)" })}</span>
            </label>
          </fieldset>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void run(file);
          }}
        />
        <button type="button" className="projects-primary-button" disabled={busy} onClick={() => inputRef.current?.click()}>
          <FileUp size={16} aria-hidden="true" />
          {busy ? step || t({ tr: "Aktarılıyor…", en: "Importing…" }) : t({ tr: "Word dosyası seç (.docx)", en: "Choose Word file (.docx)" })}
        </button>
        <p className="muted text-sm">
          {t({
            tr: "Aktarılan metin otomatik kaydedilir; sonucu beğenmezseniz Geri al (Ctrl+Z) ya da Sürüm geçmişi ile dönebilirsiniz.",
            en: "The imported text is saved automatically; if you don't like the result, you can go back with Undo (Ctrl+Z) or Version history.",
          })}
        </p>
      </div>
    </Dialog>
  );
}
