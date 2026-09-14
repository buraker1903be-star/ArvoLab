"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import TiptapImage from "@tiptap/extension-image";
import { Superscript } from "@tiptap/extension-superscript";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextStyleKit } from "@tiptap/extension-text-style";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Superscript as SuperscriptIcon,
  List,
  ListOrdered,
  Quote,
  Table as TableIcon,
  ImagePlus,
  StickyNote,
  Undo2,
  Redo2,
  ShieldCheck,
  FileDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentIncrease,
  Settings2,
  AlignVerticalSpaceAround,
  FileBadge,
  Trash2,
} from "lucide-react";
import { FootnoteReference } from "@/lib/tiptap-footnote-extension";
import { ParagraphFormatting } from "@/lib/tiptap-paragraph-formatting";
import type { TiptapDoc } from "@/lib/tiptap-text";
import { saveManuscript, runManuscriptCheck, type ManuscriptCheckResult, type PageMargins, type CoverPage } from "@/app/actions/manuscript";
import { createClient } from "@/lib/supabase/client";
import type { GuidelineEditorSettings } from "@/lib/guideline-editor-settings";
import { showToast } from "@/app/dashboard/_components/toast-events";
import Dialog from "@/app/dashboard/_components/dialog";

interface ProjectDefaults {
  title: string;
  university: string;
  institute: string;
  department: string;
  authorName: string;
  projectType: string;
}

const DEGREE_TYPE_BY_PROJECT_TYPE: Record<string, string> = {
  thesis: "Yüksek Lisans Tezi",
  article: "Makale",
  project: "Proje Raporu",
  "associate-professorship": "Doçentlik Eser Dosyası",
};

interface ManuscriptEditorProps {
  projectId: string;
  initialContent: object | null;
  /** Veritabanındaki sürümün zamanı (çakışma denetimi için); null = hiç kaydedilmemiş */
  initialUpdatedAt: string | null;
  requiredSections: string[];
  initialMargins?: PageMargins;
  initialShowPageNumbers?: boolean;
  initialCoverPage?: CoverPage | null;
  projectDefaults?: ProjectDefaults;
  appliedGuideline?: {
    label: string;
    citationStyle: string;
    settings: GuidelineEditorSettings;
    usedAsDefaults: boolean;
  } | null;
}

// Türkiye'deki üniversitelerin tez/makale yazım kılavuzlarında en sık
// istenen yazı tipleri (Times New Roman başta olmak üzere). Seçim
// tamamen serbesttir — burası yalnızca sık kullanılanları listeler.
const FONT_FAMILIES = [
  "Times New Roman",
  "Arial",
  "Calibri",
  "Cambria",
  "Garamond",
  "Georgia",
  "Verdana",
  "Book Antiqua",
];

const FONT_SIZES = [9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24];

const AUTOSAVE_DELAY_MS = 1500;
const RETRY_DELAY_MS = 10000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"];

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

interface LocalDraft {
  content: TiptapDoc;
  baseUpdatedAt: string | null;
  writtenAt: string;
}

// Kaydedilemeyen değişiklikler (bağlantı kopması, oturum bitmesi, sekme
// kapanması) bu tarayıcıda saklanır ve sayfa yeniden açılınca önerilir.
const draftKey = (projectId: string) => `arvolab:manuscript-draft:${projectId}`;

function readDraft(projectId: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(projectId));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(projectId: string, draft: LocalDraft) {
  try {
    window.localStorage.setItem(draftKey(projectId), JSON.stringify(draft));
  } catch {
    // Depolama kapalı/dolu: otomatik kayıt yine çalışır
  }
}

function clearDraft(projectId: string) {
  try {
    window.localStorage.removeItem(draftKey(projectId));
  } catch {
    // yok say
  }
}

const timeLabel = (date: Date) => date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

type FootnoteDialogState = { mode: "insert"; text: string } | { mode: "edit"; pos: number; text: string } | null;

