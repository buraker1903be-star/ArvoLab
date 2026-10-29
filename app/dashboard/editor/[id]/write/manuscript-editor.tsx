"use client";

import { ornekKalibi } from "@/lib/atif/tyk";
import { eksikAlanlar, NUMERIC_STYLES } from "@/lib/citation-format";
import { wordDosyasiniIndir } from "@/app/dashboard/_components/word-indir";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { kayitHatasiMetni, TASLAK_GUVENDE_METIN, TASLAK_YAZILAMADI_METIN } from "@/lib/taslak-durumu";
import { useCeviri, useDil, useTarihler } from "@/app/_components/dil-saglayici";
import { YEREL, type Dil, type Metin } from "@/lib/dil";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import { olc } from "@/lib/editor-olcum";
import OlcumPaneli from "./olcum-paneli";
import { editorExtensions } from "@/lib/tiptap-extensions";
import { hasManualNumber } from "@/lib/heading-numbering";
import { describeAbstractRules } from "@/lib/guideline-editor-settings";
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
  BarChart3,
  Printer,
  Captions,
  TableProperties,
  Search,
  FileUp,
  Images,
  Keyboard,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  ClipboardCheck,
  Share2,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  Columns2,
  Rows2,
  PanelTop,
  TableCellsMerge,
  TableCellsSplit,
} from "lucide-react";
import FindReplaceBar from "./find-replace-bar";
import ImportDialog, { type ImportMode } from "./import-dialog";
import type { DocxImportStats } from "@/lib/docx-import";
import ImageLibraryDialog from "./image-library-dialog";
import ShortcutsDialog from "./shortcuts-dialog";
import type { FormatLossReport } from "@/lib/format-loss";
import { checkStructure, sorunlariGrupla, type StructureIssue } from "@/lib/structure-check";
import { describeParagraphFormat, type ParagraphFormatRules } from "@/lib/paragraph-format";
import VersionsDialog from "./versions-dialog";
import SubmissionChecklistDialog from "./submission-checklist";
import ShareDialog from "./share-dialog";
import { buildSubmissionChecklist, missingCoverFields, type ChecklistAction } from "@/lib/submission-checklist";
import { sayfaDuzeniFarklari } from "@/lib/sayfa-duzeni";
import CiteDialog from "./cite-dialog";
import AnalizEkleDialog from "./analiz-ekle-dialog";
import ManuscriptComments from "./manuscript-comments";
import { updateLiteratureStatus, type LiteratureSource } from "@/app/actions/literature";
import type { CitationStyle } from "@/lib/citation-format";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import { extractPlainText, type TiptapDoc } from "@/lib/tiptap-text";
import {
  saveManuscript,
  runManuscriptCheck,
  kontrolKaydiniOku,
  type ManuscriptCheckResult,
  type PageMargins,
  type CoverPage,
  type SettingsSource,
} from "@/app/actions/manuscript";
import { createClient } from "@/lib/supabase/client";
import type { AppliedGuideline } from "@/lib/guideline-rules";
import type { GuidelineSyncChange, GuidelineSyncMode } from "@/lib/guideline-sync";
import Link from "next/link";
import { calismaAdresi } from "@/lib/calisma-karti";
import { showToast } from "@/app/dashboard/_components/toast-events";
import Dialog from "@/app/dashboard/_components/dialog";
import { estimatePages, pageRangeTone, wordsPerPage } from "@/lib/page-estimate";
import { splitBodyAndReferences } from "@/lib/text-split";
import type { KontrolKaydiOzeti } from "@/lib/kontrol-gecmisi";
import IcindekilerKarti from "./icindekiler-karti";
import BekleyenKaynaklarKarti from "./bekleyen-kaynaklar-karti";
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
  applyHangingIndent,
  clearManualTextFormat,
  type OutlineHeading,
} from "./editor-navigation";

// Liste tek kaynaktan (lib/atif/stiller.ts): eskiden burada elle yazılıydı
// ve yeni stil eklendiğinde "Kaynak ekle" penceresi sessizce APA biçiminde
// künye üretiyordu.
const CITATION_STYLES = STIL_SECENEKLERI.map((secenek) => secenek.deger) as CitationStyle[];

interface ProjectDefaults {
  title: string;
  university: string;
  institute: string;
  department: string;
  authorName: string;
  projectType: string;
}

/*
  Kapaktaki çalışma türü BELGENİN dilinde yazılır (kapak çıktının parçası;
  lib/belge-dili.ts). Seçilen metin kayda olduğu gibi girer: sonradan dil
  değişse de öğrencinin seçtiği yazım korunur.
*/
const DERECE_TURLERI: Metin[] = [
  { tr: "Yüksek Lisans Tezi", en: "Master's Thesis" },
  { tr: "Doktora Tezi", en: "Doctoral Dissertation" },
  { tr: "Lisans Bitirme Tezi", en: "Undergraduate Thesis" },
  { tr: "Makale", en: "Article" },
  { tr: "Proje Raporu", en: "Project Report" },
  { tr: "Doçentlik Eser Dosyası", en: "Associate Professorship Portfolio" },
];

const DEGREE_TYPE_BY_PROJECT_TYPE: Record<string, Metin> = {
  thesis: DERECE_TURLERI[0],
  article: DERECE_TURLERI[3],
  project: DERECE_TURLERI[4],
  "associate-professorship": DERECE_TURLERI[5],
};

interface ManuscriptEditorProps {
  projectId: string;
  /** Belgenin dili (lib/belge-dili.ts): şekil/tablo etiketleri, atıf biçimi, kapak, yazım denetimi. */
  belgeDili?: Dil;
  /*
    Ana sayfadaki eksik maddesine tıklanarak gelindiyse açılacak madde.
    Pencere açılıyor, eylem kendiliğinden ÇALIŞMIYOR: "Eksik bölümleri
    ekle" belgeyi değiştiren bir işlem ve adres çubuğundan tetiklenen
    bir metin değişikliği, öğrencinin istemediği bir düzenlemeyi geri
    alınacak işe çevirirdi.
  */
  acilacakMadde?: string | null;
  /* Çalışmada kurum girili mi: teslim kontrolünde "kılavuz yok"un iki
     hâli farklı çözüm istiyor (lib/submission-checklist.ts). */
  kurumGirili?: boolean;
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
  /** Kılavuz ve kaynakça kontrolü geçmişi, en yenisi başta (yazim_kontrolleri) */
  kontrolGecmisi?: KontrolKaydiOzeti[];
  /** En yeni kontrolün tamamı: açılışta pencerede gösterilir */
  sonKontrol?: { sonuc: ManuscriptCheckResult; yapi: StructureIssue[] } | null;
  /** Başlıklar otomatik numaralanır ("1.", "1.1.") */
  initialHeadingNumbering?: boolean;
  /** Çalışmanın teslim tarihi ve durumu (yazım temposu için) */
  dueDate?: string | null;
  projectStatus?: string | null;
  /** Çalışmanın kaynakça sistemi (atıf biçimi) */
  citationStyle: string;
  /** Kılavuzun örnek atıfı: eklenen atıf bu noktalamayla yazılır (lib/atif/tyk.ts). */
  ornekAtif?: string | null;
  /** Eski kayıt hatasından etkilenmişse neyin kaybolduğu (etkilenmediyse null) */
  formatLoss: FormatLossReport | null;
}


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

