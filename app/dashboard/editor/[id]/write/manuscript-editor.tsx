"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import TiptapImage from "@tiptap/extension-image";
import { Superscript } from "@tiptap/extension-superscript";
import { Caption } from "@/lib/tiptap-caption";
import { SearchHighlight } from "@/lib/tiptap-search";
import { HeadingNumbers } from "@/lib/tiptap-heading-numbers";
import { hasManualNumber } from "@/lib/heading-numbering";
import { describeAbstractRules } from "@/lib/guideline-editor-settings";
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
  History,
  BookMarked,
  Printer,
  Captions,
  TableProperties,
  Search,
  FileUp,
  Images,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Share2,
} from "lucide-react";
import FindReplaceBar from "./find-replace-bar";
import ImportDialog, { type ImportMode } from "./import-dialog";
import type { DocxImportStats } from "@/lib/docx-import";
import ImageLibraryDialog from "./image-library-dialog";
import ShortcutsDialog from "./shortcuts-dialog";
import type { FormatLossReport } from "@/lib/format-loss";
import { checkStructure, type StructureIssue } from "@/lib/structure-check";
import { describeParagraphFormat, type ParagraphFormatRules } from "@/lib/paragraph-format";
import VersionsDialog from "./versions-dialog";
import SubmissionChecklistDialog from "./submission-checklist";
import ShareDialog from "./share-dialog";
import { buildSubmissionChecklist, missingCoverFields, type ChecklistAction } from "@/lib/submission-checklist";
import { sayfaDuzeniFarklari } from "@/lib/sayfa-duzeni";
import CiteDialog from "./cite-dialog";
import ManuscriptComments from "./manuscript-comments";
import { updateLiteratureStatus, type LiteratureSource } from "@/app/actions/literature";
import type { CitationStyle } from "@/lib/citation-format";
import { FootnoteReference } from "@/lib/tiptap-footnote-extension";
import { ParagraphFormatting } from "@/lib/tiptap-paragraph-formatting";
import { extractPlainText, type TiptapDoc } from "@/lib/tiptap-text";
import {
  saveManuscript,
  runManuscriptCheck,
  type ManuscriptCheckResult,
  type PageMargins,
  type CoverPage,
  type SettingsSource,
} from "@/app/actions/manuscript";
import { createClient } from "@/lib/supabase/client";
import type { AppliedGuideline } from "@/lib/guideline-rules";
import type { GuidelineSyncChange, GuidelineSyncMode } from "@/lib/guideline-sync";
import Link from "next/link";
import { showToast } from "@/app/dashboard/_components/toast-events";
import Dialog from "@/app/dashboard/_components/dialog";
import { estimatePages, pageRangeTone } from "@/lib/page-estimate";
import { writingProgress } from "@/lib/writing-progress";
import { writingPace } from "@/lib/writing-pace";
import ManuscriptOutline from "./manuscript-outline";
import {
  applyTemplate,
  collectHeadings,
  insertSections,
  insertCitation,
  isDocumentEmpty,
  jumpToHeading,
  sectionStatuses,
  selectedText,
  selectText,
  sortReferences,
  fixReferencePunctuationInEditor,
  applyParagraphFormat,
  convertReferenceListsToParagraphs,
  type OutlineHeading,
} from "./editor-navigation";

const CITATION_STYLES: CitationStyle[] = ["apa7", "chicago", "ieee", "vancouver"];

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
  initialMargins?: PageMargins;
  initialShowPageNumbers?: boolean;
  initialCoverPage?: CoverPage | null;
  projectDefaults?: ProjectDefaults;
  /** Çalışmaya bağlı kılavuzun son onaylı sürümü */
  guideline: AppliedGuideline | null;
  /** Sayfa ayarlarının kılavuzla senkron durumu (sunucuda hesaplanır) */
  guidelineSync: { mode: GuidelineSyncMode; source: SettingsSource; changes: GuidelineSyncChange[] };
  /** Kurum seçimi için çalışma düzenleme sayfası */
  editHref: string;
  /** Word çıktısına içindekiler tablosu */
  initialIncludeToc: boolean;
  /** Başlıklar otomatik numaralanır ("1.", "1.1.") */
  initialHeadingNumbering?: boolean;
  /** Çalışmanın teslim tarihi ve durumu (yazım temposu için) */
  dueDate?: string | null;
  projectStatus?: string | null;
  /** Çalışmanın kaynakça sistemi (atıf biçimi) */
  citationStyle: string;
  /** Eski kayıt hatasından etkilenmişse neyin kaybolduğu (etkilenmediyse null) */
  formatLoss: FormatLossReport | null;
}

const formatDate = (value: string | null | undefined) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("tr-TR") : null;
};

const safeExternalUrl = (value: string | null) => (value && /^https?:\/\//i.test(value) ? value : null);

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
// Büyük belgelerde (190 sayfalık tez ≈ 0,9 MB) her 1,5 sn'de tüm metni göndermek ve tarayıcı
// taslağına yazmak bağlantıyı ve cihazı yorar; aralık belgenin boyutuna göre açılır.
const LARGE_DOC_BYTES = 300_000;
const autosaveDelay = (bytes: number) => (bytes > LARGE_DOC_BYTES ? 4000 : AUTOSAVE_DELAY_MS);
const draftDelay = (bytes: number) => (bytes > LARGE_DOC_BYTES ? 3000 : 500);
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

// Belge geneli istatistikler (kelime, başlık, dipnot, şekil/tablo). Tüm belgeyi gezdiği için
// (190 sayfalık tezde ~5 ms) her tuşta ve imleç hareketinde değil, metin değişince kısa bir
// beklemeyle hesaplanır.
function computeDocStats(editor: Editor) {
  const footnotes: { pos: number; text: string }[] = [];
  let figures = 0;
  let tables = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "footnoteReference") footnotes.push({ pos, text: String(node.attrs.text ?? "") });
    else if (node.type.name === "paragraph") {
      if (node.attrs.caption === "figure") figures += 1;
      else if (node.attrs.caption === "table") tables += 1;
    }
  });
  return {
    words: (editor.storage.characterCount?.words?.() as number | undefined) ?? 0,
    footnotes,
    headings: collectHeadings(editor.state.doc),
    empty: isDocumentEmpty(editor.state.doc),
    figures,
    tables,
  };
}

