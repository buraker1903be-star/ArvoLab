import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { cikisKarari, harfCevir, puntoAdimi, siradakiHarfDurumu, tabKarari } from "@/lib/klavye-karari";
import { etkinOneri } from "@/lib/tiptap-satir-ici-oneri";

/*
  WORD KLAVYESİ (27.10.2026, kurum sahibinin isteği: "editörde
  bilgisayarın klavye özelliklerini kullanamıyorum, örneğin Tab; tam
  kapsamlı düzenle").

  Öğrencinin elinde Word alışkanlığı var; editörde aynı tuşlar aynı işi
  yapmalı:
  - Tab / Shift+Tab: kararı lib/klavye-karari.ts veriyor. Liste ve tablo
    kendi Tab'larını işliyor (sinkListItem, goToNextCell); bu eklenti
    ÖNCELİĞİ DÜŞÜK olduğu için onlardan sonra çalışıyor ve odağın
    editörden kaçmasını engelliyor.
  - Backspace girintili paragrafın başında: önce girintiyi kaldırır (Word).
  - Ctrl+L / E / R / J: sola, ortaya, sağa, iki yana hizala (Word).
    Tiptap'ın kendi kısayolları (Ctrl+Shift+L…) da çalışmaya devam ediyor.
  - Ctrl+] / Ctrl+[ ve Ctrl+> / Ctrl+<: yazı boyutunu bir punto büyüt /
    küçült (Word). Köşeli parantez Türkçe Q klavyede AltGr ile yazılıyor;
    "<" tuşu ise Z'nin solunda, doğrudan basılıyor (Shift ile ">").
  - Ctrl+Shift+=: üst simge (Word). Ctrl+Boşluk: karakter biçimini temizle.
  - Shift+F3: seçili metnin harf durumu (küçük → BÜYÜK → Başlık Düzeni).
  Ctrl+P (yazdır) editör bileşeninde: kaydedip sayfalı baskıyı açması
  gerekiyor (manuscript-editor.tsx).

  İKİ EKLENTİ, iki öncelik: Tab DÜŞÜK öncelikte (liste ve tablo önce),
  hizalama ve punto YÜKSEK öncelikte — Tiptap Ctrl+E'yi satır içi koda
  ayırmış; düşük öncelikte kalınca Ctrl+E ortalamak yerine metni kod
  biçimine çeviriyordu.
*/
export const WordKlavyesi = Extension.create({
  name: "wordKlavyesi",
  priority: 50,

  addKeyboardShortcuts() {
    const durum = () => {
      const { state } = this.editor;
      const { $from, empty } = state.selection;
      const blok = $from.parent;
      return {
        listede: this.editor.isActive("listItem"),
        tabloda: this.editor.isActive("table"),
        satirBasinda: empty && $from.parentOffset === 0,
        girintili: Boolean(blok.attrs.firstLineIndent),
      };
    };
    const tab = (shift: boolean) => {
      const karar = tabKarari(durum(), shift);
      if (karar === "girinti-ekle") return this.editor.commands.setFirstLineIndent(true) || true;
      if (karar === "girinti-kaldir") return this.editor.commands.setFirstLineIndent(false) || true;
      if (karar === "sekme") return this.editor.commands.insertContent("\t") || true;
      return true;
    };
    return {
      Tab: () => tab(false),
      "Shift-Tab": () => tab(true),
    };
  },
});

