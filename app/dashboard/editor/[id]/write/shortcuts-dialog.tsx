"use client";

import { useSyncExternalStore } from "react";
import Dialog from "@/app/dashboard/_components/dialog";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { Metin } from "@/lib/dil";

/*
  Editörün klavye kısayolları, işe göre gruplu (27.10.2026). Word'le aynı
  tuşlar (lib/tiptap-klavye.ts) ve Tiptap'ın kendi kısayolları. Liste uzadı;
  gruplar olmadan öğrenci aradığını bulamıyordu. Kullanım kılavuzu da bu
  listeden yazılabilir — iki ayrı liste tutulursa biri eskir.
*/
type Kisayol = [string[], Metin];
const GRUPLAR: { baslik: Metin; satirlar: Kisayol[] }[] = [
  {
    baslik: { tr: "Belge", en: "Document" },
    satirlar: [
      [["Mod", "S"], { tr: "Şimdi kaydet (zaten otomatik kaydedilir)", en: "Save now (it already saves automatically)" }],
      [["Mod", "P"], { tr: "Yazdır / PDF (kılavuz düzeninde, sayfalı)", en: "Print / PDF (in guideline layout, paginated)" }],
      [["Mod", "F"], { tr: "Bul ve değiştir", en: "Find and replace" }],
      [["Mod", "Z"], { tr: "Geri al", en: "Undo" }],
      [["Mod", "Y"], { tr: "Yinele (Ctrl+Shift+Z de olur)", en: "Redo (Ctrl+Shift+Z also works)" }],
    ],
  },
  {
    baslik: { tr: "Yazı biçimi", en: "Text formatting" },
    satirlar: [
      [["Mod", "B"], { tr: "Kalın", en: "Bold" }],
      [["Mod", "I"], { tr: "İtalik", en: "Italic" }],
      [["Mod", "U"], { tr: "Altı çizili", en: "Underline" }],
      [["Mod", "Shift", "="], { tr: "Üst simge (Ctrl+. de olur)", en: "Superscript (Ctrl+. also works)" }],
      [["Mod", ">"], { tr: "Yazıyı bir punto büyüt (Türkçe klavyede Ctrl+Shift+<; Ctrl+] de olur)", en: "Increase font size by one point (Ctrl+Shift+< on a Turkish keyboard; Ctrl+] also works)" }],
      [["Mod", "<"], { tr: "Yazıyı bir punto küçült (Ctrl+[ de olur)", en: "Decrease font size by one point (Ctrl+[ also works)" }],
      [["Mod", "Boşluk"], { tr: "Karakter biçimini temizle", en: "Clear character formatting" }],
      [["Shift", "F3"], { tr: "Seçili metin: küçük harf → BÜYÜK HARF → Başlık Düzeni", en: "Selected text: lowercase → UPPERCASE → Title Case" }],
    ],
  },
  {
    baslik: { tr: "Paragraf", en: "Paragraph" },
    satirlar: [
      [["Mod", "L"], { tr: "Sola hizala", en: "Align left" }],
      [["Mod", "E"], { tr: "Ortala", en: "Center" }],
      [["Mod", "R"], { tr: "Sağa hizala", en: "Align right" }],
      [["Mod", "J"], { tr: "İki yana yasla", en: "Justify" }],
      [["Tab"], { tr: "Paragraf başında ilk satır girintisi; metin içinde sekme", en: "At the start of a paragraph: first-line indent; within text: tab" }],
      [["Shift", "Tab"], { tr: "Paragraf başında girintiyi kaldır", en: "At the start of a paragraph: remove indent" }],
      [["Backspace"], { tr: "Girintili paragrafın başında: önce girintiyi kaldır", en: "At the start of an indented paragraph: remove the indent first" }],
      [["Shift", "Enter"], { tr: "Aynı paragrafta alt satıra geç", en: "Line break within the same paragraph" }],
    ],
  },
  {
    baslik: { tr: "Başlık, liste, alıntı", en: "Headings, lists, quotes" },
    satirlar: [
      [["Mod", "Alt", "1"], { tr: "Başlık 1 (2 ve 3 için aynı)", en: "Heading 1 (same for 2 and 3)" }],
      [["Mod", "Alt", "0"], { tr: "Normal metne dön", en: "Back to normal text" }],
      [["Mod", "Shift", "8"], { tr: "Madde işaretli liste", en: "Bulleted list" }],
      [["Mod", "Shift", "7"], { tr: "Numaralı liste", en: "Numbered list" }],
      [["Mod", "Shift", "B"], { tr: "Alıntı", en: "Block quote" }],
      [["Tab"], { tr: "Listede: maddeyi içeri al (Shift+Tab: dışarı)", en: "In a list: indent the item (Shift+Tab: outdent)" }],
      [["#", "Boşluk"], { tr: "Satır başında: Başlık 1 (## ve ### ile Başlık 2 ve 3)", en: "At line start: Heading 1 (## and ### for Heading 2 and 3)" }],
      [["-", "Boşluk"], { tr: "Satır başında: madde işaretli liste", en: "At line start: bulleted list" }],
      [["1.", "Boşluk"], { tr: "Satır başında: numaralı liste", en: "At line start: numbered list" }],
      [[">", "Boşluk"], { tr: "Satır başında: alıntı", en: "At line start: block quote" }],
    ],
  },
  {
    baslik: { tr: "Tablo ve dipnot", en: "Tables and footnotes" },
    satirlar: [
      // Tablo kısayolları hiçbir yerde yazmıyordu; kullanıcı son hücrede Tab'a
      // basınca satır açıldığını tesadüfen öğreniyordu.
      [["Tab"], { tr: "Tabloda sonraki hücre (son hücrede: yeni satır)", en: "Next cell in a table (in the last cell: new row)" }],
      [["Shift", "Tab"], { tr: "Tabloda önceki hücre", en: "Previous cell in a table" }],
      [["Mod", "Alt", "F"], { tr: "Dipnot ekle", en: "Insert footnote" }],
      [["Mod", "Enter"], { tr: "Dipnot penceresinde kaydet", en: "Save in the footnote dialog" }],
    ],
  },
  {
    baslik: { tr: "Pencereler", en: "Dialogs" },
    satirlar: [
      [["Enter"], { tr: "Bul kutusunda sonraki eşleşme (Shift+Enter: önceki)", en: "In the find box: next match (Shift+Enter: previous)" }],
      [["Esc"], { tr: "Açık pencereyi ya da bul çubuğunu kapat", en: "Close the open dialog or the find bar" }],
    ],
  },
];

