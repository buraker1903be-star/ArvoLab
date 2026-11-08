"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { MessageSquareText, Sparkles } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { asistanaGorevGonder, type DisGorev } from "@/lib/ai-duzenleme";
import { secimDugmesiKonumu } from "@/lib/secim-dugmesi-konumu";

/*
  SEÇİMDEKİ ARVO AI (Signature OS 4.3, 05.11.2026). Eskiden seçili metni
  düzenletmenin tek yolu başlıktaki Arvo AI ile paneli açıp alttaki çipi
  bulmaktı; öğrenci seçimin YANINDA bir şey bekliyor (Jenni, Notion).

  Kurallar (kurum sahibinin 4.3 talimatı):
  - Seçimi örtmez: seçimin SON satırının ALTINDA açılır, yer yoksa ilk
    satırının üstünde (lib/secim-dugmesi-konumu.ts, testli).
  - Telefonda ekranı kaplamaz: tek, küçük bir düğme; menü yalnızca
    basınca açılır ve dört satırdır.
  - Klavye: Alt+Enter menüyü açıp ilk öğeye odaklanır, oklar gezer, Esc
    kapatıp editöre döner. Ekran okuyucu: düğmenin adı ve kısayolu
    (aria-keyshortcuts) okunur.
  - Hareket yok: belirme/kaybolma anında; yalnızca odak halkası.
  - Belgeye hiçbir şey yazmaz: görevi panele gönderir, öneri panelde
    karar bekler (yazim-paneli.tsx).

  Tarayıcının üst katmanında (popover) açılır: editör kartının overflow'u
  kırpmasın. Konum CSS değişkenleriyle taşınır — TSX'te satır içi stil yok.
*/
export default function SecimAi({ editor, panelAc }: { editor: Editor; panelAc: () => void }) {
  const t = useCeviri();
  const [gorunur, setGorunur] = useState(false);
  const [acik, setAcik] = useState(false);
  const kok = useRef<HTMLDivElement>(null);
  const surukleniyor = useRef(false);
  /*
    Alt+Enter ile açıldıysa odak, menü ÇİZİLDİKTEN SONRA ilk öğeye verilir.
    Eskiden bir sonraki karede (requestAnimationFrame) veriliyordu; menü
    yalnızca açıkken çizildiği için React o kareye kadar çizmezse
    odaklanacak öğe yoktu ve odak editörde kalıyordu.
  */
  const klavyeIleAcildi = useRef(false);
  useEffect(() => {
    if (!acik || !klavyeIleAcildi.current) return;
    klavyeIleAcildi.current = false;
    kok.current?.querySelector<HTMLElement>(".secim-ai-menu button")?.focus();
  }, [acik]);

  const menuOgeleri = () => [...(kok.current?.querySelectorAll<HTMLElement>(".secim-ai-menu button") ?? [])];

  /* Seçim boş değil, editör yazılabilir ve kullanıcı sürüklemiyorsa görünür. Odak menüdeyse kaybolmaz. */
  const guncelle = useCallback(() => {
    const { selection } = editor.state;
    const metinSecimi = !selection.empty && selection instanceof TextSelection && editor.state.doc.textBetween(selection.from, selection.to, " ").trim().length > 0;
    const odak = editor.view.hasFocus() || Boolean(kok.current?.contains(document.activeElement));
    const yeni = metinSecimi && editor.isEditable && odak && !surukleniyor.current;
    setGorunur(yeni);
    if (!yeni) setAcik(false);
  }, [editor]);

  useEffect(() => {
    const dom = editor.view.dom;
    const bas = () => {
      surukleniyor.current = true;
      setGorunur(false);
      setAcik(false);
    };
    const birak = () => {
      if (!surukleniyor.current) return;
      surukleniyor.current = false;
      window.requestAnimationFrame(guncelle);
    };
    /*
      SEÇİM EŞİTLEME YARIŞI (Aşama 1 takip R3, 08.11.2026). ProseMirror DOM
      seçimini eşzamansız okur (selectionchange). Seçim kurulur kurulmaz
      Alt+Enter gelirse (yük altında, programla kurulan seçimde ya da çok
      hızlı klavyede) editor.state henüz BOŞ seçim tutuyordu ve işleyici
      sessizce çıkıyordu: menü açılmıyordu. Ölçüldü: CPU 6× yavaşken
      20 denemenin 1–10'unda; düşenlerin hepsinde keydown anında DOM seçimi
      dolu, ProseMirror seçimi boştu. Karar vermeden önce DOM seçimi
      editörün içindeyse ProseMirror'a aktarılır (genel posAtDOM API'si).
    */
    const domSeciminiAktar = () => {
      if (!editor.state.selection.empty) return;
      const dom = window.getSelection();
      if (!dom || dom.isCollapsed || !dom.anchorNode || !dom.focusNode) return;
      if (!editor.view.dom.contains(dom.anchorNode) || !editor.view.dom.contains(dom.focusNode)) return;
      try {
        const a = editor.view.posAtDOM(dom.anchorNode, dom.anchorOffset);
        const b = editor.view.posAtDOM(dom.focusNode, dom.focusOffset);
        if (a !== b) editor.commands.setTextSelection({ from: Math.min(a, b), to: Math.max(a, b) });
      } catch {
        // Konum çözülemezse (şema dışı düğüm) eski davranış: seçim yok sayılır.
      }
    };
    const tus = (olay: KeyboardEvent) => {
      if (!(olay.altKey && olay.key === "Enter")) return;
      domSeciminiAktar();
      if (editor.state.selection.empty) return;
      olay.preventDefault();
      setGorunur(true);
      klavyeIleAcildi.current = true;
      setAcik(true);
    };
    /* Odak editörden menüye geçerken blur gelir; bir kare bekleyip asıl odağa bakılır. */
    const bulanik = () => window.requestAnimationFrame(guncelle);
    dom.addEventListener("pointerdown", bas);
    document.addEventListener("pointerup", birak);
    dom.addEventListener("keydown", tus);
    editor.on("selectionUpdate", guncelle);
    editor.on("focus", guncelle);
    editor.on("blur", bulanik);
    return () => {
      dom.removeEventListener("pointerdown", bas);
      document.removeEventListener("pointerup", birak);
      dom.removeEventListener("keydown", tus);
      editor.off("selectionUpdate", guncelle);
      editor.off("focus", guncelle);
      editor.off("blur", bulanik);
    };
  }, [editor, guncelle]);

  /* Üst katman ve konum: seçimin ekrandaki kutusuna göre, kaydırma ve boyut değişince yeniden. */
  useLayoutEffect(() => {
    const el = kok.current;
    if (!el) return;
    const destek = typeof el.showPopover === "function";
    if (!gorunur) {
      if (destek && el.matches(":popover-open")) el.hidePopover();
      return;
    }
    if (destek && !el.matches(":popover-open")) el.showPopover();
    const yerlestir = () => {
      const { from, to } = editor.state.selection;
      let bas: DOMRect | { top: number; bottom: number; left: number };
      let son: { top: number; bottom: number; left: number };
      try {
        bas = editor.view.coordsAtPos(from, 1);
        son = editor.view.coordsAtPos(to, -1);
      } catch {
        return;
      }
      const k = secimDugmesiKonumu(
        { ust: bas.top, alt: son.bottom, sol: Math.min(bas.left, son.left) },
        { genislik: el.offsetWidth, yukseklik: el.offsetHeight },
        {
          genislik: window.innerWidth,
          // Görünür alan: yapışkan araç çubuğunun altı, telefonda durum çubuğunun üstü.
          ust: Math.max(0, ...[...document.querySelectorAll(".manuscript-araclar, .manuscript-ust")].map((e) => e.getBoundingClientRect().bottom)),
          yukseklik: Math.min(window.innerHeight, document.querySelector(".yazim-durum-cubugu")?.getBoundingClientRect().top ?? window.innerHeight),
        },
      );
      el.style.setProperty("--acilir-x", `${k.x}px`);
      el.style.setProperty("--acilir-y", `${k.y}px`);
      el.toggleAttribute("data-yukari", k.yukari);
    };
    yerlestir();
    const tr = () => yerlestir();
    editor.on("transaction", tr);
    window.addEventListener("resize", yerlestir);
    window.addEventListener("scroll", yerlestir, true);
    return () => {
      editor.off("transaction", tr);
      window.removeEventListener("resize", yerlestir);
      window.removeEventListener("scroll", yerlestir, true);
    };
  }, [gorunur, acik, editor]);

  const kapat = (editoreDon: boolean) => {
    setAcik(false);
    if (editoreDon) editor.commands.focus();
  };
  const gorev = (g: DisGorev) => {
    panelAc();
    asistanaGorevGonder(g);
    setAcik(false);
    setGorunur(false);
  };
  const kendiIstegi = () => {
    // Seçim editör durumunda kalır; panelin istek kutusu odak alır, gönderilince seçimle birlikte gider.
    panelAc();
    setAcik(false);
    setGorunur(false);
  };

  const ogeler: { ad: string; gorev: DisGorev }[] = [
    { ad: t({ tr: "Akademikleştir", en: "Make academic" }), gorev: "akademik" },
    { ad: t({ tr: "Kısalt", en: "Shorten" }), gorev: "kisalt" },
    { ad: t({ tr: "Genişlet", en: "Expand" }), gorev: "genislet" },
  ];

  return (
    <div
      ref={kok}
      className="secim-ai"
      popover="manual"
      hidden={!gorunur}
      data-acik={acik || undefined}
      onKeyDown={(olay) => {
        if (olay.key === "Escape") {
          olay.preventDefault();
          kapat(true);
          return;
        }
        const liste = menuOgeleri();
        if (!liste.length) return;
        const i = liste.indexOf(document.activeElement as HTMLElement);
        const hedef =
          olay.key === "ArrowDown" ? liste[(i + 1) % liste.length]
          : olay.key === "ArrowUp" ? liste[(i - 1 + liste.length) % liste.length]
          : olay.key === "Home" ? liste[0]
          : olay.key === "End" ? liste[liste.length - 1]
          : null;
        if (!hedef) return;
        olay.preventDefault();
        hedef.focus();
      }}
      onBlur={(olay) => {
        // Odak kökün dışına (editöre değil başka bir yere) çıkınca kapan.
        if (!kok.current?.contains(olay.relatedTarget as Node | null) && !editor.view.dom.contains(olay.relatedTarget as Node | null)) {
          setAcik(false);
          setGorunur(false);
        }
      }}
    >
      <button
        type="button"
        className="secim-ai-dugme"
        aria-expanded={acik}
        aria-controls="secim-ai-menu"
        aria-keyshortcuts="Alt+Enter"
        title={t({ tr: "Seçili metin için Arvo AI (Alt+Enter)", en: "Arvo AI for selected text (Alt+Enter)" })}
        // Düğmeye basınca editör seçimini kaybetmesin.
        onMouseDown={(olay) => olay.preventDefault()}
        onClick={() => setAcik((a) => !a)}
      >
        <Sparkles size={14} aria-hidden="true" />
        <span>{t({ tr: "Arvo AI", en: "Arvo AI" })}</span>
      </button>
      {acik ? (
        <div id="secim-ai-menu" className="secim-ai-menu" role="group" aria-label={t({ tr: "Seçili metni düzenle", en: "Edit selected text" })}>
          {ogeler.map((o) => (
            <button key={o.gorev} type="button" className="arac-menu-oge" onMouseDown={(olay) => olay.preventDefault()} onClick={() => gorev(o.gorev)}>
              <span>{o.ad}</span>
            </button>
          ))}
          <button type="button" className="arac-menu-oge" onMouseDown={(olay) => olay.preventDefault()} onClick={kendiIstegi}>
            <MessageSquareText size={16} aria-hidden="true" />
            <span>{t({ tr: "Kendi isteğini yaz", en: "Ask in your own words" })}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
