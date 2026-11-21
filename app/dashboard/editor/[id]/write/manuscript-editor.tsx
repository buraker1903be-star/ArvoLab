"use client";

import { ornekKalibi } from "@/lib/atif/tyk";
import { kaynakcaOzeti } from "@/lib/kaynakca-ozeti";
import { eksikAlanlar, NUMERIC_STYLES } from "@/lib/citation-format";
import { wordDosyasiniIndir } from "@/app/dashboard/_components/word-indir";
import { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
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
  WandSparkles,
  Plus,
  MoreHorizontal,
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
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  Columns2,
  Rows2,
  PanelTop,
  TableCellsMerge,
  TableCellsSplit,
  Sparkles,
  FileText,
} from "lucide-react";
import { Minus as OlcekEksi, Plus as OlcekArti } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { SolArama, SolBolumler, SolKaynaklar } from "./sol-araclar";
import { adrestekiPdf, pdfEslesmesi, type KaynakPdfi } from "@/lib/kaynak-durumu";
import { AtifKarti, SecimIslemleri, type AtifKartiDurumu, type DogrulanmisPasaj } from "./atif-karti";
import { atifAdaylari, kartKonumu, tiklananAtif, type AtifStilTuru } from "@/lib/atif-karti";
import { atifCikarmaStili, stilTanimi } from "@/lib/atif/stiller";
import { belgeBolumleri, kaynakcaGirdileri, type Dugum } from "@/lib/kaynakca-bolumu";
import { goruntuleyiciKaynaklari as kartPdfleriniOku, kaynakKunyeDurumlari, type KunyeDurumOzeti } from "@/app/actions/kaynak-pdf";
import { getLiteratureSources as kartKaynaklariniOku } from "@/app/actions/literature";
import {
  KAGIT_GENISLIGI,
  SAG_PANEL_SINIRI,
  gecerliOlcek,
  olcekAdimi,
  olcekTercihiOku,
  pdfCekmeceGenisligi,
  sagPanelGenisligiSinirla,
  yerlesimKarari,
  SOL_ALAN_DAR_OZNITELIGI,
  SOL_ALAN_SIK_OZNITELIGI,
  SOL_ALAN_GENISLET_OLAYI,
  type OlcekTercihi,
} from "@/lib/calisma-alani-yerlesimi";
import { sagPanelOku, solAracOku, type SagPanel, type SolArac } from "@/lib/os/uygulamalar";
import { GEZINME_DAR, GEZINME_OZNITELIGI } from "@/lib/os5/gezinme";
import { gezinmeAbone } from "@/app/_components/gezinme";

import type { ImportMode } from "./import-dialog";
import type { DocxImportStats } from "@/lib/docx-import";


import type { FormatLossReport } from "@/lib/format-loss";
import { checkStructure, sorunlariGrupla, type StructureIssue } from "@/lib/structure-check";
import { describeParagraphFormat, type ParagraphFormatRules } from "@/lib/paragraph-format";



import { buildSubmissionChecklist, missingCoverFields, type ChecklistAction } from "@/lib/submission-checklist";
import { etikTeslimSatiri, type EtikKaydi } from "@/lib/etik/durum";
import { sayfaDuzeniFarklari } from "@/lib/sayfa-duzeni";


import ManuscriptComments from "./manuscript-comments";
import { updateLiteratureStatus, type LiteratureSource } from "@/app/actions/literature";
import type { CitationStyle } from "@/lib/citation-format";
import { STIL_SECENEKLERI, stilAdi } from "@/lib/atif/stiller";
import { cslCoz, type CslKodu } from "@/lib/atif/csl-kimlik";
import { cslAtifUret } from "@/app/actions/csl";
import YazimIpuclariKarti from "./yazim-ipuclari-karti";

import { useSatirIciOneri } from "./satir-ici-oneri";
import { etkinOneri } from "@/lib/tiptap-satir-ici-oneri";
import { escIsle, pdfCekmecesiGorunuyor, CEKMECE_EN_DAR, type EscDurumu } from "@/lib/editor-esc";
import AracMenusu from "./arac-menusu";
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
import { showToast } from "@/app/dashboard/_components/toast-events";
import Dialog from "@/app/dashboard/_components/dialog";
import { estimatePages, pageRangeTone, wordsPerPage } from "@/lib/page-estimate";
import { KAGIT_BOYUTLARI, KAGITLAR, kagitOku, type KagitBoyutu } from "@/lib/kagit-boyutu";
import { splitBodyAndReferences } from "@/lib/text-split";
import type { KontrolKaydiOzeti } from "@/lib/kontrol-gecmisi";
import IcindekilerKarti from "./icindekiler-karti";
import OnSayfalarKarti from "./on-sayfalar-karti";

import { kilavuzOnSayfaAdlari, kilavuzOnSayfalari, onSayfaAdiKimligi, type OnSayfaKimligi } from "@/lib/on-sayfalar";
import BekleyenKaynaklarKarti from "./bekleyen-kaynaklar-karti";
import { writingProgress } from "@/lib/writing-progress";
import { writingPace } from "@/lib/writing-pace";
import {
  autosaveDelay,
  draftDelay,
  eskiSurumHatasiMi,
  kayitKarari,
  kayitSonucuKarari,
  kurtarilabilirTaslaklar,
  sonrakiTeklif,
  yazarkenKayitZamani,
  taslakAnahtari,
  taslakAnahtariMi,
  tekUcusluCalistirici,
  tekrarGecikmesi,
  teklifiYokSay,
  type KayitDurumu,
  type SunucuSonucu,
  type YerelTaslak,
} from "@/lib/otomatik-kayit";
import { SAYFA_NUMARASI_ADI, altGirintiMetni, bolumHizasiMetni } from "@/lib/kilavuz-bicim";
import ManuscriptOutline from "./manuscript-outline";
import {
  applyTemplate,
  collectHeadings,
  insertSections,
  insertFrontMatter,
  atifIslemi,
  insertCitation,
  atifSirasi,
  kaynakcaGirdisiIslemi,
  aiAtiflariniBagla,
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
/*
  AÇIK PENCERE (Esc'i kendisi kullanan) = açık <dialog> ya da açık ortak
  pencere (dialog.tsx, .drawer-root.open). Ortak pencere KAPALIYKEN de
  sayfada role="dialog" ile durur (inert); "[role=dialog]" aramak her zaman
  bir şey bulur. Eskiden odak modu ve PDF çekmecesi böyle arıyordu ve Esc
  ikisinde de hiç çalışmıyordu (18.11.2026, tarayıcıda: 18 kapalı pencere).
*/
const ACIK_PENCERE = "dialog[open], .drawer-root.open";
/*
  Esc başladığında (yakalama aşamasında) bir pencere ya da atıf kartı açık
  mıydı? Pencere kendi Esc'iyle document'ta kapanır ve React güncellemesi
  window dinleyicisinden ÖNCE işlenir: kabarcık aşamasında pencere artık
  kapalı görünür ve aynı Esc odak modundan da çıkarıyordu (kabul S18).
*/
const sahipliEsc = new WeakSet<Event>();
const FindReplaceBar = dynamic(() => import("./find-replace-bar"), { ssr: false });
const ImportDialog = dynamic(() => import("./import-dialog"), { ssr: false });
const ImageLibraryDialog = dynamic(() => import("./image-library-dialog"), { ssr: false });
const ShortcutsDialog = dynamic(() => import("./shortcuts-dialog"), { ssr: false });
const VersionsDialog = dynamic(() => import("./versions-dialog"), { ssr: false });
const SubmissionChecklistDialog = dynamic(() => import("./submission-checklist"), { ssr: false });
const ShareDialog = dynamic(() => import("./share-dialog"), { ssr: false });
const CiteDialog = dynamic(() => import("./cite-dialog"), { ssr: false });
const AnalizEkleDialog = dynamic(() => import("./analiz-ekle-dialog"), { ssr: false });
const KaynakBulPenceresi = dynamic(() => import("./kaynak-bul-penceresi"), { ssr: false });
const YazimPaneli = dynamic(() => import("./yazim-paneli"), { ssr: false });
import type { AiAtifHazirlik } from "./yazim-paneli";
import { aiAtiflariniEsle } from "@/lib/ai-atif-esleme";
/* Yazım Stüdyosu (16.11.2026): editörün yanında kaynak PDF'i, pasaj seçimi, Arvo AI analizi ve doğrulanmış atıf. */
const KaynakPdfPaneli = dynamic(() => import("./kaynak-pdf-paneli"), { ssr: false });
const SagPanelAyirici = dynamic(() => import("./sag-panel-ayirici"), { ssr: false });
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
  /** "?asistan=1" ile gelinirse yazım asistanı açık başlar (Ctrl+K'daki "Yazım asistanını aç", Phase 3). */
  asistanAcikBasla?: boolean;
  /** Yeni çalışmadan "Word dosyasından içe aktar" ile gelindi: içe aktarma penceresi açık başlar. */
  iceAktarAcikBasla?: boolean;
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
  /** Çalışma düzenleme sayfası. 20.11.2026'dan beri editörde kullanılmıyor ("Kurum seç" kalktı); çağıran hâlâ veriyor. */
  editHref?: string;
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"];

/* Kayıt kararları ve zamanlaması saf modülde (lib/otomatik-kayit.ts, testli). */
type SaveState = KayitDurumu;

type LocalDraft = YerelTaslak<TiptapDoc>;
type TeklifTaslagi = { anahtar: string; taslak: LocalDraft };

// Kaydedilemeyen değişiklikler (bağlantı kopması, oturum bitmesi, sekme
// kapanması) bu tarayıcıda saklanır ve sayfa yeniden açılınca önerilir.
/*
  Anahtar KULLANICIYA (29.10.2026) ve SEKMEYE (P52a1, 15.11.2026) bağlı;
  biçimler ve eşleşme kuralı lib/otomatik-kayit.ts'te. Eskiden aynı
  çalışmanın iki sekmesi tek anahtara yazıyordu: son yazan, öteki sekmenin
  kaydedilememiş metnini siliyordu. Artık her sayfa yüklemesi kendi
  anahtarına yazar; açılışta bu kullanıcının bu çalışmaya ait bütün
  taslakları taranır ve en yenisi önerilir (kapanan sekmenin taslağı da
  bulunur — kurtarma deneyimi aynı). Eski biçimdeki anahtarlar okunmaya
  devam eder: içlerindeki metin kaybolmasın.
*/
function taslakAnahtarlari(projectId: string, kullaniciId: string | null): string[] {
  const anahtarlar: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const anahtar = window.localStorage.key(i);
    if (anahtar && taslakAnahtariMi(anahtar, projectId, kullaniciId)) anahtarlar.push(anahtar);
  }
  return anahtarlar;
}