const hicDinleme = () => () => {};
const macMi = () => /Mac|iPhone|iPad/i.test(navigator.userAgent);

/*
  Liste pencereden ayrı: Ayarlar da aynı listeyi gösteriyor (27.10.2026).
  İki ayrı liste tutulsaydı biri eskirdi.

  Mac sorusu useSyncExternalStore ile: liste artık sunucuda da çiziliyor
  ve navigator orada yok. Render içinde navigator okumak sunucuda "Ctrl",
  Mac'te "⌘" üretip hidrasyon uyuşmazlığı verirdi; sunucu ve ilk çizim
  "Ctrl" der, tarayıcı hemen ardından düzeltir.
*/
export function KisayolListesi() {
  const isMac = useSyncExternalStore(hicDinleme, macMi, () => false);
  const t = useCeviri();
  const label = (key: string) => {
    if (key === "Boşluk") return t({ tr: "Boşluk", en: "Space" });
    if (key === "Mod") return isMac ? "⌘" : "Ctrl";
    if (key === "Alt") return isMac ? "⌥" : "Alt";
    if (key === "Shift") return isMac ? "⇧" : "Shift";
    return key;
  };

  return (
    <>
      {GRUPLAR.map((grup) => (
        <section key={grup.baslik.tr} className="shortcut-grup" aria-label={t(grup.baslik)}>
          <h3>{t(grup.baslik)}</h3>
          <dl className="shortcut-list">
            {grup.satirlar.map(([keys, description], i) => (
              <div key={i} className="shortcut-row">
                <dt>
                  {keys.map((key, index) => (
                    <kbd key={index}>{label(key)}</kbd>
                  ))}
                </dt>
                <dd>{t(description)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}

export default function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useCeviri();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker={t({ tr: "Yardım", en: "Help" })}
      title={t({ tr: "Klavye kısayolları", en: "Keyboard shortcuts" })}
      description={t({
        tr: "Word'deki tuşlar burada da aynı işi yapar. Fareye uzanmadan daha hızlı yazın.",
        en: "The same keys as in Word do the same things here. Write faster without reaching for the mouse.",
      })}
    >
      <KisayolListesi />
    </Dialog>
  );
}
