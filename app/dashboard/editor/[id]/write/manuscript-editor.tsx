"use client";

import { useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import TiptapImage from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextStyleKit } from "@tiptap/extension-text-style";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Table as TableIcon,
  ImagePlus,
  StickyNote,
  Undo2,
  Redo2,
  Save,
  ShieldCheck,
  FileDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { FootnoteReference } from "@/lib/tiptap-footnote-extension";
import { ParagraphFormatting } from "@/lib/tiptap-paragraph-formatting";
import type { TiptapDoc } from "@/lib/tiptap-text";
import { saveManuscript, runManuscriptCheck, type ManuscriptCheckResult, type PageMargins } from "@/app/actions/manuscript";
import { createClient } from "@/lib/supabase/client";
import { IndentIncrease, Settings2, AlignVerticalSpaceAround } from "lucide-react";

interface ManuscriptEditorProps {
  projectId: string;
  initialContent: object | null;
  requiredSections: string[];
  initialMargins?: PageMargins;
  initialShowPageNumbers?: boolean;
}

// Türkiye'deki üniversitelerin tez/makale yazım kılavuzlarında en sık
// istenen yazı tipleri (Times New Roman başta olmak üzere). Seçim
// tamamen serbesttir — burası yalnızca sık kullanılanları listeler.
const FONT_FAMILIES = [
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Arial", value: "Arial" },
  { label: "Calibri", value: "Calibri" },
  { label: "Cambria", value: "Cambria" },
  { label: "Garamond", value: "Garamond" },
  { label: "Georgia", value: "Georgia" },
  { label: "Verdana", value: "Verdana" },
  { label: "Book Antiqua", value: "Book Antiqua" },
];

const FONT_SIZES = [9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24];