export const WordKisayollari = Extension.create({
  name: "wordKisayollari",
  priority: 1000,

  addKeyboardShortcuts() {
    const hizala = (yon: "left" | "center" | "right" | "justify") => () => this.editor.commands.setTextAlign(yon);
    const punto = (yon: 1 | -1) => () => {
      const simdiki = this.editor.getAttributes("textStyle").fontSize as string | undefined;
      return this.editor.chain().focus().setFontSize(puntoAdimi(simdiki, 12, yon)).run();
    };
    return {
      /* Girintili paragrafın başında Backspace önce girintiyi kaldırır (Word);
         yüksek öncelikte, yoksa paragraf bir öncekiyle birleşirdi. */
      Backspace: () => {
        const { $from, empty } = this.editor.state.selection;
        if (!empty || $from.parentOffset !== 0 || !$from.parent.attrs.firstLineIndent) return false;
        if (this.editor.isActive("listItem")) return false;
        /* Komut paragraf VE başlık türünü güncellemeye çalıştığı için imleç
           paragraftayken false dönüyor (başlık yok); girinti yine kalkıyor.
           Sonucuna bakılsaydı tuş birleştirmeye de geçer, paragraf bir
           öncekine yapışırdı. */
        this.editor.commands.setFirstLineIndent(false);
        return true;
      },
      "Mod-l": hizala("left"),
      "Mod-e": hizala("center"),
      "Mod-r": hizala("right"),
      "Mod-j": hizala("justify"),
      "Mod-]": punto(1),
      "Mod-[": punto(-1),
      "Mod->": punto(1),
      "Mod-<": punto(-1),
      "Mod-Shift->": punto(1),
      "Mod-Shift-<": punto(-1),
      // Türkçe klavyede "=" Shift+0; ABD klavyesinde Shift+= "+" verir.
      "Mod-Shift-=": () => this.editor.commands.toggleSuperscript(),
      "Mod-Shift-+": () => this.editor.commands.toggleSuperscript(),
      "Mod-Space": () => this.editor.chain().focus().unsetAllMarks().run(),
      "Shift-F3": () => {
        const { state, view } = this.editor;
        const { from, to, empty } = state.selection;
        // Seçim yoksa tuş yine yutuluyor: tarayıcının "sonrakini bul"u editörde anlamsız.
        if (empty) return true;
        const hedef = siradakiHarfDurumu(state.doc.textBetween(from, to, "\n"));
        const parcalar: { a: number; b: number; metin: string; kelimeBasi: boolean }[] = [];
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!node.isText || !node.text) return;
          const a = Math.max(from, pos);
          const b = Math.min(to, pos + node.nodeSize);
          const once = a > 0 ? state.doc.textBetween(a - 1, a, " ") : "";
          parcalar.push({ a, b, metin: node.text.slice(a - pos, b - pos), kelimeBasi: !/[\p{L}\p{N}'’]/u.test(once || " ") });
        });
        let tr = state.tr;
        // Sondan başa: öndeki değişiklik arkadaki konumları kaydırmasın. insertText biçimi (kalın vb.) korur.
        for (const p of parcalar.reverse()) {
          const yeni = harfCevir(p.metin, hedef, p.kelimeBasi);
          if (yeni !== p.metin) tr = tr.insertText(yeni, p.a, p.b);
        }
        tr = tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(from, -1), tr.mapping.map(to)));
        view.dispatch(tr);
        return true;
      },
    };
  },
});

/*
  EDİTÖRDEN KLAVYEYLE ÇIKIŞ (V4.3-B2, WCAG 2.1.2). Kural ve gerekçe
  lib/klavye-karari.ts (cikisKarari). Bu eklenti EN YÜKSEK öncelikte:
  kuruluyken gelen Tab'ı liste/tablo eklentileri (girinti, sonraki hücre)
  yutmadan önce yakalamalı. Kurulu değilken hiçbir tuşu tüketmez; Esc'i
  de tüketmez (odak modu, panel, satır içi öneri kendi Esc'lerini işler).

  Satır içi öneri açıkken Esc çıkışı KURMAZ: o Esc öneriyi kapatır, ikinci
  Esc kurar. Belgeye, seçime, kayda ve AI kartlarına dokunulmaz; odak
  tarayıcının kendi sırasıyla bir sonraki / önceki denetime geçer.
*/
const cikisAnahtari = new PluginKey("editordenCikis");
const ODAKLANABILIR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex], [contenteditable="true"]';

/** Editörün dışındaki sonraki/önceki odaklanabilir öğe (belge sırasıyla; görünmeyen, devre dışı ve inert olan atlanır). */
function disOdak(editorDom: HTMLElement, yon: 1 | -1): HTMLElement | null {
  const adaylar = [...document.querySelectorAll<HTMLElement>(ODAKLANABILIR)].filter(
    (e) => !editorDom.contains(e) && e.tabIndex >= 0 && e.getClientRects().length > 0 && !e.closest("[inert], [hidden]") && getComputedStyle(e).visibility === "visible",
  );
  const sonra = adaylar.filter((e) => editorDom.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
  const once = adaylar.filter((e) => editorDom.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING);
  return yon === 1 ? (sonra[0] ?? null) : (once[once.length - 1] ?? null);
}

export const EditordenCikis = Extension.create({
  name: "editordenCikis",
  priority: 10000,

  addProseMirrorPlugins() {
    let kurulu = false;
    return [
      new Plugin({
        key: cikisAnahtari,
        props: {
          handleKeyDown(view, olay) {
            const karar = cikisKarari(kurulu, olay.key, olay.shiftKey);
            if (karar === "kur") {
              // Öneri açıkken bu Esc öneriyi kapatır (tiptap-satir-ici-oneri.ts); çıkış kurulmaz.
              kurulu = !etkinOneri(view.state);
              return false;
            }
            if (karar === "boz") kurulu = false;
            if (karar !== "cik-ileri" && karar !== "cik-geri") return false;
            kurulu = false;
            const hedef = disOdak(view.dom as HTMLElement, karar === "cik-ileri" ? 1 : -1);
            if (hedef) hedef.focus();
            else (view.dom as HTMLElement).blur();
            return true;
          },
          handleDOMEvents: {
            blur: () => {
              kurulu = false;
              return false;
            },
            mousedown: () => {
              kurulu = false;
              return false;
            },
          },
        },
      }),
    ];
  },
});