/* Bu kullanıcının bu çalışmaya ait kurtarılabilir taslakları, en yeniden eskiye (lib/otomatik-kayit). */
function readDrafts(projectId: string, kullaniciId: string | null): TeklifTaslagi[] {
  try {
    const kayitlar = taslakAnahtarlari(projectId, kullaniciId).map((anahtar) => ({ anahtar, ham: window.localStorage.getItem(anahtar) }));
    return kurtarilabilirTaslaklar<TiptapDoc>(kayitlar, projectId, kullaniciId);
  } catch {
    return [];
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
function writeDraft(anahtar: string, draft: LocalDraft): boolean {
  try {
    window.localStorage.setItem(anahtar, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function anahtarlariSil(anahtarlar: (string | null | undefined)[]) {
  try {
    for (const anahtar of anahtarlar) if (anahtar) window.localStorage.removeItem(anahtar);
  } catch {
    // yok say
  }
}

/* Bu sekmenin taslağı + eski sürümlerin ortak (sekmesiz) anahtarları: başarılı kayıttan sonra
   bunlar kaydedilmiş metnin gerisinde kalır. Başka sekmenin taslağına DOKUNULMAZ. */
function kendiTaslaginiSil(projectId: string, kullaniciId: string | null, sekmeAnahtari: string) {
  anahtarlariSil([sekmeAnahtari, taslakAnahtari(projectId, kullaniciId, null), taslakAnahtari(projectId, null, null)]);
}

/* Sayfa yüklemesi başına sekme kimliği (sessionStorage değil: "sekmeyi çoğalt" onu kopyalıyor). */
function yeniSekmeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
  asistanAcikBasla = false,
  iceAktarAcikBasla = false,
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
  /*
    Teklif SIRASI (P52a1): ilk eleman önerilen taslak, ötekiler aynı banttan
    ("Öncekini göster") erişilebilir. Eskiden yalnızca en yeni öneriliyordu;
    ikinci bir sekmenin kaydedilmemiş metnine ancak sayfa yeniden açılınca
    ulaşılıyordu.
  */
  const [teklifSirasi, setTeklifSirasi] = useState<TeklifTaslagi[]>([]);
  const draftOffer: LocalDraft | null = teklifSirasi[0]?.taslak ?? null;
  const [taslakYukleniyor, setTaslakYukleniyor] = useState(false);
  const draftOfferRef = useRef<LocalDraft | null>(null);
  /*
    Kayıtlı içerik editörün şemasına uymuyorsa (eski/bozuk düğüm) Tiptap onu
    sessizce budayarak açar. Eskiden ilk tuşta otomatik kayıt bu budanmış
    hâli sunucuya yazıyor ve tezin bir kısmı geri dönüşsüz gidiyordu.
    Artık kayıt kilitlenir; kullanıcı sunucudaki hâli yedekleyip açıkça
    "devam et" demeden hiçbir şey yazılmaz.
  */
  const [icerikUyumsuz, setIcerikUyumsuz] = useState(false);
  const icerikUyumsuzRef = useRef(false);
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
      belgeDili,
    }),
    [citationStyle, guideline, paragraphFormat, belgeDili]
  );
  const [includeToc, setIncludeToc] = useState(initialIncludeToc);
  const [headingNumbering, setHeadingNumbering] = useState(initialHeadingNumbering);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [citeOpen, setCiteOpen] = useState(false);
  /*
    SAĞ PANEL: TEK YUVA (19.11.2026, bağlamlı çalışma alanı). Arvo AI ve
    Kaynak PDF aynı yuvayı, aynı ayırıcıyı paylaşır; biri açılınca öteki
    kapanır. Eskiden asistan sağa yaslı yüzen bir kutuydu (400 px, sabit),
    PDF ise yerleşimin sütunu: iki ayrı mekanizma, iki ayrı genişlik kuralı.
    Açık panel ADRESTE (?sag=ai|pdf): çalışma gezinmesindeki "Arvo AI"
    bağlantısı, doğrudan bağlantı ve geri/ileri aynı paneli açar. Düğmeyle
    açıp kapamak geçmişe yeni kayıt eklemez (replaceState); Next bunu
    useSearchParams'a yansıtıyor.
  */
  const adres = useSearchParams();
  const solArac = solAracOku(adres.get("sol"));
  const sagAdresi = sagPanelOku(adres.get("sag"));
  const [sag, setSag] = useState<SagPanel | null>(sagAdresi ?? (asistanAcikBasla ? "ai" : null));
  const [oncekiSagAdresi, setOncekiSagAdresi] = useState(sagAdresi);
  if (sagAdresi !== oncekiSagAdresi) {
    setOncekiSagAdresi(sagAdresi);
    setSag(sagAdresi);
  }
  const yazimAcik = sag === "ai";
  const kaynakAcik = sag === "pdf";
  const sagAc = useCallback((panel: SagPanel | null) => {
    setSag(panel);
    const u = new URL(window.location.href);
    if (panel) u.searchParams.set("sag", panel);
    else u.searchParams.delete("sag");
    // "?asistan=1" (eski bağlantılar) kalırsa yenilemede panel yeniden açılırdı.
    u.searchParams.delete("asistan");
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  }, []);
  /* Kaynaklar aracından "PDF'i aç": panel o PDF'le açılır (anahtar aynı PDF'e ikinci basışı da iletir). */
  const [acilacakPdf, setAcilacakPdf] = useState<{ id: string; anahtar: number; sayfa?: number; pasaj?: string } | null>(null);
  /*
    DIŞARIDAN "PDF'i oku" (20.11.2026, M5): Kaynakça penceresi ve Kaynaklar
    sayfası PDF'i artık yeni sekmede ham dosya olarak açmıyor, editörün
    çekmecesine bu adresle geliyor (?sag=pdf&pdf=<id>&sayfa=<n>,
    lib/kaynak-durumu editorPdfAdresi). Eskiden imzalı depo adresi yeni
    sekmede açılıyordu: pasaj seçmek, alıntı eklemek, AI'a sormak orada
    yoktu ve öğrenci aynı PDF'i iki ayrı yerde okuyordu. İstek bir kez
    işlenir, sonra adresten silinir (yenileme aynı sayfaya geri atmasın).
  */
  const pdfAdresi = adres.get("pdf");
  const sayfaAdresi = adres.get("sayfa");
  const pdfIstegi = adrestekiPdf(pdfAdresi, sayfaAdresi);
  const [islenenPdfIstegi, setIslenenPdfIstegi] = useState<string | null>(null);
  if (pdfIstegi && `${pdfIstegi.id}:${pdfIstegi.sayfa ?? ""}` !== islenenPdfIstegi) {
    setIslenenPdfIstegi(`${pdfIstegi.id}:${pdfIstegi.sayfa ?? ""}`);
    setAcilacakPdf({ id: pdfIstegi.id, anahtar: -1, sayfa: pdfIstegi.sayfa });
    if (sag !== "pdf") setSag("pdf");
  }
  useEffect(() => {
    if (!pdfAdresi && !sayfaAdresi) return;
    const u = new URL(window.location.href);
    u.searchParams.delete("pdf");
    u.searchParams.delete("sayfa");
    if (pdfIstegi) u.searchParams.set("sag", "pdf");
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  }, [pdfAdresi, sayfaAdresi, pdfIstegi]);

  /*
    ATIF KARTI (K3-A) ve SEÇİM İŞLEMLERİ: iki ayrı durum, aynı anda açılmaz
    (atif-karti.tsx). Kartın verisi ilk tıklamada okunur ve PDF bağı ya da
    atıf değişince tazelenir. Doğrulanmış pasajlar yalnızca bu oturumda,
    bellekte (K3-ek onaylı değil: kalıcı kayıt yok).
  */
  const [atifKarti, setAtifKarti] = useState<AtifKartiDurumu | null>(null);
  const [kartVerisi, setKartVerisi] = useState<{ kaynaklar: LiteratureSource[]; pdfler: KaynakPdfi[]; kunye: Map<string, KunyeDurumOzeti> } | null>(null);
  const [kartYukleniyor, setKartYukleniyor] = useState(false);
  const [dogrulanmisPasajlar, setDogrulanmisPasajlar] = useState<DogrulanmisPasaj[]>([]);
  const [secimKonumu, setSecimKonumu] = useState<{ yan: "sag" | "alt"; x: number; y: number } | null>(null);
  const yerlesimRef = useRef<HTMLDivElement>(null);
  const yerlesimiAl = useCallback(() => yerlesimRef.current, []);
  const anaRef = useRef<HTMLDivElement>(null);

  /*
    YERLEŞİM VE BELGE ÖLÇEĞİ (lib/calisma-alani-yerlesimi.ts). Ekran genişliği
    ilk çizimden sonra ölçülür; o ana kadar karar yok ve CSS eski (akan)
    düzeni çizer — sunucu ile tarayıcının ilk HTML'i aynı kalır.
  */
  const [ekran, setEkran] = useState(0);
  useEffect(() => {
    /*
      Kaydırma çubuğu HARİÇ genişlik (görsel uyum, 19.11.2026). Eskiden
      innerWidth okunuyordu: kaydırma çubuğu yer kaplayan sistemlerde
      (Windows) karar 15 px fazlası için verilir, belge sınırın altına
      inerdi. Paylar artık dar olduğu için bu fark kararı çevirebilir.
    */
    const olc = () => setEkran(document.documentElement.clientWidth || window.innerWidth);
    olc();
    window.addEventListener("resize", olc);
    return () => window.removeEventListener("resize", olc);
  }, []);
  /*
    PDF çekmecesinin genişliği YENİ anahtarda (20.11.2026): eski anahtar
    (arvolab.pdfPanelGenisligi) sütun döneminin 360–600 px değerini tutuyor;
    onu okumak çekmeceyi ilk açılışta %65 yerine 520 px açardı. 0 = ekranın %65'i.
  */
  const SAG_ANAHTARI: Record<SagPanel, string> = { ai: "arvolab.sagPanel.ai", pdf: "arvolab.pdfCekmeceGenisligi" };
  const [sagGenislikleri, setSagGenislikleri] = useState<Record<SagPanel, number>>({ ai: SAG_PANEL_SINIRI.ai.varsayilan, pdf: 0 });
  const [olcekTercihi, setOlcekTercihi] = useState<OlcekTercihi>("sigdir");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tercihler yalnızca tarayıcıda okunabilir; ilk çizim sunucuyla aynı kalır
      setSagGenislikleri({
        ai: sagPanelGenisligiSinirla("ai", Number(window.localStorage.getItem(SAG_ANAHTARI.ai))),
        pdf: Number(window.localStorage.getItem(SAG_ANAHTARI.pdf)) || 0,
      });
      setOlcekTercihi(olcekTercihiOku(window.localStorage.getItem("arvolab.belgeOlcegi")));
    } catch {
      /* Gizli sekme: varsayılanlar. */
    }
    // Anahtarlar sabit; yalnızca açılışta okunur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sagGenislikDegisti = (istenen: number, kaydet: boolean) => {
    if (!sag) return;
    // Çekmece: sınırlar ekran genişliğine göre (lib/calisma-alani-yerlesimi.ts pdfCekmeceGenisligi).
    const genislik = sag === "pdf" ? pdfCekmeceGenisligi(ekran || window.innerWidth, istenen) : istenen;
    setSagGenislikleri((onceki) => ({ ...onceki, [sag]: genislik }));
    if (kaydet) {
      try {
        window.localStorage.setItem(SAG_ANAHTARI[sag], String(genislik));
      } catch {
        /* Gizli sekme: tercih hatırlanmaz. */
      }
    }
  };
  const olcekSec = (tercih: OlcekTercihi) => {
    setOlcekTercihi(tercih);
    try {
      window.localStorage.setItem("arvolab.belgeOlcegi", String(tercih));
    } catch {
      /* Gizli sekme: tercih hatırlanmaz. */
    }
  };
  /* Kullanıcının kendi daraltma tercihi; aşağıdaki geçici ray işareti (data-gezinme-gecici) onu taklit etmesin. */
  const kullaniciDar = useSyncExternalStore(
    gezinmeAbone,
    () => document.documentElement.getAttribute(GEZINME_OZNITELIGI) === GEZINME_DAR && !document.documentElement.hasAttribute("data-gezinme-gecici"),
    () => false,
  );
  /*
    İnceleme paneli varsayılan KAPALI (premium çalışma alanı, 17.11.2026,
    onaylı tasarım: "kontroller kullanıcı istediğinde açılsın"). Eskiden
    varsayılan açıktı ve belgenin yanında sürekli bir sütun kaplıyordu.
    Paneli bir kez açan öğrencinin tercihi tarayıcıda kalır (aynı anahtar);
    düğmenin adı görünür ("Kontroller"), yapı sorunu varsa rozet taşır.
    Yerleşim kararından ÖNCE okunur: panelin sütunu belgeden yer alıyor
    (lib/calisma-alani-yerlesimi.ts, "İNCELEME PANELİ").
  */
  const incelemeAcik = useSyncExternalStore(tercihAboneligi, () => tercihOku(INCELEME_TERCIHI, false), () => false);
  /*
    PANELİ YENİDEN AÇMA (20.11.2026, canlı deneme). Eskiden panelin ×'ine
    basınca panel kayboluyor, yeniden açmanın tek yolu "Kontroller" menüsünün
    en altındaki satırdı: kapatan kullanıcı paneli bir daha bulamıyordu.
    Kapalıyken araç çubuğunun sağ ucunda, panelin başlığının tam üstünde
    görünür bir "İncele" düğmesi durur (önce sağ kenarda serbest duruyordu;
    1280 px'te kâğıdın kenarına biniyordu, araç çubuğunda her genişlikte yeri var). Klavye kullanıcısı kaybolmasın diye odak iki yönde de taşınır:
    açınca panelin kapatma düğmesine, kapatınca bu düğmeye.
  */
  const incelemeOdagi = (secici: string) =>
    window.setTimeout(() => (document.querySelector(secici) as HTMLElement | null)?.focus(), 60);
  const incelemeyiAc = () => {
    tercihYaz(INCELEME_TERCIHI, true);
    incelemeOdagi(".manuscript-outline .inceleme-bas button");
    /* Telefonda panel belgenin altında akar; açılınca oraya kaydırılır (Kontroller menüsündeki düğmeyle aynı). */
    if (window.matchMedia("(max-width: 760px)").matches) {
      window.setTimeout(() => document.querySelector(".manuscript-outline")?.scrollIntoView({ block: "start" }), 50);
    }
  };
  const incelemeyiKapat = () => {
    tercihYaz(INCELEME_TERCIHI, false);
    incelemeOdagi(".inceleme-ac-dugme");
  };
  /*
    KAYNAK LİSTESİ + PDF (4. tur, 18.11.2026). PDF açılınca belge %85'in
    altına inecekse sol araç şeride iner (lib/calisma-alani-yerlesimi.ts,
    "aracDar"); şeritteki düğme (os-gezinme.tsx) aracı geri açar ve PDF
    çekmece olur. Bu istek yalnızca o araç + PDF birlikteliği için geçerli:
    araç ya da sağ panel değişince düşer (çizim sırasında, önceki anahtarla
    karşılaştırarak; efektte sıfırlamak bir çizim gecikmeli kalırdı).
  */
  const [solGenis, setSolGenis] = useState<{ anahtar: string; istendi: boolean }>({ anahtar: "", istendi: false });
  const solGenisAnahtari = `${solArac ?? ""}|${sag ?? ""}`;
  if (solGenis.anahtar !== solGenisAnahtari) setSolGenis({ anahtar: solGenisAnahtari, istendi: false });
  const solGenisIstendi = solGenis.anahtar === solGenisAnahtari && solGenis.istendi;
  useEffect(() => {
    const ac = () => setSolGenis({ anahtar: solGenisAnahtari, istendi: true });
    window.addEventListener(SOL_ALAN_GENISLET_OLAYI, ac);
    return () => window.removeEventListener(SOL_ALAN_GENISLET_OLAYI, ac);
  }, [solGenisAnahtari]);
  const karar = ekran ? yerlesimKarari({ ekran, solArac, sagPanel: sag, sagGenislik: sag ? sagGenislikleri[sag] : 0, kenarDar: kullaniciDar, inceleme: incelemeAcik, solGenisIstendi }) : null;
  const solAlanDar = karar?.kenar === "aracDar";
  useEffect(() => {
    const kok = document.documentElement;
    if (solAlanDar) kok.setAttribute(SOL_ALAN_DAR_OZNITELIGI, "");
    else kok.removeAttribute(SOL_ALAN_DAR_OZNITELIGI);
  }, [solAlanDar]);
  useEffect(() => () => document.documentElement.removeAttribute(SOL_ALAN_DAR_OZNITELIGI), []);
  /* Kaynak listesi sıkı genişlikte (görsel uyum 2): PDF ile birlikte görünür kalsın diye 246 px. */
  const solAlanSik = karar?.kenar === "aracSik";
  useEffect(() => {
    const kok = document.documentElement;
    if (solAlanSik) kok.setAttribute(SOL_ALAN_SIK_OZNITELIGI, "");
    else kok.removeAttribute(SOL_ALAN_SIK_OZNITELIGI);
  }, [solAlanSik]);
  useEffect(() => () => document.documentElement.removeAttribute(SOL_ALAN_SIK_OZNITELIGI), []);
  /*
    Gezinme yalnızca GEÇİCİ olarak raya iner (sağ panel açıkken belge
    okunabilirlik sınırının altına inecekse): tercih kaydedilmez, panel
    kapanınca ya da editörden çıkınca geri açılır.
  */
  const geciciRay = karar?.kenar === "ray" && !kullaniciDar && !solArac;
  useEffect(() => {
    const kok = document.documentElement;
    const gecici = kok.hasAttribute("data-gezinme-gecici");
    if (geciciRay && !gecici && kok.getAttribute(GEZINME_OZNITELIGI) !== GEZINME_DAR) {
      kok.setAttribute("data-gezinme-gecici", "");
      kok.setAttribute(GEZINME_OZNITELIGI, GEZINME_DAR);
    } else if (!geciciRay && gecici) {
      kok.removeAttribute("data-gezinme-gecici");
      kok.removeAttribute(GEZINME_OZNITELIGI);
    }
  }, [geciciRay]);
  useEffect(
    () => () => {
      const kok = document.documentElement;
      if (kok.hasAttribute("data-gezinme-gecici")) {
        kok.removeAttribute("data-gezinme-gecici");
        kok.removeAttribute(GEZINME_OZNITELIGI);
      }
    },
    [],
  );
  /*
    ÇEKMECE BAŞLIĞI ÖRTMEZ (19.11.2026, kabul turu 2). Dar masaüstünde AI/PDF
    ya da inceleme paneli çekmece olunca üst çubuğun hemen altından
    başlıyordu ve editörün başlık satırını (çalışma adı, ölçek, Kontroller,
    Dışa aktar) örtüyordu; incelemeye ya da dışa aktarmaya geçmek için önce
    çekmeceyi kapatmak gerekiyordu. Çekmecenin üstü başlığın alt kenarına
    hizalanır; sayfa kayıp başlık görünümden çıkınca çekmece üst çubuğa
    kadar uzar.
  */
  /* Telefonda (≤760) çekmece yok: PDF tam ekran, asistan alttan yaprak (workspace.css). */
  const cekmeceVar = Boolean(karar && (ekran ?? 0) > CEKMECE_EN_DAR && (karar.sag === "cekmece" || karar.inceleme === "cekmece"));
  useEffect(() => {
    const yerlesim = yerlesimRef.current;
    if (!yerlesim) return;
    if (!cekmeceVar) {
      yerlesim.style.removeProperty("--cekmece-ust");
      return;
    }
    const ayarla = () => {
      /*
        Çekmece ARAÇ ÇUBUĞUNUN altından başlar (görsel uyum 2). Başlık satırı
        kalkınca önce üst çubuğun altından başlatılmıştı; 1200–1240 px'te AI/PDF
        çekmecesi araç çubuğunun sağını (liste, alıntı, asistan, Belge menüsü)
        örtüyor, o düğmeler tıklanamıyordu (tarayıcıda ölçüldü).
      */
      const baslik = document.querySelector(".manuscript-araclar") ?? document.querySelector(".dashboard-header");
      const ustCubuk = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-height")) || 64;
      const alt = baslik ? baslik.getBoundingClientRect().bottom : 0;
      yerlesim.style.setProperty("--cekmece-ust", `${Math.round(Math.max(ustCubuk + 8, alt + 8))}px`);
    };
    ayarla();
    window.addEventListener("scroll", ayarla, { passive: true });
    window.addEventListener("resize", ayarla);
    return () => {
      window.removeEventListener("scroll", ayarla);
      window.removeEventListener("resize", ayarla);
    };
  }, [cekmeceVar]);
  const [anaGenislik, setAnaGenislik] = useState(0);
  const otomatikOlcek = karar?.sabitKagit && anaGenislik ? Math.min(1, Math.floor(((anaGenislik - 2) / KAGIT_GENISLIGI) * 100) / 100) : 1;
  const belgeOlcegi = karar?.sabitKagit ? gecerliOlcek(olcekTercihi, otomatikOlcek) : 1;
  const sagGenislik = karar && (karar.sag === "sutun" || sag === "pdf") ? karar.sagGenislik : sag ? sagGenislikleri[sag] : 0;
  /* CSS değişkenleri DOM API'siyle (TSX'te satır içi stil yok, check:css). */
  useEffect(() => {
    const kap = yerlesimRef.current;
    if (!kap) return;
    kap.style.setProperty("--belge-olcek", String(belgeOlcegi));
    if (sagGenislik) kap.style.setProperty("--sag-panel-genislik", `${sagGenislik}px`);
    else kap.style.removeProperty("--sag-panel-genislik");
  });

  /*
    SOL ARAÇLAR (#sol-alan-yuva, os-gezinme.tsx). Bir kez açılan araç
    söküLMEZ, yalnızca gizlenir: arama, süzgeç ve liste konumu araç
    değiştirince kaybolmasın.
  */
  const [acilanAraclar, setAcilanAraclar] = useState<SolArac[]>([]);
  if (solArac && !acilanAraclar.includes(solArac)) setAcilanAraclar([...acilanAraclar, solArac]);
  const [solYuva, setSolYuva] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- yuva gezinmenin DOM'unda; ancak çizimden sonra bulunur
    setSolYuva(document.getElementById("sol-alan-yuva"));
  }, [solArac]);
  /* Dar ekranda araç belgenin üstünde: bir başlığa gidince ya da atıf ekleyince belge görünsün diye araç kapanır. */
  const solAraciKapatDarsa = () => {
    if (window.innerWidth >= 1200) return;
    const u = new URL(window.location.href);
    u.searchParams.delete("sol");
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  };
  const [analizOpen, setAnalizOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(iceAktarAcikBasla);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [formatLossDismissed, setFormatLossDismissed] = useState(false);
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
  /* Aynı anda tek kayıt (lib/otomatik-kayit → tekUcusluCalistirici). */
  const kayitKuyruguRef = useRef(tekUcusluCalistirici<boolean>());
  /* Art arda bağlantı hatası: geri çekilme bundan hesaplanır, başarıda sıfırlanır. */
  const ardisikHataRef = useRef(0);
  /* Bekleyen geri çekilme denemesinin zamanı; yazarken korunur (markDirty). */
  const denemeSonuRef = useRef<number | null>(null);
  /* Bu sayfa yüklemesinin taslak anahtarı (sekme başına; ilk yazımda kurulur). */
  const sekmeAnahtariRef = useRef<string | null>(null);
  const sekmeAnahtari = useCallback(
    () => (sekmeAnahtariRef.current ??= taslakAnahtari(projectId, kullaniciId, yeniSekmeId())),
    [projectId, kullaniciId]
  );
  /* "Geri yükle"de önerilen taslağın anahtarı: metin bu sekmenin taslağına geçip SUNUCUYA
     kaydedilince silinir (arada sekme kapanırsa kaybolmasın). */
  const geriYuklenenTaslakRef = useRef<string | null>(null);
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
      writeDraft(sekmeAnahtari(), {
        content: editor.getJSON() as unknown as TiptapDoc,
        baseUpdatedAt: updatedAtRef.current,
        writtenAt: new Date().toISOString(),
      })
    );
    taslakYazilamadiRef.current = !yazildi;
    setTaslakYazilamadi(!yazildi);
    return yazildi;
  }, [sekmeAnahtari]);

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
      /*
        Aynı anda tek kayıt: öncekinin bitmesi beklenir, sonra karar verilir —
        önceki zaten en güncel metni kaydettiyse istek gönderilmez
        (lib/otomatik-kayit → tekUcusluCalistirici, kayitKarari).
      */
      return kayitKuyruguRef.current.calistir(async () => {
        const karar = kayitKarari({
          // Uyumsuz içerikte "benim sürümümü kaydet" (force) de budanmış metni yazardı.
          icerikUyumsuz: icerikUyumsuzRef.current,
          engelli: blockedRef.current,
          zorla: force,
          revizyon: revisionRef.current,
          kaydedilenRevizyon: savedRevisionRef.current,
        });
        if (karar === "uyumsuz" || karar === "engelli") return false;
        if (karar === "gerek-yok") return true;

        const revision = revisionRef.current;
        setSaveState("saving");
        let sonuc: { tur: "cevap"; cevap: SunucuSonucu } | { tur: "hata"; mesaj: string };
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
          sonuc = { tur: "cevap", cevap: res };
        } catch (hata) {
          sonuc = { tur: "hata", mesaj: hata instanceof Error ? hata.message : String(hata) };
        }

        const sonra = kayitSonucuKarari(sonuc, {
          ardisikBaglantiHatasi: ardisikHataRef.current,
          araYazildi: revisionRef.current !== revision,
        });
        ardisikHataRef.current = sonra.ardisikBaglantiHatasi;
        /* Kilidi yalnızca başarı açar, kalıcı hata kurar; bağlantı hatası olduğu gibi bırakır
           (çakışma varken "benim sürümümü kaydet" ağda düşerse çakışma kilidi sürmeli). */
        if (sonuc.tur === "cevap" && sonuc.cevap.success) blockedRef.current = false;
        else if (sonra.engelle) blockedRef.current = true;

        if (sonuc.tur === "cevap" && sonuc.cevap.success) {
          updatedAtRef.current = sonuc.cevap.updatedAt;
          savedRevisionRef.current = revision;
          setSessionExpired(false);
          setAbonelikBitti(false);
          setSaveError(null);
          setLastSavedAt(new Date(sonuc.cevap.updatedAt));
          setSaveState(sonra.durum);
          if (sonra.sonraki === "yeniden") {
            scheduleSave(autosaveDelay(payloadBytesRef.current));
          } else if (!draftOfferRef.current) {
            // Taslak teklifi henüz yanıtlanmadıysa taslağı silmek kullanıcının
            // kararını onun yerine vermek olur (eskiden böyleydi). Yalnızca BU
            // sekmenin taslağı silinir; başka sekmenin kaydedilmemiş metni kalır.
            kendiTaslaginiSil(projectId, kullaniciId, sekmeAnahtari());
            anahtarlariSil([geriYuklenenTaslakRef.current]);
            geriYuklenenTaslakRef.current = null;
          }
          return true;
        }

        persistDraft();
        if (sonuc.tur === "cevap") {
          if (!sonuc.cevap.success) hataYaz(sonuc.cevap.error);
        } else if (eskiSurumHatasiMi(sonuc.mesaj)) {
          /*
            Yeni sürüm yayınlanınca açık sayfadaki server action kimliği
            geçersizleşir ("Failed to find Server Action"). Bu ağ hatası değil:
            yeniden denemek asla başarmaz, sayfa yenilenmelidir. Eskiden 10
            saniyede bir sonsuza kadar deneniyordu.
          */
          hataYaz(
            t({
              tr: "Yeni bir sürüm yayınlandı; sayfayı yenileyin, kaldığınız yerden devam edin.",
              en: "A new version has been released; refresh the page and continue where you left off.",
            })
          );
        } else {
          hataYaz(
            t({
              tr: "Bağlantı sorunu nedeniyle kaydedilemedi; birazdan yeniden denenecek.",
              en: "Could not save due to a connection problem; it will be retried shortly.",
            })
          );
        }
        setSaveState(sonra.durum);
        if (sonra.oturumBitti) setSessionExpired(true);
        // Yetki ya da abonelik reddi: yeniden denemek asla başarmaz, sonsuza kadar denenmesin.
        if (sonra.abonelikBitti) setAbonelikBitti(true);
        /*
          Bağlantı sorunu: eskiden sabit 10 sn'de bir, sonsuza kadar tam belge
          gönderiliyordu. Artık 10 → 20 → 40 → 80 → 120 sn (lib/otomatik-kayit).
        */
        if (sonra.sonraki === "geri-cekilme") {
          const gecikme = tekrarGecikmesi(sonra.ardisikBaglantiHatasi);
          denemeSonuRef.current = Date.now() + gecikme;
          scheduleSave(gecikme);
        }
        return false;
      });
    },
    [projectId, kullaniciId, guideline, persistDraft, scheduleSave, hataYaz, t, sekmeAnahtari]
  );

  const markDirty = useCallback(() => {
    revisionRef.current += 1;
    setSaveState((state) => (state === "conflict" || state === "saving" ? state : "dirty"));
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(persistDraft, draftDelay(payloadBytesRef.current));
    // Bağlantı hatası sürerken her tuş 1,5 sn'lik bir deneme kurmasın, ama
    // bekleyen denemeyi de ileri itmesin (lib/otomatik-kayit: yazarkenKayitZamani).
    if (!blockedRef.current) {
      const zaman = yazarkenKayitZamani(Date.now(), payloadBytesRef.current, ardisikHataRef.current, denemeSonuRef.current);
      denemeSonuRef.current = zaman.denemeSonu;
      scheduleSave(zaman.gecikme);
    }
  }, [persistDraft, scheduleSave]);

  useEffect(() => {
    saveNowRef.current = saveNow;
    markDirtyRef.current = markDirty;
  }, [saveNow, markDirty]);

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
    content: initialContent ?? "",
    onCreate: ({ editor: created }) => {
      editorRef.current = created;
      if (initialContent) {
        try {
          created.schema.nodeFromJSON(initialContent).check();
        } catch (hata) {
          console.error("[editor] kayıtlı içerik şemaya uymuyor", hata);
          icerikUyumsuzRef.current = true;
          blockedRef.current = true;
          setIcerikUyumsuz(true);
        }
      }
      // Önceki oturumdan kalan, kaydedilememiş taslak varsa geri yüklemeyi öner.
      /* Bu kullanıcının bu çalışmaya ait (kapanan sekmeler dahil) taslakları; en yenisi önerilir.
         Kayıtlı metinle aynı olan taslak artık bir şey kurtarmıyor: sessizce silinir (eskisi gibi). */
      const mevcut = JSON.stringify(created.getJSON());
      const taslaklar = readDrafts(projectId, kullaniciId);
      anahtarlariSil(taslaklar.filter((x) => JSON.stringify(x.taslak.content) === mevcut).map((x) => x.anahtar));
      setTeklifSirasi(taslaklar.filter((x) => JSON.stringify(x.taslak.content) !== mevcut));
    },
    onUpdate: () => markDirtyRef.current(),
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
    KAYITLI İMLEÇ (20.11.2026): öğrencinin editörde son bıraktığı yer. Odak
    PDF'e geçtiğinde editör seçimi hâlâ duruyor ama bir sonraki odak
    olayında (focus()) neyin geri yükleneceği tarayıcıya bağlı; otomatik
    sınamada alıntı bir karakter önceye girdi. Çekmeceden gelen alıntı bu
    konuma yazılır. Belge bu arada değişirse (başka sekme değil, aynı
    editördeki işlem) konum işlemin eşlemesiyle kaydırılır.
  */
  const kayitliImlec = useRef<{ from: number; to: number } | null>(null);
  useEffect(() => {
    if (!editor) return;
    const kaydet = () => {
      if (editor.isFocused) kayitliImlec.current = { from: editor.state.selection.from, to: editor.state.selection.to };
    };
    /*
      ODAK GİDERKEN DOM SEÇİMİ OKUNUR (20.11.2026, kabulde 5 turdan 1'inde
      ölçüldü). Tıklamanın hemen ardından basılan End gibi bir tuşla taşınan
      imleç ProseMirror'ın durumuna her zaman yansımıyor: tarayıcıda imleç
      satır sonunda, editörün seçimi bir karakter geride kalıyor ve alıntı
      "tanımlanmıştı“…” r" diye yazılıyordu. Odak editörden çıkarken seçim
      henüz editörün içinde: konum oradan, tarayıcının gördüğü yerden alınır.
    */
    const bulanik = () => {
      const dom = window.getSelection();
      if (!dom?.anchorNode || !dom.focusNode || !editor.view.dom.contains(dom.anchorNode) || !editor.view.dom.contains(dom.focusNode)) return;
      try {
        const a = editor.view.posAtDOM(dom.anchorNode, dom.anchorOffset);
        const b = editor.view.posAtDOM(dom.focusNode, dom.focusOffset);
        kayitliImlec.current = { from: Math.min(a, b), to: Math.max(a, b) };
      } catch {
        /* DOM konumu çözülemedi (düğüm görünümü): son ProseMirror seçimi kalır. */
      }
    };
    const esle = ({ transaction }: { transaction: import("@tiptap/pm/state").Transaction }) => {
      const k = kayitliImlec.current;
      if (!k || !transaction.docChanged) return;
      kayitliImlec.current = { from: transaction.mapping.map(k.from, -1), to: transaction.mapping.map(k.to, 1) };
    };
    kaydet();
    editor.on("selectionUpdate", kaydet);
    editor.on("focus", kaydet);
    editor.on("transaction", esle);
    editor.on("blur", bulanik);
    return () => {
      editor.off("selectionUpdate", kaydet);
      editor.off("focus", kaydet);
      editor.off("transaction", esle);
      editor.off("blur", bulanik);
    };
  }, [editor]);

  /*
    PDF paneli kapanınca odak BELGEYE, kullanıcının bıraktığı konuma döner
    (4. tur, 18.11.2026). Eskiden odak kapatma düğmesinde kalıyordu (düğme
    sökülünce sayfanın gövdesine düşüyordu): seçim korunuyordu ama yazmaya
    devam etmek için belgeye yeniden tıklamak, yani konumu yeniden seçmek
    gerekiyordu. Seçim değiştirilmez, belge kaydırılmaz.
  */
  const pdfKapat = useCallback(() => {
    sagAc(null);
    window.requestAnimationFrame(() => {
      if (editor && !editor.isDestroyed) editor.commands.focus(null, { scrollIntoView: false });
    });
  }, [sagAc, editor]);
  /*
    PDF ÇEKMECESİ GEÇİCİDİR (4. tur, 18.11.2026): belgenin üstünü kapattığı
    için Esc ile kapanır; eskiden yalnızca köşedeki çarpı kapatıyordu.
    Açık bir pencere (dialog), atıf kartı ya da Esc'i kendisi işleyen bir
    öğe (defaultPrevented) varsa dokunulmaz. Kapanınca yerleşim kendiliğinden
    eski hâline döner (sol araç yeniden tam genişlikte).
  */
  /*
    Esc kararı lib/editor-esc.ts'te (escIsle): imleç belgedeyken ProseMirror
    Esc'i her zaman işlenmiş sayar, bu yüzden belgeden gelen Esc yakalama
    aşamasında değerlendirilir. Yalnızca AÇIK pencere sayılır (ACIK_PENCERE);
    ilk sürüm "[role=dialog]" arıyordu ve kapalı pencereleri de sayıyordu.
  */
  const escDurumu = useCallback(
    (olay: KeyboardEvent): EscDurumu => {
      const yakalama = olay.eventPhase === Event.CAPTURING_PHASE;
      const acikPencere = Boolean(document.querySelector(ACIK_PENCERE));
      const atifKarti = Boolean(document.querySelector(".atif-karti"));
      if (yakalama && (acikPencere || atifKarti)) sahipliEsc.add(olay);
      const sahipli = sahipliEsc.has(olay);
      return {
        belgeden: olay.target instanceof Element && Boolean(olay.target.closest(".ProseMirror")),
        yakalama,
        islenmis: olay.defaultPrevented,
        acikPencere: acikPencere || sahipli,
        atifKarti,
        oneri: Boolean(editor && !editor.isDestroyed && etkinOneri(editor.state)),
      };
    },
    [editor],
  );
  /*
    Çekmece olup olmadığı OLAY ANINDA, kullanıcının gördüğünden okunur
    (lib/editor-esc.ts, pdfCekmecesiGorunuyor). Eskiden dinleyici yalnızca
    yerleşim kararı "cekmece" deyince ekleniyordu; karar sayfa açıldıktan
    sonra geç geliyor, çekmece ise ondan önce çiziliyordu: canlıda ~2 saniye
    boyunca "Esc ile kapatın" yazan çekmece Esc'le kapanmadı (C6, 18.11.2026).
  */
  const pdfCekmecesiAcik = useCallback(
    () =>
      pdfCekmecesiGorunuyor({
        pdfAcik: kaynakAcik,
        cekmeceNiteligi: Boolean(yerlesimRef.current?.hasAttribute("data-sag-cekmece")),
        genislik: window.innerWidth,
      }),
    [kaynakAcik],
  );
  useEffect(() => {
    if (!kaynakAcik) return;
    const tus = (olay: KeyboardEvent) => {
      if (olay.key === "Escape" && pdfCekmecesiAcik() && escIsle(escDurumu(olay))) pdfKapat();
    };
    window.addEventListener("keydown", tus, true);
    window.addEventListener("keydown", tus);
    return () => {
      window.removeEventListener("keydown", tus, true);
      window.removeEventListener("keydown", tus);
    };
  }, [kaynakAcik, pdfCekmecesiAcik, pdfKapat, escDurumu]);

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
    Odak modu: sayfa başlığı, araç çubuğu dışındaki her şey ve inceleme
    paneli gizlenir, metin ortada kalır. Bilerek hatırlanmıyor: sayfayı
    yeniden açan öğrenci uyarıları görmeden yazmaya devam etmesin. Esc çıkar.
  */
  const [odak, setOdak] = useState(false);
  useEffect(() => {
    if (!odak) return;
    // Açık pencere, atıf kartı ve satır içi öneri Esc'i kendisi kullanır (escIsle). PDF çekmecesi açıksa önce o kapanır.
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pdfCekmecesiAcik() && escIsle(escDurumu(e))) setOdak(false);
    };
    window.addEventListener("keydown", tus, true);
    window.addEventListener("keydown", tus);
    return () => {
      window.removeEventListener("keydown", tus, true);
      window.removeEventListener("keydown", tus);
    };
  }, [odak, pdfCekmecesiAcik, escDurumu]);
  const { durum: oneriDurumu, kalanDk: oneriAcilisDk, durumuSifirla: oneriDurumunuSifirla } = useSatirIciOneri({ editor, projectId, otomatik: otomatikOneri, belgeDili, atifStili: citationStyle });
  const oneriDuraklatildi = otomatikOneri && oneriDurumu.tur === "duraklatildi";

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
      editor.commands.setContent(draftOffer.content);
      /* Önerilen taslak, metin sunucuya kaydedilince silinir (saveNow); o ana kadar yedek olarak
         durur. Sıradaki ÖTEKİ taslaklar silinmez: bir sonraki açılışta yine önerilir. */
      geriYuklenenTaslakRef.current = teklifSirasi[0]?.anahtar ?? null;
      setTeklifSirasi([]);
      showToast("success", t({ tr: "Kaydedilmemiş değişiklikleriniz geri yüklendi.", en: "Your unsaved changes were restored." }));
    } catch {
      showToast("error", t({ tr: "Bağlantı sorunu nedeniyle geri yüklenemedi.", en: "Could not restore due to a connection problem." }));
    } finally {
      setTaslakYukleniyor(false);
    }
  }, [editor, draftOffer, teklifSirasi, initialUpdatedAt, projectId, t]);

  const discardDraft = useCallback(() => {
    // YALNIZCA gösterilen taslak silinir; sıradaki (başka sekmenin) taslak önerilir.
    anahtarlariSil([teklifSirasi[0]?.anahtar]);
    setTeklifSirasi(teklifiYokSay);
  }, [teklifSirasi]);

  // Öteki taslağı göster: hiçbir taslak düşmez, sıra döner (lib/otomatik-kayit → sonrakiTeklif).
  const oncekiTaslagiGoster = useCallback(() => setTeklifSirasi(sonrakiTeklif), []);

  /*
    Taslak teklifi ya da uyumsuz içerik uyarısı yanıtlanana kadar editör salt
    okunur. Eskiden teklif açıkken yazılan ilk harf kaydedilip taslağı
    siliyordu; "Geri yükle"ye basılırsa da arada yazılan metin gidiyordu.
  */
  useEffect(() => {
    draftOfferRef.current = draftOffer;
    /*
      İkinci argüman (emitUpdate) false: Tiptap v3'te setEditable varsayılan
      olarak belge değişmeden bir "update" olayı yayıyor ve onUpdate bunu
      kullanıcı değişikliği sayıyor (markDirty → otomatik kayıt). Yalnızca
      yazılabilirliği değiştirmek belgeyi değiştirmek değildir. Eskiden
      (14.11.2026'ya kadar) bu efekt her açılışta ~1,5 sn sonra içeriği aynı
      bir kayıt gönderiyordu: updated_at ileri gidiyor, 10 dakikada bir
      otomatik sürüm ekleniyor ve ikinci sekme yanlış "başka sekmede
      değiştirildi" çakışmasına düşebiliyordu.
    */
    if (editor && !editor.isDestroyed) editor.setEditable(!draftOffer && !icerikUyumsuz, false);
  }, [editor, draftOffer, icerikUyumsuz]);

  const [uyumsuzYedekleniyor, setUyumsuzYedekleniyor] = useState(false);
  const uyumsuzIcerikleDevam = useCallback(async () => {
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
  }, [projectId, t]);

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
    ATIFA TIKLAMA (K3-A). Belge değişmez: tıklanan noktadaki düz metin
    atıf, o anda çalışmanın kaynaklarıyla eşleştirilir (lib/atif-karti.ts).
    Metin seçiliyken kart açılmaz (seçim işlemleri durumu); belge değişince
    ya da seçim yapılınca kart kapanır.
  */
  const stilTuru: AtifStilTuru = (() => {
    const tur = stilTanimi(citationStyle).tur;
    return tur === "numara" ? "numara" : tur === "dipnot" ? "dipnot" : "yazar-tarih";
  })();
  const cikarmaStili = atifCikarmaStili(stilTanimi(citationStyle));
  const kartVerisiRef = useRef(kartVerisi);
  useEffect(() => {
    kartVerisiRef.current = kartVerisi;
  }, [kartVerisi]);
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const kartiAc = (pos: number) => {
      const $pos = editor.state.doc.resolve(pos);
      if (!$pos.parent.isTextblock) {
        setAtifKarti(null);
        return;
      }
      // Satır içi düğümler (dipnot işareti) metin konumunu kaydırmasın diye yer tutucuyla okunur.
      const metin = $pos.parent.textBetween(0, $pos.parent.content.size, undefined, "\ufffc");
      const ofset = $pos.parent.textBetween(0, $pos.parentOffset, undefined, "\ufffc").length;
      const isabet = tiklananAtif(metin, ofset, stilTuru, cikarmaStili);
      if (!isabet) {
        setAtifKarti(null);
        return;
      }
      const basPos = $pos.start() + isabet.bas;
      const satir = editor.view.coordsAtPos(Math.min(basPos, $pos.end()));
      const kagit = dom.getBoundingClientRect();
      const konum = kartKonumu({
        kagit,
        satir: { left: satir.left, right: satir.right, top: satir.top, bottom: satir.bottom },
        ekranGenisligi: window.innerWidth,
        ekranYuksekligi: window.innerHeight,
        genislik: 300,
        yukseklik: 320,
      });
      const girdiler = () => {
        const bloklar = (editor.getJSON().content ?? []) as Dugum[];
        return kaynakcaGirdileri(bloklar, belgeBolumleri(bloklar).kaynakca).girdiler;
      };
      const hesapla = (veri: NonNullable<typeof kartVerisi>) => {
        const adaylar = atifAdaylari(isabet, veri.kaynaklar, isabet.tur === "numara" ? girdiler() : []);
        return { isabet, adaylar, secilen: adaylar.length === 1 ? adaylar[0] : null, konum };
      };
      const mevcut = kartVerisiRef.current;
      if (mevcut) {
        setAtifKarti(hesapla(mevcut));
        return;
      }
      setAtifKarti({ isabet, adaylar: [], secilen: null, konum });
      setKartYukleniyor(true);
      void Promise.all([kartKaynaklariniOku(), kartPdfleriniOku(projectId), kaynakKunyeDurumlari(projectId)]).then(([kaynakSonuc, pdfSonuc, kunyeSonuc]) => {
        const veri = {
          kaynaklar: kaynakSonuc.okunamadi ? [] : kaynakSonuc.satirlar.filter((k) => k.project_id === projectId),
          pdfler: "hata" in pdfSonuc ? [] : pdfSonuc.satirlar.map((p) => ({ id: p.id, doi: p.doi, kaynakId: p.kaynak_id ?? null })),
          kunye: new Map("hata" in kunyeSonuc ? [] : kunyeSonuc.satirlar.map((k) => [k.kaynakId, k] as const)),
        };
        setKartVerisi(veri);
        setKartYukleniyor(false);
        setAtifKarti((d) => (d && d.isabet === isabet ? hesapla(veri) : d));
      });
    };
    const tikla = (olay: MouseEvent) => {
      if (!editor.state.selection.empty || olay.button !== 0 || olay.detail > 1) return;
      const yer = editor.view.posAtCoords({ left: olay.clientX, top: olay.clientY });
      if (yer) kartiAc(yer.pos);
    };
    /*
      Klavye: imleç bir atfın içindeyken Alt+Enter kartı açar, Esc kapatır.
      Fareyle tıklamak tek yol olsaydı klavye kullanan öğrenci karta ulaşamazdı.
      Kart açılınca odak kartın ilk düğmesine geçer; Esc odağı belgeye geri verir.
    */
    const tus = (olay: KeyboardEvent) => {
      if (olay.key === "Enter" && olay.altKey && editor.state.selection.empty) {
        olay.preventDefault();
        kartiAc(editor.state.selection.from);
        window.setTimeout(() => document.querySelector<HTMLElement>(".atif-karti button, .atif-karti a")?.focus(), 0);
      } else if (olay.key === "Escape") {
        setAtifKarti(null);
      }
    };
    dom.addEventListener("keydown", tus);
    dom.addEventListener("click", tikla);
    /* Kart ekrana sabit: belge kayınca satırdan kopmasın diye kapanır. */
    const kaydirildi = () => setAtifKarti(null);
    window.addEventListener("scroll", kaydirildi, { passive: true });
    const kapat = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) setAtifKarti(null);
    };
    editor.on("transaction", kapat);
    return () => {
      dom.removeEventListener("click", tikla);
      dom.removeEventListener("keydown", tus);
      window.removeEventListener("scroll", kaydirildi);
      editor.off("transaction", kapat);
    };
  }, [editor, stilTuru, cikarmaStili, projectId]);

  /*
    SEÇİM İŞLEMLERİ: metin seçiliyken kâğıdın sağında (yer yoksa seçimin
    altında). Kaydırmada ve seçim değişince yeniden konumlanır.
  */
  useEffect(() => {
    if (!editor) return;
    let kare = 0;
    const konumla = () => {
      kare = 0;
      const { from, to, empty } = editor.state.selection;
      if (empty || !editor.isFocused || window.innerWidth <= 760) {
        setSecimKonumu(null);
        return;
      }
      setAtifKarti(null);
      const bas = editor.view.coordsAtPos(from);
      const son = editor.view.coordsAtPos(to);
      const dom = editor.view.dom as HTMLElement;
      const kagit = dom.getBoundingClientRect();
      /* Metin sütununun sağ kenarı: kâğıdın iç boşluğu ekran ölçeğiyle birlikte (görsel uyum, lib/atif-karti.ts). */
      const olcek = dom.offsetWidth ? kagit.width / dom.offsetWidth : 1;
      const metinSagi = kagit.right - (parseFloat(getComputedStyle(dom).paddingRight) || 0) * olcek;
      setSecimKonumu(
        kartKonumu({
          kagit,
          metinSagi,
          bosluk: 8,
          satir: { left: bas.left, right: son.right, top: bas.top, bottom: son.bottom },
          ekranGenisligi: document.documentElement.clientWidth || window.innerWidth,
          ekranYuksekligi: window.innerHeight,
          genislik: 152,
          yukseklik: 120,
        }),
      );
    };
    const planla = () => {
      if (!kare) kare = window.requestAnimationFrame(konumla);
    };
    const bulanik = () => window.setTimeout(planla, 120);
    editor.on("selectionUpdate", planla);
    editor.on("blur", bulanik);
    editor.on("focus", planla);
    window.addEventListener("scroll", planla, { passive: true, capture: true });
    window.addEventListener("resize", planla);
    return () => {
      editor.off("selectionUpdate", planla);
      editor.off("blur", bulanik);
      editor.off("focus", planla);
      window.removeEventListener("scroll", planla, { capture: true });
      window.removeEventListener("resize", planla);
      if (kare) window.cancelAnimationFrame(kare);
    };
  }, [editor]);

  /* Belge sütununun genişliği: "Sığdır" ölçeği ondan hesaplanır (kâğıt sabit genişlikte, sütun daralınca küçülür). */
  useEffect(() => {
    const ana = anaRef.current;
    if (!ana || typeof ResizeObserver === "undefined") return;
    const gozlem = new ResizeObserver(([g]) => setAnaGenislik(Math.round(g.contentRect.width)));
    gozlem.observe(ana);
    return () => gozlem.disconnect();
  }, [editor]);

  if (!editor) return <div className="manuscript-editor-shell manuscript-editor-loading" aria-busy="true" />;
  /*
    Eylemler (ölçek, kayıt durumu, Kontroller, Dışa aktar) kabuğun üst
    çubuğundaki yuvaya yerleşir (görsel uyum, 19.11.2026: "iki kompakt
    bant"). Eskiden sayfanın kendi başlık satırındaydılar; o satır çalışmanın
    adını üst çubuktan sonra ikinci kez yazıyor, belgeyi 100 px aşağı itiyordu.
    Yuva yoksa (eski kabuk) sayfadaki kutuya düşer.
  */
  const eylemHedefi = document.getElementById("ust-cubuk-yuva") ?? document.getElementById("yazma-eylemleri");
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
      /* Kılavuz penceresi Çalışmalarım'daki kartta açılır (?kilavuz=1).
         20.11.2026'ya kadar bir de "Kurum seç" (link-guideline) vardı ve
         çalışma ayarlarına gönderiyordu; kılavuz isteğe bağlı olunca kalktı. */
      case "upload-guideline":
        window.open(`/dashboard/editor?sec=${encodeURIComponent(projectId)}&kilavuz=1`, "_self");
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
        if (guideline?.settings.pageSize) setPageSize(guideline.settings.pageSize);
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
    Kaynakça ve Kılavuz araçlarının verisi: yeni bir hesap değil, canlı yapı
    denetiminin (liveIssues) ve başlık listesinin süzülmüş hâli. Kaynakça
    başlığı checkStructure'ın tanıdığı adlarla aranır (Kaynakça/Kaynaklar/
    References/Bibliography), aynı sözcükler orada da geçiyor.
  */
  const kaynakcaBasligi = stats.headings.find((h) => /^\s*(\d+(\.\d+)*\.?\s*)?(kaynakça|kaynaklar|references|bibliography)\s*$/i.test(h.text)) ?? null;
  const kaynakcaSorunlari = (liveIssues ?? []).filter((issue) => issue.kategori === "kaynakca");
  const kilavuzSorunlari = (liveIssues ?? []).filter((issue) => issue.kategori !== "kaynakca");
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
  /*
    Sonuç döner (20.11.2026): PDF çekmecesi atıf üretilemediğinde açık kalıp
    hatayı göstersin. Eskiden dönüş yoktu; panel alıntıyı önceden yazıp
    başarısız atıftan sonra "eklendi" gibi kapanıyordu.
    alinti: atıftan önce tırnak içinde yazılır, atıfla AYNI işlemde
    (editor-navigation.ts atifIslemi). kayitliKonum: çekmeceden gelen
    ekleme, öğrencinin editörde bıraktığı yere yazılır.
  */
  /*
    B-16 (20.11.2026): yazım asistanının metnindeki atıfları kaynakçaya
    bağlamanın hazırlığı. Kütüphane okunur, atıflar eşleştirilir
    (lib/ai-atif-esleme.ts; kural sunucudaki denetimle aynı), CSL stilinde
    eksik künyeler citeproc'tan ÖNCEDEN alınır; panel metni ve künyeleri
    tek işlemde yazar. Kütüphane okunamazsa "kaynak yok" sayılmaz: hata
    döner ve metin girmez (okunamayan liste boş liste değildir).
  */
  const aiAtifHazirla = async (metin: string): Promise<AiAtifHazirlik> => {
    const bos: AiAtifHazirlik = { uygula: () => ({ donusen: 0, kaynakcaya: 0 }), belirsiz: [] };
    if (!/\d{4}/.test(metin)) return bos;
    const liste = await kartKaynaklariniOku();
    if (liste.okunamadi) return { ...bos, hata: t({ tr: "kütüphaneniz okunamadı; tekrar deneyin.", en: "your library couldn't be read; try again." }) };
    const eslenebilir = liste.satirlar.map((k) => ({ id: k.id, authors: k.authors, year: k.year, title: k.title }));
    const esleme = aiAtiflariniEsle(metin, eslenebilir, cikarmaStili);
    const eslesenler = esleme.eslesen.map((id) => liste.satirlar.find((k) => k.id === id)).filter((k): k is LiteratureSource => Boolean(k));
    const bugun = new Intl.DateTimeFormat(YEREL[belgeDili], { timeZone: "Europe/Istanbul" }).format(new Date());
    /* CSL: atıf ve künye citeproc'tan ÖNCEDEN alınır (işlem içinde ağ adımı olmaz). Numara, yeni kaynaklar Kaynakça'ya eklenme sırasıyla tahmin edilir. */
    const hazirlar = new Map<string, { atif: { text: string; italic?: boolean }[]; kunye: { text: string; italic?: boolean }[]; dipnot: boolean }>();
    if (csl && eslesenler.length) {
      let sonrakiNumara = atifSirasi(editor.state.doc, eslesenler[0]).number;
      for (const kaynak of eslesenler) {
        const { number, existingIndex } = atifSirasi(editor.state.doc, kaynak);
        const numara = existingIndex >= 0 ? number : sonrakiNumara++;
        const sonuc = await cslAtifUret({
          stil: citationStyle,
          kaynak,
          numara,
          sayfa: null,
          kisa: false,
          dil: belgeDili,
          erisim: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date()),
        }).catch(() => ({ hata: t({ tr: "atıf stili sunucusuna ulaşılamadı.", en: "couldn't reach the citation style server." }) }) as { hata: string; atif?: undefined; kunye?: undefined });
        if (sonuc.hata || !sonuc.atif || !sonuc.kunye?.length) return { ...bos, hata: sonuc.hata ?? t({ tr: "atıf üretilemedi.", en: "the citation couldn't be produced." }) };
        hazirlar.set(kaynak.id, { atif: sonuc.atif, kunye: sonuc.kunye, dipnot: csl.kod === "d" });
      }
    }
    return {
      belirsiz: esleme.belirsiz.map((x) => x.atif),
      uygula: (tr, kayitId) => {
        const kunyeYaz = () => ({
          donusen: 0,
          kaynakcaya: eslesenler.filter((k) => kaynakcaGirdisiIslemi(tr, k, style, { dil: belgeDili, erisimTarihi: bugun, kunye: hazirlar.get(k.id)?.kunye })).length,
        });
        // İz kimliği yoksa (kayıt yazılamadı) metin bulunamaz: yalnızca künyeler.
        if (!kayitId) return kunyeYaz();
        return aiAtiflariniBagla(tr, {
          kayitId,
          kaynakBul: (atif) => {
            const tek = aiAtiflariniEsle(atif, eslenebilir, cikarmaStili);
            return tek.eslesen.length === 1 && !tek.belirsiz.length ? (eslesenler.find((k) => k.id === tek.eslesen[0]) ?? null) : null;
          },
          digerEslesenler: eslesenler,
          style,
          secenek: { dil: belgeDili, erisimTarihi: bugun, kalip: ornekKalibi(ornekAtif), hazir: (k) => hazirlar.get((k as LiteratureSource).id) },
        });
      },
    };
  };

  const handleCite = async (
    source: LiteratureSource,
    secenek: { sayfa?: string | null; alinti?: string | null; kayitliKonum?: boolean; onizle?: boolean } = {},
  ): Promise<{ ok: true; atif?: string } | { ok: false; hata: string }> => {
    const konum = secenek.kayitliKonum && !editor.isFocused ? kayitliImlec.current : null;
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
        /* Belge DEĞİŞMEDİ: alıntı da atıf da yazılmadı (ikisi aynı işlemde). */
        const hata = sonuc.hata ?? t({ tr: "Atıf üretilemedi.", en: "The citation couldn't be produced." });
        showToast("error", hata);
        return { ok: false, hata };
      }
      hazir = { atif: sonuc.atif, kunye: sonuc.kunye ?? [], dipnot: csl.kod === "d" };
    }
    /*
      ÖNİZLEME (20.11.2026, PDF çekmecesinin onay katmanı): atıf, eklenecek
      işlemin AYNISIYLA ama gönderilmeyen bir işlemde kurulur; belgeye hiçbir
      şey yazılmaz. Önizlenen metin, "Ekle"de yazılanla aynı yoldan gelir
      (aynı stil, kalıp, sayfa, konum); ayrı bir biçimleyiciyle tahmin edilmez.
    */
    if (secenek.onizle) {
      const { citation } = atifIslemi(editor.state.tr, source, style, {
        sayfa: secenek.sayfa,
        erisimTarihi: bugun,
        kalip: ornekKalibi(ornekAtif),
        dil: belgeDili,
        hazir,
        konum,
      });
      return { ok: true, atif: citation };
    }
    const { citation, addedReference } = insertCitation(editor, source, style, {
      sayfa: secenek.sayfa,
      erisimTarihi: bugun,
      kalip: ornekKalibi(ornekAtif),
      dil: belgeDili,
      hazir,
      alinti: secenek.alinti,
      konum,
      odaklanma: !secenek.kayitliKonum,
    });
    /* Eksik künye bilgisi sessizce düşmüyor: kaynakçaya ne eksik yazıldığı söyleniyor.
       Atıf EKLENDİ: bildirim "info". Eskiden "error" türündeydi ve başarılı bir
       ekleme kırmızı "İşlem tamamlanamadı" başlığıyla gösteriliyordu (20.11.2026). */
    const eksik = addedReference ? eksikAlanlar(source, dil) : [];
    const eksikMetni = eksik.join(", ");
    showToast(
      eksik.length ? "info" : "success",
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
    return { ok: true, atif: citation };
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
  /*
    Sürüm geri yüklendi: BU sekmenin taslağı (ve sekmesiz eski anahtarlar) eski metne göre
    yazılmıştı, silinir. Başka sekmelerin taslaklarına DOKUNULMAZ: eskiden hepsi siliniyordu
    ve o sekmede kaydedilememiş metin varsa, sekme kapandığında kurtarma kopyası kalmıyordu.
    Ötekilerin güvenliği yerinde: o sekmenin bir sonraki kaydı updated_at çakışmasına düşer
    (sessizce üzerine yazmaz), taslak önerilirse "metin başka yerde değişmiş" uyarısı çıkar ve
    geri yükleme önce sunucudaki hâli sürüm geçmişine yedekler.
  */
  const handleRestored = () => {
    kendiTaslaginiSil(projectId, kullaniciId, sekmeAnahtari());
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
              ? t({ tr: `Kaydedildi · ${saatEtiketi(lastSavedAt, dil, saatDilimi)}`, en: `Saved · ${saatEtiketi(lastSavedAt, dil, saatDilimi)}` })
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
      {/*
        SOL ARAÇLAR: çalışma gezinmesinin yuvasına (os-gezinme.tsx). Bir kez
        açılan araç söküLMEZ; gizlenir.
      */}
      {solYuva
        ? createPortal(
            <>
              {acilanAraclar.includes("bolumler") ? (
                <div className="sol-arac" hidden={solArac !== "bolumler"}>
                  <SolBolumler
                    projectId={projectId}
                    gorunur={solArac === "bolumler"}
                    basliklar={stats.headings}
                    bolumler={sections}
                    onJump={(baslik) => {
                      handleJump(baslik);
                      solAraciKapatDarsa();
                    }}
                    onInsert={handleInsertSections}
                  />
                </div>
              ) : null}
              {acilanAraclar.includes("kaynaklar") ? (
                <div className="sol-arac" hidden={solArac !== "kaynaklar"}>
                  <SolKaynaklar
                    projectId={projectId}
                    gorunur={solArac === "kaynaklar"}
                    onCite={(kaynak) => {
                      void handleCite(kaynak);
                      solAraciKapatDarsa();
                    }}
                    onPdfAc={(id) => {
                      setAcilacakPdf({ id, anahtar: Date.now() });
                      sagAc("pdf");
                      solAraciKapatDarsa();
                    }}
                  />
                </div>
              ) : null}
              {acilanAraclar.includes("arama") ? (
                <div className="sol-arac" hidden={solArac !== "arama"}>
                  <SolArama
                    projectId={projectId}
                    projeAdi={projectDefaults?.title ?? ""}
                    gorunur={solArac === "arama"}
                    onPdfOku={(id) => {
                      /* Makale Bul → "PDF'yi oku" (M7): uygulama içi okuyucu; indirme ayrı eylem olarak kalır. */
                      setAcilacakPdf({ id, anahtar: Date.now() });
                      sagAc("pdf");
                    }}
                  />
                </div>
              ) : null}
              {/*
                KAYNAKÇA ve KILAVUZ VE BİÇİM (19.11.2026, kabul turu 2; onaylı
                prototipin "Kontrol et" grubu). Eskiden ikisi de yalnızca "Özet ve
                teslim"in, Kontroller menüsünün ve inceleme panelinin içindeydi;
                kılavuzun durumu ise belgenin üstünde KALICI bir şeritti ("Bu
                çalışmaya bağlı kılavuz yok · Kılavuzumu yükle · Kurumu seç").
                Şerit kalktı, içeriği burada; "Kurumu seç" bağlantısı da 20.11.2026'da
                kalktı (kılavuz isteğe bağlı, ArvoLab kurum seçtirmiyor). Hiçbir işlev
                kaldırılmadı: Kontroller menüsü ve inceleme paneli aynen duruyor,
                buradaki düğmeler aynı işleyicileri çağırıyor.
              */}
              {acilanAraclar.includes("kaynakca") ? (
                <div className="sol-arac" hidden={solArac !== "kaynakca"}>
                  <div className="sol-arac-govde">
                    <p className="sol-arac-satir">
                      <span>{t({ tr: "Atıf stili", en: "Citation style" })}</span>
                      <b>{stilAdi(citationStyle)}</b>
                    </p>
                    {kaynakcaBasligi ? (
                      <button
                        type="button"
                        className="projects-filter-button button-compact"
                        onClick={() => {
                          handleJump(kaynakcaBasligi);
                          solAraciKapatDarsa();
                        }}
                      >
                        {t({ tr: `“${kaynakcaBasligi.text}” bölümüne git`, en: `Go to “${kaynakcaBasligi.text}”` })}
                      </button>
                    ) : (
                      <p className="sol-arac-bos">
                        {t({
                          tr: "Belgede “Kaynakça” başlığı yok. Kaynakça bir başlık altında olmalı; atıf eklediğinizde kaynak oraya yazılır.",
                          en: "The document has no “References” heading. The reference list should sit under a heading; cited sources are written there.",
                        })}
                      </p>
                    )}
                    <section className="sol-arac-bolum" aria-label={t({ tr: "Atıf ve kaynakça uyumu", en: "Citation and reference match" })}>
                      <h3>{t({ tr: "Atıf ve kaynakça uyumu", en: "Citation and reference match" })}</h3>
                      {kaynakcaSorunlari.length === 0 ? (
                        <p className="sol-arac-bos">
                          {liveIssues
                            ? t({ tr: "Yazarken yapılan denetimde atıf–kaynakça sorunu yok.", en: "The live check found no citation–reference issues." })
                            : t({ tr: "Denetim yazmaya başlayınca çalışır.", en: "The check runs once you start writing." })}
                        </p>
                      ) : (
                        <ul className="sol-sorun-listesi">
                          {kaynakcaSorunlari.map((issue, i) => (
                            <li key={`${issue.message}-${i}`} data-ton={issue.tone}>
                              <span>{issue.message}</span>
                              {sorunEylemi(issue, solAraciKapatDarsa)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                    <section className="sol-arac-bolum" aria-label={t({ tr: "Atıf yapılmamış kaynaklar", en: "Sources not cited yet" })}>
                      <BekleyenKaynaklarKarti
                        projectId={projectId}
                        govdeMetni={govdeMetni}
                        numarali={NUMERIC_STYLES.includes(style)}
                        belgeDili={belgeDili}
                        onCite={(source) => void handleCite(source)}
                      />
                    </section>
                    <div className="sol-arac-eylem">
                      <button type="button" className="projects-filter-button button-compact" onClick={handleCheck} disabled={checking}>
                        {checking ? t({ tr: "Kontrol ediliyor...", en: "Checking..." }) : t({ tr: "Kılavuz ve kaynakça kontrolü", en: "Guideline and reference check" })}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {acilanAraclar.includes("kilavuz") ? (
                <div className="sol-arac" hidden={solArac !== "kilavuz"}>
                  <div className="sol-arac-govde">
                    {guideline ? (
                      <>
                        <p className="sol-arac-kilavuz">
                          <b>{kilavuzGorunenAdi(guideline.label, dil)}</b>
                          <span>
                            {stilAdi(guideline.citationStyle)}
                            {guideline.versionLabel ? ` · ${guideline.versionLabel}` : ""}
                            {formatDate(guideline.version)
                              ? t({ tr: ` · Onay: ${formatDate(guideline.version)}`, en: ` · Approved: ${formatDate(guideline.version)}` })
                              : ""}
                          </span>
                          {!guideline.dogrulandi ? <small>{t({ tr: "Kendi yüklediğiniz kılavuz", en: "A guideline you uploaded" })}</small> : null}
                        </p>
                        <div className="sol-arac-eylem">
                          <button type="button" className="projects-filter-button button-compact" onClick={() => setGuidelineOpen(true)}>
                            {t({ tr: "Kuralları gör", en: "View rules" })}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="sol-arac-bos">
                          {/* Kılavuz isteğe bağlı (20.11.2026); kılavuzsuz yazma ve dışa aktarma çalışır. */}
                          {t({
                            tr: "Yazım kılavuzunuz varsa yükleyebilirsiniz (PDF ya da web adresi); onayladığınız kurallar editöre uygulanır.",
                            en: "If you have a writing guideline, you can upload it (PDF or web address); the rules you approve are applied to the editor.",
                          })}
                        </p>
                        <div className="sol-arac-eylem">
                          <Link className="projects-filter-button button-compact" href={calismaAdresi(projectId, { kilavuz: true })}>
                            {t({ tr: "Kılavuz yükle", en: "Upload guideline" })}
                          </Link>
                        </div>
                      </>
                    )}
                    <section className="sol-arac-bolum" aria-label={t({ tr: "Biçim", en: "Format" })}>
                      <h3>{t({ tr: "Biçim", en: "Format" })}</h3>
                      <p className="sol-arac-satir">
                        <span>{t({ tr: "Kenar boşlukları", en: "Margins" })}</span>
                        <b>{t({ tr: `üst ${margins.top} · alt ${margins.bottom} · sol ${margins.left} · sağ ${margins.right} cm`, en: `top ${margins.top} · bottom ${margins.bottom} · left ${margins.left} · right ${margins.right} cm` })}</b>
                      </p>
                      <p className="sol-arac-satir">
                        <span>{t({ tr: "Başlık numaraları", en: "Heading numbers" })}</span>
                        <b>{headingNumbering ? t({ tr: "Açık", en: "On" }) : t({ tr: "Kapalı", en: "Off" })}</b>
                      </p>
                      <p className="sol-arac-satir">
                        <span>{t({ tr: "Sayfa numarası", en: "Page numbers" })}</span>
                        <b>{showPageNumbers ? t({ tr: "Açık", en: "On" }) : t({ tr: "Kapalı", en: "Off" })}</b>
                      </p>
                      {guideline?.settings.margins || guideline?.settings.pageSize ? (
                        <button type="button" className="projects-filter-button button-compact" onClick={() => handleChecklistAction("apply-page-setup")}>
                          {t({ tr: "Sayfa düzenini kılavuza göre ayarla", en: "Set the page layout from the guideline" })}
                        </button>
                      ) : null}
                    </section>
                    <section className="sol-arac-bolum" aria-label={t({ tr: "Yapı uyarıları", en: "Structure warnings" })}>
                      <h3>{t({ tr: "Yapı uyarıları", en: "Structure warnings" })}</h3>
                      {kilavuzSorunlari.length === 0 ? (
                        <p className="sol-arac-bos">{t({ tr: "Yazarken yapılan denetimde yapı sorunu yok.", en: "The live check found no structure issues." })}</p>
                      ) : (
                        <ul className="sol-sorun-listesi">
                          {kilavuzSorunlari.map((issue, i) => (
                            <li key={`${issue.message}-${i}`} data-ton={issue.tone}>
                              <span>{issue.message}</span>
                              {sorunEylemi(issue, solAraciKapatDarsa)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                    <div className="sol-arac-eylem">
                      <button type="button" className="projects-filter-button button-compact" onClick={handleCheck} disabled={checking}>
                        {checking ? t({ tr: "Kontrol ediliyor...", en: "Checking..." }) : t({ tr: "Kılavuz ve kaynakça kontrolü", en: "Guideline and reference check" })}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>,
            solYuva,
          )
        : null}
      {eylemHedefi
        ? createPortal(
            <>
              {/*
                BELGE ÖLÇEĞİ (19.11.2026). Yalnızca masaüstünde, kâğıt sabit
                genişlikteyken: belge yeniden akmaz, ekranda büyür/küçülür.
                Punto, sayfa biçimi ve dışa aktarma DEĞİŞMEZ; bu açıklama
                sürekli üst çubukta yer kaplamasın diye düğmelerin ipucunda
                ve ekran okuyucu metninde.
              */}
              {karar?.sabitKagit ? (
                <div
                  className="belge-olcek"
                  role="group"
                  aria-label={t({ tr: "Belge ölçeği", en: "Document zoom" })}
                  title={t({
                    tr: "Yalnızca ekrandaki görünüm değişir; punto, sayfa biçimi ve dışa aktarma aynı kalır.",
                    en: "Only the on-screen view changes; font size, page format and export stay the same.",
                  })}
                >
                  <button type="button" className="belge-olcek-dugme" aria-label={t({ tr: "Küçült", en: "Zoom out" })} onClick={() => olcekSec(olcekAdimi(belgeOlcegi, -1))}>
                    <OlcekEksi size={14} aria-hidden="true" />
                  </button>
                  <output className="belge-olcek-deger" aria-live="polite">
                    {Math.round(belgeOlcegi * 100)}%
                  </output>
                  <button type="button" className="belge-olcek-dugme" aria-label={t({ tr: "Büyüt", en: "Zoom in" })} onClick={() => olcekSec(olcekAdimi(belgeOlcegi, 1))}>
                    <OlcekArti size={14} aria-hidden="true" />
                  </button>
                  <button type="button" className="belge-olcek-sigdir" aria-pressed={olcekTercihi === "sigdir"} onClick={() => olcekSec("sigdir")}>
                    {t({ tr: "Sığdır", en: "Fit" })}
                  </button>
                  <span className="sr-only">
                    {t({
                      tr: "Yalnızca ekrandaki görünüm değişir; punto, sayfa biçimi ve dışa aktarma aynı kalır.",
                      en: "Only the on-screen view changes; font size, page format and export stay the same.",
                    })}
                  </span>
                </div>
              ) : null}
              {/*
                SADE ÜST BÖLÜM (ikinci tur, 17.11.2026). Kayıt durumu başlığın
                yanında; üç "kontrol" işlemi (teslim kontrol listesi, kılavuz ve
                kaynakça kontrolü, inceleme paneli) tek "Kontroller" menüsünde.
                Eskiden başlıkta dört düğme, belgenin üstünde ayrı bir kayıt
                şeridi ve araç çubuğunda ayrıca "Kontroller" vardı: aynı aile
                üç yere dağılmıştı. Teslim durumu (3/5) menü düğmesinde görünür.
              */}
              <button
                type="button"
                className="save-status yazma-kayit"
                data-state={saveState}
                title={t({ tr: "Şimdi kaydet (Ctrl+S)", en: "Save now (Ctrl+S)" })}
                aria-live="polite"
                onClick={() => void saveNow()}
              >
                {statusLabel}
              </button>
              <AracMenusu
                dugmeSinifi="projects-filter-button"
                ikon={<ClipboardCheck size={15} aria-hidden="true" />}
                etiket={t({ tr: `Kontroller · ${checklist.done}/${checklist.total}`, en: `Checks · ${checklist.done}/${checklist.total}` })}
                aciklama={t({
                  tr: `Kontroller: teslim kontrolü ${checklist.done}/${checklist.total}, kılavuz ve kaynakça kontrolü, inceleme paneli`,
                  en: `Checks: submission checklist ${checklist.done}/${checklist.total}, guideline and reference check, review panel`,
                })}
              >
                <button type="button" className="arac-menu-oge" onClick={() => setChecklistOpen(true)}>
                  <ClipboardCheck size={16} aria-hidden="true" />
                  <span>
                    {t({ tr: `Teslim kontrolü · ${checklist.done}/${checklist.total}`, en: `Submission checklist · ${checklist.done}/${checklist.total}` })}
                    {/* Kuralların kaynağı: pencereyi açmadan "neye göre hazır" sorusunun cevabı. */}
                    {guideline && !guideline.dogrulandi ? <small className="kural-kaynagi"> · {t({ tr: "kendi kılavuzunuz", en: "your own guideline" })}</small> : null}
                  </span>
                </button>
                {/*
                  Adı NE DENETLEDİĞİNİ söylüyor: kılavuzun zorunlu bölümleri, atıf
                  stili ve kaynakça–atıf eşleşmesi. Teslim kontrolü bir liste,
                  canlı yapı rozeti inceleme panelinde.
                */}
                <button
                  type="button"
                  className="arac-menu-oge"
                  onClick={handleCheck}
                  disabled={checking}
                  title={t({
                    tr: "Kılavuzun zorunlu bölümleri, atıf stili ve kaynakça–atıf eşleşmesi",
                    en: "Required guideline sections, citation style and reference–citation matching",
                  })}
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>{checking ? t({ tr: "Kontrol ediliyor...", en: "Checking..." }) : t({ tr: "Kılavuz ve kaynakça kontrolü", en: "Guideline and reference check" })}</span>
                </button>
                {/*
                  Sağ yuva tek: AI ya da PDF açıkken inceleme paneli gösterilmez.
                  Eskiden düğme o sırada "İnceleme panelini kapat" diyordu (tercih
                  açıktı) ama panel ekranda yoktu; basmak onu kapatıyordu. Artık
                  sağ panel açıkken düğme panele GEÇER: sağ panel kapanır,
                  inceleme açılır. Özellik kaybolmuyor, yalnızca yer paylaşıyor.
                */}
                <button
                  type="button"
                  className="arac-menu-oge"
                  aria-pressed={incelemeAcik && !sag}
                  onClick={() => {
                    if (sag) {
                      sagAc(null);
                      tercihYaz(INCELEME_TERCIHI, true);
                    } else tercihYaz(INCELEME_TERCIHI, !incelemeAcik);
                    if (!sag && incelemeAcik) return;
                    /* Telefonda panel belgenin altında akar (önce yazma alanı); açılınca oraya kaydırılır, yoksa açıldığı görünmez. */
                    if (window.matchMedia("(max-width: 760px)").matches) {
                      window.setTimeout(() => document.querySelector(".manuscript-outline")?.scrollIntoView({ block: "start" }), 50);
                    }
                  }}
                >
                  {incelemeAcik && !sag ? <PanelRightClose size={16} aria-hidden="true" /> : <PanelRightOpen size={16} aria-hidden="true" />}
                  <span>
                    {sag
                      ? t({ tr: "İnceleme paneline geç", en: "Switch to review panel" })
                      : incelemeAcik
                        ? t({ tr: "İnceleme panelini kapat", en: "Close review panel" })
                        : t({ tr: "İnceleme panelini aç", en: "Open review panel" })}
                  </span>
                </button>
              </AracMenusu>
              {/* Üç çıktı tek menüde (04.11.2026): başlık satırı tek satıra sığsın. */}
              <AracMenusu
                dugmeSinifi="projects-filter-button"
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
            </>,
            eylemHedefi,
          )
        : null}
    <div
      className="manuscript-layout"
      ref={yerlesimRef}
      data-inceleme={incelemeAcik ? "" : undefined}
      data-inceleme-yer={karar && karar.inceleme !== "yok" ? karar.inceleme : undefined}
      data-odak={odak ? "" : undefined}
      data-pdf={kaynakAcik ? "" : undefined}
      data-asistan={yazimAcik ? "" : undefined}
      data-sag={sag ?? undefined}
      data-sag-cekmece={sag && karar?.sag !== "sutun" ? "" : undefined}
      data-sabit-kagit={karar?.sabitKagit ? "" : undefined}
    >
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
      <div className="manuscript-araclar" role="toolbar" aria-label={t({ tr: "Biçimlendirme", en: "Formatting" })}>
        <div className="arac-grup">
          <div className="arac-segment" role="group" aria-label={t({ tr: "Geri al ve yinele", en: "Undo and redo" })}>
          <ToolbarButton label={t({ tr: "Geri al (Ctrl+Z)", en: "Undo (Ctrl+Z)" })} disabled={!ui.canUndo} onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Yinele (Ctrl+Y)", en: "Redo (Ctrl+Y)" })} disabled={!ui.canRedo} onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 size={16} />
          </ToolbarButton>
          </div>
        </div>
        <div className="arac-grup arac-grup-yazi">
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
        </div>
        <div className="arac-grup">
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
        </div>
        <div className="arac-grup">
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
        </div>
        <div className="arac-grup">
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
          <AracMenusu ikon={<AlignLeft size={16} />} etiket={t({ tr: "Paragraf", en: "Paragraph" })} aciklama={t({ tr: "Hizalama, satır aralığı, girinti", en: "Alignment, line spacing, indent" })}>
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
          </AracMenusu>
        </div>
        <div className="arac-grup">
          <AracMenusu ikon={<Plus size={16} />} etiket={t({ tr: "Ekle", en: "Insert" })} aciklama={t({ tr: "Tablo, resim, dipnot, analiz, başlık…", en: "Table, image, footnote, analysis, caption…" })}>
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
          </AracMenusu>
          {/*
            Tablo kontrolleri: yalnızca imleç tablodayken. Eskiden hiç yoktu:
            tablo 3×3 ekleniyor, sütun eklemenin ya da tabloyu silmenin yolu
            yoktu. Tablo dışındayken tıklanamaz sekiz düğme kalabalıktan
            başka bir şey değil; bu yüzden menü de yalnızca tabloda görünür.
          */}
          {ui.inTable ? (
            <AracMenusu ikon={<TableIcon size={16} />} etiket={t({ tr: "Tablo", en: "Table" })}>
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
            </AracMenusu>
          ) : null}
        </div>
        <div className="arac-grup arac-grup-asistan">
          {/* Yazım asistanı (03.11.2026): sohbette yazar, ekleme öğrencinin (yazim-paneli.tsx). */}
          <ToolbarButton
            label={t({ tr: "Yazım asistanı", en: "Writing assistant" })}
            metin={t({ tr: "Asistan", en: "Assistant" })}
            active={yazimAcik}
            onClick={() => sagAc(yazimAcik ? null : "ai")}
          >
            <Sparkles size={16} />
          </ToolbarButton>
          <ToolbarButton
            label={t({ tr: "Kaynak PDF: editörün yanında oku, pasaj seç, Arvo AI'a sor, doğrulanmış atıf ekle", en: "Source PDF: read beside the editor, select a passage, ask Arvo AI, insert a verified citation" })}
            metin={t({ tr: "PDF", en: "PDF" })}
            active={kaynakAcik}
            onClick={() => sagAc(kaynakAcik ? null : "pdf")}
          >
            <FileText size={16} />
          </ToolbarButton>
          <ToolbarButton
            label={oneriDuraklatildi && oneriDurumu.tur === "duraklatildi" ? t({
              tr: `Otomatik öneri duraklatıldı: ${oneriDurumu.mesaj}${oneriAcilisDk ? ` Yaklaşık ${oneriAcilisDk} dk sonra kendiliğinden sürer.` : ""} Kapatmak için tıklayın.`,
              en: `Automatic suggestions paused: ${oneriDurumu.mesaj}${oneriAcilisDk ? ` Resumes in about ${oneriAcilisDk} min.` : ""} Click to turn off.`,
            }) : t({
              tr: otomatikOneri
                ? "Otomatik öneri açık: yazma durunca gri öneri gelir, Tab ile kabul edersiniz. Kapatmak için tıklayın. (Her öneri saatlik asistan hakkınızdan ve kurum kredisinden düşer; Alt+/ ile istediğiniz an isteyebilirsiniz.)"
                : "Otomatik öneri kapalı. Alt+/ ile imlece öneri isteyin; Tab kabul eder, Esc vazgeçer. Açmak için tıklayın.",
              en: otomatikOneri
                ? "Automatic suggestions on: a grey suggestion appears when you pause; press Tab to accept. Click to turn off. (Each suggestion uses an assistant credit; press Alt+/ any time.)"
                : "Automatic suggestions off. Press Alt+/ for a suggestion at the cursor; Tab accepts, Esc dismisses. Click to turn on.",
            })}
            metin={oneriDuraklatildi ? t({ tr: oneriAcilisDk ? `Öneri · ${oneriAcilisDk} dk` : "Öneri · duraklatıldı", en: oneriAcilisDk ? `Suggest · ${oneriAcilisDk} min` : "Suggest · paused" }) : t({ tr: "Öneri", en: "Suggest" })}
            active={otomatikOneri}
            onClick={() => {
              oneriDurumunuSifirla();
              /*
                Geri bildirim (20.11.2026): düğme eskiden yalnızca modu
                sessizce değiştiriyordu; tıklayan öğrenci bir öneri
                bekliyor, hiçbir şey görmüyor ve "çalışmıyor" diyordu.
              */
              const acik = !otomatikOneri;
              otomatikOneriAyarla(acik);
              showToast(
                "info",
                acik
                  ? t({
                      tr: "Otomatik öneri açık: paragrafın sonunda yazmayı bıraktığınızda gri bir devam görünür. Tab (telefonda “Ekle”) kabul eder, Esc kapatır.",
                      en: "Automatic suggestions on: when you pause at the end of a paragraph a grey continuation appears. Tab (“Add” on phones) accepts, Esc dismisses.",
                    })
                  : t({ tr: "Otomatik öneri kapalı. Alt+/ ile istediğiniz an öneri isteyebilirsiniz.", en: "Automatic suggestions off. Press Alt+/ any time for a suggestion." }),
              );
              editor?.commands.focus();
            }}
          >
            <WandSparkles size={16} />
          </ToolbarButton>
          <ToolbarButton
            label={t({ tr: "Seçili cümleye kaynak bul", en: "Find a source for the selected sentence" })}
            metin={t({ tr: "Kaynak bul", en: "Find source" })}
            onClick={() => {
              /* Seçim yoksa imlecin paragrafı: öğrenci cümleyi seçmeyi bilmeyebilir. */
              const { from, to, $from } = editor.state.selection;
              setKaynakBulCumle(from !== to ? editor.state.doc.textBetween(from, to, " ") : $from.parent.textContent);
              setKaynakBulAcik(true);
            }}
          >
            <SearchCheck size={16} />
          </ToolbarButton>
          <ToolbarButton label={t({ tr: "Kaynaktan atıf ekle", en: "Cite a source" })} metin={t({ tr: "Atıf", en: "Citation" })} onClick={() => setCiteOpen(true)}>
            <BookMarked size={16} />
          </ToolbarButton>
        </div>
        <div className="arac-grup arac-grup-son">
          {/*
            "Bul" ve "Odak modu" 17.11.2026'dan beri "Belge" menüsünde (premium
            çalışma alanı: ince araç çubuğu). Eskiden çubuktaydılar ve 1440 px'te
            çubuk 323 px taşıyor, sağdaki "Kontroller" kaydırmadan görünmüyordu.
            Ctrl+F ve Esc kısayolları değişmedi.
          */}
          <AracMenusu ikon={<MoreHorizontal size={16} />} etiket={t({ tr: "Belge", en: "Document" })} aciklama={t({ tr: "Bul, odak modu, sayfa ayarı, kapak, paylaş, sürümler, kısayollar", en: "Find, focus mode, page setup, cover, share, versions, shortcuts" })} etiketiGizle>
          <ToolbarButton label={t({ tr: "Bul ve değiştir (Ctrl+F)", en: "Find and replace (Ctrl+F)" })} metin={t({ tr: "Bul ve değiştir", en: "Find and replace" })} active={findOpen} onClick={() => setFindOpen((open) => !open)}>
            <Search size={16} />
          </ToolbarButton>
          <ToolbarButton
            label={odak ? t({ tr: "Odak modundan çık (Esc)", en: "Exit focus mode (Esc)" }) : t({ tr: "Odak modu: yalnızca metin", en: "Focus mode: just the text" })}
            metin={odak ? t({ tr: "Odak modundan çık", en: "Exit focus mode" }) : t({ tr: "Odak modu", en: "Focus mode" })}
            active={odak}
            onClick={() => setOdak((o) => !o)}
          >
            {odak ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </ToolbarButton>
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
          <ToolbarButton label={t({ tr: "Klavye kısayolları", en: "Keyboard shortcuts" })} metin={t({ tr: "Kısayollar", en: "Shortcuts" })} onClick={() => setShortcutsOpen(true)}>
            <Keyboard size={16} />
          </ToolbarButton>
          </AracMenusu>
          {/* İncele panelini yeniden açma (yukarıda "PANELİ YENİDEN AÇMA"). Sağ panel (AI/PDF) aynı yeri kullanırken ve odak modunda çizilmez; o durumda Kontroller menüsündeki "İnceleme paneline geç" var. */}
          {!incelemeAcik && !sag && !odak ? (
            <button
              type="button"
              className="inceleme-ac-dugme"
              onClick={incelemeyiAc}
              aria-label={t({ tr: "İncele panelini aç", en: "Open Review panel" })}
              title={t({ tr: "İncele panelini aç", en: "Open Review panel" })}
            >
              <PanelRightOpen size={16} aria-hidden="true" />
              <span>{t({ tr: "İncele", en: "Review" })}</span>
            </button>
          ) : null}
        </div>
      </div>

    <div className="manuscript-main" ref={anaRef}>
    <div className="manuscript-editor-shell">
      {/* Bul-değiştir belgenin üstünde, yapışık. Kayıt durumu 17.11.2026'dan beri sayfa başlığında (yukarıdaki portal); eskiden burada ayrı bir şerit her zaman ~48 px tutuyordu. */}
      {findOpen ? (
        <div className="manuscript-toolbar manuscript-ust">
          <FindReplaceBar editor={editor} onClose={() => setFindOpen(false)} />
        </div>
      ) : null}

      {icerikUyumsuz ? (
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
            {teklifSirasi.length > 1
              ? t({
                  tr: `Bu çalışma için ${teklifSirasi.length - 1} taslak daha var (başka bir sekmeden). `,
                  en: `There ${teklifSirasi.length - 1 === 1 ? "is" : "are"} ${teklifSirasi.length - 1} more ${teklifSirasi.length - 1 === 1 ? "draft" : "drafts"} for this work (from another tab). `,
                })
              : ""}
            {t({ tr: "Karar verene kadar editör salt okunur.", en: "The editor is read-only until you decide." })}
          </span>
          <span className="cluster">
            <button type="button" className="projects-primary-button" disabled={taslakYukleniyor} onClick={() => void restoreDraft()}>
              {t({ tr: "Geri yükle", en: "Restore" })}
            </button>
            {teklifSirasi.length > 1 ? (
              <button type="button" className="projects-filter-button" disabled={taslakYukleniyor} onClick={oncekiTaslagiGoster}>
                {t({ tr: "Öncekini göster", en: "Show the other draft" })}
              </button>
            ) : null}
            <button type="button" className="projects-filter-button" disabled={taslakYukleniyor} onClick={discardDraft}>
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
            {/*
              Zorla kayıt artık reddedilebiliyor (P52a2): öteki sürüm
              yedeklenemezse ya da yedekten sonra metin yeniden değiştiyse
              hiçbir şey yazılmıyor ve çakışma bandı yerinde kalıyor. Bildirim
              olmasa düğme "hiçbir şey yapmadı" gibi görünürdü.
            */}
            <button
              type="button"
              className="button-danger"
              onClick={() =>
                void saveNow(true).then((kaydedildi) => {
                  if (!kaydedildi)
                    showToast(
                      "error",
                      t({
                        tr: "Sürümünüz kaydedilmedi: öteki sürüm yedeklenemedi ya da metin bu arada yeniden değişti. Hiçbir metin silinmedi; biraz sonra yeniden deneyin.",
                        en: "Your version was not saved: the other version could not be backed up, or the text changed again in the meantime. Nothing was deleted; try again shortly.",
                      })
                    );
                })
              }
            >
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
      ) : null /*
          KILAVUZ YOK ŞERİDİ KALKTI (19.11.2026, kabul turu 2): eskiden kılavuzu
          olmayan tezde belgenin üstünde kalıcı bir satırdı ("Bu çalışmaya bağlı
          kılavuz yok · Kılavuzumu yükle · Kurumu seç"). İçeriği ve iki bağlantısı
          çalışma menüsündeki "Kılavuz ve biçim" aracında (sol=kilavuz).
        */}

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
        onKapat={incelemeyiKapat}
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
        <YazimIpuclariKarti editor={editor} onFind={handleFindText} />
        <YazarlikRaporuKarti editor={editor} onFind={handleFindText} />
        <BekleyenKaynaklarKarti
          projectId={projectId}
          govdeMetni={govdeMetni}
          numarali={NUMERIC_STYLES.includes(style)}
          belgeDili={belgeDili}
          onCite={(source) => void handleCite(source)}
        />
        <ManuscriptComments projectId={projectId} getQuote={() => selectedText(editor)} onFind={handleFindText} />
      </ManuscriptOutline>

      {sag && karar?.sag === "sutun" ? (
        <SagPanelAyirici panel={sag} genislik={sagGenislik} enCok={karar.sagEnCok} onDegis={sagGenislikDegisti} yerlesim={yerlesimiAl} />
      ) : null}
      {/*
        PDF ÇEKMECESİNİN ARKASI (20.11.2026): editör hafifçe kararır, yerinden
        oynamaz; tıklamak çekmeceyi kapatır (Esc gibi). Telefonda çekmece tam
        ekran olduğu için örtü yok (workspace.css).
      */}
      {kaynakAcik ? <div className="pdf-cekmece-ortu" aria-hidden="true" onClick={pdfKapat} /> : null}
      <KaynakPdfPaneli
        editor={editor}
        projectId={projectId}
        acik={kaynakAcik}
        acilacak={acilacakPdf}
        onKapat={pdfKapat}
        onCite={handleCite}
        genislik={kaynakAcik ? sagGenislik : undefined}
        onGenislik={sagGenislikDegisti}
        onDogrulanmisPasaj={(p) => setDogrulanmisPasajlar((onceki) => [...onceki, p])}
        onBagDegisti={() => setKartVerisi(null)}
      />
      {atifKarti ? (
        <AtifKarti
          durum={atifKarti}
          projectId={projectId}
          kaynaklar={kartVerisi?.kaynaklar ?? []}
          pdfBul={(k) => (kartVerisi ? pdfEslesmesi(k, kartVerisi.pdfler) : { tur: "yok" })}
          kunye={kartVerisi?.kunye ?? new Map()}
          pasajlar={dogrulanmisPasajlar}
          yukleniyor={kartYukleniyor}
          onSec={(id) => setAtifKarti((d) => (d ? { ...d, secilen: id } : d))}
          onKapat={() => {
            setAtifKarti(null);
            editor.commands.focus();
          }}
          onPdfAc={(id) => {
            setAcilacakPdf({ id, anahtar: Date.now() });
            sagAc("pdf");
            setAtifKarti(null);
          }}
          onDayanagaGit={(p) => {
            setAcilacakPdf({ id: p.pdfId, anahtar: Date.now(), sayfa: p.sayfa, pasaj: p.metin });
            sagAc("pdf");
            setAtifKarti(null);
          }}
          onKaynaklariAc={() => {
            const u = new URL(window.location.href);
            u.searchParams.set("sol", "kaynaklar");
            window.history.pushState(window.history.state, "", u.pathname + u.search);
            setAtifKarti(null);
          }}
        />
      ) : secimKonumu ? (
        <SecimIslemleri
          konum={secimKonumu}
          onAi={() => sagAc("ai")}
          onDayanak={() => {
            const { from, to } = editor.state.selection;
            setKaynakBulCumle(editor.state.doc.textBetween(from, to, " "));
            setKaynakBulAcik(true);
          }}
          onAtif={() => setCiteOpen(true)}
        />
      ) : null}

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
              {/* "uyum /100" yerine açık sorun sayısı (20.11.2026): puan biçim
                  uyarılarını saymadığı için uyarı varken 100 görünüyordu. */}
              {checkResult.atif.referenceSectionFound ? (
                (() => {
                  const ozet = kaynakcaOzeti(checkResult.atif);
                  return (
                    <span className="status-pill" data-tone={ozet.ton}>
                      {ozet.acikSorun
                        ? t({
                            tr: `${ozet.kunye} künyede ${ozet.acikSorun} açık sorun`,
                            en: `${ozet.acikSorun} open ${ozet.acikSorun === 1 ? "issue" : "issues"} in ${ozet.kunye} ${ozet.kunye === 1 ? "reference" : "references"}`,
                          })
                        : t({ tr: `${ozet.kunye} künye · açık sorun yok`, en: `${ozet.kunye} references · no open issues` })}
                    </span>
                  );
                })()
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
      {/* Kapanınca adres de temizlenir (sagAc): "?asistan=1" ya da "?sag=ai" kalsaydı yenilemede panel yeniden açılırdı. */}
      <YazimPaneli editor={editor} projectId={projectId} acik={yazimAcik} onKapat={() => sagAc(null)} zorunluBolumler={guideline?.requiredSections ?? []} aiAtifHazirla={aiAtifHazirla} />
      <AnalizEkleDialog open={analizOpen} onClose={() => setAnalizOpen(false)} projectId={projectId} onPick={handleAnaliz} />
      <ImportDialog
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          /* ?ice=1 adreste kalırsa yenilemede pencere yeniden açılırdı; Next replaceState'i izler. */
          const adres = new URL(window.location.href);
          if (adres.searchParams.has("ice")) {
            adres.searchParams.delete("ice");
            window.history.replaceState(window.history.state, "", adres.pathname + adres.search);
          }
        }}
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