/*
  Yazma BAŞARISINI döndürür. Eskiden hata sessizce yutuluyordu ve arayüz yine
  "yazdıklarınız bu tarayıcıda saklanıyor" diyordu — üstelik tam da sunucu
  kaydının başarısız olduğu anlarda. Depolama dolu (büyük tezde localStorage
  ~5 MB sınırına dayanıyor), gizli sekmede kapalı ya da site verisi engelli
  olduğunda kullanıcıya metninin güvende olduğu söyleniyor, o da sekmeyi
  kapatıyordu. Bir tez bölümünün kaybolması için bu yeterli.
*/
function writeDraft(projectId: string, draft: LocalDraft): boolean {
  try {
    window.localStorage.setItem(draftKey(projectId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function clearDraft(projectId: string) {
  try {
    window.localStorage.removeItem(draftKey(projectId));
  } catch {
    // yok say
  }
}

const timeLabel = (date: Date, dil: Dil) => date.toLocaleTimeString(YEREL[dil], { hour: "2-digit", minute: "2-digit" });

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
    /* Tablo kontrolleri yalnızca imleç tablodayken çiziliyor: araç
       çubuğu zaten dolu ve tablo dışındayken hepsi tıklanamaz durur. */
    inTable: editor.isActive("table"),
    canMergeCells: editor.can().mergeCells(),
    canSplitCell: editor.can().splitCell(),
  };
}

export default function ManuscriptEditor({
  projectId,
  belgeDili = "tr",
  acilacakMadde = null,
  kurumGirili = false,
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
  kontrolGecmisi = [],
  sonKontrol = null,
  initialHeadingNumbering = false,
  dueDate = null,
  projectStatus = null,
  citationStyle,
  ornekAtif = null,
  formatLoss,
}: ManuscriptEditorProps) {
  const t = useCeviri();
  const dil = useDil();
  const { tarih, tarihSaat } = useTarihler();
  const formatDate = (value: string | null | undefined) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? tarih(date) : null;
  };
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  /* Taslak bu tarayıcıya yazılamadı mı (depolama dolu/kapalı) — bkz. writeDraft. */
  const [taslakYazilamadi, setTaslakYazilamadi] = useState(false);
  const taslakYazilamadiRef = useRef(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  /*
    Abonelik engeli: yeniden denemeyle geçmez. Ayrı tutuluyor çünkü
    kullanıcıya gösterilecek çıkış yolu farklı — "Şimdi dene" değil,
    planı yenileme.
  */
  const [abonelikBitti, setAbonelikBitti] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(initialUpdatedAt ? new Date(initialUpdatedAt) : null);
  const [draftOffer, setDraftOffer] = useState<LocalDraft | null>(null);
  /*
    Son kontrol açılışta veritabanından geliyor (yazim_kontrolleri).
    Eskiden yalnızca bellekteydi: sayfa yenilenince sonuç kayboluyordu.
  */
  const [checkResult, setCheckResult] = useState<ManuscriptCheckResult | null>(sonKontrol?.sonuc ?? null);
  const [gecmis, setGecmis] = useState<KontrolKaydiOzeti[]>(kontrolGecmisi);
  const [seciliKontrol, setSeciliKontrol] = useState<string | null>(kontrolGecmisi[0]?.id ?? null);
  const [kayitAciliyor, setKayitAciliyor] = useState<string | null>(null);
  /*
    "Kontrol Sonucu" kartının ATIF yarısı sunucudan geliyor ve metin
    değişince kendiliğinden tazelenmiyordu; yapı yarısı ise tazeleniyor
    (recheckStructure). Sonuç, aynı kartın iki yarısının birbiriyle
    çelişmesiydi: üstte "yapı temiz", altta düzeltilmiş üç atıf sorunu ve
    eski skor — üstelik "Göster" düğmeleri artık metinde olmayan ifadeyi
    arıyordu.

    Sonucu silmiyoruz (kullanıcı düzeltirken ona bakıyor), ESKİ olduğunu
    söylüyoruz.
  */
  // Metin son kontrolden sonra kaydedildiyse açılışta da "eski" sayılır.
  const [checkResultEski, setCheckResultEski] = useState(
    () =>
      Boolean(
        kontrolGecmisi[0] && initialUpdatedAt && new Date(initialUpdatedAt).getTime() > new Date(kontrolGecmisi[0].createdAt).getTime(),
      ),
  );
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [sonucAcik, setSonucAcik] = useState(false);
  const [structureIssues, setStructureIssues] = useState<StructureIssue[] | null>(sonKontrol?.yapi ?? null);
  const [liveIssues, setLiveIssues] = useState<StructureIssue[] | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(Boolean(acilacakMadde));
  /*
    ANA SAYFADAN GELEN MADDE. Ana sayfa eksikleri yazıyordu ama onlar
    düz metindi: öğrenci "Eksik: Bulgular, Sonuç" okuyup nereye
    gideceğini kendi bulmak zorundaydı. Artık her eksik bir bağlantı ve
    buraya "?teslim=<madde>" ile geliyor.

    Pencere AÇILIYOR, eylem kendiliğinden ÇALIŞMIYOR: "Eksik bölümleri
    ekle" belgeyi değiştiren bir işlem ve adres çubuğundan tetiklenen
    bir metin değişikliği, öğrencinin istemediği bir düzenlemeyi geri
    alınacak iş hâline getirirdi.
  */
  const [vurguluMadde, setVurguluMadde] = useState<string | null>(acilacakMadde);
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
  /* Üç yerde birden kullanılıyordu (canlı denetim, kılavuz ve kaynakça kontrolü, yeniden
     denetim) ve her eklenen kural üçünü birden değiştirmeyi gerektiriyordu;
     biri unutulunca canlı denetim ile sonuç ekranı farklı şey söylerdi. */
  const structureOptions = useMemo(
    () => ({
      citationStyle,
      abstract: guideline?.settings.abstract,
      paragraphFormat,
      referenceHangingIndentCm: guideline?.settings.referenceHangingIndentCm,
      textFormat: {
        fontFamily: guideline?.settings.fontFamily,
        fontSizePt: guideline?.settings.fontSizePt,
        lineSpacing: guideline?.settings.lineSpacing,
      },
    }),
    [citationStyle, guideline, paragraphFormat]
  );
  const [includeToc, setIncludeToc] = useState(initialIncludeToc);
  const [headingNumbering, setHeadingNumbering] = useState(initialHeadingNumbering);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [citeOpen, setCiteOpen] = useState(false);
  const [analizOpen, setAnalizOpen] = useState(false);
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
      degreeType: (DEGREE_TYPE_BY_PROJECT_TYPE[projectDefaults?.projectType ?? "thesis"] ?? DERECE_TURLERI[0])[belgeDili],
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

  /*
    Taslağın nereye yazıldığını YALNIZCA istemci bilir; sunucu göremez. Bu
    yüzden "bu tarayıcıda saklanıyor" sözü buradan veriliyor ve yazma
    başarısızsa VERİLMİYOR (bkz. writeDraft).
  */
  const persistDraft = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || revisionRef.current === savedRevisionRef.current) return true;
    const yazildi = olc("taslak yazımı", () =>
      writeDraft(projectId, {
        content: editor.getJSON() as unknown as TiptapDoc,
        baseUpdatedAt: updatedAtRef.current,
        writtenAt: new Date().toISOString(),
      })
    );
    taslakYazilamadiRef.current = !yazildi;
    setTaslakYazilamadi(!yazildi);
    return yazildi;
  }, [projectId]);

  /* Hata metnine taslağın GERÇEK durumunu ekler (lib/taslak-durumu.ts). */
  const hataYaz = useCallback(
    (mesaj: string) => {
      setSaveError(kayitHatasiMetni(mesaj, !taslakYazilamadiRef.current, dil));
    },
    [dil]
  );

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
          const serialized = olc("kayıt: JSON üretimi", () => JSON.stringify(editor.getJSON()));
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
            content: olc("kayıt: JSON çözme", () => JSON.parse(serialized)) as TiptapDoc,
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
            setAbonelikBitti(false);
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
          hataYaz(res.error);
          if (res.conflict) {
            blockedRef.current = true;
            setSaveState("conflict");
          } else {
            setSaveState("error");
            if (res.sessionExpired) {
              blockedRef.current = true;
              setSessionExpired(true);
            } else if (res.forbidden) {
              // Yetki ya da abonelik reddi: yeniden denemek asla başarmaz,
              // 10 saniyede bir sonsuza kadar denenmesin.
              blockedRef.current = true;
              if (res.abonelik) setAbonelikBitti(true);
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
            hataYaz(
              t({
                tr: "Yeni bir sürüm yayınlandı; sayfayı yenileyin, kaldığınız yerden devam edin.",
                en: "A new version has been released; refresh the page and continue where you left off.",
              })
            );
            setSaveState("error");
            return false;
          }
          hataYaz(
            t({
              tr: "Bağlantı sorunu nedeniyle kaydedilemedi; birazdan yeniden denenecek.",
              en: "Could not save due to a connection problem; it will be retried shortly.",
            })
          );
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
    [projectId, guideline, persistDraft, scheduleSave, hataYaz, t]
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
    /* Liste lib/tiptap-extensions.ts'te: şemayı testler de aynı yerden kurar. */
    extensions: editorExtensions({ headingNumbering: initialHeadingNumbering, dil: belgeDili }),
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
        "aria-label": t({ tr: "Çalışma metni", en: "Manuscript text" }),
        // Tarayıcının yazım denetimi belgenin diliyle çalışsın (eskiden hep Türkçe sözlüktü)
        spellcheck: "true",
        lang: belgeDili,
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
        if (!editor.isDestroyed) setDocStats(olc("belge istatistiği", () => computeDocStats(editor)));
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
  // sorunları kendiliğinden bulunur ve alt çubukta gösterilir (düğmeye basmaya gerek kalmaz).
  //
  // getJSON() zaten her çağrıda yeni bir düz nesne kuruyor; üstüne
  // JSON.parse(JSON.stringify(...)) eklemek 200 sayfalık bir tezde 18 ms
  // ve belgenin ikinci bir kopyası demekti. Denetim nesneyi değiştirmiyor.
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
      setLiveIssues(olc("yapı denetimi", () => checkStructure(editor.getJSON(), structureOptions, dil)));
    };
    const schedule = (delay: number) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(run, delay);
    };
    const onUpdate = () => {
      /*
        Bayrak BURADA kuruluyor, denetimin kendisinde değil: denetim
        açılışta ve bekleyen zamanlayıcıyla da çalışıyor. Orada kursaydık,
        kullanıcı yazıp hemen kontrol düğmesine bastığında bekleyen denetim
        kontrolden sonra ateşlenir ve taze sonucu "eski" diye damgalardı —
        düzeltmeye çalıştığımız yanlış alarmın aynısı. onUpdate ise tam
        olarak belge değiştiğinde çalışır.
      */
      setCheckResultEski(true);
      schedule(LIVE_CHECK_DELAY_MS);
    };
    schedule(600);
    editor.on("update", onUpdate);
    return () => {
      if (timer) window.clearTimeout(timer);
      editor.off("update", onUpdate);
    };
  }, [editor, structureOptions, dil]);

  const closeIssues = useCallback(() => setIssuesOpen(false), []);
  const closeChecklist = useCallback(() => {
    setChecklistOpen(false);
    setVurguluMadde(null);
    /*
      Adres de temizleniyor: parametre kalsaydı sayfa yenilendiğinde
      pencere kendiliğinden yeniden açılırdı. Olay işleyicisinde,
      çizim sırasında değil.
    */
    const temiz = new URL(window.location.href);
    if (temiz.searchParams.has("teslim")) {
      temiz.searchParams.delete("teslim");
      window.history.replaceState(null, "", temiz.toString());
    }
  }, []);
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
      } else if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === "KeyF") {
        // Ctrl+Alt+F: dipnot ekle (Word). code ile: Türkçe klavyede AltGr+F başka bir karakter üretiyor.
        const target = event.target as HTMLElement | null;
        if (target?.closest?.(".ProseMirror")) {
          event.preventDefault();
          setFootnoteDialog({ mode: "insert", text: "" });
        }
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        /*
          Ctrl+P editörde SAYFALI BASKIYI açar (Word'de Ctrl+P gibi kılavuz
          düzeninde çıktı). Eskiden tarayıcı editör ekranının kendisini
          yazdırıyordu: araç kartları, yan panel ve dock kâğıda çıkıyordu.
          Sekme tıklamayla aynı anda açılıyor (açılır pencere engeline
          takılmasın); metin kaydedilince baskı adresine gidiyor.
        */
        const target = event.target as HTMLElement | null;
        if (target?.closest?.(".manuscript-layout") || document.activeElement === document.body) {
          event.preventDefault();
          const pencere = window.open("", "_blank");
          void saveNowRef.current().then((kaydedildi) => {
            const adres = `/print/manuscript/${projectId}?auto=1`;
            if (!kaydedildi) {
              pencere?.close();
              showToast("error", t({ tr: "Metin kaydedilemediği için PDF hazırlanamadı.", en: "The PDF could not be prepared because the text could not be saved." }));
            } else if (pencere) pencere.location.href = adres;
            else window.open(adres, "_self");
          });
        }
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
    // projectId sayfa boyunca değişmez; Ctrl+P'nin baskı adresi için.
  }, [persistDraft, projectId, t]);

  const restoreDraft = useCallback(() => {
    if (!editor || !draftOffer) return;
    editor.commands.setContent(draftOffer.content);
    setDraftOffer(null);
    showToast("success", t({ tr: "Kaydedilmemiş değişiklikleriniz geri yüklendi.", en: "Your unsaved changes were restored." }));
  }, [editor, draftOffer, t]);

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
        setCheckError(
          t({
            tr: "Kontrolden önce metin kaydedilemedi. Kayıt durumunu kontrol edip yeniden deneyin.",
            en: "The text could not be saved before the check. Check the save status and try again.",
          })
        );
        return;
      }
      // Yapı ve bütünlük kontrolü ekrandaki içerik üzerinde tarayıcıda anında çalışır.
      const current = editorRef.current;
      let issues: StructureIssue[] = [];
      if (current) {
        issues = checkStructure(current.getJSON(), structureOptions, dil);
        setStructureIssues(issues);
        setLiveIssues(issues);
      }
      // Yapı sorunları da geçmişe birlikte yazılır (lib/kontrol-gecmisi.ts).
      const res = await runManuscriptCheck(projectId, issues);
      if (res.error) {
        setCheckError(res.error);
      } else if (res.result) {
        setCheckResult(res.result);
        setCheckResultEski(false);
        const kayit = res.kayit;
        if (kayit) {
          setGecmis((onceki) => [kayit, ...onceki.filter((k) => k.id !== kayit.id)].slice(0, 10));
          setSeciliKontrol(kayit.id);
        } else setSeciliKontrol(null);
        setSonucAcik(true);
      }
    } catch {
      setCheckError(
        t({
          tr: "Kontrol şu anda yapılamadı. Bağlantınızı kontrol edip yeniden deneyin.",
          en: "The check could not be run right now. Check your connection and try again.",
        })
      );
    } finally {
      setChecking(false);
    }
  }, [projectId, saveNow, structureOptions, dil, t]);

  /* Geçmişten bir kontrole geç: sonucu ve o anki yapı sorunlarını getirir. */
  const kontrolSec = async (id: string) => {
    if (id === seciliKontrol || kayitAciliyor) return;
    setKayitAciliyor(id);
    try {
      const res = await kontrolKaydiniOku(projectId, id);
      if (res.error || !res.sonuc) {
        showToast("error", res.error ?? t({ tr: "Kontrol kaydı okunamadı.", en: "The check record could not be read." }));
        return;
      }
      setCheckResult(res.sonuc);
      setStructureIssues(res.yapi ?? []);
      setSeciliKontrol(id);
    } catch {
      showToast("error", t({ tr: "Kontrol kaydı okunamadı; bağlantınızı kontrol edin.", en: "The check record could not be read; check your connection." }));
    } finally {
      setKayitAciliyor(null);
    }
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Word dosyası, ekrandaki son hâlden oluşturulsun.
      if (!(await saveNow())) {
        showToast("error", t({ tr: "Metin kaydedilemediği için Word dosyası oluşturulmadı.", en: "The Word file was not created because the text could not be saved." }));
        return;
      }
      // İndirme ve hata okuma ortak yardımcıda (ana sayfadaki "Danışmanıma gönder" de kullanıyor).
      const hata = await wordDosyasiniIndir(projectId, dil);
      if (hata) showToast("error", hata);
    } finally {
      window.setTimeout(() => setExporting(false), 1500);
    }
  }, [projectId, saveNow, t]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      if (!IMAGE_TYPES.includes(file.type)) {
        showToast("error", t({ tr: "Word'e aktarılabilmesi için PNG, JPG veya GIF resim seçin.", en: "Choose a PNG, JPG or GIF image so it can be exported to Word." }));
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        showToast("error", t({ tr: "Resim boyutu 8 MB sınırını aşıyor.", en: "The image exceeds the 8 MB limit." }));
        return;
      }

      setImageUploading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          showToast("error", t({ tr: "Oturumunuz sona erdi. Resim eklemek için yeniden giriş yapın.", en: "Your session has expired. Sign in again to add images." }));
          return;
        }

        // Resim, Vercel'in sunucu fonksiyonu istek boyutu sınırını
        // (~4.5 MB, aşılamaz) atlamak için doğrudan tarayıcıdan
        // Supabase Storage'a yüklenir (belge yüklemeyle aynı mimari).
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        // Klasör çalışmanın kimliği: resmi kim eklerse eklesin çalışmaya bakan herkes görür.
        const path = `${projectId}/editor-images/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("project-files")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          console.error(uploadError);
          showToast("error", t({ tr: "Resim yüklenemedi. Yeniden deneyin.", en: "The image could not be uploaded. Try again." }));
          return;
        }

        const { data: signed, error: signError } = await supabase.storage
          .from("project-files")
          .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 gün; editör/yazdırma/Word açılışta depo yolundan yeniler
        if (signError || !signed) {
          console.error(signError);
          showToast("error", t({ tr: "Resim bağlantısı oluşturulamadı.", en: "The image link could not be created." }));
          return;
        }

        editor.chain().focus().setImage({ src: signed.signedUrl, alt: file.name }).run();
      } catch {
        showToast("error", t({ tr: "Resim yüklenirken bağlantı sorunu oluştu.", en: "A connection problem occurred while uploading the image." }));
      } finally {
        setImageUploading(false);
      }
    },
    [editor, projectId, t]
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
    showToast("success", t({ tr: "Sayfa ayarları kılavuzun güncel sürümüne göre güncellendi.", en: "Page settings were updated to the guideline's current version." }));
  }, [guideline, t]);

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

  /* Bekleyen kaynaklar için kaynakça HARİÇ metin; istatistikle birlikte
     (250 ms beklemeyle) yenilenir, her tuşta değil. */
  const govdeMetni = useMemo(
    () => (editor && docStats ? splitBodyAndReferences(`\n${editor.getText({ blockSeparator: "\n" })}\n`).bodyText : ""),
    [editor, docStats],
  );

  if (!editor) return <div className="manuscript-editor-shell manuscript-editor-loading" aria-busy="true" />;
  const eylemHedefi = document.getElementById("yazma-eylemleri");
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
  const sayfaBasiKelime = wordsPerPage({
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
  }, dil);

  // Teslim kontrolü: editördeki denetimlerin tek listede özeti (lib/submission-checklist.ts)
  const missingSections = sections.filter((item) => !item.heading).map((item) => item.section);
  const checklist = buildSubmissionChecklist({
    isThesis,
    hasGuideline: Boolean(guideline),
    hasInstitution: kurumGirili,
    guidelineVerified: guideline?.dogrulandi,
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
      missingFields: missingCoverFields(coverPage, dil),
    },
    includeToc,
    headingNumbering: { enabled: headingNumbering, guidelineRule: guideline?.settings.headingNumbering, manualNumbered },
    /* Kılavuz bağlanınca uygulanan sayfa düzeni sonradan elle
       değiştirilebiliyor; fark oluştuğunda listede görünür. */
    pageSetup: sayfaDuzeniFarklari({ margins, showPageNumbers, kilavuz: guideline?.settings }, dil),
    saveState,
  }, dil);
  const handleChecklistAction = (action: ChecklistAction) => {
    switch (action) {
      case "link-guideline":
        window.open(editHref, "_self");
        break;
      /* Kurum girili ama katalogda karşılığı yok: yükleme teklifi
         Çalışma Merkezi'nde duruyor. Ayarlara göndermek, hiçbir şeyi
         değiştirmeyen bir ekrana göndermekti. */
      case "upload-guideline":
        window.open(`/dashboard/editor/${projectId}`, "_self");
        break;
      /*
        ÖNCE PENCERE KAPANIYOR, SONRA EKLENİYOR.

        insertSections eklenen ilk bölüme kaydırıp imleci oraya
        koyuyor — yani öğrenciyi yazacağı yere bırakıyor. Pencere açık
        kalırken bunun hiçbiri görünmüyordu: kipli pencere belgenin
        üstünü örtüyor ve odak tuzağı imleci geri çekiyor. Öğrenci
        "ekle"ye basıyor, iş gerçekten yapılıyor ama ekranda bir şey
        değişmiyordu.

        setTimeout, React pencereyi söküp odak tuzağının temizliğini
        çalıştırsın diye: aynı olayda çağırsaydık odak son olarak
        tuzağın geri yüklediği yere giderdi.
      */
      case "insert-sections": {
        if (!missingSections.length) break;
        const eklenecek = missingSections;
        setChecklistOpen(false);
        setVurguluMadde(null);
        window.setTimeout(() => handleInsertSections(eklenecek), 0);
        break;
      }
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
        showToast("success", t({ tr: "Word çıktısına içindekiler tablosu eklenecek.", en: "A table of contents will be added to the Word export." }));
        break;
      case "apply-numbering":
        if (guideline?.settings.headingNumbering !== undefined) setHeadingNumbering(guideline.settings.headingNumbering);
        break;
      case "apply-page-setup":
        if (guideline?.settings.margins) setMargins(guideline.settings.margins);
        if (guideline?.settings.showPageNumbers !== undefined) setShowPageNumbers(guideline.settings.showPageNumbers);
        showToast("success", t({ tr: "Sayfa düzeni kılavuza göre ayarlandı.", en: "Page layout set according to the guideline." }));
        break;
      /* Bu da imleci belgeye taşıyor: aynı gerekçeyle önce pencere kapanıyor. */
      case "strip-manual-numbers":
        setChecklistOpen(false);
        setVurguluMadde(null);
        window.setTimeout(() => editor.chain().focus().stripManualHeadingNumbers().run(), 0);
        break;
      case "save":
        void saveNow();
        break;
    }
  };

  const handleJump = (heading: OutlineHeading) => jumpToHeading(editor, heading);

  // Yapı denetimi listesi: canlı gösterge penceresi ve kontrol sonucu aynı listeyi kullanır.
  const recheckStructure = () => {
    const issues = checkStructure(editor.getJSON(), structureOptions, dil);
    setLiveIssues(issues);
    setStructureIssues((current) => (current ? issues : current));
    setCheckResultEski(true);
  };
  /* Bir sorunun eylemi: tek tıkla düzeltme varsa o, yoksa metinde göster. */
  const sorunEylemi = (issue: StructureIssue, onNavigate?: () => void) => (
    <>
      {issue.action === "sort-references" ? (
        <button
          type="button"
          className="projects-filter-button button-compact sorun-eylem"
          onClick={() => {
            const sorted = sortReferences(editor);
            if (sorted < 0) {
              showToast("error", t({ tr: "Kaynakça liste ya da tablo içinde olduğu için otomatik sıralanamadı.", en: "The reference list could not be sorted automatically because it is inside a list or table." }));
              return;
            }
            showToast("success", t({ tr: `${sorted} kaynak alfabetik sıralandı. Geri almak için Ctrl+Z.`, en: `${sorted} references sorted alphabetically. Press Ctrl+Z to undo.` }));
            recheckStructure();
          }}
        >
          {t({ tr: "Alfabetik sırala", en: "Sort alphabetically" })}
        </button>
      ) : issue.action === "convert-reference-lists" ? (
        <button
          type="button"
          className="projects-filter-button button-compact sorun-eylem"
          onClick={() => {
            const converted = convertReferenceListsToParagraphs(editor);
            if (converted === 0) {
              showToast("error", t({ tr: "Kaynakçada paragrafa çevrilecek liste bulunamadı.", en: "No list to convert to paragraphs was found in the reference list." }));
              return;
            }
            showToast("success", t({ tr: `${converted} kaynak ayrı paragraflara çevrildi. Geri almak için Ctrl+Z.`, en: `${converted} references converted to separate paragraphs. Press Ctrl+Z to undo.` }));
            recheckStructure();
          }}
        >
          {t({ tr: "Paragraflara çevir", en: "Convert to paragraphs" })}
        </button>
      ) : issue.action === "apply-hanging-indent" ? (
        <button
          type="button"
          className="projects-filter-button button-compact sorun-eylem"
          onClick={() => {
            const cm = guideline?.settings.referenceHangingIndentCm;
            const applied = cm ? applyHangingIndent(editor, cm) : 0;
            if (applied === 0) {
              showToast("error", t({ tr: "Asılı girinti uygulanacak kaynakça girdisi bulunamadı.", en: "No reference entries to apply a hanging indent to were found." }));
              return;
            }
            showToast("success", t({ tr: `${applied} kaynakça girdisine asılı girinti uygulandı. Geri almak için Ctrl+Z.`, en: `Hanging indent applied to ${applied} reference entries. Press Ctrl+Z to undo.` }));
            recheckStructure();
          }}
        >
          {t({ tr: "Asılı girinti uygula", en: "Apply hanging indent" })}
        </button>
      ) : issue.action === "apply-paragraph-format" ? (
        <button
          type="button"
          className="projects-filter-button button-compact sorun-eylem"
          onClick={() => {
            const applied = applyParagraphFormat(editor, paragraphFormat);
            if (applied === 0) {
              showToast("error", t({ tr: "Kılavuz düzenine çevrilecek gövde paragrafı bulunamadı.", en: "No body paragraphs to bring into the guideline layout were found." }));
              return;
            }
            showToast("success", t({ tr: `${applied} paragraf kılavuzun düzenine getirildi. Geri almak için Ctrl+Z.`, en: `${applied} paragraphs brought into the guideline layout. Press Ctrl+Z to undo.` }));
            recheckStructure();
          }}
        >
          {t({ tr: "Kılavuza göre düzenle", en: "Format per guideline" })}
        </button>
      ) : issue.action === "clear-manual-text-format" ? (
        <button
          type="button"
          className="projects-filter-button button-compact sorun-eylem"
          onClick={() => {
            const temizlenen = clearManualTextFormat(editor);
            if (temizlenen === 0) {
              showToast("error", t({ tr: "Temizlenecek elle verilmiş biçim bulunamadı.", en: "No manual formatting to clear was found." }));
              return;
            }
            showToast(
              "success",
              t({
                tr: `${temizlenen} yerde elle verilmiş biçim kaldırıldı; metin kılavuzun düzenine döndü. Geri almak için Ctrl+Z.`,
                en: `Manual formatting removed in ${temizlenen} places; the text is back to the guideline layout. Press Ctrl+Z to undo.`,
              })
            );
            recheckStructure();
          }}
        >
          {t({ tr: "Kılavuzun biçimine döndür", en: "Revert to guideline format" })}
        </button>
      ) : issue.action === "fix-reference-punctuation" ? (
        <button
          type="button"
          className="projects-filter-button button-compact sorun-eylem"
          onClick={() => {
            const fixed = fixReferencePunctuationInEditor(editor);
            if (fixed === 0) {
              showToast(
                "error",
                t({
                  tr: "Otomatik düzeltilemedi (hata farklı biçimlendirilmiş parçalar arasında); lütfen elle düzeltin.",
                  en: "Could not fix automatically (the error spans differently formatted parts); please fix it manually.",
                })
              );
              return;
            }
            showToast("success", t({ tr: `${fixed} kaynak girdisinde noktalama düzeltildi. Geri almak için Ctrl+Z.`, en: `Punctuation fixed in ${fixed} reference entries. Press Ctrl+Z to undo.` }));
            recheckStructure();
          }}
        >
          {t({ tr: "Düzelt", en: "Fix" })}
        </button>
      ) : issue.target ? (
        <button
          type="button"
          className="result-link sorun-goster"
          onClick={() => {
            onNavigate?.();
            handleFindText(issue.target!);
          }}
        >
          {t({ tr: "Göster", en: "Show" })}
        </button>
      ) : null}
    </>
  );
  /*
    YAPI SORUNLARI LİSTESİ (26.10.2026, kurum sahibinin isteği: "bu
    pencereyi de geliştirmeliyiz"). Eskiden renkli cümlelerden oluşan düz
    bir listeydi: boş bölüm, eksik künye ve kısaltma uyarısı alt alta,
    hangisinin hata hangisinin uyarı olduğu yalnızca yazının renginden
    anlaşılıyordu. Artık üstte hata/uyarı sayısı, sorunlar türüne göre
    gruplu (lib/structure-check.ts, SORUN_TURLERI) ve her grubun neden
    önemli olduğu tek satırda; renk tek başına ayırt edici değil, simge
    ve etiket de var.
  */
  const renderIssueList = (issues: StructureIssue[], onNavigate?: () => void) => {
    if (issues.length === 0) {
      return (
        <p className="sorun-temiz" data-tone="success">
          <CheckCircle2 size={18} aria-hidden="true" />
          {t({
            tr: "Boş bölüm, başlık atlaması, şekil/tablo ya da atıf tutarsızlığı bulunmadı.",
            en: "No empty sections, skipped heading levels, or figure/table or citation inconsistencies were found.",
          })}
        </p>
      );
    }
    const hata = issues.filter((issue) => issue.tone === "danger").length;
    const uyari = issues.length - hata;
    return (
      <div className="sorun-paneli">
        <p className="sorun-ozet">
          {hata ? (
            <span className="status-pill" data-tone="danger">
              {t({ tr: `${hata} hata`, en: `${hata} errors` })}
            </span>
          ) : null}
          {uyari ? (
            <span className="status-pill" data-tone="warning">
              {t({ tr: `${uyari} uyarı`, en: `${uyari} warnings` })}
            </span>
          ) : null}
          <small>
            {t({
              tr: "Hatalar teslimden önce düzeltilmeli; uyarılar kılavuza göre gözden geçirilmeli.",
              en: "Errors should be fixed before submission; warnings should be reviewed against the guideline.",
            })}
          </small>
        </p>
        {sorunlariGrupla(issues, dil).map((grup) => (
          <section key={grup.tur} className="sorun-grubu" aria-label={grup.baslik}>
            <header>
              <strong>{grup.baslik}</strong>
              <span className="muted text-sm">{grup.sorunlar.length}</span>
            </header>
            {grup.neden ? <p className="muted text-sm">{grup.neden}</p> : null}
            <ul>
              {grup.sorunlar.map((issue, i) => (
                <li key={i} className="sorun-satir" data-tone={issue.tone}>
                  {issue.tone === "danger" ? (
                    <AlertCircle size={16} aria-label={t({ tr: "Hata", en: "Error" })} />
                  ) : (
                    <AlertTriangle size={16} aria-label={t({ tr: "Uyarı", en: "Warning" })} />
                  )}
                  <span className="sorun-metin">{issue.message}</span>
                  {sorunEylemi(issue, onNavigate)}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  };
  const handleInsertSections = (list: string[]) => {
    insertSections(editor, requiredSections, list);
    showToast(
      "success",
      list.length > 1
        ? t({ tr: `${list.length} bölüm kılavuz sırasına göre eklendi.`, en: `${list.length} sections added in guideline order.` })
        : t({ tr: `"${list[0]}" bölümü eklendi.`, en: `Section "${list[0]}" added.` })
    );
  };
  const handleTemplate = () => {
    applyTemplate(editor, requiredSections);
    showToast("success", t({ tr: "Kılavuzun bölümleriyle taslak oluşturuldu.", en: "An outline was created from the guideline's sections." }));
  };
  const handleFindText = (text: string) => {
    if (!selectText(editor, text)) {
      showToast("error", t({ tr: "Bu ifade metinde bulunamadı; değiştirilmiş olabilir.", en: "This phrase was not found in the text; it may have been changed." }));
    }
  };
  const style: CitationStyle = CITATION_STYLES.includes(citationStyle as CitationStyle) ? (citationStyle as CitationStyle) : "apa7";
  /*
    Analiz sonucu satır satır paragraf olarak eklenir: sonuç metni tablo
    satırlarını da taşıyor, tek paragrafa sığdırmak satırları birbirine
    yapıştırırdı. Boş satırlar atlanır.
  */
  const handleAnaliz = (metin: string) => {
    const satirlar = metin.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!satirlar.length) return false;
    return editor
      .chain()
      .focus()
      .insertContent(satirlar.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })))
      .run();
  };
  const handleCite = (source: LiteratureSource, secenek: { sayfa?: string | null } = {}) => {
    /* Erişim tarihi künyeye girer: belgenin dilinde yazılır. */
    const bugun = new Intl.DateTimeFormat(YEREL[belgeDili], { timeZone: "Europe/Istanbul" }).format(new Date());
    const { citation, addedReference } = insertCitation(editor, source, style, {
      sayfa: secenek.sayfa,
      erisimTarihi: bugun,
      kalip: ornekKalibi(ornekAtif),
      dil: belgeDili,
    });
    /* Eksik künye bilgisi sessizce düşmüyor: kaynakçaya ne eksik yazıldığı söyleniyor. */
    const eksik = addedReference ? eksikAlanlar(source, dil) : [];
    const eksikMetni = eksik.join(", ");
    showToast(
      eksik.length ? "error" : "success",
      eksik.length
        ? t({
            tr: `${citation} eklendi; künyede eksik: ${eksikMetni}. Literatür'den kaynağı tamamlayın.`,
            en: `${citation} inserted; missing from reference: ${eksikMetni}. Complete the source in Literature.`,
          })
        : addedReference
          ? t({ tr: `${citation} eklendi; kaynak Kaynakça'ya yazıldı.`, en: `${citation} inserted; the source was added to the reference list.` })
          : t({ tr: `${citation} eklendi.`, en: `${citation} inserted.` }),
    );
    void updateLiteratureStatus(source.id, "used");
  };
  // Yazdırma sekmesi tıklamayla hemen açılır (açılır pencere engelleyicisine takılmasın), metin kaydedilince yüklenir.
  const handlePrint = async () => {
    const printWindow = window.open("", "_blank");
    const target = `/print/manuscript/${projectId}?auto=1`;
    if (!(await saveNow())) {
      printWindow?.close();
      showToast("error", t({ tr: "Metin kaydedilemediği için PDF hazırlanamadı.", en: "The PDF could not be prepared because the text could not be saved." }));
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
      showToast(
        "success",
        t({
          tr: "Word çıktısına güncel içindekiler tablosu eklenecek (Sayfa ayarlarından kapatılabilir).",
          en: "An up-to-date table of contents will be added to the Word export (you can turn it off in Page settings).",
        })
      );
    }
    const first = collectHeadings(editor.state.doc)[0];
    if (first) jumpToHeading(editor, first);
  };

  const statusLabel =
    saveState === "saving"
      ? t({ tr: "Kaydediliyor…", en: "Saving…" })
      : saveState === "dirty"
        ? t({ tr: "Kaydedilecek…", en: "Unsaved changes…" })
        : saveState === "error"
          ? t({ tr: "Kaydedilemedi · tekrar dene", en: "Not saved · try again" })
          : saveState === "conflict"
            ? t({ tr: "Çakışma var", en: "Conflict" })
            : lastSavedAt
              ? t({ tr: `Kaydedildi · ${timeLabel(lastSavedAt, dil)}`, en: `Saved · ${timeLabel(lastSavedAt, dil)}` })
              : t({ tr: "Otomatik kayıt açık", en: "Autosave on" });

  return (
    <>
      {/*
        EYLEM DÜĞMELERİ SAYFA BAŞLIĞINDA (26.10.2026, kurum sahibinin
        isteği: "butonları çalışma özeti butonunun yanına almalı, yer
        kazanmak için"). Başlık sunucu bileşeninde (page.tsx) çiziliyor,
        düğmeler editörün durumuna bağlı; başlıktaki #yazma-eylemleri
        kutusuna portal ile yerleşiyorlar. Editör yalnızca tarayıcıda
        kurulduğu için bu satıra gelindiğinde document hep var.
      */}
      {eylemHedefi
        ? createPortal(
            <>
              <button
                type="button"
                className="projects-filter-button"
                data-tone={checklist.done === checklist.total ? "success" : undefined}
                onClick={() => setChecklistOpen(true)}
                title={t({ tr: "Teslimden önce bakılacaklar", en: "What to check before submission" })}
              >
                <ClipboardCheck size={15} aria-hidden="true" />
                {t({ tr: "Teslim kontrolü", en: "Submission checklist" })} {checklist.done}/{checklist.total}
                {/* Kuralların kaynağı alt çubukta da görünüyor: pencereyi
                    açmadan "neye göre hazır" sorusunun cevabı bilinmeli. */}
                {guideline && !guideline.dogrulandi ? <small className="kural-kaynagi">{t({ tr: "kendi kılavuzunuz", en: "your own guideline" })}</small> : null}
              </button>
              <button type="button" className="projects-filter-button" onClick={handleExport} disabled={exporting}>
                <FileDown size={15} />
                {exporting ? t({ tr: "Hazırlanıyor...", en: "Preparing..." }) : t({ tr: "Word olarak indir", en: "Download as Word" })}
              </button>
              <button type="button" className="projects-filter-button" onClick={() => void handlePrint()}>
                <Printer size={15} />
                {t({ tr: "PDF / Yazdır", en: "PDF / Print" })}
              </button>
              {/*
                Adı NE DENETLEDİĞİNİ söylüyor. Alt çubukta üç ayrı "kontrol"
                vardı ve en kapsamlısının adı en belirsiziydi: soldaki rozet
                yalnızca YAPIYI denetliyor (canlı), "Teslim kontrolü" bir
                kontrol listesi, bu düğme ise kılavuz uyumunu ve kaynakça
                çapraz denetimini çalıştırıyor. Üçü de "kontrol" deyince
                öğrenci hangisinin neye baktığını ayırt edemiyordu.
              */}
              <button
                type="button"
                className="projects-primary-button"
                onClick={handleCheck}
                disabled={checking}
                title={t({
                  tr: "Kılavuzun zorunlu bölümleri, atıf stili ve kaynakça–atıf eşleşmesi",
                  en: "Required guideline sections, citation style and reference–citation matching",
                })}
              >
                <ShieldCheck size={15} />
                {checking ? t({ tr: "Kontrol ediliyor...", en: "Checking..." }) : t({ tr: "Kılavuz ve kaynakça kontrolü", en: "Guideline and reference check" })}
              </button>
            </>,
            eylemHedefi,
          )
        : null}
    <div className="manuscript-layout">
      {/*
        ARAÇLAR SOLDA, DİKEY KARTLARDA (26.10.2026, kurum sahibinin isteği).
        Eskiden belgenin üstünde iki satıra sarılan tek bir çubuktu: geniş
        ekranda bile kırk düğme yan yana, hangisinin ne işe yaradığı ancak
        üzerine gelince anlaşılıyordu. Kartlar işe göre gruplu (yazı,
        başlık ve liste, paragraf, ekle, belge); tablo kartı yalnızca imleç
        tablodayken görünür. Telefonda panel belgenin üstünde yatay kayar.
      */}
      <aside className="manuscript-araclar" role="toolbar" aria-label={t({ tr: "Biçimlendirme", en: "Formatting" })} aria-orientation="vertical">
        <AracKarti baslik={t({ tr: "Yazı", en: "Text" })}>
          <select
            className="toolbar-select"
            title={t({ tr: "Yazı tipi", en: "Font" })}
            aria-label={t({ tr: "Yazı tipi", en: "Font" })}
            value={ui.fontFamily}
            onChange={(e) => {
              const value = e.target.value;
              if (value) editor.chain().focus().setFontFamily(value).run();
              else editor.chain().focus().unsetFontFamily().run();
            }}
          >
            <option value="">
              {guideline?.settings.fontFamily
                ? t({ tr: `Kılavuz (${guideline.settings.fontFamily})`, en: `Guideline (${guideline.settings.fontFamily})` })
                : t({ tr: "Varsayılan yazı tipi", en: "Default font" })}
            </option>
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>

          <select
            className="toolbar-select"
            title={t({ tr: "Yazı boyutu", en: "Font size" })}
            aria-label={t({ tr: "Yazı boyutu", en: "Font size" })}
            value={ui.fontSize}
            onChange={(e) => {
              const value = e.target.value;
              if (value) editor.chain().focus().setFontSize(value).run();
              else editor.chain().focus().unsetFontSize().run();
            }}
          >
            <option value="">
              {guideline?.settings.fontSizePt
                ? t({ tr: `Kılavuz (${guideline.settings.fontSizePt} pt)`, en: `Guideline (${guideline.settings.fontSizePt} pt)` })
                : t({ tr: "Varsayılan boyut", en: "Default size" })}
            </option>
            {FONT_SIZES.map((s) => (
              <option key={s} value={`${s}pt`}>
                {s} pt
              </option>
            ))}
          </select>

          <div className="arac-segment" role="group" aria-label={t({ tr: "Yazı biçimi", en: "Text style" })}>
          <ToolbarButton label={t({ tr: "Kalın (Ctrl+B)", en: "Bold (Ctrl+B)" })} active={ui.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
            <BoldIcon size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "İtalik (Ctrl+I)", en: "Italic (Ctrl+I)" })} active={ui.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <ItalicIcon size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Altı çizili (Ctrl+U)", en: "Underline (Ctrl+U)" })} active={ui.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Üst simge (Ctrl+Shift+=)", en: "Superscript (Ctrl+Shift+=)" })} active={ui.superscript} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
            <SuperscriptIcon size={16} />
          </ToolbarButton>
          </div>

        </AracKarti>
        <AracKarti baslik={t({ tr: "Başlık ve liste", en: "Headings and lists" })}>
          <div className="arac-segment" role="group" aria-label={t({ tr: "Paragraf türü", en: "Paragraph type" })}>
          {/* "Metin": başlıktan normal paragrafa dönüş. Eskiden yalnızca aynı
              başlık düğmesine yeniden basarak dönülüyordu; bu belli değildi. */}
          <ToolbarButton
            label={t({ tr: "Normal metin (Ctrl+Alt+0)", en: "Normal text (Ctrl+Alt+0)" })}
            active={!ui.heading}
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            {t({ tr: "Metin", en: "Text" })}
          </ToolbarButton>
          {([1, 2, 3] as const).map((level) => (
            <ToolbarButton
              key={level}
              label={t({ tr: `Başlık ${level} (Ctrl+Alt+${level})`, en: `Heading ${level} (Ctrl+Alt+${level})` })}
              active={ui.heading === level}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            >
              H{level}
            </ToolbarButton>
          ))}
          </div>
          <div className="arac-segment" role="group" aria-label={t({ tr: "Liste ve alıntı", en: "Lists and quotes" })}>

          <ToolbarButton label={t({ tr: "Madde işaretli liste (Ctrl+Shift+8)", en: "Bulleted list (Ctrl+Shift+8)" })} active={ui.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Numaralı liste (Ctrl+Shift+7)", en: "Numbered list (Ctrl+Shift+7)" })} active={ui.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Alıntı (Ctrl+Shift+B)", en: "Block quote (Ctrl+Shift+B)" })} active={ui.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote size={16} />
          </ToolbarButton>
          </div>

        </AracKarti>
        <AracKarti baslik={t({ tr: "Paragraf", en: "Paragraph" })}>
          <div className="arac-segment" role="group" aria-label={t({ tr: "Hizalama", en: "Alignment" })}>
          <ToolbarButton label={t({ tr: "Sola hizala (Ctrl+L)", en: "Align left (Ctrl+L)" })} active={ui.align === "left"} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Ortala (Ctrl+E)", en: "Center (Ctrl+E)" })} active={ui.align === "center"} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Sağa hizala (Ctrl+R)", en: "Align right (Ctrl+R)" })} active={ui.align === "right"} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "İki yana yasla (Ctrl+J)", en: "Justify (Ctrl+J)" })} active={ui.align === "justify"} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
            <AlignJustify size={16} />
          </ToolbarButton>
          </div>

          <select
            className="toolbar-select"
            title={t({ tr: "Satır aralığı", en: "Line spacing" })}
            aria-label={t({ tr: "Satır aralığı", en: "Line spacing" })}
            value={ui.lineSpacing}
            onChange={(e) => editor.chain().focus().setLineSpacing(e.target.value || null).run()}
          >
            <option value="">
              {guideline?.settings.lineSpacing
                ? t({ tr: `Aralık: kılavuz (${guideline.settings.lineSpacing})`, en: `Spacing: guideline (${guideline.settings.lineSpacing})` })
                : t({ tr: "Satır aralığı", en: "Line spacing" })}
            </option>
            <option value="1">{t({ tr: "Tek (1.0)", en: "Single (1.0)" })}</option>
            <option value="1.15">1.15</option>
            <option value="1.5">1.5</option>
            <option value="2">{t({ tr: "Çift (2.0)", en: "Double (2.0)" })}</option>
          </select>

          <ToolbarButton
            label={t({ tr: "İlk satır girintisi (1.25 cm) — paragraf başında Tab", en: "First-line indent (1.25 cm) — Tab at paragraph start" })}
            metin={t({ tr: "İlk satır girintisi", en: "First-line indent" })}
            active={ui.firstLineIndent}
            onClick={() => editor.chain().focus().setFirstLineIndent(!ui.firstLineIndent).run()}
          >
            <IndentIncrease size={16} />
          </ToolbarButton>

        </AracKarti>
        <AracKarti baslik={t({ tr: "Ekle", en: "Insert" })} izgara>
          <ToolbarButton label={t({ tr: "Tablo ekle", en: "Insert table" })} metin={t({ tr: "Tablo", en: "Table" })} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <TableIcon size={16} />
          </ToolbarButton>
          <ToolbarButton
            label={imageUploading ? t({ tr: "Resim yükleniyor…", en: "Uploading image…" }) : t({ tr: "Resim ekle (PNG, JPG, GIF)", en: "Insert image (PNG, JPG, GIF)" })}
            metin={t({ tr: "Resim", en: "Image" })}
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
          <ToolbarButton label={t({ tr: "Dipnot ekle (Ctrl+Alt+F)", en: "Insert footnote (Ctrl+Alt+F)" })} metin={t({ tr: "Dipnot", en: "Footnote" })} onClick={() => setFootnoteDialog({ mode: "insert", text: "" })}>
            <StickyNote size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Kaynaktan atıf ekle", en: "Cite a source" })} metin={t({ tr: "Atıf", en: "Citation" })} onClick={() => setCiteOpen(true)}>
            <BookMarked size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Analiz sonucu ekle", en: "Insert analysis result" })} metin={t({ tr: "Analiz", en: "Analysis" })} onClick={() => setAnalizOpen(true)}>
            <BarChart3 size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Resimlerim (daha önce yüklenenler)", en: "My images (previously uploaded)" })} metin={t({ tr: "Resimlerim", en: "My images" })} onClick={() => setLibraryOpen(true)}>
            <Images size={16} />
          </ToolbarButton>
          <ToolbarButton
            label={t({ tr: "Şekil başlığı (otomatik numaralı)", en: "Figure caption (auto-numbered)" })}
            metin={t({ tr: "Şekil başlığı", en: "Figure caption" })}
            genis
            active={ui.caption === "figure"}
            onClick={() => editor.chain().focus().toggleCaption("figure").run()}
          >
            <Captions size={16} />
          </ToolbarButton>
          <ToolbarButton
            label={t({ tr: "Tablo başlığı (otomatik numaralı)", en: "Table caption (auto-numbered)" })}
            metin={t({ tr: "Tablo başlığı", en: "Table caption" })}
            genis
            active={ui.caption === "table"}
            onClick={() => editor.chain().focus().toggleCaption("table").run()}
          >
            <TableProperties size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Word dosyasından aktar", en: "Import from Word file" })} metin={t({ tr: "Word'den aktar", en: "Import Word" })} genis onClick={() => setImportOpen(true)}>
            <FileUp size={16} />
          </ToolbarButton>

        </AracKarti>
        {/*
          Tablo kontrolleri: yalnızca imleç tablodayken.

          Eskiden hiç yoktu. Tablo 3×3 olarak ekleniyor, sonrasında
          SATIR eklenebiliyordu (Tiptap'ta son hücrede Tab yeni satır
          açar) ama SÜTUN eklemenin, satır ya da sütun silmenin, tabloyu
          kaldırmanın hiçbir yolu yoktu. Kullanıcı üç sütunla kalıyor,
          dördüncüyü isteyince tabloyu silip baştan kurmak zorundaydı —
          silmenin de yolu olmadığı için gerçekte kalıyordu.

          Araç çubuğunda sürekli durmuyor: tablo dışındayken hepsi
          tıklanamaz sekiz düğme, kalabalıktan başka bir şey değil.
        */}
        {ui.inTable ? (
          <AracKarti baslik={t({ tr: "Tablo", en: "Table" })} izgara>
            <ToolbarButton label={t({ tr: "Soluna sütun ekle", en: "Insert column left" })} metin={t({ tr: "Sola sütun", en: "Column left" })} onClick={() => editor.chain().focus().addColumnBefore().run()}>
              <ArrowLeftToLine size={16} />
            </ToolbarButton>
            <ToolbarButton label={t({ tr: "Sağına sütun ekle", en: "Insert column right" })} metin={t({ tr: "Sağa sütun", en: "Column right" })} onClick={() => editor.chain().focus().addColumnAfter().run()}>
              <ArrowRightToLine size={16} />
            </ToolbarButton>
            <ToolbarButton label={t({ tr: "Sütunu sil", en: "Delete column" })} metin={t({ tr: "Sütunu sil", en: "Delete column" })} onClick={() => editor.chain().focus().deleteColumn().run()}>
              <Columns2 size={16} />
            </ToolbarButton>
            <ToolbarButton label={t({ tr: "Üstüne satır ekle", en: "Insert row above" })} metin={t({ tr: "Üste satır", en: "Row above" })} onClick={() => editor.chain().focus().addRowBefore().run()}>
              <ArrowUpToLine size={16} />
            </ToolbarButton>
            <ToolbarButton label={t({ tr: "Altına satır ekle", en: "Insert row below" })} metin={t({ tr: "Alta satır", en: "Row below" })} onClick={() => editor.chain().focus().addRowAfter().run()}>
              <ArrowDownToLine size={16} />
            </ToolbarButton>
            <ToolbarButton label={t({ tr: "Satırı sil", en: "Delete row" })} metin={t({ tr: "Satırı sil", en: "Delete row" })} onClick={() => editor.chain().focus().deleteRow().run()}>
              <Rows2 size={16} />
            </ToolbarButton>
            <ToolbarButton label={t({ tr: "Başlık satırını aç/kapat", en: "Toggle header row" })} metin={t({ tr: "Başlık satırı", en: "Header row" })} genis onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
              <PanelTop size={16} />
            </ToolbarButton>
            <ToolbarButton label={t({ tr: "Hücreleri birleştir", en: "Merge cells" })} metin={t({ tr: "Birleştir", en: "Merge" })} disabled={!ui.canMergeCells} onClick={() => editor.chain().focus().mergeCells().run()}>
              <TableCellsMerge size={16} />
            </ToolbarButton>
            <ToolbarButton label={t({ tr: "Hücreyi böl", en: "Split cell" })} metin={t({ tr: "Böl", en: "Split" })} disabled={!ui.canSplitCell} onClick={() => editor.chain().focus().splitCell().run()}>
              <TableCellsSplit size={16} />
            </ToolbarButton>
            <ToolbarButton label={t({ tr: "Tabloyu sil", en: "Delete table" })} metin={t({ tr: "Tabloyu sil", en: "Delete table" })} genis onClick={() => editor.chain().focus().deleteTable().run()}>
              <Trash2 size={16} />
            </ToolbarButton>
          </AracKarti>
        ) : null}

        <AracKarti baslik={t({ tr: "Belge", en: "Document" })} izgara>
          <div className="arac-segment" role="group" aria-label={t({ tr: "Geri al ve yinele", en: "Undo and redo" })}>
          <ToolbarButton label={t({ tr: "Geri al (Ctrl+Z)", en: "Undo (Ctrl+Z)" })} disabled={!ui.canUndo} onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Yinele (Ctrl+Y)", en: "Redo (Ctrl+Y)" })} disabled={!ui.canRedo} onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 size={16} />
          </ToolbarButton>
          </div>

          <ToolbarButton label={t({ tr: "Sayfa ayarları", en: "Page settings" })} metin={t({ tr: "Sayfa ayarı", en: "Page setup" })} active={showPageSettings} onClick={() => setShowPageSettings((v) => !v)}>
            <Settings2 size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Kapak sayfası", en: "Cover page" })} metin={t({ tr: "Kapak", en: "Cover" })} active={showCoverPageEditor} onClick={() => setShowCoverPageEditor((v) => !v)}>
            <FileBadge size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Danışmana paylaş (salt okunur bağlantı)", en: "Share with advisor (read-only link)" })} metin={t({ tr: "Paylaş", en: "Share" })} onClick={() => setShareOpen(true)}>
            <Share2 size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Sürüm geçmişi", en: "Version history" })} metin={t({ tr: "Sürümler", en: "Versions" })} onClick={() => setVersionsOpen(true)}>
            <History size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Bul ve değiştir (Ctrl+F)", en: "Find and replace (Ctrl+F)" })} metin={t({ tr: "Bul", en: "Find" })} active={findOpen} onClick={() => setFindOpen((open) => !open)}>
            <Search size={16} />
          </ToolbarButton>

          <ToolbarButton label={t({ tr: "Klavye kısayolları", en: "Keyboard shortcuts" })} metin={t({ tr: "Kısayollar", en: "Shortcuts" })} onClick={() => setShortcutsOpen(true)}>
            <Keyboard size={16} />
          </ToolbarButton>
        </AracKarti>
      </aside>

    <div className="manuscript-main">
    <div className="manuscript-editor-shell">
      {/* Kayıt durumu ve bul-değiştir belgenin üstünde, yapışık */}
      <div className="manuscript-toolbar manuscript-ust">
        <button
          type="button"
          className="save-status"
          data-state={saveState}
          title={t({ tr: "Şimdi kaydet (Ctrl+S)", en: "Save now (Ctrl+S)" })}
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
            {t({
              tr: `Bu tarayıcıda kaydedilmemiş değişiklikleriniz bulundu (${tarihSaat(draftOffer.writtenAt)}).`,
              en: `Unsaved changes were found in this browser (${tarihSaat(draftOffer.writtenAt)}).`,
            })}
          </span>
          <span className="cluster">
            <button type="button" className="projects-primary-button" onClick={restoreDraft}>
              {t({ tr: "Geri yükle", en: "Restore" })}
            </button>
            <button type="button" className="projects-filter-button" onClick={discardDraft}>
              {t({ tr: "Yok say", en: "Discard" })}
            </button>
          </span>
        </div>
      ) : null}

      {formatLoss && !formatLossDismissed ? (
        <div className="callout editor-notice" data-tone="warning" role="status">
          <strong>
            {t({
              tr: "Bu belgenin bazı biçim bilgileri eski bir kayıt hatası nedeniyle kaybolmuş.",
              en: "Some of this document's formatting was lost due to an old saving bug.",
            })}
          </strong>
          <ul className="format-loss-list">
            {formatLoss.nodesWithoutAttrs > 0 ? (
              <li>
                {t({
                  tr: "Başlık düzeylerini (H1–H3), hizalamayı ve şekil/tablo başlıklarını kontrol edin; düzelttiğiniz hâl artık eksiksiz kaydedilir.",
                  en: "Check heading levels (H1–H3), alignment and figure/table captions; your corrected version is now saved in full.",
                })}
              </li>
            ) : null}
            {formatLoss.missingImages > 0 ? (
              <li>
                {t({
                  tr: `${formatLoss.missingImages} resim görüntülenemiyor: boş resim kutularını silip “Resimlerim”den yeniden ekleyebilirsiniz.`,
                  en: `${formatLoss.missingImages} images cannot be displayed: delete the empty image boxes and add them again from “My images”.`,
                })}
              </li>
            ) : null}
            {formatLoss.emptyFootnotes > 0 ? (
              <li>
                {t({
                  tr: `${formatLoss.emptyFootnotes} dipnotun metni boş: dipnot işaretine tıklayıp metnini yeniden yazın.`,
                  en: `${formatLoss.emptyFootnotes} footnotes are empty: click the footnote marker and write the text again.`,
                })}
              </li>
            ) : null}
            <li>
              {t({
                tr: "Word dosyanız varsa “Word'den aktar → Yerine koy” ile metni tüm biçimiyle yeniden alabilirsiniz (mevcut hâl önce sürüm olarak saklanır).",
                en: "If you have the Word file, you can re-import the text with all its formatting via “Import Word → Replace” (the current version is saved as a version first).",
              })}
            </li>
          </ul>
          <span className="cluster mt-sm">
            <button type="button" className="projects-filter-button" onClick={() => setLibraryOpen(true)}>
              {t({ tr: "Resimlerim", en: "My images" })}
            </button>
            <button type="button" className="projects-filter-button" onClick={() => setImportOpen(true)}>
              {t({ tr: "Word'den aktar", en: "Import Word" })}
            </button>
            <button type="button" className="projects-filter-button" onClick={() => setFormatLossDismissed(true)}>
              {t({ tr: "Anladım", en: "Got it" })}
            </button>
          </span>
        </div>
      ) : null}

      {saveState === "conflict" ? (
        <div className="callout editor-notice cluster" data-tone="danger" role="alert">
          <span>
            {t({
              tr: "Bu belge başka bir sekmede ya da başka biri tarafından değiştirildi. Üzerine yazmamak için otomatik kayıt durduruldu;",
              en: "This document was changed in another tab or by someone else. Autosave was paused so nothing is overwritten;",
            })}{" "}
            {t(taslakYazilamadi ? TASLAK_YAZILAMADI_METIN : TASLAK_GUVENDE_METIN)}
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
              {t({ tr: "Diğer sürümü aç", en: "Open the other version" })}
            </button>
            <button type="button" className="button-danger" onClick={() => void saveNow(true)}>
              {t({ tr: "Benim sürümümü kaydet", en: "Save my version" })}
            </button>
          </span>
        </div>
      ) : saveState === "error" && saveError ? (
        <div className="callout editor-notice cluster" data-tone="danger" role="alert">
          <span>
            {saveError}
            {abonelikBitti
              ? t({
                  tr: " Yazdıklarınız bu tarayıcıda duruyor; plan yenilenince kaydedilir.",
                  en: " What you wrote is kept in this browser; it will be saved once your plan is renewed.",
                })
              : ""}
          </span>
          <span className="cluster">
            {sessionExpired ? (
              <button type="button" className="projects-primary-button" onClick={() => window.location.reload()}>
                {t({ tr: "Yeniden giriş yap", en: "Sign in again" })}
              </button>
            ) : abonelikBitti ? (
              /*
                Abonelik engelinde "Şimdi dene" yanlış yola sokuyordu:
                basılan düğme asla başaramaz. Yazdıkları tarayıcıda
                duruyor; söylenmesi gereken bu ve yenileme yolu.
              */
              <Link href="/dashboard" className="projects-primary-button">
                {t({ tr: "Planı yenile", en: "Renew plan" })}
              </Link>
            ) : (
              <button type="button" className="projects-filter-button" onClick={() => void saveNow()}>
                {t({ tr: "Şimdi dene", en: "Try now" })}
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
            <strong>
              {t({
                tr: "Kapak sayfası oluştur (Word'e aktarınca belgenin ilk sayfası olur)",
                en: "Create a cover page (it becomes the first page when exported to Word)",
              })}
            </strong>
          </label>

          {coverPageEnabled && (
            <div className="manuscript-cover-page-grid">
              <CoverField label={t({ tr: "Üniversite", en: "University" })} value={coverPage.university} onChange={(university) => setCoverPage((p) => ({ ...p, university }))} />
              <CoverField label={t({ tr: "Enstitü / Fakülte", en: "Institute / Faculty" })} value={coverPage.institute} onChange={(institute) => setCoverPage((p) => ({ ...p, institute }))} />
              <CoverField label={t({ tr: "Anabilim Dalı / Bölüm", en: "Department" })} value={coverPage.department} onChange={(department) => setCoverPage((p) => ({ ...p, department }))} />
              <CoverField label={t({ tr: "Program (varsa)", en: "Program (if any)" })} value={coverPage.program} onChange={(program) => setCoverPage((p) => ({ ...p, program }))} />
              <CoverField full label={t({ tr: "Tez / Çalışma Başlığı", en: "Thesis / Work Title" })} value={coverPage.title} onChange={(title) => setCoverPage((p) => ({ ...p, title }))} />
              <CoverField label={t({ tr: "Yazar Adı Soyadı", en: "Author's Full Name" })} value={coverPage.authorName} onChange={(authorName) => setCoverPage((p) => ({ ...p, authorName }))} />
              <label>
                <span>{t({ tr: "Çalışma Türü", en: "Work Type" })}</span>
                <select
                  value={coverPage.degreeType}
                  onChange={(e) => setCoverPage((p) => ({ ...p, degreeType: e.target.value }))}
                >
                  {/* Kayıtlı değer belgenin bugünkü dilinde değilse de listede kalsın: yoksa seçim sessizce ilk seçeneğe kayar. */}
                  {DERECE_TURLERI.some((tur) => tur[belgeDili] === coverPage.degreeType) ? null : (
                    <option value={coverPage.degreeType}>{coverPage.degreeType}</option>
                  )}
                  {DERECE_TURLERI.map((tur) => (
                    <option key={tur.tr} value={tur[belgeDili]}>
                      {tur[belgeDili]}
                    </option>
                  ))}
                </select>
              </label>
              <CoverField label={t({ tr: "Danışman (varsa)", en: "Advisor (if any)" })} placeholder={t({ tr: "Unvan Adı Soyadı", en: "Title First Last" })} value={coverPage.advisorName} onChange={(advisorName) => setCoverPage((p) => ({ ...p, advisorName }))} />
              <CoverField label={t({ tr: "Şehir", en: "City" })} value={coverPage.city} onChange={(city) => setCoverPage((p) => ({ ...p, city }))} />
              <CoverField label={t({ tr: "Yıl", en: "Year" })} value={coverPage.year} onChange={(year) => setCoverPage((p) => ({ ...p, year }))} />
            </div>
          )}
        </div>
      )}

      {/* Kılavuzun adı ve "Kuralları gör" sağdaki kontrol kartında; belgenin
          üstünde yalnızca yeni sürümün UYGULANDIĞI haberi kalıyor. */}
      {guideline && syncMode === "auto-applied" ? (
        <div className="guideline-applied-banner" role="status">
          <div>
            <strong>{t({ tr: "Kılavuzun yeni sürümü uygulandı", en: "The guideline's new version was applied" })}</strong>
            <span>{guideline.label}</span>
            <span className="guideline-meta text-sm">
              {guideline.citationStyle.toUpperCase()}
              {guideline.versionLabel ? ` · ${guideline.versionLabel}` : ""}
              {formatDate(guideline.version)
                ? t({ tr: ` · Onay: ${formatDate(guideline.version)}`, en: ` · Approved: ${formatDate(guideline.version)}` })
                : ""}
              {guideline.updatePending ? t({ tr: " · Yeni sürüm ekibimizce inceleniyor", en: " · A new version is under review by our team" }) : ""}
            </span>
            {syncMode === "auto-applied" && guidelineSync.changes.length > 0 ? (
              <SyncChangeList title={t({ tr: "Değişen ayarlar:", en: "Changed settings:" })} changes={guidelineSync.changes} />
            ) : null}
          </div>
          <div className="cluster">
            <button type="button" className="projects-filter-button" onClick={() => setGuidelineOpen(true)}>
              {t({ tr: "Kuralları gör", en: "View rules" })}
            </button>
          </div>
        </div>
      ) : !guideline && isThesis ? (
        <div className="guideline-applied-banner" data-tone="muted" role="status">
          <div>
            <strong>{t({ tr: "Bu çalışmaya bağlı kılavuz yok", en: "No guideline is linked to this work" })}</strong>
            {/* Eskiden yalnızca "kurumu seçin" deniyordu: kataloğunda kılavuzu
                olmayan (yurt dışındaki her) öğrenci kurumu seçse de bir şey
                değişmiyordu. Asıl yol kendi kılavuzunu yüklemek. */}
            <span>
              {t({
                tr: "Tez yazım kılavuzunuzu (PDF ya da web adresi) yükleyin; onayladığınız kurallar editöre uygulanır.",
                en: "Upload your thesis writing guideline (PDF or web address); the rules you approve are applied to the editor.",
              })}
            </span>
          </div>
          <div className="cluster">
            <Link href={calismaAdresi(projectId, { kilavuz: true })} className="projects-primary-button">
              {t({ tr: "Kılavuzumu yükle", en: "Upload my guideline" })}
            </Link>
            <Link href={editHref} className="projects-filter-button">
              {t({ tr: "Kurumu seç", en: "Select institution" })}
            </Link>
          </div>
        </div>
      ) : null}

      {guideline && syncMode === "offer" ? (
        <div className="callout editor-notice cluster" data-tone="accent" role="status">
          <span>
            {t({
              tr: "Kılavuzun yeni sürümü onaylandı. Kenar boşluklarını ya da sayfa numarasını siz değiştirdiğiniz için sayfa ayarlarınızı kendiliğinden değiştirmedik.",
              en: "A new version of the guideline was approved. Because you changed the margins or page numbering yourself, we did not change your page settings automatically.",
            })}
            {guidelineSync.changes.length > 0 ? (
              <SyncChangeList title={t({ tr: "Güncellerseniz şunlar değişir:", en: "If you update, these change:" })} changes={guidelineSync.changes} />
            ) : null}
          </span>
          <span className="cluster">
            <button type="button" className="projects-primary-button" onClick={acceptGuidelineSettings}>
              {t({ tr: "Kılavuza göre güncelle", en: "Update to guideline" })}
            </button>
            <button type="button" className="projects-filter-button" onClick={keepOwnSettings}>
              {t({ tr: "Ayarlarımı koru", en: "Keep my settings" })}
            </button>
          </span>
        </div>
      ) : null}

      {showPageSettings && (
        <div className="manuscript-page-settings">
          <span className="manuscript-page-settings-label">
            <AlignVerticalSpaceAround size={14} />
            {t({ tr: "Sayfa kenar boşlukları (cm)", en: "Page margins (cm)" })}
          </span>
          {(["top", "bottom", "left", "right"] as const).map((side) => (
            <label key={side}>
              <span>
                {side === "top"
                  ? t({ tr: "Üst", en: "Top" })
                  : side === "bottom"
                    ? t({ tr: "Alt", en: "Bottom" })
                    : side === "left"
                      ? t({ tr: "Sol", en: "Left" })
                      : t({ tr: "Sağ", en: "Right" })}
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
            <span>{t({ tr: "Sayfa numarası ekle", en: "Add page numbers" })}</span>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={includeToc} onChange={(e) => setIncludeToc(e.target.checked)} />
            <span>{t({ tr: "İçindekiler tablosu (Word ve PDF)", en: "Table of contents (Word and PDF)" })}</span>
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
            <span>{t({ tr: "Başlıkları otomatik numarala (1., 1.1.)", en: "Number headings automatically (1., 1.1.)" })}</span>
          </label>
          {manualNumbered > 0 ? (
            <span className="manuscript-page-settings-hint">
              {t({
                tr: `${manualNumbered} başlıkta elle yazılmış numara var; çift numara olmaması için`,
                en: `${manualNumbered} headings have manually typed numbers; to avoid double numbering,`,
              })}{" "}
              <button
                type="button"
                className="result-link"
                onClick={() => {
                  editor.chain().focus().stripManualHeadingNumbers().run();
                  showToast("success", t({ tr: "Elle yazılmış başlık numaraları kaldırıldı (Geri al ile geri alınabilir).", en: "Manually typed heading numbers were removed (you can undo this)." }));
                }}
              >
                {t({ tr: "elle yazılanları kaldırın", en: "remove the manual ones" })}
              </button>
              .
            </span>
          ) : null}
          <span className="manuscript-page-settings-hint">
            {t({ tr: "Otomatik kaydedilir, Word'e aktarırken uygulanır.", en: "Saved automatically and applied when exporting to Word." })}
          </span>
        </div>
      )}

      <EditorContent editor={editor} />
      <OlcumPaneli editor={editor} />

      {stats.footnotes.length > 0 ? (
        <ol className="footnote-list" aria-label={t({ tr: "Dipnotlar", en: "Footnotes" })}>
          {stats.footnotes.map((footnote) => (
            <li key={footnote.pos}>
              <button type="button" onClick={() => openFootnoteEditor(footnote.pos, footnote.text)}>
                {footnote.text || t({ tr: "(boş dipnot)", en: "(empty footnote)" })}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

    </div>{/* .manuscript-editor-shell */}

      <ShareDialog open={shareOpen} onClose={closeShare} projectId={projectId} />

      <SubmissionChecklistDialog
        open={checklistOpen}
        onClose={closeChecklist}
        checklist={checklist}
        onAction={handleChecklistAction}
        vurgu={vurguluMadde}
        dogrulanmamis={guideline ? !guideline.dogrulandi : false}
      />

      <Dialog
        open={issuesOpen}
        onClose={closeIssues}
        kicker={t({ tr: "Canlı kontrol", en: "Live check" })}
        title={t({ tr: "Yapı ve bütünlük", en: "Structure and consistency" })}
        description={t({
          tr: "Yazarken kendiliğinden denetlenir: boş bölümler, başlık atlamaları, şekil/tablo numaraları, atıf–kaynakça uyumu ve boş dipnotlar.",
          en: "Checked automatically as you write: empty sections, skipped heading levels, figure/table numbering, citation–reference matching and empty footnotes.",
        })}
      >
        {liveIssues === null ? (
                /* null "ilk denetim henüz çalışmadı" demek; boş dizi
                   "sorun bulunmadı". İkisini aynı göstermek, bilinmeyeni
                   temiz rapor gibi sunmaktı. */
                <p className="tone-text" data-tone="warning">
                  {t({ tr: "Canlı denetim birkaç saniye içinde tamamlanır.", en: "The live check completes within a few seconds." })}
                </p>
              ) : (
                renderIssueList(liveIssues, closeIssues)
              )}
      </Dialog>

    </div>{/* .manuscript-main */}

      {/*
        KONTROL KARTI (26.10.2026): eskiden belgenin altındaki çubuktu —
        kelime sayısı, sayfa hedefi, canlı yapı uyarısı, teslim kontrolü,
        kılavuz denetimi ve çıktı düğmeleri. Uzun belgede ancak sona
        inince görünüyordu; artık sağ panelin başında, her zaman görünür.
      */}
      <ManuscriptOutline
        ust={
          /*
            KONTROL KARTI (26.10.2026, ikinci elden geçiriş: "bu kartı daha
            kaliteli hale getir"). Kılavuzun adı kesilmiyor, iki satıra
            iniyor; kelime ve sayfa ayrı ölçü kutularında; sayfa hedefi
            yerleşik <progress> ile (satır içi stil yok); yapı denetimi
            satırın tamamı tıklanan bir durum satırı — eskiden küçük bir
            rozetti ve tıklanabildiği belli değildi.
          */
          <section className="outline-card kontrol-karti" aria-label={t({ tr: "Kılavuz ve ilerleme", en: "Guideline and progress" })}>
            {guideline ? (
              <header className="kontrol-kilavuz">
                <span className="kontrol-kilavuz-ust">
                  <span className="dashboard-kicker">{t({ tr: "Uygulanan kılavuz", en: "Applied guideline" })}</span>
                  <button type="button" className="projects-filter-button button-compact" onClick={() => setGuidelineOpen(true)}>
                    <BookOpen size={14} aria-hidden="true" /> {t({ tr: "Kurallar", en: "Rules" })}
                  </button>
                </span>
                <strong title={guideline.label}>{guideline.label}</strong>
                <span className="kontrol-etiketler">
                  <span className="kontrol-etiket">{guideline.citationStyle.toUpperCase()}</span>
                  {formatDate(guideline.version) ? (
                    <span className="kontrol-etiket">
                      {t({ tr: `Onay ${formatDate(guideline.version)}`, en: `Approved ${formatDate(guideline.version)}` })}
                    </span>
                  ) : null}
                  {guideline.updatePending ? (
                    <span className="kontrol-etiket">{t({ tr: "Yeni sürüm inceleniyor", en: "New version under review" })}</span>
                  ) : null}
                </span>
              </header>
            ) : null}

            <dl className="kontrol-olculer">
              <div>
                <dt>{t({ tr: "Kelime", en: "Words" })}</dt>
                <dd>{stats.words.toLocaleString(YEREL[dil])}</dd>
              </div>
              <div>
                <dt>{t({ tr: "Sayfa", en: "Pages" })}</dt>
                <dd>
                  ≈ {pages}
                  {guideline?.minPages ? (
                    <small>
                      {" "}
                      / {guideline.minPages}
                      {guideline.maxPages ? `–${guideline.maxPages}` : "+"}
                    </small>
                  ) : null}
                </dd>
              </div>
              {stats.footnotes.length > 0 ? (
                <div>
                  <dt>{t({ tr: "Dipnot", en: "Footnotes" })}</dt>
                  <dd>{stats.footnotes.length}</dd>
                </div>
              ) : null}
            </dl>

            {/*
              Sayfa hedefi: kılavuzun alt sınırına göre dolar, sınır dışına
              çıkınca tonu değişir. Yazarken hedefin neresinde olunduğu
              görünsün diye; eskiden yalnızca kontrol sonrasında görünüyordu.
            */}
            {guideline?.minPages ? (
              <div className="kontrol-hedef" data-tone={pageTone}>
                <progress
                  className="sayfa-cubugu"
                  max={guideline.minPages}
                  value={Math.min(pages, guideline.minPages)}
                  aria-label={t({ tr: `Sayfa hedefi: ${pages} / ${guideline.minPages} sayfa`, en: `Page target: ${pages} / ${guideline.minPages} pages` })}
                />
                {pace && !stats.empty ? <small>{pace.detail}</small> : null}
              </div>
            ) : pace && !stats.empty ? (
              <small className="kontrol-tempo">{pace.detail}</small>
            ) : null}

            {liveIssues ? (
              <button
                type="button"
                className="kontrol-yapi"
                data-tone={
                  liveIssues.length === 0 ? "success" : liveIssues.some((issue) => issue.tone === "danger") ? "danger" : "warning"
                }
                onClick={() => setIssuesOpen(true)}
                title={t({ tr: "Yazarken kendiliğinden denetlenir", en: "Checked automatically as you write" })}
              >
                {liveIssues.length === 0 ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}
                <span>
                  <b>
                    {liveIssues.length === 0
                      ? t({ tr: "Yapı sorunsuz", en: "Structure OK" })
                      : t({ tr: `${liveIssues.length} yapı uyarısı`, en: `${liveIssues.length} structure warnings` })}
                  </b>
                  <small>
                    {liveIssues.length === 0
                      ? t({ tr: "Yazarken kendiliğinden denetlenir", en: "Checked automatically as you write" })
                      : t({ tr: "Ayrıntıları gör", en: "See details" })}
                  </small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ) : null}

            {checkError ? (
              <p className="alert" data-tone="danger" role="alert">
                {checkError}
              </p>
            ) : null}
            {/* Son kontrol kaydı: kart her açılışta gösterir, pencerede geçmiş listelenir. */}
            {checkResult ? (
              <button type="button" className="kontrol-son" onClick={() => setSonucAcik(true)}>
                <History size={16} aria-hidden="true" />
                <span>
                  <b>{t({ tr: "Son kılavuz kontrolü", en: "Last guideline check" })}</b>
                  <small>
                    {gecmis[0] ? tarihSaat(gecmis[0].createdAt) : t({ tr: "Bu oturumda", en: "This session" })}
                    {checkResultEski ? t({ tr: " · metin sonradan değişti", en: " · text changed since" }) : ""}
                    {gecmis.length > 1 ? t({ tr: ` · ${gecmis.length} kayıt`, en: ` · ${gecmis.length} records` }) : ""}
                  </small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ) : null}
          </section>
        }
        sections={sections}
        documentEmpty={stats.empty}
        onJump={handleJump}
        onInsert={handleInsertSections}
        onTemplate={handleTemplate}
        onImport={() => setImportOpen(true)}
      >
        <IcindekilerKarti
          headings={stats.headings}
          numaralama={headingNumbering}
          sayfaBasiKelime={sayfaBasiKelime}
          onJump={handleJump}
        />
        <BekleyenKaynaklarKarti
          projectId={projectId}
          govdeMetni={govdeMetni}
          numarali={NUMERIC_STYLES.includes(style)}
          belgeDili={belgeDili}
          onCite={(source) => handleCite(source)}
        />
        <ManuscriptComments projectId={projectId} getQuote={() => selectedText(editor)} onFind={handleFindText} />
      </ManuscriptOutline>

      {/*
        Sonuç pencerede. Eskiden belgenin ALTINDA açılıyordu: 150 sayfalık
        tezde öğrenci düğmeye basıyor, hiçbir şey olmamış sanıyordu.
        Sonuçtaki "Göster/Ekle" bağlantıları önce pencereyi kapatıyor —
        kipli pencere açıkken belgede gidilen yer görünmez.
      */}
      {checkResult && (
        <Dialog
          open={sonucAcik}
          onClose={() => setSonucAcik(false)}
          kicker={t({ tr: "Kontrol", en: "Check" })}
          title={t({ tr: "Kılavuz ve kaynakça kontrolü", en: "Guideline and reference check" })}
          description={t({
            tr: "Kılavuzun zorunlu bölümleri, yapı ve bütünlük, atıf–kaynakça eşleşmesi. Her çalıştırma kaydedilir; öncekiler aşağıda.",
            en: "Required guideline sections, structure and consistency, citation–reference matching. Every run is saved; earlier ones are below.",
          })}
        >
        <div
          className="sorun-paneli"
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest(".result-link, .kontrol-git")) setSonucAcik(false);
          }}
        >
          {/*
            KONTROL GEÇMİŞİ (26.10.2026, kurum sahibinin isteği: "son kontrol
            sonucunu kaldırma, geçmiş işlem gözüksün"). Son 10 çalıştırma;
            birine basınca o anki sonuç açılır. Hata ve uyarı sayısı
            çalıştırmalar arasında düzelip düzelmediğini gösteriyor.
          */}
          {gecmis.length ? (
            <section className="kontrol-gecmisi" aria-label={t({ tr: "Kontrol geçmişi", en: "Check history" })}>
              <strong className="text-sm">{t({ tr: "Kontrol geçmişi", en: "Check history" })}</strong>
              <ol>
                {gecmis.map((k, i) => (
                  <li key={k.id}>
                    <button
                      type="button"
                      aria-pressed={k.id === seciliKontrol}
                      disabled={kayitAciliyor !== null}
                      onClick={() => void kontrolSec(k.id)}
                    >
                      <span className="kontrol-gecmisi-tarih">
                        {tarihSaat(k.createdAt)}
                        {i === 0 ? <small>{t({ tr: "en son", en: "latest" })}</small> : null}
                      </span>
                      <span className="kontrol-gecmisi-sayilar">
                        {k.hata ? (
                          <span className="status-pill" data-tone="danger">
                            {t({ tr: `${k.hata} hata`, en: `${k.hata} errors` })}
                          </span>
                        ) : null}
                        {k.uyari ? (
                          <span className="status-pill" data-tone="warning">
                            {t({ tr: `${k.uyari} uyarı`, en: `${k.uyari} warnings` })}
                          </span>
                        ) : null}
                        {k.eksikBolum ? (
                          <span className="status-pill" data-tone="neutral">
                            {t({ tr: `${k.eksikBolum} eksik bölüm`, en: `${k.eksikBolum} missing sections` })}
                          </span>
                        ) : null}
                        {!k.hata && !k.uyari && !k.eksikBolum ? (
                          <span className="status-pill" data-tone="success">
                            {t({ tr: "Sorunsuz", en: "No issues" })}
                          </span>
                        ) : null}
                      </span>
                      <span className="muted text-sm">
                        {t({ tr: `${k.kelime.toLocaleString(YEREL[dil])} kelime`, en: `${k.kelime.toLocaleString(YEREL[dil])} words` })}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {seciliKontrol && gecmis[0] && seciliKontrol !== gecmis[0].id ? (
            <p className="alert" data-tone="info">
              {t({
                tr: `Önceki bir kontrolü görüntülüyorsunuz (${tarihSaat(gecmis.find((k) => k.id === seciliKontrol)?.createdAt ?? "")}). Bağlantılar metnin bugünkü hâlinde arar.`,
                en: `You are viewing an earlier check (${tarihSaat(gecmis.find((k) => k.id === seciliKontrol)?.createdAt ?? "")}). Links search the current version of the text.`,
              })}
            </p>
          ) : checkResultEski ? (
            <p className="alert" data-tone="warning">
              {t({
                tr: "Bu sonuç metnin önceki hâline ait; sonrasında değişiklik yaptınız. Güncel durum için “Kılavuz ve kaynakça kontrolü” düğmesine yeniden basın.",
                en: "This result is for an earlier version of the text; you have made changes since. For the current status, click “Guideline and reference check” again.",
              })}
            </p>
          ) : null}

          {checkResult.guidelineCompliance ? (
            <section className="sorun-grubu" aria-label={t({ tr: "Kılavuz uygunluğu", en: "Guideline compliance" })}>
              <header>
                <strong>{t({ tr: "Kılavuz uygunluğu", en: "Guideline compliance" })}</strong>
                <span className="muted text-sm">
                  {checkResult.guidelineCompliance.sections.filter((b) => b.found).length}/
                  {checkResult.guidelineCompliance.sections.length}
                </span>
              </header>
              <p className="muted text-sm">
                {t({ tr: "Kılavuzun zorunlu bölümleri metinde başlık olarak bulunmalı.", en: "The guideline's required sections must appear as headings in the text." })}
              </p>
              <ul>
                {checkResult.guidelineCompliance.sections.map((b, i) => {
                  const heading = sections.find((item) => item.section === b.section)?.heading ?? null;
                  return (
                    <li key={i} className="sorun-satir" data-tone={b.found ? "success" : "danger"}>
                      {b.found ? (
                        <CheckCircle2 size={16} aria-label={t({ tr: "Var", en: "Present" })} />
                      ) : (
                        <AlertCircle size={16} aria-label={t({ tr: "Eksik", en: "Missing" })} />
                      )}
                      <span className="sorun-metin">
                        {b.section}
                        {b.found ? null : <small className="muted">{t({ tr: " — bulunamadı", en: " — not found" })}</small>}
                      </span>
                      {heading ? (
                        <button type="button" className="result-link sorun-goster" onClick={() => handleJump(heading)}>
                          {t({ tr: "Git", en: "Go" })}
                        </button>
                      ) : !b.found ? (
                        <button
                          type="button"
                          className="projects-filter-button button-compact sorun-eylem kontrol-git"
                          onClick={() => handleInsertSections([b.section])}
                        >
                          {t({ tr: "Bölümü ekle", en: "Add section" })}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {structureIssues ? (
            <section className="kontrol-bolumu" aria-label={t({ tr: "Yapı ve bütünlük", en: "Structure and consistency" })}>
              <strong>{t({ tr: "Yapı ve bütünlük", en: "Structure and consistency" })}</strong>
              {renderIssueList(structureIssues)}
            </section>
          ) : null}

          <section className="sorun-grubu" aria-label={t({ tr: "Atıf ve kaynakça eşleşmesi", en: "Citation and reference matching" })}>
            <header>
              <strong>{t({ tr: "Atıf ve kaynakça eşleşmesi", en: "Citation and reference matching" })}</strong>
              {checkResult.atif.referenceSectionFound && checkResult.atif.complianceScore !== null ? (
                <span
                  className="status-pill"
                  data-tone={
                    checkResult.atif.complianceScore >= 85 ? "success" : checkResult.atif.complianceScore >= 60 ? "warning" : "danger"
                  }
                >
                  {t({
                    tr: `${checkResult.stil.ad} uyum ${checkResult.atif.complianceScore}/100`,
                    en: `${checkResult.stil.ad} compliance ${checkResult.atif.complianceScore}/100`,
                  })}
                </span>
              ) : null}
            </header>
            {!checkResult.atif.referenceSectionFound ? (
              <p className="sorun-satir" data-tone="danger">
                <AlertCircle size={16} aria-label={t({ tr: "Hata", en: "Error" })} />
                <span className="sorun-metin">
                  {t({
                    tr: "Kaynakça bölümü bulunamadı: \"Kaynakça\" ya da \"Kaynaklar\" başlığı ekleyin.",
                    en: "No reference list section found: add a \"References\" or \"Bibliography\" heading.",
                  })}
                </span>
              </p>
            ) : checkResult.atif.crossCheck.referencesWithoutCitation.length +
                checkResult.atif.crossCheck.citationsWithoutReference.length ===
              0 ? (
              <p className="sorun-satir" data-tone="success">
                <CheckCircle2 size={16} aria-label={t({ tr: "Sorunsuz", en: "No issues" })} />
                <span className="sorun-metin">
                  {checkResult.stil.tur === "numara"
                    ? t({
                        tr: `${checkResult.stil.ad} numaralı bir stil: atıf numaraları ile kaynakça sırası "Yapı ve bütünlük" altında denetlenir.`,
                        en: `${checkResult.stil.ad} is a numbered style: citation numbers and reference order are checked under "Structure and consistency".`,
                      })
                    : t({
                        tr: "Her atıfın kaynakçada, her kaynağın metinde karşılığı var.",
                        en: "Every citation has a matching reference, and every reference is cited in the text.",
                      })}
                </span>
              </p>
            ) : (
              <ul>
                {checkResult.atif.crossCheck.citationsWithoutReference.map((c, i) => (
                  <li key={`cw-${i}`} className="sorun-satir" data-tone="danger">
                    <AlertCircle size={16} aria-label={t({ tr: "Hata", en: "Error" })} />
                    <span className="sorun-metin">
                      {t({ tr: "Metinde atıf var, kaynakçada yok", en: "Cited in text, missing from references" })}: {c.raw}
                    </span>
                    <button type="button" className="result-link sorun-goster" onClick={() => handleFindText(c.raw)}>
                      {t({ tr: "Göster", en: "Show" })}
                    </button>
                  </li>
                ))}
                {checkResult.atif.crossCheck.referencesWithoutCitation.map((r, i) => (
                  <li key={`rw-${i}`} className="sorun-satir" data-tone="warning">
                    <AlertTriangle size={16} aria-label={t({ tr: "Uyarı", en: "Warning" })} />
                    <span className="sorun-metin">
                      {t({ tr: "Kaynakçada var, metinde atıf yok", en: "In references, not cited in text" })}: {r.raw}
                    </span>
                    <button type="button" className="result-link sorun-goster" onClick={() => handleFindText(r.raw)}>
                      {t({ tr: "Göster", en: "Show" })}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        </Dialog>
      )}

      <VersionsDialog
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        projectId={projectId}
        flush={() => saveNow()}
        onRestored={handleRestored}
        getCurrentText={() => extractPlainText(editor.getJSON() as TiptapDoc)}
      />
      <CiteDialog
        open={citeOpen}
        onClose={() => setCiteOpen(false)}
        projectId={projectId}
        style={style}
        belgeDili={belgeDili}
        onPick={handleCite}
      />
      <AnalizEkleDialog open={analizOpen} onClose={() => setAnalizOpen(false)} projectId={projectId} onPick={handleAnaliz} />
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
        projectId={projectId}
        onClose={() => setLibraryOpen(false)}
        onPick={(src, name) => editor.chain().focus().setImage({ src, alt: name }).run()}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {guideline ? (
        <Dialog
          open={guidelineOpen}
          onClose={closeGuideline}
          kicker={t({ tr: "Tez yazım kılavuzu", en: "Thesis writing guideline" })}
          title={guideline.label}
          description={t({
            tr: "Ekibimizin onayladığı son sürüm. Yeni sürüm onaylandığında editörünüze kendiliğinden yansır.",
            en: "The latest version approved by our team. When a new version is approved, it is reflected in your editor automatically.",
          })}
        >
          <dl className="guideline-rules">
            <dt>{t({ tr: "Kurum", en: "Institution" })}</dt>
            <dd>
              {guideline.universityName}
              {guideline.instituteName ? ` — ${guideline.instituteName}` : ""}
            </dd>
            <dt>{t({ tr: "Kaynakça", en: "References" })}</dt>
            <dd>{guideline.citationStyle.toUpperCase()}</dd>
            {guideline.settings.fontFamily || guideline.settings.fontSizePt ? (
              <>
                <dt>{t({ tr: "Yazı", en: "Font" })}</dt>
                <dd>
                  {[guideline.settings.fontFamily, guideline.settings.fontSizePt ? `${guideline.settings.fontSizePt} pt` : null]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </>
            ) : null}
            {guideline.settings.lineSpacing ? (
              <>
                <dt>{t({ tr: "Satır aralığı", en: "Line spacing" })}</dt>
                <dd>{guideline.settings.lineSpacing}</dd>
              </>
            ) : null}
            {guideline.settings.margins ? (
              <>
                <dt>{t({ tr: "Kenar boşlukları", en: "Margins" })}</dt>
                <dd>
                  {t({
                    tr: `Üst ${guideline.settings.margins.top} · Alt ${guideline.settings.margins.bottom} · Sol ${guideline.settings.margins.left} · Sağ ${guideline.settings.margins.right} cm`,
                    en: `Top ${guideline.settings.margins.top} · Bottom ${guideline.settings.margins.bottom} · Left ${guideline.settings.margins.left} · Right ${guideline.settings.margins.right} cm`,
                  })}
                </dd>
              </>
            ) : null}
            {guideline.settings.showPageNumbers !== undefined ? (
              <>
                <dt>{t({ tr: "Sayfa numarası", en: "Page numbers" })}</dt>
                <dd>{guideline.settings.showPageNumbers ? t({ tr: "Var", en: "Yes" }) : t({ tr: "Yok", en: "No" })}</dd>
              </>
            ) : null}
            {guideline.settings.headingNumbering !== undefined ? (
              <>
                <dt>{t({ tr: "Başlık numaralandırma", en: "Heading numbering" })}</dt>
                <dd>
                  {guideline.settings.headingNumbering
                    ? t({ tr: "Ondalık (1., 1.1., 1.1.1.)", en: "Decimal (1., 1.1., 1.1.1.)" })
                    : t({ tr: "Numarasız", en: "Unnumbered" })}
                </dd>
              </>
            ) : null}
            {guideline.settings.chapterUppercase || guideline.settings.chapterNewPage ? (
              <>
                <dt>{t({ tr: "Ana bölüm başlıkları", en: "Chapter headings" })}</dt>
                <dd>
                  {[
                    guideline.settings.chapterUppercase ? t({ tr: "büyük harfle", en: "in uppercase" }) : "",
                    guideline.settings.chapterNewPage ? t({ tr: "her biri yeni sayfadan", en: "each on a new page" }) : "",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </>
            ) : null}
            {paragraphFormat.indentCm || paragraphFormat.justify ? (
              <>
                <dt>{t({ tr: "Paragraf düzeni", en: "Paragraph layout" })}</dt>
                <dd>{describeParagraphFormat(paragraphFormat, dil)}</dd>
              </>
            ) : null}
            {guideline.settings.abstract ? (
              <>
                <dt>{t({ tr: "Özet", en: "Abstract" })}</dt>
                <dd>{describeAbstractRules(guideline.settings.abstract, dil)}</dd>
              </>
            ) : null}
            {guideline.minPages || guideline.maxPages ? (
              <>
                <dt>{t({ tr: "Sayfa sayısı", en: "Page count" })}</dt>
                <dd>
                  {guideline.minPages ? t({ tr: `en az ${guideline.minPages}`, en: `at least ${guideline.minPages}` }) : ""}
                  {guideline.minPages && guideline.maxPages ? ", " : ""}
                  {guideline.maxPages ? t({ tr: `en fazla ${guideline.maxPages}`, en: `at most ${guideline.maxPages}` }) : ""}
                </dd>
              </>
            ) : null}
            {guideline.versionLabel ? (
              <>
                <dt>{t({ tr: "Sürüm", en: "Version" })}</dt>
                <dd>{guideline.versionLabel}</dd>
              </>
            ) : null}
            {formatDate(guideline.version) ? (
              <>
                <dt>{t({ tr: "Onay tarihi", en: "Approval date" })}</dt>
                <dd>{formatDate(guideline.version)}</dd>
              </>
            ) : null}
            {formatDate(guideline.lastCheckedAt) ? (
              <>
                <dt>{t({ tr: "Son kaynak kontrolü", en: "Last source check" })}</dt>
                <dd>
                  {formatDate(guideline.lastCheckedAt)}
                  {guideline.updatePending ? t({ tr: " · yeni sürüm inceleniyor", en: " · new version under review" }) : ""}
                </dd>
              </>
            ) : null}
          </dl>

          {requiredSections.length > 0 ? (
            <div className="stack mt-md">
              <strong>{t({ tr: "Zorunlu bölümler", en: "Required sections" })}</strong>
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
              {t({ tr: "Resmî kılavuzu aç", en: "Open the official guideline" })}
            </a>
          ) : null}
        </Dialog>
      ) : null}

      <Dialog
        open={footnoteDialog !== null}
        onClose={closeFootnoteDialog}
        kicker={t({ tr: "Dipnot", en: "Footnote" })}
        title={footnoteDialog?.mode === "edit" ? t({ tr: "Dipnotu düzenle", en: "Edit footnote" }) : t({ tr: "Dipnot ekle", en: "Insert footnote" })}
        description={t({
          tr: "Numaralar belge sırasına göre otomatik verilir; Word'e gerçek dipnot olarak aktarılır.",
          en: "Numbers are assigned automatically in document order; they are exported to Word as real footnotes.",
        })}
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            submitFootnote();
          }}
        >
          <label className="dialog-field">
            <span>{t({ tr: "Dipnot metni", en: "Footnote text" })}</span>
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
              {footnoteDialog?.mode === "edit" ? t({ tr: "Kaydet", en: "Save" }) : t({ tr: "Ekle", en: "Insert" })}
            </button>
            {footnoteDialog?.mode === "edit" ? (
              <button type="button" className="button-danger" onClick={deleteFootnote}>
                <Trash2 size={15} />
                {t({ tr: "Dipnotu sil", en: "Delete footnote" })}
              </button>
            ) : null}
            <button type="button" className="projects-filter-button" onClick={closeFootnoteDialog}>
              {t({ tr: "Vazgeç", en: "Cancel" })}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
    </>
  );
}

/* Sol paneldeki araç kartı. `izgara`: etiketli düğmeler iki sütunda
   (Ekle, Tablo, Belge); yalnız simgeli düğmeyi öğrenci üzerine gelmeden
   tanımıyordu. */
function AracKarti({ baslik, izgara = false, children }: { baslik: string; izgara?: boolean; children: React.ReactNode }) {
  return (
    <section className="arac-karti" aria-label={baslik}>
      <span className="arac-karti-baslik">{baslik}</span>
      <div className="arac-karti-govde" data-izgara={izgara ? "" : undefined}>
        {children}
      </div>
    </section>
  );
}

function ToolbarButton({
  label,
  metin,
  genis = false,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  /** Simgenin yanında görünen kısa ad (sol paneldeki etiketli düğmeler) */
  metin?: string;
  /** Izgarada iki sütunu kaplar (uzun ad) */
  genis?: boolean;
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
      data-etiketli={metin ? "" : undefined}
      data-genis={genis ? "" : undefined}
    >
      {children}
      {metin ? <span className="arac-metin">{metin}</span> : null}
    </button>
  );
}

// Kılavuz sürümü değiştiğinde hangi sayfa ayarının neye döndüğünü açıkça gösterir.
function SyncChangeList({ title, changes }: { title: string; changes: GuidelineSyncChange[] }) {
  const t = useCeviri();
  return (
    <span className="sync-changes">
      <span className="sync-changes-title">{title}</span>
      <ul>
        {changes.map((change) => (
          <li key={change.label}>
            {change.label}: <span className="sync-change-from">{change.from}</span>
            <span aria-hidden="true"> → </span>
            <span className="sr-only">{t({ tr: " yerine ", en: " changed to " })}</span>
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