export default function ManuscriptEditor({ projectId, initialContent, requiredSections, initialMargins, initialShowPageNumbers }: ManuscriptEditorProps) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<ManuscriptCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [, forceRerender] = useState(0);
  const [margins, setMargins] = useState<PageMargins>(
    initialMargins ?? { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 }
  );
  const [showPageNumbers, setShowPageNumbers] = useState(initialShowPageNumbers ?? true);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    onUpdate: () => forceRerender((n) => n + 1),
    onSelectionUpdate: () => forceRerender((n) => n + 1),
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
      }),
      TextStyleKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ParagraphFormatting,
      Placeholder.configure({ placeholder: "Çalışmanızı buraya yazmaya başlayın..." }),
      CharacterCount,
      TiptapImage,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      FootnoteReference,
    ],
    content: initialContent ?? "",
    editorProps: {
      attributes: { class: "manuscript-editor-content" },
    },
  });

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    try {
      const json = editor.getJSON() as unknown as TiptapDoc;
      const res = await saveManuscript(projectId, json, margins, showPageNumbers);
      if (res.success) {
        setLastSaved(new Date().toLocaleTimeString("tr-TR"));
      }
    } finally {
      setSaving(false);
    }
  }, [editor, projectId, margins, showPageNumbers]);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    setCheckError(null);
    setCheckResult(null);
    try {
      await handleSave(); // kontrolden önce her zaman güncel içeriği kaydet
      const res = await runManuscriptCheck(projectId);
      if (res.error) {
        setCheckError(res.error);
      } else if (res.result) {
        setCheckResult(res.result);
      }
    } finally {
      setChecking(false);
    }
  }, [projectId, handleSave]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      if (file.size > 8 * 1024 * 1024) {
        window.alert("Resim boyutu 8 MB sınırını aşıyor.");
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.alert("Oturum bulunamadı.");
        return;
      }

      // Resim, Vercel'in sunucu fonksiyonu istek boyutu sınırını
      // (~4.5 MB, aşılamaz) atlamak için doğrudan tarayıcıdan
      // Supabase Storage'a yüklenir (belge yüklemeyle aynı mimari).
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/editor-images/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });

      if (uploadError) {
        console.error(uploadError);
        window.alert("Resim yüklenirken hata oluştu.");
        return;
      }

      const { data: signed, error: signError } = await supabase.storage
        .from("project-files")
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 yıl

      if (signError || !signed) {
        console.error(signError);
        window.alert("Resim bağlantısı oluşturulamadı.");
        return;
      }

      editor.chain().focus().setImage({ src: signed.signedUrl }).run();
    },
    [editor]
  );

  const handleInsertFootnote = useCallback(() => {
    if (!editor) return;
    const text = window.prompt("Dipnot metnini girin:");
    if (!text) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "footnoteReference",
        attrs: { id: `fn-${Date.now()}`, text, number: 1 },
      })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="manuscript-editor-shell">
      <div className="manuscript-toolbar">
        <select
          className="toolbar-select"
          title="Yazı tipi"
          value={editor.getAttributes("textStyle").fontFamily ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              editor.chain().focus().setFontFamily(value).run();
            } else {
              editor.chain().focus().unsetFontFamily().run();
            }
          }}
        >
          <option value="">Varsayılan yazı tipi</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          className="toolbar-select"
          title="Yazı boyutu"
          value={editor.getAttributes("textStyle").fontSize ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              editor.chain().focus().setFontSize(value).run();
            } else {
              editor.chain().focus().unsetFontSize().run();
            }
          }}
        >
          <option value="">Varsayılan boyut</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={`${s}pt`}>
              {s} pt
            </option>
          ))}
        </select>

        <span className="toolbar-divider" />

        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive("bold") ? "is-active" : ""} title="Kalın">
          <BoldIcon size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive("italic") ? "is-active" : ""} title="İtalik">
          <ItalicIcon size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive("underline") ? "is-active" : ""} title="Altı çizili">
          <UnderlineIcon size={16} />
        </button>

        <span className="toolbar-divider" />

        {[1, 2, 3].map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
            className={editor.isActive("heading", { level }) ? "is-active" : ""}
            title={`Başlık ${level}`}
          >
            H{level}
          </button>
        ))}

        <span className="toolbar-divider" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive("bulletList") ? "is-active" : ""} title="Madde işareti">
          <List size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive("orderedList") ? "is-active" : ""} title="Numaralı liste">
          <ListOrdered size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive("blockquote") ? "is-active" : ""} title="Alıntı">
          <Quote size={16} />
        </button>

        <span className="toolbar-divider" />

        <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Sola hizala">
          <AlignLeft size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Ortala">
          <AlignCenter size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Sağa hizala">
          <AlignRight size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="İki yana yasla">
          <AlignJustify size={16} />
        </button>

        <span className="toolbar-divider" />

        <select
          className="toolbar-select"
          title="Satır aralığı"
          value={editor.getAttributes("paragraph").lineSpacing ?? editor.getAttributes("heading").lineSpacing ?? ""}
          onChange={(e) => {
            const value = e.target.value || null;
            editor.chain().focus().setLineSpacing(value).run();
          }}
        >
          <option value="">Satır aralığı</option>
          <option value="1">Tek (1.0)</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">Çift (2.0)</option>
        </select>

        <button
          type="button"
          onClick={() => {
            const current = editor.getAttributes("paragraph").firstLineIndent ?? false;
            editor.chain().focus().setFirstLineIndent(!current).run();
          }}
          className={editor.getAttributes("paragraph").firstLineIndent ? "is-active" : ""}
          title="İlk satır girintisi (1.25 cm)"
        >
          <IndentIncrease size={16} />
        </button>

        <span className="toolbar-divider" />

        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Tablo ekle"
        >
          <TableIcon size={16} />
        </button>
        <button type="button" onClick={() => imageInputRef.current?.click()} title="Resim ekle">
          <ImagePlus size={16} />
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={handleInsertFootnote} title="Dipnot ekle">
          <StickyNote size={16} />
        </button>

        <span className="toolbar-divider" />

        <button type="button" onClick={() => editor.chain().focus().undo().run()} title="Geri al">
          <Undo2 size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} title="Yinele">
          <Redo2 size={16} />
        </button>

        <span className="toolbar-divider" />

        <button
          type="button"
          onClick={() => setShowPageSettings((v) => !v)}
          className={showPageSettings ? "is-active" : ""}
          title="Sayfa kenar boşlukları"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {showPageSettings && (
        <div className="manuscript-page-settings">
          <span className="manuscript-page-settings-label">
            <AlignVerticalSpaceAround size={14} />
            Sayfa kenar boşlukları (cm)
          </span>
          {(["top", "bottom", "left", "right"] as const).map((side) => (
            <label key={side}>
              <span>
                {side === "top" ? "Üst" : side === "bottom" ? "Alt" : side === "left" ? "Sol" : "Sağ"}
              </span>
              <input
                type="number"
                step={0.1}
                min={0}
                max={10}
                value={margins[side]}
                onChange={(e) =>
                  setMargins((prev) => ({ ...prev, [side]: parseFloat(e.target.value) || 0 }))
                }
              />
            </label>
          ))}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={showPageNumbers}
              onChange={(e) => setShowPageNumbers(e.target.checked)}
            />
            <span>Sayfa numarası ekle</span>
          </label>
          <span className="manuscript-page-settings-hint">
            Değerler kaydedince ve Word&apos;e aktarırken uygulanır.
          </span>
        </div>
      )}

      <EditorContent editor={editor} />

      <div className="manuscript-footer">
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {editor.storage.characterCount?.words?.() ?? 0} kelime
          {lastSaved ? ` · Son kayıt: ${lastSaved}` : ""}
        </span>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="projects-filter-button" onClick={handleSave} disabled={saving}>
            <Save size={15} />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button type="button" className="projects-primary-button" onClick={handleCheck} disabled={checking}>
            <ShieldCheck size={15} />
            {checking ? "Kontrol ediliyor..." : "Kontrol Et"}
          </button>
          <a href={`/api/manuscripts/${projectId}/export`} className="projects-filter-button">
            <FileDown size={15} />
            Word olarak indir
          </a>
        </div>
      </div>

      {requiredSections.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted-foreground)" }}>
          Kılavuzun zorunlu tuttuğu bölümler: {requiredSections.join(", ")}
        </div>
      )}

      {checkError && (
        <p className="login-error" role="alert" style={{ marginTop: 16 }}>
          {checkError}
        </p>
      )}

      {checkResult && (
        <div className="project-form-card" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Kontrol Sonucu</h3>

          {checkResult.guidelineCompliance && (
            <div style={{ marginBottom: 16 }}>
              <strong style={{ fontSize: 13 }}>Kılavuz Uygunluğu</strong>
              <ul style={{ fontSize: 13, paddingLeft: 18, marginTop: 6 }}>
                {checkResult.guidelineCompliance.sections.map((s, i) => (
                  <li key={i} style={{ color: s.found ? "#16a34a" : "#dc2626" }}>
                    {s.found ? "✓" : "✗"} {s.section}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <strong style={{ fontSize: 13 }}>
              {checkResult.apa7.referenceSectionFound
                ? `APA7 Uyum Skoru: ${checkResult.apa7.complianceScore}/100`
                : "Kaynakça bölümü bulunamadı"}
            </strong>
            {checkResult.apa7.referenceSectionFound && (
              <>
                <ul style={{ fontSize: 13, paddingLeft: 18, marginTop: 6 }}>
                  {checkResult.apa7.crossCheck.referencesWithoutCitation.map((r, i) => (
                    <li key={`rw-${i}`} style={{ color: "#d97706" }}>
                      Kaynakçada var, metinde atıf yok: {r.raw}
                    </li>
                  ))}
                  {checkResult.apa7.crossCheck.citationsWithoutReference.map((c, i) => (
                    <li key={`cw-${i}`} style={{ color: "#d97706" }}>
                      Metinde atıf var, kaynakçada yok: {c.raw}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