// Araç çubuğu yalnızca bu değerler değişince yeniden çizilir
// (önceden her tuş vuruşunda tüm editör bileşeni yeniden çiziliyordu).
function selectToolbarState({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const footnotes: { pos: number; text: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "footnoteReference") footnotes.push({ pos, text: String(node.attrs.text ?? "") });
  });
  return {
    fontFamily: (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
    fontSize: (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "",
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    superscript: editor.isActive("superscript"),
    heading: [1, 2, 3].find((level) => editor.isActive("heading", { level })) ?? 0,
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    blockquote: editor.isActive("blockquote"),
    align: (["left", "center", "right", "justify"] as const).find((a) => editor.isActive({ textAlign: a })) ?? "",
    lineSpacing:
      (editor.getAttributes("paragraph").lineSpacing as string | undefined) ??
      (editor.getAttributes("heading").lineSpacing as string | undefined) ??
      "",
    firstLineIndent: Boolean(editor.getAttributes("paragraph").firstLineIndent),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    words: (editor.storage.characterCount?.words?.() as number | undefined) ?? 0,
    footnotes,
  };
}

export default function ManuscriptEditor({
  projectId,
  initialContent,
  initialUpdatedAt,
  requiredSections,
  initialMargins,
  initialShowPageNumbers,
  initialCoverPage,
  projectDefaults,
  appliedGuideline,
}: ManuscriptEditorProps) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(initialUpdatedAt ? new Date(initialUpdatedAt) : null);
  const [draftOffer, setDraftOffer] = useState<LocalDraft | null>(null);
  const [checkResult, setCheckResult] = useState<ManuscriptCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [footnoteDialog, setFootnoteDialog] = useState<FootnoteDialogState>(null);
  const [margins, setMargins] = useState<PageMargins>(
    initialMargins ?? { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 }
  );
  const [showPageNumbers, setShowPageNumbers] = useState(initialShowPageNumbers ?? true);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [showCoverPageEditor, setShowCoverPageEditor] = useState(false);
  const [coverPageEnabled, setCoverPageEnabled] = useState(!!initialCoverPage);
  const [coverPage, setCoverPage] = useState<CoverPage>(
    initialCoverPage ?? {
      university: projectDefaults?.university ?? "",
      institute: projectDefaults?.institute ?? "",
      department: projectDefaults?.department ?? "",
      program: "",
      degreeType: DEGREE_TYPE_BY_PROJECT_TYPE[projectDefaults?.projectType ?? "thesis"] ?? "Yüksek Lisans Tezi",
      title: projectDefaults?.title ?? "",
      authorName: projectDefaults?.authorName ?? "",
      advisorName: "",
      city: "",
      year: String(new Date().getFullYear()),
    }
  );
  const imageInputRef = useRef<HTMLInputElement>(null);

  // --- Otomatik kayıt durumu (ref: zamanlayıcılar ve editör olayları her zaman güncel değeri görsün) ---
  const editorRef = useRef<Editor | null>(null);
  const updatedAtRef = useRef<string | null>(initialUpdatedAt);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const blockedRef = useRef(false);
  const settingsRef = useRef({ margins, showPageNumbers, coverPage: coverPageEnabled ? coverPage : null });
  const saveNowRef = useRef<(force?: boolean) => Promise<boolean>>(async () => false);
  const markDirtyRef = useRef<() => void>(() => undefined);
  const openFootnoteRef = useRef<(pos: number, text: string) => void>(() => undefined);

  const persistDraft = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || revisionRef.current === savedRevisionRef.current) return;
    writeDraft(projectId, {
      content: editor.getJSON() as unknown as TiptapDoc,
      baseUpdatedAt: updatedAtRef.current,
      writtenAt: new Date().toISOString(),
    });
  }, [projectId]);

  const scheduleSave = useCallback((delay: number) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveNowRef.current();
    }, delay);
  }, []);

  const saveNow = useCallback(
    async (force = false): Promise<boolean> => {
      const editor = editorRef.current;
      if (!editor) return false;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Aynı anda tek kayıt: öncekinin bitmesi beklenir, sonra en güncel metin gönderilir.
      while (inFlightRef.current) await inFlightRef.current;
      if (blockedRef.current && !force) return false;
      if (!force && revisionRef.current === savedRevisionRef.current) return true;

      const revision = revisionRef.current;
      const run = (async () => {
        setSaveState("saving");
        try {
          const res = await saveManuscript(projectId, {
            content: editor.getJSON() as unknown as TiptapDoc,
            ...settingsRef.current,
            expectedUpdatedAt: updatedAtRef.current,
            force,
          });
          if (res.success) {
            updatedAtRef.current = res.updatedAt;
            savedRevisionRef.current = revision;
            blockedRef.current = false;
            setSessionExpired(false);
            setSaveError(null);
            setLastSavedAt(new Date(res.updatedAt));
            if (revisionRef.current === revision) {
              setSaveState("saved");
              clearDraft(projectId);
            } else {
              setSaveState("dirty");
              scheduleSave(AUTOSAVE_DELAY_MS);
            }
            return true;
          }
          persistDraft();
          setSaveError(res.error);
          if (res.conflict) {
            blockedRef.current = true;
            setSaveState("conflict");
          } else {
            setSaveState("error");
            if (res.sessionExpired) {
              blockedRef.current = true;
              setSessionExpired(true);
            } else {
              scheduleSave(RETRY_DELAY_MS);
            }
          }
          return false;
        } catch {
          persistDraft();
          setSaveError("Bağlantı sorunu nedeniyle kaydedilemedi. Yazdıklarınız bu tarayıcıda saklanıyor; birazdan yeniden denenecek.");
          setSaveState("error");
          scheduleSave(RETRY_DELAY_MS);
          return false;
        }
      })();
      inFlightRef.current = run;
      try {
        return await run;
      } finally {
        inFlightRef.current = null;
      }
    },
    [projectId, persistDraft, scheduleSave]
  );

  const markDirty = useCallback(() => {
    revisionRef.current += 1;
    setSaveState((state) => (state === "conflict" || state === "saving" ? state : "dirty"));
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(persistDraft, 500);
    if (!blockedRef.current) scheduleSave(AUTOSAVE_DELAY_MS);
  }, [persistDraft, scheduleSave]);

  useEffect(() => {
    saveNowRef.current = saveNow;
    markDirtyRef.current = markDirty;
  }, [saveNow, markDirty]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, protocols: ["http", "https", "mailto"] },
      }),
      TextStyleKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ParagraphFormatting,
      Placeholder.configure({ placeholder: "Çalışmanızı buraya yazmaya başlayın..." }),
      CharacterCount,
      Superscript,
      TiptapImage,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      FootnoteReference,
    ],
    content: initialContent ?? "",
    onCreate: ({ editor: created }) => {
      editorRef.current = created;
      // Önceki oturumdan kalan, kaydedilememiş taslak varsa geri yüklemeyi öner.
      const draft = readDraft(projectId);
      if (draft && JSON.stringify(draft.content) !== JSON.stringify(created.getJSON())) {
        setDraftOffer(draft);
      } else if (draft) {
        clearDraft(projectId);
      }
    },
    onUpdate: () => markDirtyRef.current(),
    editorProps: {
      attributes: {
        class: "manuscript-editor-content",
        "aria-label": "Çalışma metni",
        style: [
          appliedGuideline?.settings.fontFamily ? `font-family: '${appliedGuideline.settings.fontFamily}'` : "",
          appliedGuideline?.settings.fontSizePt ? `font-size: ${appliedGuideline.settings.fontSizePt}pt` : "",
          appliedGuideline?.settings.lineSpacing ? `line-height: ${appliedGuideline.settings.lineSpacing}` : "",
        ].filter(Boolean).join("; "),
      },
      handleClickOn: (_view, pos, node) => {
        if (node.type.name !== "footnoteReference") return false;
        openFootnoteRef.current(pos, String(node.attrs.text ?? ""));
        return true;
      },
    },
  });

  const toolbarState = useEditorState({ editor, selector: selectToolbarState });

  // Sayfa ayarları ve kapak da otomatik kaydedilir — yalnızca gerçekten değişince
  // (geliştirmedeki çift effect çalıştırması boş kayıt tetiklemesin).
  const settingsSnapshot = useRef<string | null>(null);
  useEffect(() => {
    const next = { margins, showPageNumbers, coverPage: coverPageEnabled ? coverPage : null };
    const serialized = JSON.stringify(next);
    settingsRef.current = next;
    const previous = settingsSnapshot.current;
    settingsSnapshot.current = serialized;
    if (previous === null || previous === serialized) return;
    markDirtyRef.current();
  }, [margins, showPageNumbers, coverPageEnabled, coverPage]);

  // Kısayol, sekme kapatma uyarısı, sekme gizlenince kaydet, sayfadan ayrılınca kaydet.
  useEffect(() => {
    const isDirty = () => revisionRef.current !== savedRevisionRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNowRef.current();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      persistDraft();
      event.preventDefault();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isDirty()) {
        persistDraft();
        void saveNowRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Panel içinde başka sayfaya geçerken (beforeunload tetiklenmez) son değişiklikler gönderilir.
      if (isDirty()) {
        persistDraft();
        void saveNowRef.current();
      }
    };
  }, [persistDraft]);

  const restoreDraft = useCallback(() => {
    if (!editor || !draftOffer) return;
    editor.commands.setContent(draftOffer.content);
    setDraftOffer(null);
    showToast("success", "Kaydedilmemiş değişiklikleriniz geri yüklendi.");
  }, [editor, draftOffer]);

  const discardDraft = useCallback(() => {
    clearDraft(projectId);
    setDraftOffer(null);
  }, [projectId]);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    setCheckError(null);
    try {
      // Kontrol her zaman güncel metin üzerinde yapılır.
      if (!(await saveNow())) {
        setCheckError("Kontrolden önce metin kaydedilemedi. Kayıt durumunu kontrol edip yeniden deneyin.");
        return;
      }
      const res = await runManuscriptCheck(projectId);
      if (res.error) {
        setCheckError(res.error);
      } else if (res.result) {
        setCheckResult(res.result);
      }
    } catch {
      setCheckError("Kontrol şu anda yapılamadı. Bağlantınızı kontrol edip yeniden deneyin.");
    } finally {
      setChecking(false);
    }
  }, [projectId, saveNow]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Word dosyası, ekrandaki son hâlden oluşturulsun.
      if (!(await saveNow())) {
        showToast("error", "Metin kaydedilemediği için Word dosyası oluşturulmadı.");
        return;
      }
      const link = document.createElement("a");
      link.href = `/api/manuscripts/${projectId}/export`;
      link.download = "";
      link.click();
    } finally {
      window.setTimeout(() => setExporting(false), 1500);
    }
  }, [projectId, saveNow]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      if (!IMAGE_TYPES.includes(file.type)) {
        showToast("error", "Word'e aktarılabilmesi için PNG, JPG veya GIF resim seçin.");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        showToast("error", "Resim boyutu 8 MB sınırını aşıyor.");
        return;
      }

      setImageUploading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          showToast("error", "Oturumunuz sona erdi. Resim eklemek için yeniden giriş yapın.");
          return;
        }

        // Resim, Vercel'in sunucu fonksiyonu istek boyutu sınırını
        // (~4.5 MB, aşılamaz) atlamak için doğrudan tarayıcıdan
        // Supabase Storage'a yüklenir (belge yüklemeyle aynı mimari).
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/editor-images/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("project-files")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          console.error(uploadError);
          showToast("error", "Resim yüklenemedi. Yeniden deneyin.");
          return;
        }

        const { data: signed, error: signError } = await supabase.storage
          .from("project-files")
          .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 yıl
        if (signError || !signed) {
          console.error(signError);
          showToast("error", "Resim bağlantısı oluşturulamadı.");
          return;
        }

        editor.chain().focus().setImage({ src: signed.signedUrl, alt: file.name }).run();
      } catch {
        showToast("error", "Resim yüklenirken bağlantı sorunu oluştu.");
      } finally {
        setImageUploading(false);
      }
    },
    [editor]
  );

  const openFootnoteEditor = useCallback((pos: number, text: string) => {
    setFootnoteDialog({ mode: "edit", pos, text });
  }, []);
  useEffect(() => {
    openFootnoteRef.current = openFootnoteEditor;
  }, [openFootnoteEditor]);

  const closeFootnoteDialog = useCallback(() => setFootnoteDialog(null), []);

  const submitFootnote = useCallback(() => {
    if (!editor || !footnoteDialog) return;
    const text = footnoteDialog.text.trim();
    if (!text) return;
    if (footnoteDialog.mode === "insert") {
      editor
        .chain()
        .focus()
        .insertContent({ type: "footnoteReference", attrs: { id: `fn-${crypto.randomUUID()}`, text } })
        .run();
    } else {
      const { pos } = footnoteDialog;
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          const node = tr.doc.nodeAt(pos);
          if (node?.type.name !== "footnoteReference") return false;
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, text });
          return true;
        })
        .run();
    }
    setFootnoteDialog(null);
  }, [editor, footnoteDialog]);

  const deleteFootnote = useCallback(() => {
    if (!editor || footnoteDialog?.mode !== "edit") return;
    const { pos } = footnoteDialog;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(pos);
        if (node?.type.name !== "footnoteReference") return false;
        tr.delete(pos, pos + node.nodeSize);
        return true;
      })
      .run();
    setFootnoteDialog(null);
  }, [editor, footnoteDialog]);

  if (!editor) return <div className="manuscript-editor-shell manuscript-editor-loading" aria-busy="true" />;
  // Editör oluştuğu ilk çizimde abonelik henüz anlık görüntü üretmemiş olabilir;
  // o an için durum doğrudan okunur (ilk işlemden sonra abonelik devralır).
  const ui = toolbarState ?? selectToolbarState({ editor })!;

  const statusLabel =
    saveState === "saving"
      ? "Kaydediliyor…"
      : saveState === "dirty"
        ? "Kaydedilecek…"
        : saveState === "error"
          ? "Kaydedilemedi · tekrar dene"
          : saveState === "conflict"
            ? "Çakışma var"
            : lastSavedAt
              ? `Kaydedildi · ${timeLabel(lastSavedAt)}`
              : "Otomatik kayıt açık";

  return (
    <div className="manuscript-editor-shell">
      <div className="manuscript-toolbar" role="toolbar" aria-label="Biçimlendirme">
        <select
          className="toolbar-select"
          title="Yazı tipi"
          aria-label="Yazı tipi"
          value={ui.fontFamily}
          onChange={(e) => {
            const value = e.target.value;
            if (value) editor.chain().focus().setFontFamily(value).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
        >
          <option value="">{appliedGuideline?.settings.fontFamily ? `Kılavuz (${appliedGuideline.settings.fontFamily})` : "Varsayılan yazı tipi"}</option>
          {FONT_FAMILIES.map((font) => (
            <option key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
        </select>

        <select
          className="toolbar-select"
          title="Yazı boyutu"
          aria-label="Yazı boyutu"
          value={ui.fontSize}
          onChange={(e) => {
            const value = e.target.value;
            if (value) editor.chain().focus().setFontSize(value).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
        >
          <option value="">{appliedGuideline?.settings.fontSizePt ? `Kılavuz (${appliedGuideline.settings.fontSizePt} pt)` : "Varsayılan boyut"}</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={`${s}pt`}>
              {s} pt
            </option>
          ))}
        </select>

        <span className="toolbar-divider" />

        <ToolbarButton label="Kalın (Ctrl+B)" active={ui.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <BoldIcon size={16} />
        </ToolbarButton>
        <ToolbarButton label="İtalik (Ctrl+I)" active={ui.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <ItalicIcon size={16} />
        </ToolbarButton>
        <ToolbarButton label="Altı çizili (Ctrl+U)" active={ui.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={16} />
        </ToolbarButton>
        <ToolbarButton label="Üst simge" active={ui.superscript} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
          <SuperscriptIcon size={16} />
        </ToolbarButton>

        <span className="toolbar-divider" />

        {([1, 2, 3] as const).map((level) => (
          <ToolbarButton
            key={level}
            label={`Başlık ${level}`}
            active={ui.heading === level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            H{level}
          </ToolbarButton>
        ))}

        <span className="toolbar-divider" />

        <ToolbarButton label="Madde işaretli liste" active={ui.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton label="Numaralı liste" active={ui.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton label="Alıntı" active={ui.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={16} />
        </ToolbarButton>

        <span className="toolbar-divider" />

        <ToolbarButton label="Sola hizala" active={ui.align === "left"} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton label="Ortala" active={ui.align === "center"} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton label="Sağa hizala" active={ui.align === "right"} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight size={16} />
        </ToolbarButton>
        <ToolbarButton label="İki yana yasla" active={ui.align === "justify"} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify size={16} />
        </ToolbarButton>

        <span className="toolbar-divider" />

        <select
          className="toolbar-select"
          title="Satır aralığı"
          aria-label="Satır aralığı"
          value={ui.lineSpacing}
          onChange={(e) => editor.chain().focus().setLineSpacing(e.target.value || null).run()}
        >
          <option value="">{appliedGuideline?.settings.lineSpacing ? `Aralık: kılavuz (${appliedGuideline.settings.lineSpacing})` : "Satır aralığı"}</option>
          <option value="1">Tek (1.0)</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">Çift (2.0)</option>
        </select>

        <ToolbarButton
          label="İlk satır girintisi (1.25 cm)"
          active={ui.firstLineIndent}
          onClick={() => editor.chain().focus().setFirstLineIndent(!ui.firstLineIndent).run()}
        >
          <IndentIncrease size={16} />
        </ToolbarButton>

        <span className="toolbar-divider" />

        <ToolbarButton label="Tablo ekle" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon size={16} />
        </ToolbarButton>
        <ToolbarButton
          label={imageUploading ? "Resim yükleniyor…" : "Resim ekle (PNG, JPG, GIF)"}
          disabled={imageUploading}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus size={16} />
        </ToolbarButton>
        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageUpload(file);
            e.target.value = "";
          }}
        />
        <ToolbarButton label="Dipnot ekle" onClick={() => setFootnoteDialog({ mode: "insert", text: "" })}>
          <StickyNote size={16} />
        </ToolbarButton>

        <span className="toolbar-divider" />

        <ToolbarButton label="Geri al (Ctrl+Z)" disabled={!ui.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Yinele (Ctrl+Shift+Z)" disabled={!ui.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={16} />
        </ToolbarButton>

        <span className="toolbar-divider" />

        <ToolbarButton label="Sayfa ayarları" active={showPageSettings} onClick={() => setShowPageSettings((v) => !v)}>
          <Settings2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Kapak sayfası" active={showCoverPageEditor} onClick={() => setShowCoverPageEditor((v) => !v)}>
          <FileBadge size={16} />
        </ToolbarButton>

        <span className="toolbar-spacer" />
        <button
          type="button"
          className="save-status"
          data-state={saveState}
          title="Şimdi kaydet (Ctrl+S)"
          aria-live="polite"
          onClick={() => void saveNow()}
        >
          {statusLabel}
        </button>
      </div>

      {draftOffer ? (
        <div className="callout editor-notice cluster" data-tone="warning" role="status">
          <span>
            Bu tarayıcıda kaydedilmemiş değişiklikleriniz bulundu
            ({new Date(draftOffer.writtenAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}).
          </span>
          <span className="cluster">
            <button type="button" className="projects-primary-button" onClick={restoreDraft}>Geri yükle</button>
            <button type="button" className="projects-filter-button" onClick={discardDraft}>Yok say</button>
          </span>
        </div>
      ) : null}

      {saveState === "conflict" ? (
        <div className="callout editor-notice cluster" data-tone="danger" role="alert">
          <span>
            Bu belge başka bir sekmede ya da başka biri tarafından değiştirildi. Üzerine yazmamak için
            otomatik kayıt durduruldu; yazdıklarınız bu tarayıcıda saklanıyor.
          </span>
          <span className="cluster">
            <button
              type="button"
              className="projects-filter-button"
              onClick={() => {
                persistDraft();
                window.location.reload();
              }}
            >
              Diğer sürümü aç
            </button>
            <button type="button" className="button-danger" onClick={() => void saveNow(true)}>
              Benim sürümümü kaydet
            </button>
          </span>
        </div>
      ) : saveState === "error" && saveError ? (
        <div className="callout editor-notice cluster" data-tone="danger" role="alert">
          <span>{saveError}</span>
          <span className="cluster">
            {sessionExpired ? (
              <button type="button" className="projects-primary-button" onClick={() => window.location.reload()}>
                Yeniden giriş yap
              </button>
            ) : (
              <button type="button" className="projects-filter-button" onClick={() => void saveNow()}>
                Şimdi dene
              </button>
            )}
          </span>
        </div>
      ) : null}

      {showCoverPageEditor && (
        <div className="manuscript-page-settings manuscript-cover-page-editor">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={coverPageEnabled}
              onChange={(e) => setCoverPageEnabled(e.target.checked)}
            />
            <strong>Kapak sayfası oluştur (Word&apos;e aktarınca belgenin ilk sayfası olur)</strong>
          </label>

          {coverPageEnabled && (
            <div className="manuscript-cover-page-grid">
              <CoverField label="Üniversite" value={coverPage.university} onChange={(university) => setCoverPage((p) => ({ ...p, university }))} />
              <CoverField label="Enstitü / Fakülte" value={coverPage.institute} onChange={(institute) => setCoverPage((p) => ({ ...p, institute }))} />
              <CoverField label="Anabilim Dalı / Bölüm" value={coverPage.department} onChange={(department) => setCoverPage((p) => ({ ...p, department }))} />
              <CoverField label="Program (varsa)" value={coverPage.program} onChange={(program) => setCoverPage((p) => ({ ...p, program }))} />
              <CoverField full label="Tez / Çalışma Başlığı" value={coverPage.title} onChange={(title) => setCoverPage((p) => ({ ...p, title }))} />
              <CoverField label="Yazar Adı Soyadı" value={coverPage.authorName} onChange={(authorName) => setCoverPage((p) => ({ ...p, authorName }))} />
              <label>
                <span>Çalışma Türü</span>
                <select
                  value={coverPage.degreeType}
                  onChange={(e) => setCoverPage((p) => ({ ...p, degreeType: e.target.value }))}
                >
                  <option value="Yüksek Lisans Tezi">Yüksek Lisans Tezi</option>
                  <option value="Doktora Tezi">Doktora Tezi</option>
                  <option value="Lisans Bitirme Tezi">Lisans Bitirme Tezi</option>
                  <option value="Makale">Makale</option>
                  <option value="Proje Raporu">Proje Raporu</option>
                  <option value="Doçentlik Eser Dosyası">Doçentlik Eser Dosyası</option>
                </select>
              </label>
              <CoverField label="Danışman (varsa)" placeholder="Unvan Adı Soyadı" value={coverPage.advisorName} onChange={(advisorName) => setCoverPage((p) => ({ ...p, advisorName }))} />
              <CoverField label="Şehir" value={coverPage.city} onChange={(city) => setCoverPage((p) => ({ ...p, city }))} />
              <CoverField label="Yıl" value={coverPage.year} onChange={(year) => setCoverPage((p) => ({ ...p, year }))} />
            </div>
          )}
        </div>
      )}

      {appliedGuideline ? (
        <div className="guideline-applied-banner" role="status">
          <div>
            <strong>Tez kılavuzu otomatik uygulandı</strong>
            <span>{appliedGuideline.label}</span>
          </div>
          <span>
            {appliedGuideline.citationStyle ? `${appliedGuideline.citationStyle.toUpperCase()} · ` : ""}
            {appliedGuideline.usedAsDefaults ? "Sayfa ayarları kılavuzdan yüklendi" : "Kayıtlı kişisel ayarlar korundu"}
          </span>
        </div>
      ) : null}

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
                  setMargins((prev) => ({ ...prev, [side]: Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 10) }))
                }
              />
            </label>
          ))}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showPageNumbers}
              onChange={(e) => setShowPageNumbers(e.target.checked)}
            />
            <span>Sayfa numarası ekle</span>
          </label>
          <span className="manuscript-page-settings-hint">
            Otomatik kaydedilir, Word&apos;e aktarırken uygulanır.
          </span>
        </div>
      )}

      <EditorContent editor={editor} />

      {ui.footnotes.length > 0 ? (
        <ol className="footnote-list" aria-label="Dipnotlar">
          {ui.footnotes.map((footnote) => (
            <li key={footnote.pos}>
              <button type="button" onClick={() => openFootnoteEditor(footnote.pos, footnote.text)}>
                {footnote.text || "(boş dipnot)"}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="manuscript-footer">
        <span className="muted text-sm">
          {ui.words.toLocaleString("tr-TR")} kelime
          {ui.footnotes.length > 0 ? ` · ${ui.footnotes.length} dipnot` : ""}
        </span>

        <div className="cluster cluster-lg">
          <button type="button" className="projects-primary-button" onClick={handleCheck} disabled={checking}>
            <ShieldCheck size={15} />
            {checking ? "Kontrol ediliyor..." : "Kontrol Et"}
          </button>
          <button type="button" className="projects-filter-button" onClick={handleExport} disabled={exporting}>
            <FileDown size={15} />
            {exporting ? "Hazırlanıyor..." : "Word olarak indir"}
          </button>
        </div>
      </div>

      {requiredSections.length > 0 && (
        <div className="muted text-sm mt-md">
          Kılavuzun zorunlu tuttuğu bölümler: {requiredSections.join(", ")}
        </div>
      )}

      {checkError && (
        <p className="alert mt-md" data-tone="danger" role="alert">
          {checkError}
        </p>
      )}

      {checkResult && (
        <div className="project-form-card mt-md">
          <h3 className="result-heading-lg">Kontrol Sonucu</h3>

          {checkResult.guidelineCompliance && (
            <div className="result-block">
              <strong className="text-base">Kılavuz Uygunluğu</strong>
              <ul className="result-list">
                {checkResult.guidelineCompliance.sections.map((s, i) => (
                  <li key={i} className="tone-text" data-tone={s.found ? "success" : "danger"}>
                    {s.found ? "✓" : "✗"} {s.section}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {checkResult.citationCheckSupported ? (
            <div>
              <strong className="text-base">
                {checkResult.apa7.referenceSectionFound
                  ? `APA 7 Uyum Skoru: ${checkResult.apa7.complianceScore}/100`
                  : "Kaynakça bölümü bulunamadı (\"Kaynakça\" ya da \"Kaynaklar\" başlığı ekleyin)"}
              </strong>
              {checkResult.apa7.referenceSectionFound && (
                <ul className="result-list">
                  {checkResult.apa7.crossCheck.referencesWithoutCitation.map((r, i) => (
                    <li key={`rw-${i}`} className="tone-text" data-tone="warning">
                      Kaynakçada var, metinde atıf yok: {r.raw}
                    </li>
                  ))}
                  {checkResult.apa7.crossCheck.citationsWithoutReference.map((c, i) => (
                    <li key={`cw-${i}`} className="tone-text" data-tone="warning">
                      Metinde atıf var, kaynakçada yok: {c.raw}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="muted text-sm">
              Otomatik kaynakça denetimi şimdilik yalnızca APA 7 için yapılıyor
              (bu çalışmanın atıf stili: {checkResult.citationStyle.toUpperCase()}).
            </p>
          )}
        </div>
      )}

      <Dialog
        open={footnoteDialog !== null}
        onClose={closeFootnoteDialog}
        kicker="Dipnot"
        title={footnoteDialog?.mode === "edit" ? "Dipnotu düzenle" : "Dipnot ekle"}
        description="Numaralar belge sırasına göre otomatik verilir; Word'e gerçek dipnot olarak aktarılır."
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            submitFootnote();
          }}
        >
          <label className="dialog-field">
            <span>Dipnot metni</span>
            <textarea
              rows={4}
              required
              value={footnoteDialog?.text ?? ""}
              onChange={(e) => setFootnoteDialog((d) => (d ? { ...d, text: e.target.value } : d))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitFootnote();
                }
              }}
            />
          </label>
          <div className="cluster">
            <button type="submit" className="projects-primary-button" disabled={!footnoteDialog?.text.trim()}>
              {footnoteDialog?.mode === "edit" ? "Kaydet" : "Ekle"}
            </button>
            {footnoteDialog?.mode === "edit" ? (
              <button type="button" className="button-danger" onClick={deleteFootnote}>
                <Trash2 size={15} />
                Dipnotu sil
              </button>
            ) : null}
            <button type="button" className="projects-filter-button" onClick={closeFootnoteDialog}>
              Vazgeç
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? "is-active" : undefined}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Düğmeye basınca editör seçimini kaybetmesin
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CoverField({
  label,
  value,
  onChange,
  placeholder,
  full = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <label className={full ? "manuscript-cover-page-full" : undefined}>
      <span>{label}</span>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
