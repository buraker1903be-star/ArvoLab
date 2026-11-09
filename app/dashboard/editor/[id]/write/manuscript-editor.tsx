"use client";

import { ornekKalibi } from "@/lib/atif/tyk";
import { eksikAlanlar } from "@/lib/citation-format";
import { wordDosyasiniIndir } from "@/app/dashboard/_components/word-indir";
import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { kayitHatasiMetni, TASLAK_GUVENDE_METIN, TASLAK_YAZILAMADI_METIN } from "@/lib/taslak-durumu";
import { useCeviri, useDil, useSaatDilimi, useTarihler } from "@/app/_components/dil-saglayici";
import { saatEtiketi } from "@/lib/tr-time";
import { YEREL, type Dil, type Metin } from "@/lib/dil";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import { olc } from "@/lib/editor-olcum";

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
  FileCode,
  SearchCheck,
  Plus,
  MoreHorizontal,
  MoreVertical,
  PanelRightOpen,
  PanelRightClose,
  Maximize2,
  Minimize2,
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
  Type,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  Columns2,
  Rows2,
  PanelTop,
  TableCellsMerge,
  TableCellsSplit,
  Sparkles,
  FileSearch,
  Library,
  CloudOff,
  X,
} from "lucide-react";

import type { ImportMode } from "./import-dialog";
import type { DocxImportStats } from "@/lib/docx-import";


import type { FormatLossReport } from "@/lib/format-loss";
import { checkStructure, sorunlariGrupla, type StructureIssue } from "@/lib/structure-check";
import { describeParagraphFormat, type ParagraphFormatRules } from "@/lib/paragraph-format";



import { buildSubmissionChecklist, missingCoverFields, type ChecklistAction } from "@/lib/submission-checklist";
import { makaleTeslimGirdisi, type SinirProfili } from "@/lib/makale/ozet-ve-sinirlar";
import { baslikSirasi } from "@/lib/makale/bolumler";
import { belgeGercektenDegisti } from "@/lib/tiptap-belge-degisti";
import { getSchema } from "@tiptap/core";
import { korunacakIcerigiHazirla, korunanIcerigiGeriSar, type AcilisDurumu, type HazirlikSonucu } from "@/lib/tiptap-korunan-icerik";
import { etikTeslimSatiri, type EtikKaydi } from "@/lib/etik/durum";
import { sayfaDuzeniFarklari } from "@/lib/sayfa-duzeni";


import ManuscriptComments from "./manuscript-comments";
import { updateLiteratureStatus, type LiteratureSource } from "@/app/actions/literature";
import type { CitationStyle } from "@/lib/citation-format";
import { STIL_SECENEKLERI, stilAdi, stilTanimi } from "@/lib/atif/stiller";
import { cslCoz, type CslKodu } from "@/lib/atif/csl-kimlik";
import { cslAtifUret } from "@/app/actions/csl";
import YazimIpuclariKarti from "./yazim-ipuclari-karti";

import { useSatirIciOneri } from "./satir-ici-oneri";
import AracMenusu from "@/app/dashboard/_components/acilir-menu";
import { CalismaBolumMenusu, CalismaBolumOgeleri } from "@/app/dashboard/_components/calisma-seridi";
import YazarlikRaporuKarti from "./yazarlik-raporu-karti";
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
import { saveNamedVersion } from "@/app/actions/manuscript-versions";
import { createClient } from "@/lib/supabase/client";
import { kilavuzGorunenAdi, type AppliedGuideline } from "@/lib/guideline-rules";
import type { GuidelineSyncChange, GuidelineSyncMode } from "@/lib/guideline-sync";
import Link from "next/link";
import { calismaAdresi } from "@/lib/calisma-karti";
import { kilavuzBandiAnahtari } from "@/lib/kilavuz-bandi";
import { showToast } from "@/app/dashboard/_components/toast-events";
import Dialog from "@/app/dashboard/_components/dialog";
import { estimatePages, pageRangeTone, wordsPerPage } from "@/lib/page-estimate";
import { KAGIT_BOYUTLARI, KAGITLAR, kagitOku, type KagitBoyutu } from "@/lib/kagit-boyutu";
import { belgeSutunuCm, belgeSutunuDegeri } from "@/lib/belge-sutunu";
import { cssUzunlugu, yazimRayiGerekli } from "@/lib/os/kirilimlar";
import { splitBodyAndReferences } from "@/lib/text-split";
import type { KontrolKaydiOzeti } from "@/lib/kontrol-gecmisi";
import IcindekilerKarti from "./icindekiler-karti";
import OnSayfalarKarti from "./on-sayfalar-karti";

