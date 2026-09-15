"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { createClient } from "@/lib/supabase/client";
import { importWordDocument } from "@/app/actions/manuscript-import";
import { saveNamedVersion } from "@/app/actions/manuscript-versions";
import type { DocxImportStats } from "@/lib/docx-import";

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

function summary(stats: DocxImportStats) {
  const parts = [
    stats.headings ? `${stats.headings} başlık` : null,
    stats.tables ? `${stats.tables} tablo` : null,
    stats.images ? `${stats.images} resim` : null,
    stats.footnotes ? `${stats.footnotes} dipnot` : null,
    stats.captions ? `${stats.captions} şekil/tablo başlığı` : null,
    stats.tocLines ? `eski içindekiler listesi (${stats.tocLines} satır) kaldırıldı` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "metin";
}

// Word'den aktarma: dosya tarayıcıdan doğrudan depoya yüklenir, sunucu dönüştürür,
// içerik editöre eklenir ve otomatik kayıtla saklanır.
export default function ImportDialog({ open, onClose, projectId, documentEmpty, flush, onImported }: ImportDialogProps) {
  const [mode, setMode] = useState<ImportMode>("append");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (file: File) => {
    if (!/\.docx$/i.test(file.name)) {
      showToast("error", "Yalnızca .docx biçimindeki Word dosyaları aktarılabilir (.doc ise Word'de .docx olarak kaydedin).");
      return;
    }
    if (file.size > MAX_DOCX_BYTES) {
      showToast("error", "Word dosyası 20 MB sınırını aşıyor.");
      return;
    }
    const effectiveMode: ImportMode = documentEmpty ? "replace" : mode;
    setBusy(true);
    try {
      if (effectiveMode === "replace" && !documentEmpty) {
        setStep("Mevcut metin sürüm olarak saklanıyor…");
        if (!(await flush())) {
          showToast("error", "Mevcut metin kaydedilemediği için aktarma yapılmadı.");
          return;
        }
        const version = await saveNamedVersion(projectId, "Word aktarımı öncesi");
        if (version.error) {
          showToast("error", version.error);
          return;
        }
      }

      setStep("Dosya yükleniyor…");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", "Oturumunuz sona erdi. Yeniden giriş yapın.");
        return;
      }
      const path = `${user.id}/imports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("project-files").upload(path, file, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });
      if (uploadError) {
        console.error(uploadError);
        showToast("error", "Dosya yüklenemedi. Yeniden deneyin.");
        return;
      }

      setStep("Word dosyası dönüştürülüyor…");
      const result = await importWordDocument(projectId, path);
      if (result.error || !result.html) {
        showToast("error", result.error ?? "Word dosyası dönüştürülemedi.");
        return;
      }
      onImported(result.html, effectiveMode, result.stats);
      showToast("success", `Word dosyası aktarıldı: ${summary(result.stats!)}${result.stats?.skippedImages ? ` (${result.stats.skippedImages} resim aktarılamadı)` : ""}.`);
      onClose();
    } catch {
      showToast("error", "Aktarma sırasında bağlantı sorunu oluştu.");
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
      kicker="Word'den aktar"
      title="Word dosyasını editöre al"
      description="Başlıklar, listeler, tablolar, dipnotlar, resimler ve şekil/tablo başlıkları korunur. Yazı tipi ve boşluklar kılavuzunuza göre uygulanır. Eski içindekiler, tablolar ve şekiller listesi kaldırılır; güncelleri Word çıktısında kendiliğinden oluşur."
    >
      <div className="stack">
        {!documentEmpty ? (
          <fieldset className="import-modes" disabled={busy}>
            <legend className="muted text-sm">Mevcut metin ne olsun?</legend>
            <label className="checkbox-label">
              <input type="radio" name="import-mode" checked={mode === "append"} onChange={() => setMode("append")} />
              <span>Sonuna ekle</span>
            </label>
            <label className="checkbox-label">
              <input type="radio" name="import-mode" checked={mode === "replace"} onChange={() => setMode("replace")} />
              <span>Yerine koy (mevcut metin önce sürüm geçmişine kaydedilir)</span>
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
          {busy ? step || "Aktarılıyor…" : "Word dosyası seç (.docx)"}
        </button>
        <p className="muted text-sm">
          Aktarılan metin otomatik kaydedilir; sonucu beğenmezseniz Geri al (Ctrl+Z) ya da Sürüm geçmişi ile dönebilirsiniz.
        </p>
      </div>
    </Dialog>
  );
}