type DocStats = ReturnType<typeof computeDocStats>;

/** Yazma durduktan sonra canlı yapı denetimi (190 sayfalık tezde ~7 ms) */
const LIVE_CHECK_DELAY_MS = 2500;

// Araç çubuğu yalnızca bu (seçime bağlı, ucuz) değerler değişince yeniden çizilir
// (önceden her tuş vuruşunda tüm editör bileşeni yeniden çiziliyordu).
function selectToolbarState({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
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
    caption: (editor.getAttributes("paragraph").caption as string | null | undefined) ?? null,
  };
}

export default function ManuscriptEditor({
  projectId,
  initialContent,
  initialUpdatedAt,
  initialMargins,
  initialShowPageNumbers,
  initialCoverPage,
  projectDefaults,
  guideline,
  guidelineSync,
  editHref,
  initialIncludeToc,
  initialHeadingNumbering = false,
  dueDate = null,
  projectStatus = null,
  citationStyle,
  formatLoss,
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
  const [structureIssues, setStructureIssues] = useState<StructureIssue[] | null>(null);
  const [liveIssues, setLiveIssues] = useState<StructureIssue[] | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [footnoteDialog, setFootnoteDialog] = useState<FootnoteDialogState>(null);
  const [settingsSource, setSettingsSource] = useState<SettingsSource>(guidelineSync.source);
  const [syncMode, setSyncMode] = useState<GuidelineSyncMode>(guidelineSync.mode);
  const [guidelineOpen, setGuidelineOpen] = useState(false);
  // Kılavuzun paragraf düzeni kuralı: yoksa denetim bu konuya hiç bakmaz.
  const paragraphFormat = useMemo<ParagraphFormatRules>(
    () => ({
      ...(guideline?.settings.paragraphIndentCm ? { indentCm: guideline.settings.paragraphIndentCm } : {}),
      ...(guideline?.settings.justify ? { justify: true } : {}),
    }),
    [guideline]
  );
  const [includeToc, setIncludeToc] = useState(initialIncludeToc);
  const [headingNumbering, setHeadingNumbering] = useState(initialHeadingNumbering);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [citeOpen, setCiteOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [formatLossDismissed, setFormatLossDismissed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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
  /** Son kaydedilen içeriğin JSON boyutu (otomatik kayıt aralığını belirler) */
  const payloadBytesRef = useRef(0);
  const settingsRef = useRef({
    margins,
    showPageNumbers,
    coverPage: coverPageEnabled ? coverPage : null,
    settingsSource,
    includeToc,
    headingNumbering,
  });
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
          // ProseMirror öznitelik nesneleri prototipsizdir (Object.create(null)); React'in sunucu
          // eylemi kodlayıcısı bunları düz nesne saymayıp "$T" (geçici referans) olarak gönderir ve
          // sunucuya hiçbir şey ulaşmaz: başlık düzeyi, resim adresi, dipnot metni vb. kaybolurdu.
          // Düz JSON'a çevirerek gönderiyoruz; boyutu otomatik kayıt aralığını belirler.
          const serialized = JSON.stringify(editor.getJSON());
          payloadBytesRef.current = serialized.length;
          // Kartlardaki ilerleme çubuğu: kılavuzun bölümleri ve sayfa alt sınırına göre.
          const progress = guideline
            ? writingProgress({
                sectionsFound: sectionStatuses(collectHeadings(editor.state.doc), guideline.requiredSections).filter((item) => item.heading)
                  .length,
                sectionsRequired: guideline.requiredSections.length,
                pages: estimatePages((editor.storage.characterCount?.words?.() as number | undefined) ?? 0, {
                  fontSizePt: guideline.settings.fontSizePt,
                  lineSpacing: guideline.settings.lineSpacing,
                  margins: settingsRef.current.margins,
                }),
                minPages: guideline.minPages,
                maxPages: guideline.maxPages,
              })
            : null;
          const res = await saveManuscript(projectId, {
            content: JSON.parse(serialized) as TiptapDoc,
            ...settingsRef.current,
            expectedUpdatedAt: updatedAtRef.current,
            force,
            progress,
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
              scheduleSave(autosaveDelay(payloadBytesRef.current));
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
        } catch (hata) {
          persistDraft();
          /*
            Yeni sürüm yayınlanınca açık sayfadaki server action kimliği
            geçersizleşir ("Failed to find Server Action"). Bu ağ hatası değil:
            yeniden denemek asla başarmaz, sayfa yenilenmelidir. Eskiden 10
            saniyede bir sonsuza kadar deneniyordu.
          */
          const eskiSurum = /Failed to find Server Action|Server Action .* was not found/i.test(
            hata instanceof Error ? hata.message : String(hata),
          );
          if (eskiSurum) {
            blockedRef.current = true;
            setSaveError("Yeni bir sürüm yayınlandı. Yazdıklarınız bu tarayıcıda saklandı; sayfayı yenileyin, kaldığınız yerden devam edin.");
            setSaveState("error");
            return false;
          }
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
    [projectId, guideline, persistDraft, scheduleSave]
  );

  const markDirty = useCallback(() => {
    revisionRef.current += 1;
    setSaveState((state) => (state === "conflict" || state === "saving" ? state : "dirty"));
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(persistDraft, draftDelay(payloadBytesRef.current));
    if (!blockedRef.current) scheduleSave(autosaveDelay(payloadBytesRef.current));
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
      Caption,
      SearchHighlight,
      HeadingNumbers.configure({ enabled: initialHeadingNumbering }),
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
        // Kılavuzun ana bölüm kuralları editörde de görünür (metin değişmez; CSS workspace.css)
        ...(guideline?.settings.chapterUppercase ? { "data-chapter-case": "upper" } : {}),
        ...(guideline?.settings.chapterNewPage ? { "data-chapter-new-page": "true" } : {}),
        "aria-label": "Çalışma metni",
        // Tarayıcının yazım denetimi Türkçe sözlükle çalışsın
        spellcheck: "true",
        lang: "tr",
        style: [
          guideline?.settings.fontFamily ? `font-family: '${guideline.settings.fontFamily}'` : "",
          guideline?.settings.fontSizePt ? `font-size: ${guideline.settings.fontSizePt}pt` : "",
          guideline?.settings.lineSpacing ? `line-height: ${guideline.settings.lineSpacing}` : "",
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

  // Belge istatistikleri metin değişince 250 ms beklemeyle güncellenir; imleç hareketinde çalışmaz.
  const [docStats, setDocStats] = useState<DocStats | null>(null);
  useEffect(() => {
    if (!editor) return;
    let timer: number | null = null;
    const refresh = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (!editor.isDestroyed) setDocStats(computeDocStats(editor));
      }, 250);
    };
    const initial = window.setTimeout(() => {
      if (!editor.isDestroyed) setDocStats(computeDocStats(editor));
    }, 0);
    editor.on("update", refresh);
    return () => {
      window.clearTimeout(initial);
      if (timer) window.clearTimeout(timer);
      editor.off("update", refresh);
    };
  }, [editor]);

  // Sayfa ayarları ve kapak da otomatik kaydedilir — yalnızca gerçekten değişince
  // (geliştirmedeki çift effect çalıştırması boş kayıt tetiklemesin).
  const settingsSnapshot = useRef<string | null>(null);
  useEffect(() => {
    const next = { margins, showPageNumbers, coverPage: coverPageEnabled ? coverPage : null, settingsSource, includeToc, headingNumbering };
    const serialized = JSON.stringify(next);
    settingsRef.current = next;
    const previous = settingsSnapshot.current;
    settingsSnapshot.current = serialized;
    if (previous === null || previous === serialized) return;
    markDirtyRef.current();
  }, [margins, showPageNumbers, coverPageEnabled, coverPage, settingsSource, includeToc, headingNumbering]);

  // Numaralar editörde süsleme olarak gösterilir; açıp kapatmak metni değiştirmez.
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setHeadingNumbering(headingNumbering);
  }, [editor, headingNumbering]);

  // Canlı yapı denetimi: yazma durunca atıf–kaynakça, şekil/tablo, başlık ve boş bölüm
  // sorunları kendiliğinden bulunur ve alt çubukta gösterilir ("Kontrol Et"e gerek kalmaz).
  useEffect(() => {
    if (!editor) return;
    let timer: number | null = null;
    const run = () => {
      timer = null;
      // Arka plan sekmesinde açılan editörün görünümü henüz bağlanmamış olabilir: ilk denetimi
      // atlamak yerine sonra yeniden dene (bileşen kaldırılınca temizlik zamanlayıcıyı iptal eder).
      if (editor.isDestroyed) {
        schedule(1000);
        return;
      }
      setLiveIssues(
        checkStructure(JSON.parse(JSON.stringify(editor.getJSON())), { citationStyle, abstract: guideline?.settings.abstract, paragraphFormat })
      );
    };
    const schedule = (delay: number) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(run, delay);
    };
    const onUpdate = () => schedule(LIVE_CHECK_DELAY_MS);
    schedule(600);
    editor.on("update", onUpdate);
    return () => {
      if (timer) window.clearTimeout(timer);
      editor.off("update", onUpdate);
    };
  }, [editor, citationStyle, guideline, paragraphFormat]);

  const closeIssues = useCallback(() => setIssuesOpen(false), []);
  const closeChecklist = useCallback(() => setChecklistOpen(false), []);
  const closeShare = useCallback(() => setShareOpen(false), []);

  // Kılavuzun yeni sürümü kendiliğinden uygulandıysa kalıcı olsun (bir kez).
  const autoAppliedRef = useRef(false);
  useEffect(() => {
    if (!editor || guidelineSync.mode !== "auto-applied" || autoAppliedRef.current) return;
    autoAppliedRef.current = true;
    markDirtyRef.current();
  }, [editor, guidelineSync.mode]);

  // Kısayol, sekme kapatma uyarısı, sekme gizlenince kaydet, sayfadan ayrılınca kaydet.
  useEffect(() => {
    const isDirty = () => revisionRef.current !== savedRevisionRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNowRef.current();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        // Yalnızca editör alanındayken; sayfanın başka yerinde tarayıcının kendi araması çalışır.
        const target = event.target as HTMLElement | null;
        if (target?.closest?.(".manuscript-layout")) {
          event.preventDefault();
          setFindOpen(true);
        }
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
      // Yapı ve bütünlük kontrolü ekrandaki içerik üzerinde tarayıcıda anında çalışır.
      const current = editorRef.current;
      if (current) {
        const issues = checkStructure(JSON.parse(JSON.stringify(current.getJSON())), {
          citationStyle,
          abstract: guideline?.settings.abstract,
          paragraphFormat,
        });
        setStructureIssues(issues);
        setLiveIssues(issues);
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
  }, [projectId, saveNow, citationStyle, guideline, paragraphFormat]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Word dosyası, ekrandaki son hâlden oluşturulsun.
      if (!(await saveNow())) {
        showToast("error", "Metin kaydedilemediği için Word dosyası oluşturulmadı.");
        return;
      }
      /*
        Eskiden <a download> tıklanıyordu: 402 (abonelik), 404 ve 500
        yanıtlarındaki Türkçe açıklama hiçbir yerde görünmüyor, indirme
        sessizce boş kalıyordu. Artık yanıt okunup hata bildirimle gösterilir.
      */
      const response = await fetch(`/api/manuscripts/${projectId}/export`, { cache: "no-store" });
      if (!response.ok) {
        const govde = (await response.json().catch(() => null)) as { error?: string } | null;
        showToast("error", govde?.error ?? "Word dosyası oluşturulamadı. Metin çok büyükse resimleri küçültüp tekrar deneyin.");
        return;
      }
      /*
        Büyük dosyalar Vercel'in yanıt sınırına takıldığı için depoya yazılıp
        imzalı bağlantıyla dönüyor; küçük dosyalar doğrudan geliyor.
      */
      if (response.headers.get("Content-Type")?.includes("application/json")) {
        const { downloadUrl, fileName } = (await response.json()) as { downloadUrl: string; fileName?: string };
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName ?? "calisma.docx";
        link.click();
        return;
      }
      const blob = await response.blob();
      const adBasligi = response.headers.get("Content-Disposition") ?? "";
      const eslesme = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(adBasligi);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = eslesme ? decodeURIComponent(eslesme[1]) : "calisma.docx";
      link.click();
      URL.revokeObjectURL(url);
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
          .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 gün; editör/yazdırma/Word açılışta depo yolundan yeniler
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
  const closeGuideline = useCallback(() => setGuidelineOpen(false), []);

  // Kullanıcı sayfa ayarlarını kendisi değiştirdi: yeni kılavuz sürümü artık kendiliğinden uygulanmaz, önerilir.
  const markCustomized = useCallback(() => {
    setSettingsSource((source) => (source.customized ? source : { ...source, customized: true }));
  }, []);

  const acceptGuidelineSettings = useCallback(() => {
    if (!guideline) return;
    if (guideline.settings.margins) setMargins(guideline.settings.margins);
    if (guideline.settings.showPageNumbers !== undefined) setShowPageNumbers(guideline.settings.showPageNumbers);
    if (guideline.settings.headingNumbering !== undefined) setHeadingNumbering(guideline.settings.headingNumbering);
    setSettingsSource({ guidelineId: guideline.id, version: guideline.version, customized: false });
    setSyncMode("current");
    showToast("success", "Sayfa ayarları kılavuzun güncel sürümüne göre güncellendi.");
  }, [guideline]);

  const keepOwnSettings = useCallback(() => {
    if (!guideline) return;
    setSettingsSource({ guidelineId: guideline.id, version: guideline.version, customized: true });
    setSyncMode("current");
  }, [guideline]);

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
  const stats = docStats ?? computeDocStats(editor);
  const requiredSections = guideline?.requiredSections ?? [];
  const isThesis = (projectDefaults?.projectType ?? "thesis") === "thesis";
  const sections = sectionStatuses(stats.headings, requiredSections);
  // Otomatik numara açıkken elle "1.2. Amaç" yazılmış başlıklar çift numaralı görünür.
  const manualNumbered = headingNumbering ? stats.headings.filter((heading) => hasManualNumber(heading.text)).length : 0;
  const pages = estimatePages(stats.words, {
    fontSizePt: guideline?.settings.fontSizePt,
    lineSpacing: guideline?.settings.lineSpacing,
    margins,
  });
  const pageTone = pageRangeTone(pages, guideline?.minPages ?? null, guideline?.maxPages ?? null);

  // Yazım temposu: sayfa hedefine kalan kelime ve teslim tarihine göre günlük hedef
  const pace = writingPace({
    words: stats.words,
    minPages: guideline?.minPages ?? null,
    maxPages: guideline?.maxPages ?? null,
    dueDate,
    status: projectStatus,
    settings: { fontSizePt: guideline?.settings.fontSizePt, lineSpacing: guideline?.settings.lineSpacing, margins },
  });

  // Teslim kontrolü: editördeki denetimlerin tek listede özeti (lib/submission-checklist.ts)
  const missingSections = sections.filter((item) => !item.heading).map((item) => item.section);
  const checklist = buildSubmissionChecklist({
    isThesis,
    hasGuideline: Boolean(guideline),
    sections: { total: sections.length, missing: missingSections },
    pages,
    minPages: guideline?.minPages ?? null,
    maxPages: guideline?.maxPages ?? null,
    issues: liveIssues
      ? {
          danger: liveIssues.filter((issue) => issue.tone === "danger").length,
          warning: liveIssues.filter((issue) => issue.tone === "warning").length,
        }
      : null,
    cover: {
      enabled: coverPageEnabled,
      missingFields: missingCoverFields(coverPage),
    },
    includeToc,
    headingNumbering: { enabled: headingNumbering, guidelineRule: guideline?.settings.headingNumbering, manualNumbered },
    /* Kılavuz bağlanınca uygulanan sayfa düzeni sonradan elle
       değiştirilebiliyor; fark oluştuğunda listede görünür. */
    pageSetup: sayfaDuzeniFarklari({ margins, showPageNumbers, kilavuz: guideline?.settings }),
    saveState,
  });
  const handleChecklistAction = (action: ChecklistAction) => {
    switch (action) {
      case "link-guideline":
        window.open(editHref, "_self");
        break;
      case "insert-sections":
        if (missingSections.length) handleInsertSections(missingSections);
        break;
      case "open-issues":
        setChecklistOpen(false);
        setIssuesOpen(true);
        break;
      case "open-cover":
        setChecklistOpen(false);
        setCoverPageEnabled(true);
        setShowCoverPageEditor(true);
        break;
      case "enable-toc":
        setIncludeToc(true);
        showToast("success", "Word çıktısına içindekiler tablosu eklenecek.");
        break;
      case "apply-numbering":
        if (guideline?.settings.headingNumbering !== undefined) setHeadingNumbering(guideline.settings.headingNumbering);
        break;
      case "apply-page-setup":
        if (guideline?.settings.margins) setMargins(guideline.settings.margins);
        if (guideline?.settings.showPageNumbers !== undefined) setShowPageNumbers(guideline.settings.showPageNumbers);
        showToast("success", "Sayfa düzeni kılavuza göre ayarlandı.");
        break;
      case "strip-manual-numbers":
        editor.chain().focus().stripManualHeadingNumbers().run();
        break;
      case "save":
        void saveNow();
        break;
    }
  };

  const handleJump = (heading: OutlineHeading) => jumpToHeading(editor, heading);

  // Yapı denetimi listesi: canlı gösterge penceresi ve "Kontrol Et" sonucu aynı listeyi kullanır.
  const recheckStructure = () => {
    const issues = checkStructure(JSON.parse(JSON.stringify(editor.getJSON())), {
      citationStyle,
      abstract: guideline?.settings.abstract,
      paragraphFormat,
    });
    setLiveIssues(issues);
    setStructureIssues((current) => (current ? issues : current));
  };
  const renderIssueList = (issues: StructureIssue[], onNavigate?: () => void) =>
    issues.length === 0 ? (
      <p className="tone-text" data-tone="success">
        ✓ Boş bölüm, başlık atlaması, şekil/tablo ya da atıf tutarsızlığı bulunmadı.
      </p>
    ) : (
      <ul className="result-list">
        {issues.map((issue, i) => (
          <li key={i} className="tone-text result-action-row" data-tone={issue.tone}>
            <span>{issue.message}</span>
            {issue.action === "sort-references" ? (
              <button
                type="button"
                className="result-link"
                onClick={() => {
                  const sorted = sortReferences(editor);
                  if (sorted < 0) {
                    showToast("error", "Kaynakça liste ya da tablo içinde olduğu için otomatik sıralanamadı.");
                    return;
                  }
                  showToast("success", `${sorted} kaynak alfabetik sıralandı. Geri almak için Ctrl+Z.`);
                  recheckStructure();
                }}
              >
                Alfabetik sırala
              </button>
            ) : issue.action === "convert-reference-lists" ? (
              <button
                type="button"
                className="result-link"
                onClick={() => {
                  const converted = convertReferenceListsToParagraphs(editor);
                  if (converted === 0) {
                    showToast("error", "Kaynakçada paragrafa çevrilecek liste bulunamadı.");
                    return;
                  }
                  showToast("success", `${converted} kaynak ayrı paragraflara çevrildi. Geri almak için Ctrl+Z.`);
                  recheckStructure();
                }}
              >
                Paragraflara çevir
              </button>
            ) : issue.action === "apply-paragraph-format" ? (
              <button
                type="button"
                className="result-link"
                onClick={() => {
                  const applied = applyParagraphFormat(editor, paragraphFormat);
                  if (applied === 0) {
                    showToast("error", "Kılavuz düzenine çevrilecek gövde paragrafı bulunamadı.");
                    return;
                  }
                  showToast("success", `${applied} paragraf kılavuzun düzenine getirildi. Geri almak için Ctrl+Z.`);
                  recheckStructure();
                }}
              >
                Kılavuza göre düzenle
              </button>
            ) : issue.action === "fix-reference-punctuation" ? (
              <button
                type="button"
                className="result-link"
                onClick={() => {
                  const fixed = fixReferencePunctuationInEditor(editor);
                  if (fixed === 0) {
                    showToast("error", "Otomatik düzeltilemedi (hata farklı biçimlendirilmiş parçalar arasında); lütfen elle düzeltin.");
                    return;
                  }
                  showToast("success", `${fixed} kaynak girdisinde noktalama düzeltildi. Geri almak için Ctrl+Z.`);
                  recheckStructure();
                }}
              >
                Düzelt
              </button>
            ) : issue.target ? (
              <button
                type="button"
                className="result-link"
                onClick={() => {
                  onNavigate?.();
                  handleFindText(issue.target!);
                }}
              >
                Göster
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    );
  const handleInsertSections = (list: string[]) => {
    insertSections(editor, requiredSections, list);
    showToast("success", list.length > 1 ? `${list.length} bölüm kılavuz sırasına göre eklendi.` : `"${list[0]}" bölümü eklendi.`);
  };
  const handleTemplate = () => {
    applyTemplate(editor, requiredSections);
    showToast("success", "Kılavuzun bölümleriyle taslak oluşturuldu.");
  };
  const handleFindText = (text: string) => {
    if (!selectText(editor, text)) showToast("error", "Bu ifade metinde bulunamadı; değiştirilmiş olabilir.");
  };
  const style: CitationStyle = CITATION_STYLES.includes(citationStyle as CitationStyle) ? (citationStyle as CitationStyle) : "apa7";
  const handleCite = (source: LiteratureSource) => {
    const { citation, addedReference } = insertCitation(editor, source, style);
    showToast("success", addedReference ? `${citation} eklendi; kaynak Kaynakça'ya yazıldı.` : `${citation} eklendi.`);
    void updateLiteratureStatus(source.id, "used");
  };
  // Yazdırma sekmesi tıklamayla hemen açılır (açılır pencere engelleyicisine takılmasın), metin kaydedilince yüklenir.
  const handlePrint = async () => {
    const printWindow = window.open("", "_blank");
    const target = `/print/manuscript/${projectId}?auto=1`;
    if (!(await saveNow())) {
      printWindow?.close();
      showToast("error", "Metin kaydedilemediği için PDF hazırlanamadı.");
      return;
    }
    if (printWindow) printWindow.location.href = target;
    else window.open(target, "_self");
  };
  const handleRestored = () => {
    clearDraft(projectId);
    window.location.reload();
  };
  // Word'den gelen içerik: boş belgede ya da "yerine koy"da tüm metin, aksi hâlde sona eklenir.
  const handleImported = (html: string, mode: ImportMode, importStats?: DocxImportStats) => {
    if (mode === "replace" || stats.empty) editor.commands.setContent(html);
    else editor.chain().insertContentAt(editor.state.doc.content.size, html).run();
    markDirtyRef.current();
    // Word belgesinde içindekiler vardı: eskisi kaldırıldı, güncel olanı Word çıktısında oluşsun.
    if (importStats?.tocLines && !includeToc) {
      setIncludeToc(true);
      showToast("success", "Word çıktısına güncel içindekiler tablosu eklenecek (Sayfa ayarlarından kapatılabilir).");
    }
    const first = collectHeadings(editor.state.doc)[0];
    if (first) jumpToHeading(editor, first);
  };

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
    <div className="manuscript-layout">
    <div className="manuscript-main">
    <div className="manuscript-editor-shell">
      <div className="manuscript-toolbar" role="toolbar" aria-label="Biçimlendirme">
        {/* Masaüstünde düğmeler satırlara sarılır; telefonda tek satırda yatay kayar (workspace.css) */}
        <div className="toolbar-tools">
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
          <option value="">{guideline?.settings.fontFamily ? `Kılavuz (${guideline.settings.fontFamily})` : "Varsayılan yazı tipi"}</option>
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
          <option value="">{guideline?.settings.fontSizePt ? `Kılavuz (${guideline.settings.fontSizePt} pt)` : "Varsayılan boyut"}</option>
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
          <option value="">{guideline?.settings.lineSpacing ? `Aralık: kılavuz (${guideline.settings.lineSpacing})` : "Satır aralığı"}</option>
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
        <ToolbarButton label="Kaynaktan atıf ekle" onClick={() => setCiteOpen(true)}>
          <BookMarked size={16} />
        </ToolbarButton>
        <ToolbarButton label="Word dosyasından aktar" onClick={() => setImportOpen(true)}>
          <FileUp size={16} />
        </ToolbarButton>
        <ToolbarButton label="Resimlerim (daha önce yüklenenler)" onClick={() => setLibraryOpen(true)}>
          <Images size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Şekil başlığı (otomatik numaralı)"
          active={ui.caption === "figure"}
          onClick={() => editor.chain().focus().toggleCaption("figure").run()}
        >
          <Captions size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Tablo başlığı (otomatik numaralı)"
          active={ui.caption === "table"}
          onClick={() => editor.chain().focus().toggleCaption("table").run()}
        >
          <TableProperties size={16} />
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
        <ToolbarButton label="Danışmana paylaş (salt okunur bağlantı)" onClick={() => setShareOpen(true)}>
          <Share2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Sürüm geçmişi" onClick={() => setVersionsOpen(true)}>
          <History size={16} />
        </ToolbarButton>
        <ToolbarButton label="Bul ve değiştir (Ctrl+F)" active={findOpen} onClick={() => setFindOpen((open) => !open)}>
          <Search size={16} />
        </ToolbarButton>

        <ToolbarButton label="Klavye kısayolları" onClick={() => setShortcutsOpen(true)}>
          <Keyboard size={16} />
        </ToolbarButton>
        </div>

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
        {findOpen ? <FindReplaceBar editor={editor} onClose={() => setFindOpen(false)} /> : null}
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

      {formatLoss && !formatLossDismissed ? (
        <div className="callout editor-notice" data-tone="warning" role="status">
          <strong>Bu belgenin bazı biçim bilgileri eski bir kayıt hatası nedeniyle kaybolmuş.</strong>
          <ul className="format-loss-list">
            {formatLoss.nodesWithoutAttrs > 0 ? (
              <li>
                Başlık düzeylerini (H1–H3), hizalamayı ve şekil/tablo başlıklarını kontrol edin; düzelttiğiniz hâl
                artık eksiksiz kaydedilir.
              </li>
            ) : null}
            {formatLoss.missingImages > 0 ? (
              <li>
                {formatLoss.missingImages} resim görüntülenemiyor: boş resim kutularını silip “Resimlerim”den yeniden
                ekleyebilirsiniz.
              </li>
            ) : null}
            {formatLoss.emptyFootnotes > 0 ? (
              <li>{formatLoss.emptyFootnotes} dipnotun metni boş: dipnot işaretine tıklayıp metnini yeniden yazın.</li>
            ) : null}
            <li>
              Word dosyanız varsa “Word&apos;den aktar → Yerine koy” ile metni tüm biçimiyle yeniden alabilirsiniz
              (mevcut hâl önce sürüm olarak saklanır).
            </li>
          </ul>
          <span className="cluster mt-sm">
            <button type="button" className="projects-filter-button" onClick={() => setLibraryOpen(true)}>
              Resimlerim
            </button>
            <button type="button" className="projects-filter-button" onClick={() => setImportOpen(true)}>
              Word&apos;den aktar
            </button>
            <button type="button" className="projects-filter-button" onClick={() => setFormatLossDismissed(true)}>
              Anladım
            </button>
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

      {guideline ? (
        <div className="guideline-applied-banner" role="status">
          <div>
            <strong>{syncMode === "auto-applied" ? "Kılavuzun yeni sürümü uygulandı" : "Tez kılavuzu otomatik uygulanıyor"}</strong>
            <span>{guideline.label}</span>
            <span className="guideline-meta text-sm">
              {guideline.citationStyle.toUpperCase()}
              {guideline.versionLabel ? ` · ${guideline.versionLabel}` : ""}
              {formatDate(guideline.version) ? ` · Onay: ${formatDate(guideline.version)}` : ""}
              {guideline.updatePending ? " · Yeni sürüm ekibimizce inceleniyor" : ""}
            </span>
            {syncMode === "auto-applied" && guidelineSync.changes.length > 0 ? (
              <SyncChangeList title="Değişen ayarlar:" changes={guidelineSync.changes} />
            ) : null}
          </div>
          <div className="cluster">
            <button type="button" className="projects-filter-button" onClick={() => setGuidelineOpen(true)}>
              Kuralları gör
            </button>
          </div>
        </div>
      ) : isThesis ? (
        <div className="guideline-applied-banner" data-tone="muted" role="status">
          <div>
            <strong>Bu çalışmaya bağlı onaylı kılavuz yok</strong>
            <span>
              Üniversite, enstitü ve bölümünüzü seçin; kılavuzunuz onaylandığında editöre kendiliğinden uygulanır.
            </span>
          </div>
          <div className="cluster">
            <Link href={editHref} className="projects-filter-button">Kurumu seç</Link>
          </div>
        </div>
      ) : null}

      {guideline && syncMode === "offer" ? (
        <div className="callout editor-notice cluster" data-tone="accent" role="status">
          <span>
            Kılavuzun yeni sürümü onaylandı. Kenar boşluklarını ya da sayfa numarasını siz değiştirdiğiniz için
            sayfa ayarlarınızı kendiliğinden değiştirmedik.
            {guidelineSync.changes.length > 0 ? (
              <SyncChangeList title="Güncellerseniz şunlar değişir:" changes={guidelineSync.changes} />
            ) : null}
          </span>
          <span className="cluster">
            <button type="button" className="projects-primary-button" onClick={acceptGuidelineSettings}>
              Kılavuza göre güncelle
            </button>
            <button type="button" className="projects-filter-button" onClick={keepOwnSettings}>
              Ayarlarımı koru
            </button>
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
                onChange={(e) => {
                  markCustomized();
                  setMargins((prev) => ({ ...prev, [side]: Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 10) }));
                }}
              />
            </label>
          ))}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showPageNumbers}
              onChange={(e) => {
                markCustomized();
                setShowPageNumbers(e.target.checked);
              }}
            />
            <span>Sayfa numarası ekle</span>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={includeToc} onChange={(e) => setIncludeToc(e.target.checked)} />
            <span>İçindekiler tablosu (Word)</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={headingNumbering}
              onChange={(e) => {
                markCustomized();
                setHeadingNumbering(e.target.checked);
              }}
            />
            <span>Başlıkları otomatik numarala (1., 1.1.)</span>
          </label>
          {manualNumbered > 0 ? (
            <span className="manuscript-page-settings-hint">
              {manualNumbered} başlıkta elle yazılmış numara var; çift numara olmaması için{" "}
              <button
                type="button"
                className="result-link"
                onClick={() => {
                  editor.chain().focus().stripManualHeadingNumbers().run();
                  showToast("success", "Elle yazılmış başlık numaraları kaldırıldı (Geri al ile geri alınabilir).");
                }}
              >
                elle yazılanları kaldırın
              </button>
              .
            </span>
          ) : null}
          <span className="manuscript-page-settings-hint">
            Otomatik kaydedilir, Word&apos;e aktarırken uygulanır.
          </span>
        </div>
      )}

      <EditorContent editor={editor} />

      {stats.footnotes.length > 0 ? (
        <ol className="footnote-list" aria-label="Dipnotlar">
          {stats.footnotes.map((footnote) => (
            <li key={footnote.pos}>
              <button type="button" onClick={() => openFootnoteEditor(footnote.pos, footnote.text)}>
                {footnote.text || "(boş dipnot)"}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="manuscript-footer">
        <div className="cluster">
          <span className="muted text-sm">
            {stats.words.toLocaleString("tr-TR")} kelime · ≈ {pages} sayfa
            {stats.footnotes.length > 0 ? ` · ${stats.footnotes.length} dipnot` : ""}
          </span>
          {/*
            Sayfa hedefi: kılavuzun alt/üst sınırına ne kadar kaldığı yalnızca
            "Kontrol Et" sonrasında görünüyordu; yazarken hedefin neresinde
            olduğu belli değildi. Çubuk alt sınıra göre dolar, sınır aşılınca
            uyarı tonuna geçer.
          */}
          {guideline?.minPages ? (
            <span
              className="page-goal"
              data-tone={pageTone}
              title={`Kılavuz hedefi: ${guideline.minPages}${guideline.maxPages ? `–${guideline.maxPages}` : "+"} sayfa`}
              role="progressbar"
              aria-valuenow={pages}
              aria-valuemin={0}
              aria-valuemax={guideline.maxPages ?? guideline.minPages}
              aria-label="Sayfa hedefi"
            >
              <i style={{ "--w": `${Math.min(100, Math.round((pages / guideline.minPages) * 100))}%` } as React.CSSProperties} />
              {pages}/{guideline.minPages}
              {guideline.maxPages ? `–${guideline.maxPages}` : ""} sayfa
            </span>
          ) : null}
          {liveIssues ? (
            <button
              type="button"
              className="live-check"
              data-tone={
                liveIssues.length === 0 ? "success" : liveIssues.some((issue) => issue.tone === "danger") ? "danger" : "warning"
              }
              onClick={() => setIssuesOpen(true)}
              title="Yazarken kendiliğinden denetlenir"
            >
              {liveIssues.length === 0 ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
              {liveIssues.length === 0 ? "Yapı sorunsuz" : `${liveIssues.length} yapı uyarısı`}
            </button>
          ) : null}
        </div>

        <div className="cluster cluster-lg">
          <button
            type="button"
            className="projects-filter-button"
            data-tone={checklist.done === checklist.total ? "success" : undefined}
            onClick={() => setChecklistOpen(true)}
            title="Teslimden önce bakılacaklar"
          >
            <ClipboardCheck size={15} aria-hidden="true" />
            Teslim kontrolü {checklist.done}/{checklist.total}
          </button>
          <button type="button" className="projects-primary-button" onClick={handleCheck} disabled={checking}>
            <ShieldCheck size={15} />
            {checking ? "Kontrol ediliyor..." : "Kontrol Et"}
          </button>
          <button type="button" className="projects-filter-button" onClick={handleExport} disabled={exporting}>
            <FileDown size={15} />
            {exporting ? "Hazırlanıyor..." : "Word olarak indir"}
          </button>
          <button type="button" className="projects-filter-button" onClick={() => void handlePrint()}>
            <Printer size={15} />
            PDF / Yazdır
          </button>
        </div>
      </div>

    </div>{/* .manuscript-editor-shell */}

      <ShareDialog open={shareOpen} onClose={closeShare} projectId={projectId} />

      <SubmissionChecklistDialog open={checklistOpen} onClose={closeChecklist} checklist={checklist} onAction={handleChecklistAction} />

      <Dialog
        open={issuesOpen}
        onClose={closeIssues}
        kicker="Canlı kontrol"
        title="Yapı ve bütünlük"
        description="Yazarken kendiliğinden denetlenir: boş bölümler, başlık atlamaları, şekil/tablo numaraları, atıf–kaynakça uyumu ve boş dipnotlar."
      >
        {renderIssueList(liveIssues ?? [], closeIssues)}
      </Dialog>

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
                {checkResult.guidelineCompliance.sections.map((s, i) => {
                  const heading = sections.find((item) => item.section === s.section)?.heading ?? null;
                  return (
                    <li key={i} className="tone-text result-action-row" data-tone={s.found ? "success" : "danger"}>
                      <span>
                        {s.found ? "✓" : "✗"} {s.section}
                      </span>
                      {heading ? (
                        <button type="button" className="result-link" onClick={() => handleJump(heading)}>
                          Git
                        </button>
                      ) : !s.found ? (
                        <button type="button" className="result-link" onClick={() => handleInsertSections([s.section])}>
                          Ekle
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {structureIssues ? (
            <div className="result-block">
              <strong className="text-base">Yapı ve bütünlük</strong>
              {renderIssueList(structureIssues)}
            </div>
          ) : null}

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
                    <li key={`rw-${i}`} className="tone-text result-action-row" data-tone="warning">
                      <span>Kaynakçada var, metinde atıf yok: {r.raw}</span>
                      <button type="button" className="result-link" onClick={() => handleFindText(r.raw)}>
                        Göster
                      </button>
                    </li>
                  ))}
                  {checkResult.apa7.crossCheck.citationsWithoutReference.map((c, i) => (
                    <li key={`cw-${i}`} className="tone-text result-action-row" data-tone="warning">
                      <span>Metinde atıf var, kaynakçada yok: {c.raw}</span>
                      <button type="button" className="result-link" onClick={() => handleFindText(c.raw)}>
                        Göster
                      </button>
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

    </div>{/* .manuscript-main */}

      <ManuscriptOutline
        headings={stats.headings}
        sections={sections}
        words={stats.words}
        pages={pages}
        minPages={guideline?.minPages ?? null}
        maxPages={guideline?.maxPages ?? null}
        pageTone={pageTone}
        pace={pace}
        documentEmpty={stats.empty}
        figures={stats.figures}
        tables={stats.tables}
        onJump={handleJump}
        onInsert={handleInsertSections}
        onTemplate={handleTemplate}
        onImport={() => setImportOpen(true)}
      >
        <ManuscriptComments projectId={projectId} getQuote={() => selectedText(editor)} onFind={handleFindText} />
      </ManuscriptOutline>

      <VersionsDialog
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        projectId={projectId}
        flush={() => saveNow()}
        onRestored={handleRestored}
        getCurrentText={() => extractPlainText(JSON.parse(JSON.stringify(editor.getJSON())) as TiptapDoc)}
      />
      <CiteDialog open={citeOpen} onClose={() => setCiteOpen(false)} projectId={projectId} style={style} onPick={handleCite} />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectId={projectId}
        documentEmpty={stats.empty}
        flush={() => saveNow()}
        onImported={handleImported}
      />
      <ImageLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPick={(src, name) => editor.chain().focus().setImage({ src, alt: name }).run()}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {guideline ? (
        <Dialog
          open={guidelineOpen}
          onClose={closeGuideline}
          kicker="Tez yazım kılavuzu"
          title={guideline.label}
          description="Ekibimizin onayladığı son sürüm. Yeni sürüm onaylandığında editörünüze kendiliğinden yansır."
        >
          <dl className="guideline-rules">
            <dt>Kurum</dt>
            <dd>
              {guideline.universityName}
              {guideline.instituteName ? ` — ${guideline.instituteName}` : ""}
            </dd>
            <dt>Kaynakça</dt>
            <dd>{guideline.citationStyle.toUpperCase()}</dd>
            {guideline.settings.fontFamily || guideline.settings.fontSizePt ? (
              <>
                <dt>Yazı</dt>
                <dd>
                  {[guideline.settings.fontFamily, guideline.settings.fontSizePt ? `${guideline.settings.fontSizePt} pt` : null]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </>
            ) : null}
            {guideline.settings.lineSpacing ? (
              <>
                <dt>Satır aralığı</dt>
                <dd>{guideline.settings.lineSpacing}</dd>
              </>
            ) : null}
            {guideline.settings.margins ? (
              <>
                <dt>Kenar boşlukları</dt>
                <dd>
                  Üst {guideline.settings.margins.top} · Alt {guideline.settings.margins.bottom} · Sol{" "}
                  {guideline.settings.margins.left} · Sağ {guideline.settings.margins.right} cm
                </dd>
              </>
            ) : null}
            {guideline.settings.showPageNumbers !== undefined ? (
              <>
                <dt>Sayfa numarası</dt>
                <dd>{guideline.settings.showPageNumbers ? "Var" : "Yok"}</dd>
              </>
            ) : null}
            {guideline.settings.headingNumbering !== undefined ? (
              <>
                <dt>Başlık numaralandırma</dt>
                <dd>{guideline.settings.headingNumbering ? "Ondalık (1., 1.1., 1.1.1.)" : "Numarasız"}</dd>
              </>
            ) : null}
            {guideline.settings.chapterUppercase || guideline.settings.chapterNewPage ? (
              <>
                <dt>Ana bölüm başlıkları</dt>
                <dd>
                  {[guideline.settings.chapterUppercase ? "büyük harfle" : "", guideline.settings.chapterNewPage ? "her biri yeni sayfadan" : ""]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </>
            ) : null}
            {paragraphFormat.indentCm || paragraphFormat.justify ? (
              <>
                <dt>Paragraf düzeni</dt>
                <dd>{describeParagraphFormat(paragraphFormat)}</dd>
              </>
            ) : null}
            {guideline.settings.abstract ? (
              <>
                <dt>Özet</dt>
                <dd>{describeAbstractRules(guideline.settings.abstract)}</dd>
              </>
            ) : null}
            {guideline.minPages || guideline.maxPages ? (
              <>
                <dt>Sayfa sayısı</dt>
                <dd>
                  {guideline.minPages ? `en az ${guideline.minPages}` : ""}
                  {guideline.minPages && guideline.maxPages ? ", " : ""}
                  {guideline.maxPages ? `en fazla ${guideline.maxPages}` : ""}
                </dd>
              </>
            ) : null}
            {guideline.versionLabel ? (
              <>
                <dt>Sürüm</dt>
                <dd>{guideline.versionLabel}</dd>
              </>
            ) : null}
            {formatDate(guideline.version) ? (
              <>
                <dt>Onay tarihi</dt>
                <dd>{formatDate(guideline.version)}</dd>
              </>
            ) : null}
            {formatDate(guideline.lastCheckedAt) ? (
              <>
                <dt>Son kaynak kontrolü</dt>
                <dd>
                  {formatDate(guideline.lastCheckedAt)}
                  {guideline.updatePending ? " · yeni sürüm inceleniyor" : ""}
                </dd>
              </>
            ) : null}
          </dl>

          {requiredSections.length > 0 ? (
            <div className="stack mt-md">
              <strong>Zorunlu bölümler</strong>
              <div className="guideline-sections">
                {requiredSections.map((section) => (
                  <span key={section} className="chip">{section}</span>
                ))}
              </div>
            </div>
          ) : null}

          {safeExternalUrl(guideline.sourceUrl) ? (
            <a
              href={safeExternalUrl(guideline.sourceUrl)!}
              target="_blank"
              rel="noopener noreferrer"
              className="projects-filter-button mt-md"
            >
              Resmî kılavuzu aç
            </a>
          ) : null}
        </Dialog>
      ) : null}

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

// Kılavuz sürümü değiştiğinde hangi sayfa ayarının neye döndüğünü açıkça gösterir.
function SyncChangeList({ title, changes }: { title: string; changes: GuidelineSyncChange[] }) {
  return (
    <span className="sync-changes">
      <span className="sync-changes-title">{title}</span>
      <ul>
        {changes.map((change) => (
          <li key={change.label}>
            {change.label}: <span className="sync-change-from">{change.from}</span>
            <span aria-hidden="true"> → </span>
            <span className="sr-only"> yerine </span>
            <strong>{change.to}</strong>
          </li>
        ))}
      </ul>
    </span>
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