import { kilavuzOnSayfaAdlari, kilavuzOnSayfalari, onSayfaAdiKimligi, type OnSayfaKimligi } from "@/lib/on-sayfalar";
import BekleyenKaynaklarKarti from "./bekleyen-kaynaklar-karti";
import { koruyucuKaydet } from "@/lib/gezinme-korumasi";
import { hataliDevriBirak, kayitDevret, type DevirSonucu } from "@/lib/bekleyen-kayit";
import { writingProgress } from "@/lib/writing-progress";
import { writingPace } from "@/lib/writing-pace";
import { SAYFA_NUMARASI_ADI, altGirintiMetni, bolumHizasiMetni } from "@/lib/kilavuz-bicim";
import ManuscriptOutline from "./manuscript-outline";
import TeslimListesi from "./submission-checklist";
import YanPanel, { type PanelSekmesi } from "./yan-panel";
import { useEkranSinifi } from "@/app/dashboard/_components/ekran-sinifi";
import { acilisGorunumu, ASISTAN_AC_OLAYI, panelAcikMi, panelBicimi, type PanelGorunumu } from "@/lib/yazim-yan-panel";
import {
  applyTemplate,
  collectHeadings,
  insertSections,
  insertFrontMatter,
  insertCitation,
  atifSirasi,
  oncekiDipnottaVar,
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

/*
  SEYREK AÇILAN PENCERELER TEMBEL YÜKLENİR (Phase 2, 04.11.2026). Editörün
  ilk yüklemesinde indirilen JS'e bu on iki pencere/panelin kodu da
  giriyordu; hepsi kapalıyken hiçbir şey çizmiyor. Artık sayfa
  etkileşime açıldıktan sonra ayrı parçalar olarak iniyor (ssr: false:
  kapalı pencerenin sunucuda çizilecek bir hâli yok). Davranış aynı:
  bileşenler eskisi gibi her zaman yerinde, `open` ile açılıyor.
*/
const FindReplaceBar = dynamic(() => import("./find-replace-bar"), { ssr: false });
const ImportDialog = dynamic(() => import("./import-dialog"), { ssr: false });
const ImageLibraryDialog = dynamic(() => import("./image-library-dialog"), { ssr: false });
const ShortcutsDialog = dynamic(() => import("./shortcuts-dialog"), { ssr: false });
import SecimAi from "./secim-ai";
import YazimPaneliIskeleti from "./yazim-paneli-iskelet";
import { ARAC_GRUPLARI, gizlenecekGruplar, type AracGrubuAnahtari } from "@/lib/arac-cubugu";
import { oncekiUygulamalar, oncekiUygulamalariUnut } from "@/lib/ai-kararlari";
const VersionsDialog = dynamic(() => import("./versions-dialog"), { ssr: false });
const ShareDialog = dynamic(() => import("./share-dialog"), { ssr: false });
const CiteDialog = dynamic(() => import("./cite-dialog"), { ssr: false });
const AnalizEkleDialog = dynamic(() => import("./analiz-ekle-dialog"), { ssr: false });
const KaynakBulPenceresi = dynamic(() => import("./kaynak-bul-penceresi"), { ssr: false });
/* Yüklenirken iskelet (UX S2): eskiden boş kalıyor, istem kutusu sonradan beliriyordu. */
const yazimPaneliYukle = () => import("./yazim-paneli");
const YazimPaneli = dynamic(yazimPaneliYukle, { ssr: false, loading: () => <YazimPaneliIskeleti /> });
const OlcumPaneli = dynamic(() => import("./olcum-paneli"), { ssr: false });

// Liste tek kaynaktan (lib/atif/stiller.ts): eskiden burada elle yazılıydı
// ve yeni stil eklendiğinde "Kaynak ekle" penceresi sessizce APA biçiminde
// künye üretiyordu.
const CITATION_STYLES = STIL_SECENEKLERI.map((secenek) => secenek.deger) as CitationStyle[];

/*
  Editörün tarayıcıda hatırlanan tercihleri (04.11.2026): otomatik satır
  içi öneri ve inceleme panelinin açıklığı. Değer bir dış kaynak gibi
  okunuyor (useSyncExternalStore): useState'in ilk değerinde localStorage
  okumak sunucu ile tarayıcının farklı çizmesine yol açardı. Depolama
  kapalıysa varsayılan geçerli.
*/
const ONERI_TERCIHI = "arvolab:otomatik-oneri";
const INCELEME_TERCIHI = "arvolab:inceleme-paneli";
/*
  "Bu çalışmaya bağlı kılavuz yok" bandı (Premium Simplicity Aşama 1):
  her genişlikte tek satır ve ikincil; öğrenci "Gizle" derse bant kalkar,
  aynı seçenekler durum çubuğundan ve "⋯" menüsünden açılır. Gizleme
  tercihi ÇALIŞMA başına ve yalnız tarayıcıda (lib/kilavuz-bandi.ts;
  08.11.2026'ya kadar tek genel anahtardı, bir tezde gizlenen bant bütün
  tezlerde gizleniyordu). Yalnızca bu bilgi bandı gizlenir: "yeni sürüm
  uygulandı" ve "kılavuza göre güncelle" uyarıları akademik uyumluluk
  bildirdiği için bu tercihi okumaz.
*/
const TERCIH_OLAYI = "arvolab:editor-tercihi";
function tercihAboneligi(degisti: () => void) {
  window.addEventListener(TERCIH_OLAYI, degisti);
  window.addEventListener("storage", degisti);
  return () => {
    window.removeEventListener(TERCIH_OLAYI, degisti);
    window.removeEventListener("storage", degisti);
  };
}
function tercihOku(anahtar: string, varsayilan: boolean): boolean {
  try {
    const deger = window.localStorage.getItem(anahtar);
    return deger === null ? varsayilan : deger === "1";
  } catch {
    return varsayilan;
  }
}
function tercihYaz(anahtar: string, acik: boolean) {
  try {
    window.localStorage.setItem(anahtar, acik ? "1" : "0");
  } catch {
    // Depolama kapalıysa tercih tutulamaz; düğme varsayılanda kalır.
  }
  window.dispatchEvent(new Event(TERCIH_OLAYI));
}

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
  /** Etik kurul kaydı: teslim kontrolünün etik satırı (lib/etik/durum.ts). */
  etik?: EtikKaydi | null;
  /** Oturumdaki kullanıcı: yerel taslağın anahtarı ona bağlı (ortak bilgisayar). */
  kullaniciId: string | null;
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
  /** Açılışta gidilecek başlığın metni (Makale → Bölüm denetimi, ?baslik=). Bulunamazsa editör yalnızca açılır. */
  acilacakBaslik?: string | null;
  /** "?asistan=1" ile gelinirse yazım asistanı açık başlar (Ctrl+K'daki "Yazım asistanını aç", Phase 3). */
  asistanAcikBasla?: boolean;
  /* Çalışmada kurum girili mi: teslim kontrolünde "kılavuz yok"un iki
     hâli farklı çözüm istiyor (lib/submission-checklist.ts). */
  kurumGirili?: boolean;
  initialContent: object | null;
  /** Veritabanındaki sürümün zamanı (çakışma denetimi için); null = hiç kaydedilmemiş */
  initialUpdatedAt: string | null;
  initialMargins?: PageMargins;
  /** Kâğıt boyutu (lib/kagit-boyutu.ts); kılavuz eşitlemesinden geçmiş hâli. */
  initialPageSize?: KagitBoyutu;
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
  /*
    Makale çalışmasının dergi sınırları (Makale Aşama 2, 05.11.2026).
    undefined: makale değil. null: makale ama profil kaydedilmemiş.
    Teslim listesi kelime/özet/anahtar kelimeyi Makale sekmesiyle AYNI
    fonksiyonla hesaplar (lib/makale/ozet-ve-sinirlar.ts).
  */
  makaleProfili?: SinirProfili | null;
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
/*
  Anahtar KULLANICIYA da bağlı (29.10.2026). Eskiden yalnızca çalışmaya
  bağlıydı ve çıkışta silinmiyordu: ortak bir bilgisayarda aynı çalışmaya
  erişen danışman ya da uzman, öğrencinin kaydedilmemiş taslağını "sizin
  kaydedilmemiş değişiklikleriniz" diye görüyor, geri yükleyip öğrencinin
  sunucudaki metninin üzerine yazabiliyordu. Eski biçimdeki anahtar bir
  geçiş dönemi okunuyor: içindeki metin kaybolmasın.
*/
const draftKey = (projectId: string, kullaniciId: string | null) =>
  kullaniciId ? `arvolab:manuscript-draft:${projectId}:${kullaniciId}` : `arvolab:manuscript-draft:${projectId}`;
const eskiDraftKey = (projectId: string) => `arvolab:manuscript-draft:${projectId}`;

function readDraft(projectId: string, kullaniciId: string | null): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(projectId, kullaniciId)) ?? window.localStorage.getItem(eskiDraftKey(projectId));
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
function writeDraft(projectId: string, kullaniciId: string | null, draft: LocalDraft): boolean {
  try {
    window.localStorage.setItem(draftKey(projectId, kullaniciId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function clearDraft(projectId: string, kullaniciId: string | null) {
  try {
    window.localStorage.removeItem(draftKey(projectId, kullaniciId));
    window.localStorage.removeItem(eskiDraftKey(projectId));
  } catch {
    // yok say
  }
}


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
    /* Durum çubuğunda (Signature OS Phase 2). Dipnot ve boşluklar dahil, Word'ün "karakter (boşluklar dahil)" sayısı gibi. */
    characters: (editor.storage.characterCount?.characters?.() as number | undefined) ?? 0,
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
  etik = null,
  kullaniciId,
  belgeDili = "tr",
  acilacakMadde = null,
  acilacakBaslik = null,
  asistanAcikBasla = false,
  kurumGirili = false,
  initialContent,
  initialUpdatedAt,
  initialMargins,
  initialPageSize,
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
  makaleProfili,
  formatLoss,
}: ManuscriptEditorProps) {
  const t = useCeviri();
  const dil = useDil();
  const saatDilimi = useSaatDilimi();
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
  const [taslakYukleniyor, setTaslakYukleniyor] = useState(false);
  const draftOfferRef = useRef<LocalDraft | null>(null);
  /*
    Kayıtlı içerik editörün şemasına uymuyorsa (eski/bozuk/tanınmayan düğüm)
    Tiptap onu BOŞ açar (@tiptap/core createNodeFromContent). Eskiden ilk
    tuşta otomatik kayıt bu boş hâli sunucuya yazıyordu; 8fb36dc'den sonra
    kayıt kilitlendi ama "Yedekle ve devam et" yine BOŞ editörü açıyordu ve
    yazılan ilk harf tezin yerine "boş + yazılan"ı kaydediyordu.

    S1.3 (lib/tiptap-korunan-icerik.ts): belge editöre verilmeden önce
    hazırlanır. Tanınmayan parçalar "korunan öğe" olarak özgün JSON'larıyla
    taşınır ve kayıtta yerine geri konur; belgenin geri kalanı düzenlenir
    (durum "korundu"). Yalnızca ProseMirror'ın içerik kuralı tutmuyorsa
    (yapi-hatasi) eski kilit + "Yedekle ve devam et" geçerli — orada Tiptap
    belgeyi boşaltmadan gösteriyor. Belge hiç kurulamıyorsa (acilamadi)
    editör boş açılır ve kayıt HİÇBİR koşulda açılmaz.
  */
  const [icerikUyumsuz, setIcerikUyumsuz] = useState(false);
  const icerikUyumsuzRef = useRef(false);
  const [acilis] = useState<HazirlikSonucu | null>(() =>
    initialContent ? korunacakIcerigiHazirla(initialContent, getSchema(editorExtensions({ headingNumbering: true }))) : null
  );
  const [acilisDurumu, setAcilisDurumu] = useState<AcilisDurumu>(acilis?.durum ?? "temiz");
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
  /* Bölüm denetiminden gelinen başlığa BİR KEZ gidilir; sonraki çizimler imleci oynatmaz. */
  const acilacakBaslikRef = useRef(acilacakBaslik);
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
      belgeDili,
    }),
    [citationStyle, guideline, paragraphFormat, belgeDili]
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
  /*
    Önceki sayfa yüklemesinde uygulanmış AI değişiklikleri (4.3 ek). Panelin
    "Geri al"ı ve AI adımının ayrı Ctrl+Z'si bellekteydi; yenilemeyle
    kayboldu. Kullanıcıya Ctrl+Z'nin eski AI işlemine ulaşamayacağı söylenir
    ve belge geçmişine (Sürümler) yönlendirilir. Editör yalnızca tarayıcıda
    kurulduğu için oturum deposu burada okunabilir (sunucuda editor null).
  */
  const [oncekiAiUnutuldu, setOncekiAiUnutuldu] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [margins, setMargins] = useState<PageMargins>(
    initialMargins ?? { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 }
  );
  const [pageSize, setPageSize] = useState<KagitBoyutu>(initialPageSize ?? "a4");
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
    pageSize,
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
      writeDraft(projectId, kullaniciId, {
        content: editor.getJSON() as unknown as TiptapDoc,
        baseUpdatedAt: updatedAtRef.current,
        writtenAt: new Date().toISOString(),
      })
    );
    taslakYazilamadiRef.current = !yazildi;
    setTaslakYazilamadi(!yazildi);
    return yazildi;
  }, [projectId, kullaniciId]);

  /* Hata metnine taslağın GERÇEK durumunu ekler (lib/taslak-durumu.ts). */
  /* Son sunucu kayıt hatasının yalın metni: gezinme korumasının penceresi gösterir (Aşama 2.1). */
  const sonKayitHatasiRef = useRef<string | null>(null);
  const hataYaz = useCallback(
    (mesaj: string) => {
      sonKayitHatasiRef.current = mesaj;
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
      // Uyumsuz içerikte "benim sürümümü kaydet" (force) de budanmış metni yazardı.
      if (icerikUyumsuzRef.current) return false;
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
          // Korunan öğeler özgün düğümlerine geri sarılır (S1.3): veritabanına editörün iç biçimi yazılmaz.
          const serialized = olc("kayıt: JSON üretimi", () => JSON.stringify(korunanIcerigiGeriSar(editor.getJSON())));
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
                  pageSize: settingsRef.current.pageSize,
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
              // Taslak teklifi henüz yanıtlanmadıysa taslağı silmek kullanıcının
              // kararını onun yerine vermek olur (eskiden böyleydi).
              if (!draftOfferRef.current) clearDraft(projectId, kullaniciId);
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
    [projectId, kullaniciId, guideline, persistDraft, scheduleSave, hataYaz, t]
  );

  /*
    AI DEĞİŞİKLİĞİNDEN ÖNCE SÜRÜM (Signature OS 4.3): önce KAYDET (sürüm
    sunucudaki metinden alınıyor; kaydedilmemiş son yazılar dışarıda
    kalmasın), sonra adlı sürüm. İkisinden biri olmazsa false: büyük AI
    değişikliği uygulanmaz (yazim-paneli.tsx).
  */
  const asistanSurumuAl = useCallback(
    async (etiket: string) => {
      if (!(await saveNow())) return false;
      const sonuc = await saveNamedVersion(projectId, etiket);
      return Boolean(sonuc.success);
    },
    [saveNow, projectId],
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

  /*
    GEZİNME KORUMASI (Signature OS 2.0 Aşama 2). Kabuk, uygulama içi bir
    geçişten önce buraya sorar: kaydedilmemiş ya da kaydı süren değişiklik
    varsa önce kayıt yapılır, SONUCU beklenir; kayıt düşerse geçiş olmaz
    (lib/gezinme-korumasi.ts). Eskiden kapanırken kayıt yalnızca başlatılıyor,
    sonucu beklenmiyordu.
  */
  // Bu çalışmanın hatalı bir devri varsa artık taslak teklifi buradan yürür (lib/bekleyen-kayit.ts).
  useEffect(() => hataliDevriBirak(projectId), [projectId]);

  useEffect(
    () =>
      koruyucuKaydet({
        kirliMi: () => revisionRef.current !== savedRevisionRef.current || inFlightRef.current !== null,
        kaydet: () => saveNowRef.current(),
        durum: () => ({ taslakYazildi: !taslakYazilamadiRef.current, neden: sonKayitHatasiRef.current }),
      }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    /* Liste lib/tiptap-extensions.ts'te: şemayı testler de aynı yerden kurar. */
    extensions: editorExtensions({
      headingNumbering: initialHeadingNumbering,
      dil: belgeDili,
      /* Kılavuzun ana başlık kuralları: ek numarasızlar ve bölüm başlığı hizası (lib/kilavuz-bicim.ts). */
      baslikKurallari: {
        numarasiz: guideline?.settings.unnumberedSections,
        chapterAlign: guideline?.settings.chapterAlign,
        chapterLeftSections: guideline?.settings.chapterLeftSections,
        altGirinti: guideline?.settings.subheadingIndent,
      },
    }),
    content: acilis && acilis.durum !== "acilamadi" ? (acilis.icerik as object) : "",
    onCreate: ({ editor: created }) => {
      editorRef.current = created;
      let durum: AcilisDurumu = acilis?.durum ?? "temiz";
      if (acilis && durum !== "acilamadi") {
        /*
          Son söz editörün KENDİ şemasında: hazırlık ayrı kurulan bir şemayla
          yapıldı. Verilen belge burada kurulamıyorsa Tiptap onu boş açmıştır.
        */
        try {
          created.schema.nodeFromJSON(acilis.icerik).check();
        } catch {
          try {
            created.schema.nodeFromJSON(acilis.icerik);
            durum = "yapi-hatasi";
          } catch {
            durum = "acilamadi";
          }
        }
      }
      if (durum === "yapi-hatasi" || durum === "acilamadi") {
        console.error(`[editor] kayıtlı içerik şemaya uymuyor (${durum})`, acilis?.hata ?? "");
        icerikUyumsuzRef.current = true;
        blockedRef.current = true;
        setIcerikUyumsuz(true);
      }
      setAcilisDurumu(durum);
      // Önceki oturumdan kalan, kaydedilememiş taslak varsa geri yüklemeyi öner.
      // Belge açılamadıysa önerilmez: geri yükleme kaydı gerektirir ve kayıt kapalı (taslak silinmez).
      const draft = durum === "acilamadi" ? null : readDraft(projectId, kullaniciId);
      if (draft && JSON.stringify(draft.content) !== JSON.stringify(created.getJSON())) {
        setDraftOffer(draft);
      } else if (draft) {
        clearDraft(projectId, kullaniciId);
      }
    },
    /*
      Yalnızca belge GERÇEKTEN değiştiyse kirli say (lib/tiptap-belge-degisti.ts).
      Eskiden her "update" olayı kaydı tetikliyordu; setEditable'ın belgeye
      dokunmadan yayınladığı olay da dahil, yani editörü açmak kayıttı.
      Ayar, kapak, kılavuz uygulaması ve içe aktarma markDirty'yi doğrudan
      çağırıyor; bu süzgeç onları etkilemez.
    */
    onUpdate: ({ transaction, appendedTransactions }) => {
      if (belgeGercektenDegisti({ transaction, appendedTransactions })) markDirtyRef.current();
    },
    editorProps: {
      attributes: {
        // "kagit": belge alanı her temada açık kâğıt (tokens.css `:root, .kagit`, Phase 4.3).
        class: "manuscript-editor-content kagit",
        // Kılavuzun ana bölüm kuralları editörde de görünür (metin değişmez; CSS workspace.css)
        ...(guideline?.settings.chapterUppercase ? { "data-chapter-case": "upper" } : {}),
        ...(guideline?.settings.chapterNewPage ? { "data-chapter-new-page": "true" } : {}),
        /* Paragraf öncesi/sonrası (nk): ölçü değişkenle, kural CSS'te (workspace.css). */
        ...(guideline?.settings.paragraphSpacing ? { "data-paragraf-araligi": "true" } : {}),
        "aria-label": t({ tr: "Çalışma metni", en: "Manuscript text" }),
        // Tarayıcının yazım denetimi belgenin diliyle çalışsın (eskiden hep Türkçe sözlüktü)
        spellcheck: "true",
        lang: belgeDili,
        style: [
          guideline?.settings.fontFamily ? `font-family: '${guideline.settings.fontFamily}'` : "",
          guideline?.settings.fontSizePt ? `font-size: ${guideline.settings.fontSizePt}pt` : "",
          guideline?.settings.lineSpacing ? `line-height: ${guideline.settings.lineSpacing}` : "",
          guideline?.settings.paragraphSpacing
            ? `--kilavuz-p-once: ${guideline.settings.paragraphSpacing.beforePt}pt; --kilavuz-p-sonra: ${guideline.settings.paragraphSpacing.afterPt}pt`
            : "",
          guideline?.settings.subheadingIndent ? `--kilavuz-alt-girinti: ${guideline.settings.subheadingIndent.cm}cm` : "",
        ].filter(Boolean).join("; "),
      },
      handleClickOn: (_view, pos, node) => {
        if (node.type.name !== "footnoteReference") return false;
        openFootnoteRef.current(pos, String(node.attrs.text ?? ""));
        return true;
      },
    },
  });

  /*
    Satır içi öneri (03.11.2026): otomatik mod tarayıcıda hatırlanır,
    varsayılan kapalı (her öneri bir asistan hakkı; satir-ici-oneri.tsx).
  */
  /*
    Sunucuda ve ilk çizimde "kapalı": localStorage'ı useState'in ilk
    değerinde okumak sunucu ile tarayıcının farklı çizmesine (hydration
    uyuşmazlığı) yol açardı. Değer bir dış kaynak gibi okunuyor.
  */
  const otomatikOneri = useSyncExternalStore(tercihAboneligi, () => tercihOku(ONERI_TERCIHI, false), () => false);
  const otomatikOneriAyarla = useCallback((acik: boolean) => tercihYaz(ONERI_TERCIHI, acik), []);
  /*
    YAZIM PANELİ (Signature OS Phase 2, lib/yazim-yan-panel.ts): asistan,
    inceleme, kaynaklar ve teslim tek panelde. Masaüstünde açıklık
    tarayıcıda hatırlanır (varsayılan AÇIK: kılavuz ve yapı uyarıları
    orada; kapatan öğrenci bilerek kapatır). Tablet ve telefonda panel
    belgenin üstüne açılan bir sayfa ve yalnızca açılınca açık.
    "?asistan=1" ve "?teslim=<madde>" ilgili görünümü açık başlatır.
  */
  const panelTercihi = useSyncExternalStore(tercihAboneligi, () => tercihOku(INCELEME_TERCIHI, true), () => true);
  const kilavuzBandiTercihi = kilavuzBandiAnahtari(projectId);
  const kilavuzBandiGizli = useSyncExternalStore(tercihAboneligi, () => (kilavuzBandiTercihi ? tercihOku(kilavuzBandiTercihi, false) : false), () => false);
  const kilavuzBandiniGizle = useCallback((gizli: boolean) => {
    if (kilavuzBandiTercihi) tercihYaz(kilavuzBandiTercihi, gizli);
  }, [kilavuzBandiTercihi]);
  const ekran = useEkranSinifi();
  const bicim = panelBicimi(ekran);
  const ilkGorunum = acilisGorunumu({ asistan: asistanAcikBasla, teslim: acilacakMadde });
  const [panelOturumda, setPanelOturumda] = useState<boolean | null>(ilkGorunum ? true : null);
  const [gorunum, setGorunum] = useState<PanelGorunumu>(ilkGorunum ?? "inceleme");
  /* Asistan, ilk kez açılana kadar kurulmaz (yazim-paneli.tsx ayrı bir paket); açıldıktan sonra sohbet korunur. */
  const [asistanKuruldu, setAsistanKuruldu] = useState(ilkGorunum === "asistan");
  const panelAcik = panelAcikMi({ ekran, tercih: panelTercihi, oturumdaAcildi: panelOturumda });
  const panelAc = useCallback(
    (hedef: PanelGorunumu) => {
      setGorunum(hedef);
      if (hedef === "asistan") setAsistanKuruldu(true);
      setPanelOturumda(true);
      if (bicim === "sutun") tercihYaz(INCELEME_TERCIHI, true);
    },
    [bicim],
  );
  /*
    Asistanı açmanın öteki yolları (UX S2): komut paleti aynı çalışmanın
    yazım ekranındayken olay yayınlıyor; adres editör kurulduktan sonra
    "?asistan=1" olursa (aynı sayfaya bağlantı) o da asistanı açar. Eskiden
    ikisi de hiçbir şey yapmıyordu: görünüm yalnızca ilk kurulumda okunuyordu.
    Açmak üretim isteği BAŞLATMAZ; yalnızca seçim düğmesinin bıraktığı görev
    (lib/ai-duzenleme.ts) panel kurulunca gönderilir.
  */
  useEffect(() => {
    const ac = () => panelAc("asistan");
    window.addEventListener(ASISTAN_AC_OLAYI, ac);
    return () => window.removeEventListener(ASISTAN_AC_OLAYI, ac);
  }, [panelAc]);
  const oncekiAsistanIstegi = useRef(asistanAcikBasla);
  useEffect(() => {
    if (asistanAcikBasla && !oncekiAsistanIstegi.current) panelAc("asistan");
    oncekiAsistanIstegi.current = asistanAcikBasla;
  }, [asistanAcikBasla, panelAc]);
  /*
    Asistan paketi editör boşta kalınca önceden indirilir: ilk tıklamada
    iskelet çoğu zaman hiç görünmez. Yalnızca indirme; asistan kurulmaz,
    istek gönderilmez.
  */
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => void yazimPaneliYukle(), { timeout: 5000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const zaman = window.setTimeout(() => void yazimPaneliYukle(), 3000);
    return () => window.clearTimeout(zaman);
  }, []);
  const panelKapat = useCallback(() => {
    setPanelOturumda(false);
    if (bicim === "sutun") tercihYaz(INCELEME_TERCIHI, false);
    setVurguluMadde(null);
    /*
      Adres temizlenir: "?asistan=1" ya da "?teslim=…" kalsaydı sayfa
      yenilenince panel yeniden açılırdı. Olay işleyicisinde, çizim
      sırasında değil.
    */
    const temiz = new URL(window.location.href);
    if (temiz.searchParams.has("asistan") || temiz.searchParams.has("teslim")) {
      temiz.searchParams.delete("asistan");
      temiz.searchParams.delete("teslim");
      window.history.replaceState(null, "", temiz.toString());
    }
  }, [bicim]);
  /*
    Belgede bir yere götüren eylemden (bölüm ekle, kapak, numara temizle)
    önce: panel belgenin ÜSTÜNDEYSE (tablet, telefon) kapanır, yoksa
    öğrenci "ekle"ye basar ama eklenen yeri göremezdi. Masaüstünde panel
    belgenin yanında, açık kalır.
  */
  const sayfaysaKapat = useCallback(() => {
    if (bicim === "sayfa") panelKapat();
  }, [bicim, panelKapat]);
  /*
    Odak modu: sayfa başlığı, araç çubuğu dışındaki her şey ve inceleme
    paneli gizlenir, metin ortada kalır. Bilerek hatırlanmıyor: sayfayı
    yeniden açan öğrenci uyarıları görmeden yazmaya devam etmesin. Esc çıkar.
  */
  const [odak, setOdak] = useState(false);
  useEffect(() => {
    if (!odak) return;
    const tus = (e: KeyboardEvent) => {
      // Açık bir pencere ya da öneri Esc'i kendisi kullanıyor; yalnızca editör boştayken çık.
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("dialog[open], [role=dialog]")) setOdak(false);
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [odak]);
  const otomatigiKapat = useCallback(() => otomatikOneriAyarla(false), [otomatikOneriAyarla]);
  useSatirIciOneri({ editor, projectId, otomatik: otomatikOneri, otomatigiKapat });

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
    const next = { margins, pageSize, showPageNumbers, coverPage: coverPageEnabled ? coverPage : null, settingsSource, includeToc, headingNumbering };
    const serialized = JSON.stringify(next);
    settingsRef.current = next;
    const previous = settingsSnapshot.current;
    settingsSnapshot.current = serialized;
    if (previous === null || previous === serialized) return;
    markDirtyRef.current();
  }, [margins, pageSize, showPageNumbers, coverPageEnabled, coverPage, settingsSource, includeToc, headingNumbering]);

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
      /*
        Sayfadan çıkarken (uygulama içi gezinme korumasının yakalamadığı
        yollar: tarayıcının geri/ileri düğmesi, yönlendirme) kaydedilmemiş
        değişiklik varsa iş KABUĞA DEVREDİLİR (lib/bekleyen-kayit.ts).
        ESKİDEN burada kayıt başlatılıyor ama sonucu beklenmiyordu: kayıt
        düşerse metin yalnızca tarayıcı taslağında kalıyor, kullanıcı başka
        sayfadaydı ve kimse bunu bilmiyordu. Şimdi kabuk gezinme bitince
        gönderir, geçici hatada yeniden dener, düşerse vardığı sayfada
        kalıcı uyarı gösterir (gezinme-korumasi-kabul.mjs, negatif kontrol).
        İçerik ŞİMDİ alınır: editör bileşen kapandıktan hemen sonra yok
        ediliyor (Tiptap scheduleDestroy).
      */
      if (isDirty()) {
        const taslakYazildi = persistDraft();
        const kapanan = editorRef.current;
        if (kapanan && !kapanan.isDestroyed) {
          const icerik = JSON.stringify(korunanIcerigiGeriSar(kapanan.getJSON()));
          const hedefRevizyon = revisionRef.current;
          const ayarlar = { ...settingsRef.current };
          kayitDevret({
            anahtar: projectId,
            baslik: projectDefaults?.title ?? "",
            adres: `/dashboard/editor/${projectId}/write`,
            taslakYazildi,
            gonder: async (): Promise<DevirSonucu> => {
              /*
                Süren bir otomatik kayıt varsa önce o bitsin (en çok 15 sn):
                ikisi aynı sürüm damgasıyla yazmaya kalkarsa ikincisi
                "başka yerde değiştirildi" çakışmasına düşerdi.
              */
              if (inFlightRef.current) await Promise.race([inFlightRef.current.catch(() => false), new Promise((r) => setTimeout(r, 15_000))]);
              if (savedRevisionRef.current === hedefRevizyon) {
                clearDraft(projectId, kullaniciId);
                return { tur: "kaydedildi" };
              }
              const res = await saveManuscript(projectId, {
                content: JSON.parse(icerik) as TiptapDoc,
                ...ayarlar,
                expectedUpdatedAt: updatedAtRef.current,
                force: false,
                progress: null,
              });
              if (res.success) {
                updatedAtRef.current = res.updatedAt;
                savedRevisionRef.current = hedefRevizyon;
                clearDraft(projectId, kullaniciId);
                return { tur: "kaydedildi" };
              }
              return { tur: "hata", neden: res.error, kalici: Boolean(res.conflict || res.sessionExpired || res.forbidden) };
            },
          });
        }
      }
    };
    // projectId, kullanıcı ve başlık sayfa boyunca değişmez (Ctrl+P adresi, kayıt devri).
  }, [persistDraft, projectId, t, kullaniciId, projectDefaults?.title]);

  /*
    Geri yüklemeden önce sunucudaki metin geçmişe yedeklenir. Eskiden taslak
    doğrudan yazılıyordu: başka bir cihazda sonradan yapılan değişiklikler,
    bu tarayıcıda kalmış ESKİ taslak geri yüklenince otomatik kayıtla
    sessizce siliniyordu. Taslak sunucudan eskiyse ve yedek alınamıyorsa
    geri yükleme yapılmaz.
  */
  const restoreDraft = useCallback(async () => {
    if (!editor || !draftOffer) return;
    const eski = draftOffer.baseUpdatedAt !== initialUpdatedAt;
    setTaslakYukleniyor(true);
    try {
      const yedek = await saveNamedVersion(projectId, t({ tr: "Taslak geri yüklenmeden önce", en: "Before restoring draft" }));
      if (yedek.error && eski) {
        showToast("error", yedek.error);
        return;
      }
      /*
        Taslak editörün kendi biçiminde yazılıyor, ama başka bir sürümden
        kalmış olabilir: setContent tanımadığı düğümde belgeyi BOŞALTIR.
        Önce hazırlanır; kurulamıyorsa geri yükleme yapılmaz.
      */
      const hazir = korunacakIcerigiHazirla(draftOffer.content, editor.schema);
      if (hazir.durum === "acilamadi") {
        showToast("error", t({ tr: "Taslak bu editörde açılamadı; geri yüklenmedi. Sunucudaki metin değişmedi.", en: "The draft could not be opened in this editor and was not restored. The server copy is unchanged." }));
        return;
      }
      editor.commands.setContent(hazir.icerik as object);
      setDraftOffer(null);
      showToast("success", t({ tr: "Kaydedilmemiş değişiklikleriniz geri yüklendi.", en: "Your unsaved changes were restored." }));
    } catch {
      showToast("error", t({ tr: "Bağlantı sorunu nedeniyle geri yüklenemedi.", en: "Could not restore due to a connection problem." }));
    } finally {
      setTaslakYukleniyor(false);
    }
  }, [editor, draftOffer, initialUpdatedAt, projectId, t]);

  const discardDraft = useCallback(() => {
    clearDraft(projectId, kullaniciId);
    setDraftOffer(null);
  }, [projectId, kullaniciId]);

  /*
    Taslak teklifi ya da uyumsuz içerik uyarısı yanıtlanana kadar editör salt
    okunur. Eskiden teklif açıkken yazılan ilk harf kaydedilip taslağı
    siliyordu; "Geri yükle"ye basılırsa da arada yazılan metin gidiyordu.
    emitUpdate = false: setEditable varsayılan olarak belgeye dokunmadan
    "update" olayı yayınlıyor. Eskiden bu olay her açılışta (ve taslak
    teklifi reddedilince) belgenin tamamını kaydettiriyordu.
  */
  useEffect(() => {
    draftOfferRef.current = draftOffer;
    if (editor && !editor.isDestroyed) editor.setEditable(!draftOffer && !icerikUyumsuz, false);
  }, [editor, draftOffer, icerikUyumsuz]);

  const [uyumsuzYedekleniyor, setUyumsuzYedekleniyor] = useState(false);
  const uyumsuzIcerikleDevam = useCallback(async () => {
    // Açılamayan belgede editör BOŞ: kilidi açmak boş belgeyi kaydettirmek demek (düğme de gösterilmiyor).
    if (acilisDurumu === "acilamadi") return;
    setUyumsuzYedekleniyor(true);
    try {
      const yedek = await saveNamedVersion(projectId, t({ tr: "Uyumsuz içerik düzenlenmeden önce", en: "Before editing incompatible content" }));
      if (yedek.error) {
        showToast("error", yedek.error);
        return;
      }
      icerikUyumsuzRef.current = false;
      blockedRef.current = false;
      setIcerikUyumsuz(false);
    } catch {
      showToast("error", t({ tr: "Bağlantı sorunu nedeniyle yedeklenemedi.", en: "Could not back up due to a connection problem." }));
    } finally {
      setUyumsuzYedekleniyor(false);
    }
  }, [projectId, t, acilisDurumu]);

  /* Açılamayan belgenin sunucudan gelen hâli, kullanıcının kendi bilgisayarına (kurtarma için). */
  const hamIcerigiIndir = useCallback(() => {
    const blob = new Blob([JSON.stringify(initialContent ?? null, null, 2)], { type: "application/json" });
    const adres = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = adres;
    a.download = `arvolab-calisma-${projectId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(adres), 1000);
  }, [initialContent, projectId]);

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
    /* dil bağımlılıkta: eskiden yoktu ve dil değiştirildikten sonra Word
       indirme hataları ilk açılıştaki dilde çıkıyordu. */
  }, [projectId, saveNow, t, dil]);

  /*
    LaTeX paketi (03.11.2026): ekrandaki son hâl, yazdırmayla aynı başlık
    numaralarıyla (lib/tiptap-latex.ts). Kaydetmeye bağlı değil — dosya
    tarayıcıda üretiliyor — ama kaydedilmemiş metin uyarısı Word'deki gibi
    gereksiz: indirilen, editörde görülendir.
  */
  const [latexHazirlaniyor, setLatexHazirlaniyor] = useState(false);
  const [kaynakBulAcik, setKaynakBulAcik] = useState(false);
  const [kaynakBulCumle, setKaynakBulCumle] = useState("");
  const handleLatex = async () => {
    if (!editor) return;
    setLatexHazirlaniyor(true);
    try {
      const { latexPaketiniIndir } = await import("./latex-paketi");
      const sonuc = await latexPaketiniIndir(editor.getJSON(), projectId, {
        baslik: coverPage.title?.trim() || projectDefaults?.title || t({ tr: "Çalışma", en: "Work" }),
        dil: belgeDili,
        headingNumbering,
        chapterNewPage: guideline?.settings.chapterNewPage ?? false,
        numarasiz: guideline?.settings.unnumberedSections,
        kenarCm: margins,
        puntoPt: guideline?.settings.fontSizePt,
        satirAraligi: guideline?.settings.lineSpacing,
      });
      const notlar = [
        sonuc.atlananGorsel ? t({ tr: `${sonuc.atlananGorsel} görsel indirilemedi`, en: `${sonuc.atlananGorsel} images couldn't be downloaded` }) : "",
        sonuc.kaynakSayisi === null ? t({ tr: "kaynaklar okunamadığı için .bib eklenmedi", en: "the .bib file was left out because sources couldn't be read" }) : "",
      ].filter(Boolean);
      showToast(
        notlar.length ? "error" : "success",
        notlar.length
          ? t({ tr: `LaTeX paketi indirildi; ${notlar.join(", ")}.`, en: `LaTeX package downloaded; ${notlar.join(", ")}.` })
          : t({ tr: "LaTeX paketi indirildi; Overleaf'te \"Yeni proje → ZIP yükle\" ile açabilirsiniz.", en: "LaTeX package downloaded; open it in Overleaf with \"New project → Upload ZIP\"." }),
      );
    } catch (hata) {
      console.error(hata);
      showToast("error", t({ tr: "LaTeX paketi hazırlanamadı.", en: "The LaTeX package couldn't be prepared." }));
    } finally {
      setLatexHazirlaniyor(false);
    }
  };

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

  /* Kılavuzun ön sayfaları bir kez eklenir (aşağıda kilavuzOnSayfalariniEkle). */
  const onSayfaOtoRef = useRef(false);
  const kilavuzOnSayfalariniEkleRef = useRef<() => void>(() => undefined);

  const acceptGuidelineSettings = useCallback(() => {
    if (!guideline) return;
    if (guideline.settings.margins) setMargins(guideline.settings.margins);
    if (guideline.settings.pageSize) setPageSize(guideline.settings.pageSize);
    if (guideline.settings.showPageNumbers !== undefined) setShowPageNumbers(guideline.settings.showPageNumbers);
    if (guideline.settings.headingNumbering !== undefined) setHeadingNumbering(guideline.settings.headingNumbering);
    setSettingsSource({ guidelineId: guideline.id, version: guideline.version, customized: false });
    setSyncMode("current");
    showToast("success", t({ tr: "Sayfa ayarları kılavuzun güncel sürümüne göre güncellendi.", en: "Page settings were updated to the guideline's current version." }));
    onSayfaOtoRef.current = true;
    kilavuzOnSayfalariniEkleRef.current();
  }, [guideline, t]);

  const keepOwnSettings = useCallback(() => {
    if (!guideline) return;
    setSettingsSource({ guidelineId: guideline.id, version: guideline.version, customized: true });
    setSyncMode("current");
    // Sayfa ayarlarını korumak ön sayfalardan vazgeçmek değil.
    onSayfaOtoRef.current = true;
    kilavuzOnSayfalariniEkleRef.current();
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
  /*
    Atıf türü ve dipnot metinleri (4.3.5, B5): "bekleyen kaynaklar" kartı
    stili Kaynaklar sayfasıyla aynı yerden sınıflandırır. Eskiden yalnızca
    IEEE/Vancouver numaralı sayılıyor, dipnotlu stil yazar-tarih sanılıyordu.
  */
  useEffect(() => {
    const aranan = acilacakBaslikRef.current;
    if (!editor || !aranan) return;
    acilacakBaslikRef.current = null;
    const basliklar = collectHeadings(editor.state.doc);
    const sira = baslikSirasi(basliklar, aranan);
    if (sira >= 0) window.requestAnimationFrame(() => !editor.isDestroyed && jumpToHeading(editor, basliklar[sira]));
  }, [editor]);

  /* Makale: dergi sınırı maddeleri canlı belgeden; belge değiştikçe (docStats) yeniden. */
  const makaleTeslim = useMemo(
    () => (editor && docStats && makaleProfili !== undefined ? makaleTeslimGirdisi(makaleProfili, editor.getJSON(), dil) : undefined),
    [editor, docStats, makaleProfili, dil],
  );
  const dipnotMetinleri = useMemo(() => (docStats ? docStats.footnotes.map((f) => f.text) : []), [docStats]);
  const govdeMetni = useMemo(
    () => (editor && docStats ? splitBodyAndReferences(`\n${editor.getText({ blockSeparator: "\n" })}\n`).bodyText : ""),
    [editor, docStats],
  );

  /*
    KILAVUZUN ÖN SAYFALARI KENDİLİĞİNDEN (03.11.2026). Kılavuz Özet,
    Abstract, Yemin Metni gibi ön sayfalar istiyorsa, kılavuz bu metne
    İLK KEZ uygulandığında (ya da yeni sürümü geldiğinde) eksik olanlar
    şablonlarıyla yerlerine eklenir; boş belgede bütün taslak kurulur.
    Eskiden öğrenci bunları "Ön sayfalar" kutusundan tek tek eklemek
    zorundaydı ve çoğu fark etmiyordu.

    Bir kez: ölçüt, metne kayıtlı kılavuz damgasının (settingsSource)
    uygulanan kılavuzdan farklı olması. Damga bir sonraki kayıtta
    yazıldığı için öğrencinin sildiği sayfa her açılışta geri gelmez.
    Sayfa ayarı teklif edilen ("offer") durumda ekleme, öğrenci teklife
    cevap verince yapılır.
  */
  const kilavuzOnSayfalariniEkle = useCallback(() => {
    if (!editor || !guideline) return;
    const istenen = kilavuzOnSayfalari(guideline.requiredSections);
    if (!istenen.length) return;
    const veri = {
      kapak: coverPage,
      dil: belgeDili,
      ozet: guideline.settings.abstract,
      basliklar: kilavuzOnSayfaAdlari(guideline.requiredSections),
      calismaBasligi: coverPage.title,
    };
    if (editor.isEmpty) {
      applyTemplate(editor, guideline.requiredSections, veri);
      markDirtyRef.current();
      showToast(
        "success",
        t({
          tr: "Kılavuzunuzun bölümleriyle taslak kuruldu; ön sayfalardaki [ … ] yerlerini doldurun.",
          en: "An outline was built from your guideline's sections; fill in the [ … ] places on the front pages.",
        }),
      );
      return;
    }
    const eklenen = insertFrontMatter(editor, istenen, veri);
    if (!eklenen) return;
    markDirtyRef.current();
    showToast(
      "success",
      t({
        tr: `Kılavuzunuzun istediği ${eklenen} ön sayfa yerine eklendi; [ … ] yerlerini doldurun.`,
        en: `${eklenen} front matter page${eklenen === 1 ? "" : "s"} required by your guideline added in place; fill in the [ … ] places.`,
      }),
    );
  }, [editor, guideline, coverPage, belgeDili, t]);

  useEffect(() => {
    kilavuzOnSayfalariniEkleRef.current = kilavuzOnSayfalariniEkle;
  }, [kilavuzOnSayfalariniEkle]);
  useEffect(() => {
    if (!editor || !guideline || onSayfaOtoRef.current || guidelineSync.mode === "offer") return;
    const yeniKilavuz = guidelineSync.source.guidelineId !== guideline.id || guidelineSync.source.version !== guideline.version;
    if (!yeniKilavuz) return;
    onSayfaOtoRef.current = true;
    kilavuzOnSayfalariniEkle();
  }, [editor, guideline, guidelineSync, kilavuzOnSayfalariniEkle]);

  /*
    Araç çubuğunun daralması (UX S3+S4, lib/arac-cubugu.ts). Grupların
    genişliği görünürken ölçülüp saklanır; gizli grubun genişliği son
    ölçülen. Çubuk ya da bir grup boy değiştirince (panel açıldı, ekran
    döndü, imleç tabloya girdi) yeniden karar verilir.
  */
  const aracCubuguRef = useRef<HTMLDivElement>(null);
  const aracGenislikleri = useRef(new Map<AracGrubuAnahtari, number>());
  const [gizliGruplar, setGizliGruplar] = useState<AracGrubuAnahtari[]>([]);
  const editorHazir = Boolean(editor);
  useLayoutEffect(() => {
    const kok = aracCubuguRef.current;
    if (!kok) return;
    const hesapla = () => {
      const stil = getComputedStyle(kok);
      const aralik = parseFloat(stil.columnGap) || 0;
      for (const el of kok.querySelectorAll<HTMLElement>("[data-arac-grup]")) {
        if (!el.hidden && el.offsetWidth) aracGenislikleri.current.set(el.dataset.aracGrup as AracGrubuAnahtari, el.offsetWidth + aralik);
      }
      const sabit = kok.querySelector<HTMLElement>("[data-arac-sabit]");
      const kullanilabilir = kok.clientWidth - (parseFloat(stil.paddingLeft) || 0) - (parseFloat(stil.paddingRight) || 0);
      const gruplar = ARAC_GRUPLARI.flatMap((g) => {
        const genislik = aracGenislikleri.current.get(g.anahtar);
        return genislik === undefined ? [] : [{ ...g, genislik }];
      });
      const yeni = gizlenecekGruplar(gruplar, kullanilabilir, (sabit?.offsetWidth ?? 0) + aralik);
      setGizliGruplar((onceki) => (onceki.join() === yeni.join() ? onceki : yeni));
    };
    hesapla();
    const gozcu = new ResizeObserver(hesapla);
    gozcu.observe(kok);
    kok.querySelectorAll("[data-arac-grup]").forEach((el) => gozcu.observe(el));
    return () => gozcu.disconnect();
  }, [editorHazir]);

  /*
    METİN SÜTUNU (V4.3-C1, K-4; lib/belge-sutunu.ts). Kılavuz kenar
    boşluklarını tanımlıyorsa sütun belgenin sayfa düzeninden (kâğıt −
    sol − sağ, cm); tanımlamıyorsa CSS'in 638 px varsayılanı. Değişken
    satır içi stil yazılmadan (check:css) kabuğa verilir; ölçü değişince
    (sayfa düzeni penceresi) çizimden önce güncellenir, sütun bir kare
    bile eski genişlikte görünmez.
  */
  const belgeKabiRef = useRef<HTMLDivElement>(null);
  const sutunDegeri = belgeSutunuDegeri(
    belgeSutunuCm({ kilavuzOlcusuVar: Boolean(guideline?.settings.margins), margins, pageSize }),
  );
  useLayoutEffect(() => {
    const kap = belgeKabiRef.current;
    if (!kap) return;
    if (sutunDegeri) kap.style.setProperty("--belge-sutun", sutunDegeri);
    else kap.style.removeProperty("--belge-sutun");
  }, [sutunDegeri, editorHazir]);

  /*
    YAZIM RAYI (V4.3-C1, lib/os/kirilimlar.ts → yazimRayiGerekli). Panel
    belgenin yanındayken geniş kenar çubuğuyla sütun sığmıyorsa kenar
    çubuğu bu sayfada raya iner: <html data-yazim-ray>, gezinme ve CSS
    (os-shell.css) bunu daraltılmış hâl gibi okur. Kullanıcının tercihi
    (localStorage) yazılmaz; panel kapanınca, odak modunda, sayfadan
    çıkınca ya da yer açılınca kendiliğinden kalkar.
    ESKİDEN: 1280 px'te panel açılınca sütun 860'tan 514'e iniyor, belge
    yeniden kırılıyordu (C1 öncesi ölçüm).
  */
  const panelYerlesik = bicim === "sutun" && panelAcik && !odak;
  useEffect(() => {
    const html = document.documentElement;
    const pm = editor?.view.dom as HTMLElement | undefined;
    if (!panelYerlesik || !pm) {
      html.removeAttribute("data-yazim-ray");
      return;
    }
    const hesapla = () => {
      const kok = getComputedStyle(html);
      const stil = getComputedStyle(pm);
      const sutun = cssUzunlugu(stil.getPropertyValue("--belge-sutun-etkin").trim()) ?? 638;
      const payMin = cssUzunlugu(kok.getPropertyValue("--belge-pay-min").trim()) ?? 24;
      const kenarFarki = (cssUzunlugu(kok.getPropertyValue("--kenar-genis").trim()) ?? 236) - (cssUzunlugu(kok.getPropertyValue("--ray").trim()) ?? 64);
      const gerekli = yazimRayiGerekli({
        panelYerlesik: true,
        kenarDar: html.getAttribute("data-kenar") === "dar",
        rayAcik: html.hasAttribute("data-yazim-ray"),
        kap: pm.getBoundingClientRect().width,
        sutun,
        payMin,
        kenarFarki,
      });
      if (gerekli !== html.hasAttribute("data-yazim-ray")) html.toggleAttribute("data-yazim-ray", gerekli);
    };
    hesapla();
    const gozcu = new ResizeObserver(hesapla);
    gozcu.observe(pm);
    return () => {
      gozcu.disconnect();
      html.removeAttribute("data-yazim-ray");
    };
  }, [panelYerlesik, editor, sutunDegeri]);

  if (!editor) return <div className="manuscript-editor-shell manuscript-editor-loading" aria-busy="true" />;
  const eylemHedefi = document.getElementById("yazma-eylemleri");
  const durumHedefi = document.getElementById("yazma-durum");
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
    pageSize,
  });
  const sayfaBasiKelime = wordsPerPage({
    fontSizePt: guideline?.settings.fontSizePt,
    lineSpacing: guideline?.settings.lineSpacing,
    margins,
    pageSize,
  });
  const pageTone = pageRangeTone(pages, guideline?.minPages ?? null, guideline?.maxPages ?? null);

  // Yazım temposu: sayfa hedefine kalan kelime ve teslim tarihine göre günlük hedef
  const pace = writingPace({
    words: stats.words,
    minPages: guideline?.minPages ?? null,
    maxPages: guideline?.maxPages ?? null,
    dueDate,
    status: projectStatus,
    settings: { fontSizePt: guideline?.settings.fontSizePt, lineSpacing: guideline?.settings.lineSpacing, margins, pageSize },
  }, dil);

  // Teslim kontrolü: editördeki denetimlerin tek listede özeti (lib/submission-checklist.ts)
  const missingSections = sections.filter((item) => !item.heading).map((item) => item.section);
  const checklist = buildSubmissionChecklist({
    isThesis,
    /* Metin yalnızca onaylı kayıtta gerekiyor (karar sayısı metinde mi); her çizimde
       bütün belgenin metnini kurmamak için. */
    etik: etikTeslimSatiri(etik, etik?.durum === "onaylandi" ? editor.getText() : ""),
    hasGuideline: Boolean(guideline),
    hasInstitution: kurumGirili,
    guidelineVerified: guideline?.dogrulandi,
    sections: { total: sections.length, missing: missingSections },
    pages,
    minPages: guideline?.minPages ?? null,
    maxPages: guideline?.maxPages ?? null,
    words: stats.words,
    wordLimit: guideline?.settings.thesisWords,
    /* Makalede kelime sınırı kılavuzdan değil dergi profilinden (makaleTeslim). */
    makale: makaleTeslim,
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
    pageSetup: sayfaDuzeniFarklari({ margins, pageSize, showPageNumbers, kilavuz: guideline?.settings }, dil),
    saveState,
  }, dil);
  const handleChecklistAction = (action: ChecklistAction) => {
    switch (action) {
      case "link-guideline":
        window.open(editHref, "_self");
        break;
      /* Kurum girili ama katalogda karşılığı yok: kılavuz penceresi
         Çalışmalarım'daki kartta açılır (?kilavuz=1). Ayarlara göndermek,
         hiçbir şeyi değiştirmeyen bir ekrana göndermekti. */
      case "upload-guideline":
        window.open(`/dashboard/editor?sec=${encodeURIComponent(projectId)}&kilavuz=1`, "_self");
        break;
      /*
        ÖNCE BELGE GÖRÜNÜR OLUR, SONRA EKLENİR.

        insertSections eklenen ilk bölüme kaydırıp imleci oraya
        koyuyor — yani öğrenciyi yazacağı yere bırakıyor. Liste eskiden
        kipli bir penceredeydi ve açık kalırken bunun hiçbiri
        görünmüyordu: öğrenci "ekle"ye basıyor, iş gerçekten yapılıyor
        ama ekranda bir şey değişmiyordu. Liste artık yazım panelinde;
        masaüstünde belge yanında görünür, tablet ve telefonda panel
        belgenin üstünde olduğu için önce kapanıyor (sayfaysaKapat).

        setTimeout, panel kapanıp odak açan düğmeye döndükten SONRA
        imleç belgeye gitsin diye: aynı olayda çağırsaydık odak son
        olarak panelin geri verdiği yere giderdi.
      */
      case "insert-sections": {
        if (!missingSections.length) break;
        const eklenecek = missingSections;
        sayfaysaKapat();
        window.setTimeout(() => handleInsertSections(eklenecek), 0);
        break;
      }
      case "open-issues":
        setIssuesOpen(true);
        break;
      case "open-cover":
        sayfaysaKapat();
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
        if (guideline?.settings.pageSize) setPageSize(guideline.settings.pageSize);
        if (guideline?.settings.showPageNumbers !== undefined) setShowPageNumbers(guideline.settings.showPageNumbers);
        showToast("success", t({ tr: "Sayfa düzeni kılavuza göre ayarlandı.", en: "Page layout set according to the guideline." }));
        break;
      /* Bu da imleci belgeye taşıyor: aynı gerekçeyle önce pencere kapanıyor. */
      case "strip-manual-numbers":
        sayfaysaKapat();
        window.setTimeout(() => editor.chain().focus().stripManualHeadingNumbers().run(), 0);
        break;
      case "open-article-details":
        window.open(`/dashboard/editor/${encodeURIComponent(projectId)}/makale`, "_self");
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
    /* Ön sayfa olan bölüm (Özet, Yemin Metni…) şablonuyla ve kendi yerine
       gelir; eskiden düz başlık olarak sonraki bölümün önüne ekleniyordu. */
    const onSayfaIdleri = list.map(onSayfaAdiKimligi).filter((id): id is OnSayfaKimligi => id !== null);
    if (onSayfaIdleri.length) {
      insertFrontMatter(editor, onSayfaIdleri, {
        kapak: coverPage,
        dil: belgeDili,
        ozet: guideline?.settings.abstract,
        basliklar: kilavuzOnSayfaAdlari(requiredSections),
        calismaBasligi: coverPage.title,
      });
    }
    insertSections(
      editor,
      requiredSections.filter((b) => onSayfaAdiKimligi(b) === null),
      list.filter((b) => onSayfaAdiKimligi(b) === null),
    );
    showToast(
      "success",
      list.length > 1
        ? t({ tr: `${list.length} bölüm kılavuz sırasına göre eklendi.`, en: `${list.length} sections added in guideline order.` })
        : t({ tr: `"${list[0]}" bölümü eklendi.`, en: `Section "${list[0]}" added.` })
    );
  };
  /* Ön sayfalar (lib/on-sayfalar.ts): kapak bilgisi kapak açık olmasa da doldurmak için kullanılır. */
  const handleOnSayfalar = (idler: OnSayfaKimligi[]) => {
    const eklenen = insertFrontMatter(editor, idler, {
      kapak: coverPage,
      dil: belgeDili,
      ozet: guideline?.settings.abstract,
      basliklar: kilavuzOnSayfaAdlari(requiredSections),
      calismaBasligi: coverPage.title,
    });
    showToast(
      eklenen ? "success" : "error",
      eklenen
        ? t({ tr: `${eklenen} ön sayfa yerine eklendi; [ … ] yerlerini doldurun.`, en: `${eklenen} front matter pages added in place; fill in the [ … ] places.` })
        : t({ tr: "Seçilen sayfalar belgede zaten var.", en: "The selected pages are already in the document." }),
    );
  };
  const handleTemplate = () => {
    applyTemplate(editor, requiredSections, {
      kapak: coverPage,
      dil: belgeDili,
      ozet: guideline?.settings.abstract,
      basliklar: kilavuzOnSayfaAdlari(requiredSections),
    });
    showToast("success", t({ tr: "Kılavuzun bölümleriyle taslak oluşturuldu.", en: "An outline was created from the guideline's sections." }));
  };
  const handleFindText = (text: string) => {
    if (!selectText(editor, text)) {
      showToast("error", t({ tr: "Bu ifade metinde bulunamadı; değiştirilmiş olabilir.", en: "This phrase was not found in the text; it may have been changed." }));
    }
  };
  /*
    CSL stilinde (03.11.2026) atıfı citeproc yazar; `style` o stile en
    yakın yerleşik aile — yalnızca pencere açıklaması ve "numaralı mı"
    kararı için, metne giren biçim için değil.
  */
  const csl = cslCoz(citationStyle);
  const CSL_AILESI: Record<CslKodu, CitationStyle> = { a: "apa7", k: "ieee", p: "vancouver", s: "vancouver", d: "dipnot", y: "mla" };
  const style: CitationStyle = csl
    ? CSL_AILESI[csl.kod]
    : CITATION_STYLES.includes(citationStyle as CitationStyle)
      ? (citationStyle as CitationStyle)
      : "apa7";
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
  const handleCite = async (source: LiteratureSource, secenek: { sayfa?: string | null } = {}) => {
    /* Erişim tarihi künyeye girer: belgenin dilinde yazılır. */
    const bugun = new Intl.DateTimeFormat(YEREL[belgeDili], { timeZone: "Europe/Istanbul" }).format(new Date());
    let hazir: { atif: { text: string; italic?: boolean }[]; kunye: { text: string; italic?: boolean }[]; dipnot: boolean } | undefined;
    if (csl) {
      /*
        Sunucuya gidilirken imleç yerinde kalır: insertCitation yine
        editörün o anki seçimine yazar. Numara gidişten ÖNCE alınır;
        arada başka bir atıf eklenmesi (çift tık) aynı numarayı verir ama
        künye başlıkla tanındığı için ikinci kez yazılmaz.
      */
      const { number } = atifSirasi(editor.state.doc, source);
      const sonuc = await cslAtifUret({
        stil: citationStyle,
        kaynak: source,
        numara: number,
        sayfa: secenek.sayfa,
        kisa: csl.kod === "d" && oncekiDipnottaVar(editor, source),
        dil: belgeDili,
        erisim: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date()),
      }).catch(() => ({ hata: t({ tr: "Atıf stili sunucusuna ulaşılamadı.", en: "Couldn't reach the citation style server." }) }) as { hata: string; atif?: undefined; kunye?: undefined });
      if (sonuc.hata || !sonuc.atif) {
        showToast("error", sonuc.hata ?? t({ tr: "Atıf üretilemedi.", en: "The citation couldn't be produced." }));
        return;
      }
      hazir = { atif: sonuc.atif, kunye: sonuc.kunye ?? [], dipnot: csl.kod === "d" };
    }
    const { citation, addedReference } = insertCitation(editor, source, style, {
      sayfa: secenek.sayfa,
      erisimTarihi: bugun,
      kalip: ornekKalibi(ornekAtif),
      dil: belgeDili,
      hazir,
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
    clearDraft(projectId, kullaniciId);
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

  /* Panelin sekmeleri; Teslim sekmesi hazır madde sayısını taşır (eskiden başlıktaki "Teslim kontrolü 1/5" düğmesi). */
  const panelSekmeleri: PanelSekmesi[] = [
    { id: "asistan", etiket: "Arvo AI", ikon: Sparkles },
    { id: "inceleme", etiket: t({ tr: "İnceleme", en: "Review" }), ikon: FileSearch },
    { id: "kaynaklar", etiket: t({ tr: "Kaynaklar", en: "Sources" }), ikon: BookMarked },
    { id: "teslim", etiket: t({ tr: "Teslim", en: "Submission" }), ikon: ClipboardCheck, rozet: `${checklist.done}/${checklist.total}` },
  ];

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
              ? t({ tr: `Kaydedildi · ${saatEtiketi(lastSavedAt, dil, saatDilimi)}`, en: `Saved · ${saatEtiketi(lastSavedAt, dil, saatDilimi)}` })
              : t({ tr: "Otomatik kayıt açık", en: "Autosave on" });

  /*
    ARAÇ ÇUBUĞU GRUPLARI (UX S3+S4): her grubun içeriği bir kez yazılı ve
    TEK yerde çizilir: sığıyorsa çubukta, sığmıyorsa "⋯" menüsünün başında
    (karar lib/arac-cubugu.ts). Eskiden çubuk gizli kaydırma çubuğuyla yana
    kayıyor, panel açıkken sondaki araçlar görünür alanın dışında kalıyordu.
  */
  const gizliAraclar = new Set(gizliGruplar);
  /*
    Geri al ve Yinele ayrı gruplar (UX mobil, 07.11.2026): telefonda (360,
    390) ikisi birlikte "⋯"ye gidiyordu. Geri al en son çıkanlardan; Yinele
    daha seyrek, dar ekranda "⋯"de (masaüstünde Ctrl+Y her yerde çalışıyor).
  */
  const aracGeriAl = (
    <div className="arac-segment" role="group" aria-label={t({ tr: "Geri al", en: "Undo" })}>
      <ToolbarButton label={t({ tr: "Geri al (Ctrl+Z)", en: "Undo (Ctrl+Z)" })} disabled={!ui.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={16} />
      </ToolbarButton>
    </div>
  );
  const aracYinele = (
    <div className="arac-segment" role="group" aria-label={t({ tr: "Yinele", en: "Redo" })}>
      <ToolbarButton label={t({ tr: "Yinele (Ctrl+Y)", en: "Redo (Ctrl+Y)" })} disabled={!ui.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={16} />
      </ToolbarButton>
    </div>
  );
  const aracYazi = (
    <>
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
    </>
  );
  const aracBicim = (
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
          </div>
  );
  const aracUst = (
    <div className="arac-segment" role="group" aria-label={t({ tr: "Üst simge", en: "Superscript" })}>
          <ToolbarButton label={t({ tr: "Üst simge (Ctrl+Shift+=)", en: "Superscript (Ctrl+Shift+=)" })} active={ui.superscript} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
            <SuperscriptIcon size={16} />
          </ToolbarButton>
    </div>
  );
  const aracStil = (
          <select
            className="toolbar-select arac-paragraf-stili"
            title={t({ tr: "Paragraf stili (Ctrl+Alt+0…3)", en: "Paragraph style (Ctrl+Alt+0…3)" })}
            aria-label={t({ tr: "Paragraf stili", en: "Paragraph style" })}
            value={ui.heading ? String(ui.heading) : "0"}
            onChange={(e) => {
              const level = Number(e.target.value);
              if (level === 1 || level === 2 || level === 3) editor.chain().focus().setHeading({ level }).run();
              else editor.chain().focus().setParagraph().run();
            }}
          >
            <option value="0">{t({ tr: "Normal metin", en: "Normal text" })}</option>
            <option value="1">{t({ tr: "Başlık 1", en: "Heading 1" })}</option>
            <option value="2">{t({ tr: "Başlık 2", en: "Heading 2" })}</option>
            <option value="3">{t({ tr: "Başlık 3", en: "Heading 3" })}</option>
          </select>
  );
  const aracListe = (
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
  );
  const aracParagraf = (
    <>
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
    </>
  );
  const aracEkle = (
    <>
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
          <ToolbarButton label={t({ tr: "Dipnot ekle (Ctrl+Alt+F)", en: "Insert footnote (Ctrl+Alt+F)" })} metin={t({ tr: "Dipnot", en: "Footnote" })} onClick={() => setFootnoteDialog({ mode: "insert", text: "" })}>
            <StickyNote size={16} />
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
    </>
  );
  const aracTablo = (
    <>
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
    </>
  );
  const aracAtif = (
          <ToolbarButton label={t({ tr: "Kaynaktan atıf ekle", en: "Cite a source" })} metin={t({ tr: "Atıf", en: "Citation" })} onClick={() => setCiteOpen(true)}>
            <BookMarked size={16} />
          </ToolbarButton>
  );
  const tumAraclar: { anahtar: AracGrubuAnahtari; baslik: string; icerik: React.ReactNode }[] = [
    { anahtar: "geriAl", baslik: t({ tr: "Geri al", en: "Undo" }), icerik: aracGeriAl },
    { anahtar: "yinele", baslik: t({ tr: "Yinele", en: "Redo" }), icerik: aracYinele },
    { anahtar: "yazi", baslik: t({ tr: "Yazı", en: "Font" }), icerik: aracYazi },
    { anahtar: "bicim", baslik: t({ tr: "Yazı biçimi", en: "Text style" }), icerik: aracBicim },
    { anahtar: "ust", baslik: t({ tr: "Üst simge", en: "Superscript" }), icerik: aracUst },
    { anahtar: "stil", baslik: t({ tr: "Paragraf stili", en: "Paragraph style" }), icerik: aracStil },
    { anahtar: "liste", baslik: t({ tr: "Liste ve alıntı", en: "Lists and quotes" }), icerik: aracListe },
    { anahtar: "paragraf", baslik: t({ tr: "Paragraf", en: "Paragraph" }), icerik: aracParagraf },
    { anahtar: "ekle", baslik: t({ tr: "Ekle", en: "Insert" }), icerik: ui.inTable ? <>{aracEkle}{aracTablo}</> : aracEkle },
    { anahtar: "atif", baslik: t({ tr: "Atıf", en: "Citation" }), icerik: aracAtif },
    { anahtar: "odak", baslik: t({ tr: "Görünüm", en: "View" }), icerik: (
          <ToolbarButton
            label={odak ? t({ tr: "Odak modundan çık (Esc)", en: "Exit focus mode (Esc)" }) : t({ tr: "Odak modu: yalnızca metin", en: "Focus mode: just the text" })}
            metin={odak ? t({ tr: "Odak modundan çık", en: "Exit focus mode" }) : t({ tr: "Odak modu", en: "Focus mode" })}
            active={odak}
            onClick={() => setOdak((o) => !o)}
          >
            {odak ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </ToolbarButton>
    ) },
  ];
  const menudeGizliAraclar = tumAraclar.filter((g) => gizliAraclar.has(g.anahtar));

  return (
    <>
      {/*
        BAŞLIK SATIRI (Signature OS Phase 2). Başlık sunucu bileşeninde
        (page.tsx), kayıt durumu ve belge işlemleri editörün durumuna
        bağlı; başlıktaki #yazma-durum ve #yazma-eylemleri kutularına
        portal ile yerleşiyorlar. Editör yalnızca tarayıcıda kurulduğu
        için bu satıra gelindiğinde document hep var.

        Eskiden burada "Teslim kontrolü 1/5", "Dışa aktar" ve birincil
        "Kılavuz ve kaynakça kontrolü" vardı; paylaşım "Belge" menüsünün
        içindeydi. Teslim kontrolü ve kılavuz kontrolü yazım panelinin
        "Teslim" görünümüne taşındı (listenin yanında, sonucuyla birlikte);
        başlıkta belgenin kendisiyle yapılanlar kaldı: paylaş, dışa aktar
        ve paneli açan Arvo AI.
      */}
      {durumHedefi
        ? createPortal(
            /* Kayıt durumu: tıklayınca şimdi kaydeder (Ctrl+S). Eskiden belgenin üstünde ayrı bir şeritteydi. */
            <button
              type="button"
              className="save-status"
              data-state={saveState}
              title={t({ tr: "Şimdi kaydet (Ctrl+S)", en: "Save now (Ctrl+S)" })}
              aria-live="polite"
              onClick={() => void saveNow()}
            >
              {/* Telefonda yalnız renkli nokta görünür; metin ekran okuyucuda kalır (workspace.css). */}
              <span className="save-status-metin">{statusLabel}</span>
            </button>,
            durumHedefi,
          )
        : null}
      {eylemHedefi
        ? createPortal(
            <>
              {/* Çalışma bölümleri (V4.3-C1, R18): tablette ve kenar çubuğu ray olduğunda; telefonda ⋮ menüsünde (calisma-seridi.tsx). */}
              <CalismaBolumMenusu />
              <button type="button" className="projects-filter-button yazma-paylas" onClick={() => setShareOpen(true)} aria-label={t({ tr: "Danışmana paylaş (salt okunur bağlantı)", en: "Share with advisor (read-only link)" })} title={t({ tr: "Danışmana paylaş (salt okunur bağlantı)", en: "Share with advisor (read-only link)" })}>
                <Share2 size={15} aria-hidden="true" />
                <span className="yazma-etiket">{t({ tr: "Paylaş", en: "Share" })}</span>
              </button>
              {/* Üç çıktı tek menüde (04.11.2026): başlık satırı tek satıra sığsın. */}
              <AracMenusu
                dugmeSinifi="projects-filter-button yazma-disa-aktar"
                ikon={<FileDown size={15} aria-hidden="true" />}
                etiket={exporting || latexHazirlaniyor ? t({ tr: "Hazırlanıyor...", en: "Preparing..." }) : t({ tr: "Dışa aktar", en: "Export" })}
                aciklama={t({ tr: "Word, PDF ya da LaTeX olarak indir", en: "Download as Word, PDF or LaTeX" })}
              >
                <button type="button" className="arac-menu-oge" onClick={handleExport} disabled={exporting}>
                  <FileDown size={16} aria-hidden="true" />
                  <span>{t({ tr: "Word (.docx)", en: "Word (.docx)" })}</span>
                </button>
                <button type="button" className="arac-menu-oge" onClick={() => void handlePrint()}>
                  <Printer size={16} aria-hidden="true" />
                  <span>{t({ tr: "PDF / Yazdır", en: "PDF / Print" })}</span>
                </button>
                <button type="button" className="arac-menu-oge" onClick={() => void handleLatex()} disabled={latexHazirlaniyor}>
                  <FileCode size={16} aria-hidden="true" />
                  <span>{t({ tr: "LaTeX (Overleaf)", en: "LaTeX (Overleaf)" })}</span>
                </button>
              </AracMenusu>
              {/*
                Arvo AI: yazım asistanını panelde açar; asistan zaten açıksa
                paneli kapatır. Yaptığı iş değişmedi (yazim-paneli.tsx:
                sohbette yazar, belgeye eklemek öğrencinin düğmesi).
                YUMUŞAK VURGU (Premium Simplicity Aşama 1, 08.11.2026): eskiden
                dolgu birincil düğmeydi ve yazım sayfasında gözü belgeden
                çeken en koyu öğeydi. Şimdi açık mavi zemin + mavi yazı:
                her yerde bulunur ama kâğıtla yarışmaz (workspace.css).
              */}
              <button
                type="button"
                className="projects-filter-button yazma-ai"
                aria-expanded={panelAcik && gorunum === "asistan"}
                aria-controls="yazim-yan-panel"
                onClick={() => (panelAcik && gorunum === "asistan" ? panelKapat() : panelAc("asistan"))}
              >
                <Sparkles size={15} aria-hidden="true" />
                <span>{t({ tr: "Arvo AI", en: "Arvo AI" })}</span>
              </button>
              <button
                type="button"
                className="projects-filter-button yazma-panel-dugmesi"
                aria-expanded={panelAcik}
                aria-controls="yazim-yan-panel"
                aria-label={panelAcik ? t({ tr: "Yazım panelini kapat", en: "Close writing panel" }) : t({ tr: "Yazım panelini aç", en: "Open writing panel" })}
                title={panelAcik ? t({ tr: "Yazım panelini kapat", en: "Close writing panel" }) : t({ tr: "Yazım panelini aç", en: "Open writing panel" })}
                onClick={() => (panelAcik ? panelKapat() : panelAc(gorunum))}
              >
                {panelAcik ? <PanelRightClose size={16} aria-hidden="true" /> : <PanelRightOpen size={16} aria-hidden="true" />}
              </button>
              {/*
                TELEFONDA BELGE MENÜSÜ (Premium Simplicity Aşama 1, 08.11.2026).
                Eskiden telefonda başlığın altında dört simge düğme (paylaş,
                dışa aktar, Arvo AI, panel) ayrı bir satır kaplıyordu; başlık
                da iki satırdı ve yazı ekranın ortasında başlıyordu. Şimdi
                başlık tek satır ve yanında yalnızca Arvo AI ile bu menü:
                paylaşım, üç çıktı ve yazım paneli burada. İşlev kalkmadı;
                masaüstünde menü yok, düğmeler eskisi gibi (CSS).
              */}
              <AracMenusu
                dugmeSinifi="projects-filter-button yazma-belge-menu"
                /* Dikey üç nokta: hemen altındaki araç çubuğunun "⋯"si ile karışmasın. */
                ikon={<MoreVertical size={18} aria-hidden="true" />}
                etiket={t({ tr: "Çalışma bölümleri ve belge: paylaş, dışa aktar, yazım paneli", en: "Work sections and document: share, export, writing panel" })}
                etiketiGizle
              >
                {/*
                  Çalışmanın TAM adı (Aşama 1 takip, R1, 08.11.2026): telefonda
                  başlık tek satırda kesiliyor ve tam ad yalnız title'daydı
                  (dokunmatikte görünmez). Salt okunur bilgi satırı: odak
                  almaz, ok tuşlarıyla gezilen öğelerden değil; ekran okuyucu
                  menünün başında okur, metin seçilip kopyalanabilir.
                */}
                {projectDefaults?.title ? (
                  <p className="yazma-belge-ad">
                    <span className="sr-only">{t({ tr: "Çalışma: ", en: "Work: " })}</span>
                    {projectDefaults.title}
                  </p>
                ) : null}
                {/* R18 (V4.3-C1): telefonda çalışma bölümleri burada, yeni bir çubuk yerine. */}
                <CalismaBolumOgeleri />
                <hr className="arac-menu-ayrac" />
                <button type="button" className="arac-menu-oge" onClick={() => setShareOpen(true)}>
                  <Share2 size={16} aria-hidden="true" />
                  <span>{t({ tr: "Danışmana paylaş", en: "Share with advisor" })}</span>
                </button>
                <button type="button" className="arac-menu-oge" onClick={handleExport} disabled={exporting}>
                  <FileDown size={16} aria-hidden="true" />
                  <span>{t({ tr: "Word (.docx)", en: "Word (.docx)" })}</span>
                </button>
                <button type="button" className="arac-menu-oge" onClick={() => void handlePrint()}>
                  <Printer size={16} aria-hidden="true" />
                  <span>{t({ tr: "PDF / Yazdır", en: "PDF / Print" })}</span>
                </button>
                <button type="button" className="arac-menu-oge" onClick={() => void handleLatex()} disabled={latexHazirlaniyor}>
                  <FileCode size={16} aria-hidden="true" />
                  <span>{t({ tr: "LaTeX (Overleaf)", en: "LaTeX (Overleaf)" })}</span>
                </button>
                <hr className="arac-menu-ayrac" />
                <button type="button" className="arac-menu-oge" aria-controls="yazim-yan-panel" onClick={() => (panelAcik ? panelKapat() : panelAc(gorunum))}>
                  {panelAcik ? <PanelRightClose size={16} aria-hidden="true" /> : <PanelRightOpen size={16} aria-hidden="true" />}
                  <span>{panelAcik ? t({ tr: "Yazım panelini kapat", en: "Close writing panel" }) : t({ tr: "Yazım paneli (inceleme, kaynaklar, teslim)", en: "Writing panel (review, sources, submission)" })}</span>
                </button>
              </AracMenusu>
            </>,
            eylemHedefi,
          )
        : null}
    <div className="manuscript-layout" data-inceleme={panelAcik && bicim === "sutun" ? "" : undefined} data-odak={odak ? "" : undefined}>
    <div className="manuscript-main">
      {/*
        TEK SATIR ARAÇ ÇUBUĞU (04.11.2026, kurum sahibinin isteği: Jenni'nin
        yazım ekranı örnek; "daha elit, daha akışkan").

        26.10.2026'da araçlar sol sütunda dikey kartlara alınmıştı: o zamanki
        tek çubuk kırk düğmeyi iki satıra sarıyordu ve hangisinin ne işe
        yaradığı ancak üzerine gelince anlaşılıyordu. Sütun bu sorunu çözdü
        ama metne yer bırakmadı. Yeni düzen kırk düğmeyi çubuğa dizmiyor:
        her gün kullanılanlar (geri al, yazı, biçim, başlık, liste, asistan,
        atıf) çubukta; seyrek olanlar adı yazan menülerde (Paragraf, Ekle,
        Belge). Tablo menüsü yalnızca imleç tablodayken görünür.
      */}
      <div ref={aracCubuguRef} className="manuscript-araclar" role="toolbar" aria-label={t({ tr: "Biçimlendirme", en: "Formatting" })}>
        {/* Resim seçici tek kopya: Ekle grubu çubukta da menüde de olsa aynı girdiye basar. */}
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
        <div className="arac-grup" data-arac-grup="geriAl" hidden={gizliAraclar.has("geriAl")}>
          {aracGeriAl}
        </div>
        <div className="arac-grup" data-arac-grup="yinele" hidden={gizliAraclar.has("yinele")}>
          {aracYinele}
        </div>
        {/*
          Yazı tipi ve punto bir menüde (Signature OS Phase 2): araç çubuğu
          artık belge sütununun genişliğinde ve iki geniş seçim kutusu onun
          üçte birini kaplıyordu. Akademik belgede ikisini çoğunlukla kılavuz
          belirliyor; seçim kutularının kendisi ve "Kılavuz (…)" seçeneği aynı.
        */}
        <div className="arac-grup arac-grup-yazi" data-arac-grup="yazi" hidden={gizliAraclar.has("yazi")}>
          <AracMenusu ikon={<Type size={16} />} etiket={t({ tr: "Yazı", en: "Font" })} aciklama={t({ tr: "Yazı tipi ve boyutu", en: "Font family and size" })}>
            {aracYazi}
          </AracMenusu>
        </div>
        <div className="arac-grup" data-arac-grup="bicim" hidden={gizliAraclar.has("bicim")}>
          {aracBicim}
        </div>
        <div className="arac-grup" data-arac-grup="ust" hidden={gizliAraclar.has("ust")}>
          {aracUst}
        </div>
        <div className="arac-grup" data-arac-grup="stil" hidden={gizliAraclar.has("stil")}>
          {/*
            Paragraf stili tek seçim kutusunda (Signature OS Phase 2): eskiden
            dört düğmeydi (Metin, H1, H2, H3). İşlev ve kısayollar aynı
            (Ctrl+Alt+0…3); "Metin" başlıktan normal paragrafa dönüş.
          */}
          {aracStil}
        </div>
        <div className="arac-grup" data-arac-grup="liste" hidden={gizliAraclar.has("liste")}>
          {aracListe}
        </div>
        <div className="arac-grup" data-arac-grup="paragraf" hidden={gizliAraclar.has("paragraf")}>
          <AracMenusu ikon={<AlignLeft size={16} />} etiket={t({ tr: "Paragraf", en: "Paragraph" })} aciklama={t({ tr: "Hizalama, satır aralığı, girinti", en: "Alignment, line spacing, indent" })}>
            {aracParagraf}
          </AracMenusu>
        </div>
        <div className="arac-grup" data-arac-grup="ekle" hidden={gizliAraclar.has("ekle")}>
          <AracMenusu ikon={<Plus size={16} />} etiket={t({ tr: "Ekle", en: "Insert" })} aciklama={t({ tr: "Tablo, resim, dipnot, analiz, başlık…", en: "Table, image, footnote, analysis, caption…" })}>
            {aracEkle}
          </AracMenusu>
          {/*
            Tablo kontrolleri: yalnızca imleç tablodayken. Eskiden hiç yoktu:
            tablo 3×3 ekleniyor, sütun eklemenin ya da tabloyu silmenin yolu
            yoktu. Tablo dışındayken tıklanamaz sekiz düğme kalabalıktan
            başka bir şey değil; bu yüzden menü de yalnızca tabloda görünür.
          */}
          {ui.inTable ? (
            <AracMenusu ikon={<TableIcon size={16} />} etiket={t({ tr: "Tablo", en: "Table" })}>
              {aracTablo}
            </AracMenusu>
          ) : null}
        </div>
        {/*
          Atıf çubukta kalıyor: yazarken imlece en sık eklenen şey. Asistan,
          satır içi öneri ve "cümleye kaynak bul" yazım paneline taşındı
          (Asistan ve Kaynaklar görünümleri); başlıktaki Arvo AI düğmesi
          asistanı açıyor. Eskiden dördü de burada etiketliydi ve çubuk
          dar ekranda yatay kayıyordu.
        */}
        <div className="arac-grup arac-grup-asistan" data-arac-grup="atif" hidden={gizliAraclar.has("atif")}>
          {aracAtif}
        </div>
        <div className="arac-grup" data-arac-grup="odak" hidden={gizliAraclar.has("odak")}>
          <ToolbarButton
            label={odak ? t({ tr: "Odak modundan çık (Esc)", en: "Exit focus mode (Esc)" }) : t({ tr: "Odak modu: yalnızca metin", en: "Focus mode: just the text" })}
            active={odak}
            onClick={() => setOdak((o) => !o)}
          >
            {odak ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </ToolbarButton>
        </div>
        <div className="arac-grup arac-grup-son" data-arac-sabit="">
          {/*
            "⋯": belge araçları ve çubuğa sığmayan gruplar (UX S3+S4). Erişilebilir
            adı "Bul, sayfa ayarı…" ile başlıyor; sığmayan araç varsa sonuna eklenir.
          */}
          <AracMenusu
            ikon={<MoreHorizontal size={16} />}
            etiket={t({ tr: "Belge", en: "Document" })}
            aciklama={
              menudeGizliAraclar.length
                ? t({ tr: "Bul, sayfa ayarı, kapak, sürümler, kısayollar ve diğer araçlar", en: "Find, page setup, cover, versions, shortcuts and more tools" })
                : t({ tr: "Bul, sayfa ayarı, kapak, sürümler, kısayollar", en: "Find, page setup, cover, versions, shortcuts" })
            }
            etiketiGizle
          >
            {menudeGizliAraclar.map((g) => (
              <div key={g.anahtar} className="arac-menu-bolum" role="group" aria-label={g.baslik}>
                <small className="arac-menu-baslik" aria-hidden="true">{g.baslik}</small>
                {g.icerik}
              </div>
            ))}
            {menudeGizliAraclar.length ? <hr className="arac-menu-ayrac" /> : null}
          <ToolbarButton label={t({ tr: "Bul ve değiştir (Ctrl+F)", en: "Find and replace (Ctrl+F)" })} metin={t({ tr: "Bul ve değiştir", en: "Find and replace" })} active={findOpen} onClick={() => setFindOpen((open) => !open)}>
            <Search size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Sayfa ayarları", en: "Page settings" })} metin={t({ tr: "Sayfa ayarı", en: "Page setup" })} active={showPageSettings} onClick={() => setShowPageSettings((v) => !v)}>
            <Settings2 size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Kapak sayfası", en: "Cover page" })} metin={t({ tr: "Kapak", en: "Cover" })} active={showCoverPageEditor} onClick={() => setShowCoverPageEditor((v) => !v)}>
            <FileBadge size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Sürüm geçmişi", en: "Version history" })} metin={t({ tr: "Sürümler", en: "Versions" })} onClick={() => setVersionsOpen(true)}>
            <History size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Klavye kısayolları", en: "Keyboard shortcuts" })} metin={t({ tr: "Kısayollar", en: "Shortcuts" })} onClick={() => setShortcutsOpen(true)}>
            <Keyboard size={16} />
          </ToolbarButton>
          {/*
            Gizlenen kılavuz bandını geri getirir. Durum çubuğundaki düğme
            telefonda belgenin SONUNDA ve alt çubuğun altında kalıyor; "⋯"
            her genişlikte elin altında.
          */}
          {!guideline && isThesis && kilavuzBandiGizli ? (
            <ToolbarButton label={t({ tr: "Kılavuz uyarısını göster", en: "Show guideline notice" })} metin={t({ tr: "Kılavuz bağla", en: "Link guideline" })} onClick={() => kilavuzBandiniGizle(false)}>
              <BookMarked size={16} />
            </ToolbarButton>
          ) : null}
          </AracMenusu>
        </div>
      </div>
    <div className="manuscript-editor-shell" ref={belgeKabiRef}>
      {/* Bul-değiştir belgenin üstünde, yapışık. Kayıt durumu başlık satırında (Signature OS Phase 2). */}
      {findOpen ? (
        <div className="manuscript-toolbar manuscript-ust">
          <FindReplaceBar editor={editor} onClose={() => setFindOpen(false)} />
        </div>
      ) : null}

      {acilisDurumu === "korundu" && acilis ? (
        <div className="callout editor-notice cluster" data-tone="warning" role="status" data-korunan-uyari="">
          <span>
            {t({
              tr: `Bu metinde editörün tanımadığı ${acilis.korunan.reduce((t2, k) => t2 + k.sayi, 0)} öğe var (${acilis.korunan.map((k) => k.tur).join(", ")}). Kesik çerçeveli kutularda olduğu gibi korunuyor ve kayıtta yerinde kalıyor; metnin geri kalanını düzenleyebilirsiniz.`,
              en: `This text has ${acilis.korunan.reduce((t2, k) => t2 + k.sayi, 0)} item(s) the editor does not recognise (${acilis.korunan.map((k) => k.tur).join(", ")}). They are preserved as-is in the dashed boxes and kept on save; you can edit the rest of the text.`,
            })}
          </span>
          <span className="cluster">
            <button type="button" className="projects-filter-button" onClick={() => setVersionsOpen(true)}>
              {t({ tr: "Sürüm geçmişi", en: "Version history" })}
            </button>
            <Link href="/dashboard/support" className="projects-filter-button">
              {t({ tr: "Destek", en: "Support" })}
            </Link>
          </span>
        </div>
      ) : null}

      {icerikUyumsuz && acilisDurumu === "acilamadi" ? (
        <div className="callout editor-notice cluster" data-tone="danger" role="alert" data-acilamadi-uyari="">
          <span>
            {t({
              tr: "Kayıtlı metin bu editörde açılamadı. Metniniz sunucuda olduğu gibi duruyor ve bu ekrandan üzerine hiçbir şey yazılmayacak. Önceki bir sürümü geri yükleyebilir, metnin ham kopyasını indirebilir ya da destekten yardım isteyebilirsiniz.",
              en: "The saved text could not be opened in this editor. Your text is unchanged on the server and nothing will be written over it from this screen. You can restore an earlier version, download a raw copy of the text, or ask support for help.",
            })}
          </span>
          <span className="cluster">
            <button type="button" className="projects-filter-button" onClick={() => setVersionsOpen(true)}>
              {t({ tr: "Sürüm geçmişi", en: "Version history" })}
            </button>
            <button type="button" className="projects-filter-button" onClick={hamIcerigiIndir}>
              {t({ tr: "Ham kopyayı indir", en: "Download raw copy" })}
            </button>
            <Link href="/dashboard/support" className="projects-filter-button">
              {t({ tr: "Destek", en: "Support" })}
            </Link>
          </span>
        </div>
      ) : null}

      {icerikUyumsuz && acilisDurumu !== "acilamadi" ? (
        <div className="callout editor-notice cluster" data-tone="danger" role="alert">
          <span>
            {t({
              tr: "Kayıtlı metnin bir kısmı editörde açılamadı. Metin kaybolmasın diye kayıt durduruldu; devam ederseniz önce sunucudaki hâli geçmişe yedeklenir.",
              en: "Part of the saved text could not be opened in the editor. Saving is paused so nothing is lost; if you continue, the server copy is first backed up to the history.",
            })}
          </span>
          <span className="cluster">
            <button type="button" className="projects-primary-button" disabled={uyumsuzYedekleniyor} onClick={() => void uyumsuzIcerikleDevam()}>
              {t({ tr: "Yedekle ve devam et", en: "Back up and continue" })}
            </button>
            <Link href="/dashboard/support" className="projects-filter-button">
              {t({ tr: "Destek", en: "Support" })}
            </Link>
          </span>
        </div>
      ) : null}

      {draftOffer ? (
        <div className="callout editor-notice cluster" data-tone="warning" role="status">
          <span>
            {t({
              tr: `Bu tarayıcıda kaydedilmemiş değişiklikleriniz bulundu (${tarihSaat(draftOffer.writtenAt)}).`,
              en: `Unsaved changes were found in this browser (${tarihSaat(draftOffer.writtenAt)}).`,
            })}
            {draftOffer.baseUpdatedAt !== initialUpdatedAt
              ? t({
                  tr: " Metin bu taslaktan sonra başka bir yerde değişmiş; geri yüklerseniz sunucudaki hâl önce geçmişe yedeklenir.",
                  en: " The text has changed elsewhere since this draft; if you restore, the server copy is first backed up to the history.",
                })
              : ""}{" "}
            {t({ tr: "Karar verene kadar editör salt okunur.", en: "The editor is read-only until you decide." })}
          </span>
          <span className="cluster">
            <button type="button" className="projects-primary-button" disabled={taslakYukleniyor} onClick={() => void restoreDraft()}>
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
            {/* Word'den aktar burada ayrıca bir düğme DEĞİL (4.3): yolu yukarıdaki maddede yazılı; düğme Ekle menüsünde ve boş belgenin ana hat kartında. */}
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
                  tr: " Yazdıklarınız bu tarayıcıda duruyor; plan yenilendikten sonra bu sayfayı açınca geri yüklemeniz önerilir.",
                  en: " What you wrote is kept in this browser; after renewing your plan, open this page and you will be offered to restore it.",
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

      {!oncekiAiUnutuldu && oncekiUygulamalar(projectId).length > 0 ? (
        <div className="guideline-applied-banner" data-tone="muted" role="status">
          <div>
            <strong>{t({ tr: "Asistan değişiklikleri artık buradan geri alınamaz", en: "Assistant changes can no longer be undone here" })}</strong>
            <span>
              {t({
                tr: "Sayfa yenilendiği için asistanın önceki değişiklikleri Geri al düğmesiyle ya da Ctrl+Z ile geri alınamaz; belgedeki öteki düzenlemeleriniz olduğu gibi duruyor. Önceki hâle Sürümler'den dönebilirsiniz.",
                en: "Because the page was reloaded, the assistant's earlier changes can't be undone with the Undo button or Ctrl+Z; your other edits are unchanged. You can return to an earlier state from Versions.",
              })}
            </span>
          </div>
          <div className="cluster">
            <button type="button" className="projects-filter-button" onClick={() => setVersionsOpen(true)}>
              {t({ tr: "Sürümleri aç", en: "Open versions" })}
            </button>
            <button
              type="button"
              className="projects-filter-button"
              onClick={() => {
                oncekiUygulamalariUnut(projectId);
                setOncekiAiUnutuldu(true);
              }}
            >
              {t({ tr: "Anladım", en: "Got it" })}
            </button>
          </div>
        </div>
      ) : null}

      {/* Kılavuzun adı ve "Kuralları gör" sağdaki kontrol kartında; belgenin
          üstünde yalnızca yeni sürümün UYGULANDIĞI haberi kalıyor. */}
      {guideline && syncMode === "auto-applied" ? (
        <div className="guideline-applied-banner" role="status">
          <div>
            {/* Öğrencinin kendi kılavuzunda "yeni sürüm" yok: kurallar yüklendi ya da yeniden okundu. */}
            <strong>
              {guideline.dogrulandi
                ? t({ tr: "Kılavuzun yeni sürümü uygulandı", en: "The guideline's new version was applied" })
                : t({ tr: "Kılavuzunuzun kuralları uygulandı", en: "Your guideline's rules were applied" })}
            </strong>
            <span>{kilavuzGorunenAdi(guideline.label, dil)}</span>
            <span className="guideline-meta text-sm">
              {stilAdi(guideline.citationStyle)}
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
      ) : !guideline && isThesis && !kilavuzBandiGizli ? (
        /*
          KOMPAKT VE İKİNCİL (Premium Simplicity Aşama 1, 08.11.2026).
          Eskiden iki satırlık açıklama ve DOLGU (birincil) "Kılavuzumu
          yükle" düğmesiyle yazının üstünde 66–122 px tutuyor, başlıktaki
          Arvo AI ile ekranın ikinci birincil eylemi oluyordu. Şimdi tek
          satır: durum cümlesi, iki seçeneği tek menüde toplayan ikincil
          "Kılavuz bağla" ve "Gizle". Açıklama menü öğelerinde. Kataloğunda
          kılavuzu olmayan öğrenci için asıl yol yine kendi kılavuzunu
          yüklemek (ilk öğe).
        */
        <div className="kilavuz-bandi" role="status">
          <BookMarked size={16} aria-hidden="true" className="kilavuz-bandi-simge" />
          <span className="kilavuz-bandi-metin">
            {/* Telefonda kısa biçim: uzun cümle 390 px'te yarıda kesiliyordu. */}
            <span className="kilavuz-bandi-uzun">{t({ tr: "Bu çalışmaya bağlı kılavuz yok", en: "No guideline is linked to this work" })}</span>
            <span className="kilavuz-bandi-kisa" aria-hidden="true">{t({ tr: "Kılavuz bağlı değil", en: "No guideline" })}</span>
          </span>
          <KilavuzSecenekleri projectId={projectId} editHref={editHref} dugmeSinifi="projects-filter-button button-compact kilavuz-bandi-menu" />
          <button
            type="button"
            className="kilavuz-bandi-gizle"
            aria-label={t({ tr: "Kılavuz uyarısını gizle (durum çubuğundan yeniden açılır)", en: "Hide guideline notice (reopen it from the status bar)" })}
            title={t({ tr: "Gizle", en: "Hide" })}
            onClick={() => kilavuzBandiniGizle(true)}
          >
            <X size={16} aria-hidden="true" />
          </button>
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
          {/* Kâğıt boyutu (29.10.2026): ABD ve Kanada tezleri US Letter basılıyor. */}
          <label>
            <span>{t({ tr: "Kâğıt", en: "Paper" })}</span>
            <select
              className="compact-select"
              value={pageSize}
              onChange={(e) => {
                markCustomized();
                setPageSize(kagitOku(e.target.value));
              }}
            >
              {KAGIT_BOYUTLARI.map((k) => (
                <option key={k} value={k}>
                  {t(KAGITLAR[k].ad)}
                </option>
              ))}
            </select>
          </label>
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
      <SecimAi editor={editor} panelAc={() => panelAc("asistan")} />
      <OlcumPaneli editor={editor} />

      {stats.footnotes.length > 0 ? (
        <ol
          className="footnote-list"
          aria-label={t({ tr: "Dipnotlar", en: "Footnotes" })}
          /* Kılavuzun dipnot puntosu (lib/kilavuz-bicim.ts); baskı ve Word de aynı ölçüyü kullanıyor. */
          data-kilavuz-dipnot={guideline?.settings.footnoteSizePt ? String(guideline.settings.footnoteSizePt) : undefined}
        >
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

      {/*
        DURUM ÇUBUĞU (Signature OS Phase 2): kelime, karakter, tahmini sayfa
        ve otomatik kaydın durumu belgenin altında, hep görünür. Kelime ve
        sayfa eskiden yalnızca İncele panelindeydi; panel kapalıyken ya da
        telefonda hiç görünmüyordu. Kayıt durumunun kendisi (ve "şimdi
        kaydet") başlık satırında; burada yalnızca otomatik kayıt DURDUYSA
        yazar (oturum ya da abonelik bitti). 4.3'e kadar burada bir de
        "Otomatik kayıt açık" yazıyordu: başlıktaki "Kaydedildi · 11:54" ile
        aynı bilgiyi ikinci kez veriyordu.
      */}
      <footer className="yazim-durum-cubugu" aria-label={t({ tr: "Belge durumu", en: "Document status" })}>
        <span>{t({ tr: `${stats.words.toLocaleString(YEREL[dil])} kelime`, en: `${stats.words.toLocaleString(YEREL[dil])} words` })}</span>
        <span>{t({ tr: `${stats.characters.toLocaleString(YEREL[dil])} karakter`, en: `${stats.characters.toLocaleString(YEREL[dil])} characters` })}</span>
        <span>{t({ tr: `≈ ${pages} sayfa`, en: `≈ ${pages} pages` })}</span>
        {/* Gizlenen kılavuz bandının yeri: aynı iki seçenek, yazının önünde değil. */}
        {!guideline && isThesis && kilavuzBandiGizli ? (
          <span className="yazim-durum-kilavuz">
            <KilavuzSecenekleri projectId={projectId} editHref={editHref} dugmeSinifi="yazim-durum-kilavuz-dugme" etiket={t({ tr: "Kılavuz bağlı değil", en: "No guideline linked" })} />
          </span>
        ) : null}
        {sessionExpired || abonelikBitti ? (
          <span className="yazim-durum-kayit" data-tone="danger">
            <CloudOff size={14} aria-hidden="true" />
            {t({ tr: "Otomatik kayıt durdu", en: "Autosave stopped" })}
          </span>
        ) : null}
      </footer>

      <ShareDialog open={shareOpen} onClose={closeShare} projectId={projectId} />

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
        YAZIM PANELİ (Signature OS Phase 2, yan-panel.tsx). Eskiden burada
        "İncele" paneli (kontrol kartı + yedi kutu, alt alta) ve ayrıca
        ekranın sağına sabitlenmiş yazım asistanı vardı; asistan açılınca
        inceleme panelinin üstüne biniyordu. Artık tek panel, dört görünüm.
        İçerikler yeni değil: aynı kartlar ve eylemler ihtiyaca göre
        gruplandı. Hiçbir kart kaldırılmadı.
      */}
      <YanPanel
        acik={panelAcik && !odak}
        bicim={bicim}
        gorunum={gorunum}
        sekmeler={panelSekmeleri}
        onGorunum={(g) => {
          setGorunum(g);
          if (g === "asistan") setAsistanKuruldu(true);
        }}
        onKapat={panelKapat}
        icerik={{
          asistan: asistanKuruldu ? (
            <>
              {/*
                Satır içi öneri anahtarı (eskiden araç çubuğundaydı): asistanın
                işi olduğu için burada. Açıkken yazma durunca gri öneri gelir.
              */}
              <div className="yan-anahtar">
                <span>
                  <b>{t({ tr: "Satır içi öneri", en: "Inline suggestions" })}</b>
                  <small>
                    {t({
                      tr: "Yazma durunca imlecin önüne gri öneri; Tab kabul eder, Esc vazgeçer. Her öneri bir asistan hakkı kullanır. Kapalıyken Alt+/ ile istediğiniz an.",
                      en: "A grey suggestion appears at the cursor when you pause; Tab accepts, Esc dismisses. Each suggestion uses an assistant credit. When off, press Alt+/ any time.",
                    })}
                  </small>
                </span>
                <button
                  type="button"
                  role="switch"
                  className="yan-anahtar-dugme"
                  aria-checked={otomatikOneri}
                  aria-label={t({ tr: "Otomatik satır içi öneri", en: "Automatic inline suggestions" })}
                  onClick={() => otomatikOneriAyarla(!otomatikOneri)}
                >
                  <span aria-hidden="true" />
                </button>
              </div>
              <YazimPaneli editor={editor} projectId={projectId} acik={panelAcik && gorunum === "asistan"} zorunluBolumler={guideline?.requiredSections ?? []} surumAl={asistanSurumuAl} surumleriAc={() => setVersionsOpen(true)} />
            </>
          ) : null,
          inceleme: (
            <>
              <section className="yan-bolum kontrol-karti" aria-label={t({ tr: "Ölçüler ve yapı", en: "Measures and structure" })}>
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
              </section>
              <div className="yan-kutular">
                <YazimIpuclariKarti editor={editor} onFind={handleFindText} />
                <YazarlikRaporuKarti editor={editor} onFind={handleFindText} />
                <ManuscriptComments projectId={projectId} getQuote={() => selectedText(editor)} onFind={handleFindText} />
              </div>
            </>
          ),
          kaynaklar: (
            <>
              {/* Atıf stili ve iki eylem: imlece atıf ve seçili cümleye kaynak (eskiden araç çubuğunda). */}
              <section className="yan-bolum" aria-labelledby="yan-kaynaklar-baslik">
                <header className="yan-bolum-bas">
                  <h3 id="yan-kaynaklar-baslik">{t({ tr: "Atıflar", en: "Citations" })}</h3>
                  <span className="kontrol-etiket">{stilAdi(style)}</span>
                </header>
                <div className="yan-eylemler">
                  <button type="button" className="projects-filter-button" onClick={() => setCiteOpen(true)}>
                    <BookMarked size={15} aria-hidden="true" /> {t({ tr: "Kaynaktan atıf ekle", en: "Cite a source" })}
                  </button>
                  <button
                    type="button"
                    className="projects-filter-button"
                    title={t({ tr: "Seçim yoksa imlecin bulunduğu paragraf", en: "If nothing is selected, the paragraph at the cursor" })}
                    onClick={() => {
                      /* Seçim yoksa imlecin paragrafı: öğrenci cümleyi seçmeyi bilmeyebilir. */
                      const { from, to, $from } = editor.state.selection;
                      setKaynakBulCumle(from !== to ? editor.state.doc.textBetween(from, to, " ") : $from.parent.textContent);
                      setKaynakBulAcik(true);
                    }}
                  >
                    <SearchCheck size={15} aria-hidden="true" /> {t({ tr: "Seçili cümleye kaynak bul", en: "Find a source for the selection" })}
                  </button>
                </div>
              </section>
              <div className="yan-kutular">
                <BekleyenKaynaklarKarti
                  projectId={projectId}
                  govdeMetni={govdeMetni}
                  atifTuru={stilTanimi(style).tur}
                  dipnotlar={dipnotMetinleri}
                  belgeDili={belgeDili}
                  onCite={(source) => void handleCite(source)}
                />
              </div>
              <Link className="yan-baglanti" href={`/dashboard/literature?calisma=${encodeURIComponent(projectId)}`}>
                <Library size={15} aria-hidden="true" /> {t({ tr: "Kaynak kütüphanesini aç", en: "Open source library" })}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </>
          ),
          teslim: (
            <>
              <section className="yan-bolum kontrol-karti" aria-label={t({ tr: "Kılavuz ve kontrol", en: "Guideline and check" })}>
                {guideline ? (
              <header className="kontrol-kilavuz">
                <span className="kontrol-kilavuz-ust">
                  <span className="dashboard-kicker">{t({ tr: "Uygulanan kılavuz", en: "Applied guideline" })}</span>
                  <button type="button" className="projects-filter-button button-compact" onClick={() => setGuidelineOpen(true)}>
                    <BookOpen size={14} aria-hidden="true" /> {t({ tr: "Kurallar", en: "Rules" })}
                  </button>
                </span>
                <strong title={kilavuzGorunenAdi(guideline.label, dil)}>{kilavuzGorunenAdi(guideline.label, dil)}</strong>
                <span className="kontrol-etiketler">
                  <span className="kontrol-etiket">{stilAdi(guideline.citationStyle)}</span>
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
                {/*
                  Adı NE DENETLEDİĞİNİ söylüyor: kılavuzun zorunlu bölümleri,
                  atıf stili ve kaynakça–atıf çapraz denetimi. Eskiden başlığın
                  birincil düğmesiydi; sonucu ve geçmişi burada, teslim
                  listesinin yanında okunuyor.
                */}
                <button
                  type="button"
                  className="projects-filter-button kontrol-calistir"
                  onClick={handleCheck}
                  disabled={checking}
                  title={t({
                    tr: "Kılavuzun zorunlu bölümleri, atıf stili ve kaynakça–atıf eşleşmesi",
                    en: "Required guideline sections, citation style and reference–citation matching",
                  })}
                >
                  <ShieldCheck size={15} aria-hidden="true" />
                  {checking ? t({ tr: "Kontrol ediliyor...", en: "Checking..." }) : t({ tr: "Kılavuz ve kaynakça kontrolü", en: "Guideline and reference check" })}
                </button>
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
              <TeslimListesi
                checklist={checklist}
                onAction={handleChecklistAction}
                vurgu={vurguluMadde}
                dogrulanmamis={guideline ? !guideline.dogrulandi : false}
                makale={makaleProfili !== undefined}
              />
              <div className="yan-kutular">
                <ManuscriptOutline
                  sections={sections}
                  documentEmpty={stats.empty}
                  onJump={handleJump}
                  onInsert={handleInsertSections}
                  onTemplate={handleTemplate}
                  onImport={() => setImportOpen(true)}
                />
                {isThesis ? (
                  <OnSayfalarKarti belge={() => editor.getJSON()} calismaBasligi={coverPage.title} onEkle={handleOnSayfalar} />
                ) : null}
                <IcindekilerKarti
                  headings={stats.headings}
                  numaralama={headingNumbering}
                  numarasiz={guideline?.settings.unnumberedSections}
                  onSayfaRomen={guideline?.settings.frontMatterRoman}
                  sayfaBasiKelime={sayfaBasiKelime}
                  onJump={handleJump}
                />
              </div>
            </>
          ),
        }}
      />

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
              /*
                YİNELEME YOK (03.11.2026). Eskiden eşleşmeyen atıf ve kaynaklar
                burada da tek tek listeleniyordu; aynı liste "Yapı ve bütünlük >
                Atıf ve kaynakça" altında zaten var. Kurum sahibi aynı 8 kaynağı
                iki bölümde gördü. Burada yalnızca sayı ve yönlendirme kalır;
                bulguların tek kaynağı yapı denetimi.
              */
              <p className="sorun-satir" data-tone="warning">
                <AlertTriangle size={16} aria-label={t({ tr: "Uyarı", en: "Warning" })} />
                <span className="sorun-metin">
                  {(() => {
                    const anilmayan = checkResult.atif.crossCheck.referencesWithoutCitation.length;
                    const karsiliksiz = checkResult.atif.crossCheck.citationsWithoutReference.length;
                    const tr = [
                      karsiliksiz ? `${karsiliksiz} atıfın kaynakçada karşılığı yok` : "",
                      anilmayan ? `${anilmayan} kaynak metinde anılmıyor` : "",
                    ].filter(Boolean).join(", ");
                    const en = [
                      karsiliksiz ? `${karsiliksiz} citation${karsiliksiz === 1 ? " has" : "s have"} no matching reference` : "",
                      anilmayan ? `${anilmayan} reference${anilmayan === 1 ? " is" : "s are"} not cited in the text` : "",
                    ].filter(Boolean).join(", ");
                    return t({
                      tr: `${tr}. Ayrıntılar yukarıda, "Yapı ve bütünlük › Atıf ve kaynakça" altında.`,
                      en: `${en}. Details above, under "Structure and consistency › Citations and reference list".`,
                    });
                  })()}
                </span>
              </p>
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
        cslStili={Boolean(csl)}
        belgeDili={belgeDili}
        onPick={(source, secenek) => void handleCite(source, secenek)}
      />
      <KaynakBulPenceresi
        key={kaynakBulCumle}
        open={kaynakBulAcik}
        onClose={() => setKaynakBulAcik(false)}
        projectId={projectId}
        cumle={kaynakBulCumle.slice(0, 600)}
        onCite={(source) => void handleCite(source)}
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
          title={kilavuzGorunenAdi(guideline.label, dil)}
          /* Öğrencinin kendi yüklediği kılavuz ekibin onayından geçmedi; eskiden
             bu pencere onu da "ekibimizin onayladığı son sürüm" diye sunuyordu. */
          description={
            guideline.dogrulandi
              ? t({
                  tr: "Ekibimizin onayladığı son sürüm. Enstitünüz daha yeni bir sürüm yayımladıysa \"Kılavuzu değiştir\" ile kendi dosyanızı yükleyebilirsiniz.",
                  en: "The latest version approved by our team. If your graduate school has published a newer version, upload your own file with \"Change guideline\".",
                })
              : t({
                  tr: "Kendi yüklediğiniz kılavuz: kuralları siz onayladınız, kurumunuzun onayından geçmedi. Değiştirmek ya da kaldırmak için \"Kılavuzu değiştir\"e basın.",
                  en: "The guideline you uploaded: you confirmed its rules; it has not been approved by your institution. To replace or remove it, click \"Change guideline\".",
                })
          }
        >
          <dl className="guideline-rules">
            {guideline.universityName ? (
              <>
                <dt>{t({ tr: "Kurum", en: "Institution" })}</dt>
                <dd>
                  {guideline.universityName}
                  {guideline.instituteName ? ` — ${guideline.instituteName}` : ""}
                </dd>
              </>
            ) : null}
            <dt>{t({ tr: "Kaynakça", en: "References" })}</dt>
            <dd>{stilAdi(guideline.citationStyle)}</dd>
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
            {guideline.settings.paragraphSpacing ? (
              <>
                <dt>{t({ tr: "Paragraf aralığı", en: "Paragraph spacing" })}</dt>
                <dd>
                  {t({
                    tr: `Önce ${guideline.settings.paragraphSpacing.beforePt} nk · sonra ${guideline.settings.paragraphSpacing.afterPt} nk`,
                    en: `Before ${guideline.settings.paragraphSpacing.beforePt} pt · after ${guideline.settings.paragraphSpacing.afterPt} pt`,
                  })}
                </dd>
              </>
            ) : null}
            {guideline.settings.chapterAlign ? (
              <>
                <dt>{t({ tr: "Bölüm başlığı hizası", en: "Chapter heading alignment" })}</dt>
                <dd>{t(bolumHizasiMetni(guideline.settings.chapterAlign, guideline.settings.chapterLeftSections))}</dd>
              </>
            ) : null}
            {guideline.settings.frontMatterRoman ? (
              <>
                <dt>{t({ tr: "Ön sayfa numaraları", en: "Front matter numbering" })}</dt>
                <dd>{t({ tr: "i, ii, iii …; Giriş'ten itibaren 1, 2, 3 …", en: "i, ii, iii …; from the Introduction 1, 2, 3 …" })}</dd>
              </>
            ) : null}
            {guideline.settings.subheadingIndent ? (
              <>
                <dt>{t({ tr: "Alt başlık girintisi", en: "Subheading indent" })}</dt>
                <dd>{t(altGirintiMetni(guideline.settings.subheadingIndent))}</dd>
              </>
            ) : null}
            {guideline.settings.unnumberedSections?.length ? (
              <>
                <dt>{t({ tr: "Numarasız ana başlıklar", en: "Unnumbered main headings" })}</dt>
                <dd>{guideline.settings.unnumberedSections.join(", ")}</dd>
              </>
            ) : null}
            {guideline.settings.footnoteSizePt ? (
              <>
                <dt>{t({ tr: "Dipnot", en: "Footnotes" })}</dt>
                <dd>{t({ tr: `${guideline.settings.footnoteSizePt} punto`, en: `${guideline.settings.footnoteSizePt} pt` })}</dd>
              </>
            ) : null}
            {guideline.settings.pageNumberPosition ? (
              <>
                <dt>{t({ tr: "Sayfa numarasının yeri", en: "Page number position" })}</dt>
                <dd>{t(SAYFA_NUMARASI_ADI[guideline.settings.pageNumberPosition])}</dd>
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
          {/* Kılavuzu değiştirme (02.11.2026): Çalışmalarım'daki Kılavuz penceresi bu çalışma seçili açılır. */}
          <a className="projects-filter-button button-compact mt-sm" href={`/dashboard/editor?sec=${projectId}&kilavuz=1`}>
            {t({ tr: "Kılavuzu değiştir", en: "Change guideline" })}
          </a>

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
              {guideline.dogrulandi
                ? t({ tr: "Resmî kılavuzu aç", en: "Open the official guideline" })
                : t({ tr: "Yüklediğiniz kılavuzu aç", en: "Open the guideline you uploaded" })}
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

/*
  Kılavuz bağlama seçenekleri: kılavuz bandında ve (bant gizlenince)
  durum çubuğunda AYNI menü. İki yerde ayrı yazılsaydı biri öbüründen
  sapardı.
*/
function KilavuzSecenekleri({ projectId, editHref, dugmeSinifi, etiket }: { projectId: string; editHref: string; dugmeSinifi: string; etiket?: string }) {
  const t = useCeviri();
  return (
    <AracMenusu
      dugmeSinifi={dugmeSinifi}
      ikon={<BookMarked size={15} aria-hidden="true" />}
      etiket={etiket ?? t({ tr: "Kılavuz bağla", en: "Link guideline" })}
      aciklama={t({ tr: "Tez yazım kılavuzunu bağla: yükle ya da kurumunu seç", en: "Link a thesis guideline: upload it or select your institution" })}
    >
      <Link href={calismaAdresi(projectId, { kilavuz: true })} className="arac-menu-oge kilavuz-secenek">
        <FileUp size={16} aria-hidden="true" />
        <span>
          {t({ tr: "Kılavuzumu yükle", en: "Upload my guideline" })}
          <small>{t({ tr: "PDF ya da web adresi; onayladığınız kurallar editöre uygulanır", en: "PDF or web address; the rules you approve are applied to the editor" })}</small>
        </span>
      </Link>
      <Link href={editHref} className="arac-menu-oge kilavuz-secenek">
        <Settings2 size={16} aria-hidden="true" />
        <span>
          {t({ tr: "Kurumumu seç", en: "Select my institution" })}
          <small>{t({ tr: "Çalışma ayarlarında; kurumun onaylı kılavuzu varsa kullanılır", en: "In the work settings; your institution's approved guideline is used if there is one" })}</small>
        </span>
      </Link>
    </AracMenusu>
  );
}
