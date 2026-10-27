import { Extension } from "@tiptap/core";
import { puntoAdimi, tabKarari } from "@/lib/klavye-karari";

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
  - Ctrl+] / Ctrl+[: yazı boyutunu bir punto büyüt / küçült (Word).
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
    };
  },
});
