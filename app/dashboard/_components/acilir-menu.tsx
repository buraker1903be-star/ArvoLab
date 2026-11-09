"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useAcilirKonum } from "./acilir-konum";

/*
  ARAÇ ÇUBUĞUNUN AÇILIR MENÜSÜ (04.11.2026, editörün yeni düzeni).

  Araçlar 26.10.2026'da sol sütunda dikey kartlara alınmıştı, çünkü
  belgenin üstündeki tek çubuk kırk düğmeyi iki satıra sarıyordu. Yeni
  düzen (kurum sahibinin isteği, Jenni'nin yazım ekranı örnek) tek satır:
  sık kullanılanlar çubukta, seyrek kullanılanlar (tablo, resim, dipnot,
  sayfa ayarı, sürümler…) adı yazan bir menüde. Kırk düğme sorunu
  çubuğu uzatarak değil, menüye gruplayarak çözülüyor.

  Signature OS 4.1 (05.11.2026): editörün klasöründen ortak bileşenlere
  taşındı; sayfa başlıklarındaki taşma menüsü (sayfa/sayfa-eylemleri.tsx)
  de bunu kullanıyor. İkinci bir menü bileşeni yazılmadı: konumlama, Esc
  ve dışarı tıklama davranışı iki yerde ayrı ayrı bozulmasın.

  ERİŞİLEBİLİRLİK (05.11.2026): eskiden pencere role="menu" taşıyordu ama
  içindeki düğmeler menü öğesi değildi ve ok tuşları çalışmıyordu — ekran
  okuyucu "menü" diyor, menü gibi davranmıyordu. Artık açılır panel
  (disclosure) deseni: düğme aria-expanded taşır, panel adlı bir grup;
  Tab ile içeri girilir, ok tuşları ve Home/End öğeler arasında gezer,
  ↓ kapalı menüyü açıp ilk öğeye gider.

  Pencere tarayıcının üst katmanında açılır (useAcilirKonum): yapışık ve
  bulanık araç çubuğunun içinde position:fixed bir çocuk ekrana göre
  konumlanmıyor. Bir öğeye basınca, dışarı tıklayınca ya da Esc'e basınca
  kapanır; odak düğmeye döner.
*/
export default function AracMenusu({
  ikon,
  etiket,
  aciklama,
  children,
  etiketiGizle = false,
  dugmeSinifi = "arac-menu-dugme",
  pencereSinifi,
}: {
  ikon: ReactNode;
  etiket: string;
  /** Düğmenin üzerine gelince ve ekran okuyucuda. */
  aciklama?: string;
  children: ReactNode;
  /** Yalnızca simge (⋯ menüsü). */
  etiketiGizle?: boolean;
  /** Sayfa başlığındaki "Dışa aktar" gibi, araç çubuğu dışında kullanılan düğmenin sınıfı. */
  dugmeSinifi?: string;
  /** Pencerenin ek sınıfı (sayfa eylemlerinin taşma menüsü). */
  pencereSinifi?: string;
}) {
  const [acik, setAcik] = useState(false);
  const dugme = useRef<HTMLButtonElement>(null);
  const pencere = useRef<HTMLDivElement>(null);
  const kimlik = useId();
  useAcilirKonum(acik, dugme, pencere);
  const ogeler = () => [...(pencere.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], select") ?? [])];

  useEffect(() => {
    if (!acik) return;
    const disari = (olay: PointerEvent) => {
      const hedef = olay.target as Node | null;
      if (hedef && (pencere.current?.contains(hedef) || dugme.current?.contains(hedef))) return;
      setAcik(false);
    };
    const tus = (olay: KeyboardEvent) => {
      if (olay.key !== "Escape") return;
      setAcik(false);
      dugme.current?.focus();
    };
    document.addEventListener("pointerdown", disari);
    document.addEventListener("keydown", tus);
    return () => {
      document.removeEventListener("pointerdown", disari);
      document.removeEventListener("keydown", tus);
    };
  }, [acik]);

  return (
    <>
      <button
        ref={dugme}
        type="button"
        className={dugmeSinifi}
        data-acik={acik || undefined}
        aria-expanded={acik}
        aria-controls={kimlik}
        title={aciklama ?? etiket}
        aria-label={aciklama ?? etiket}
        // Düğmeye basınca editör seçimini kaybetmesin (ToolbarButton ile aynı).
        onMouseDown={(olay) => olay.preventDefault()}
        onClick={() => setAcik((a) => !a)}
        onKeyDown={(olay) => {
          if (olay.key !== "ArrowDown" || acik) return;
          olay.preventDefault();
          setAcik(true);
          requestAnimationFrame(() => ogeler()[0]?.focus());
        }}
      >
        {ikon}
        {etiketiGizle ? null : <span className="arac-metin">{etiket}</span>}
        {etiketiGizle ? null : <ChevronDown size={14} className="arac-menu-ok" aria-hidden="true" />}
      </button>
      <div
        ref={pencere}
        id={kimlik}
        className={pencereSinifi ? `arac-menu-pencere ${pencereSinifi}` : "arac-menu-pencere"}
        role="group"
        aria-label={etiket}
        popover="manual"
        hidden={!acik}
        onKeyDown={(olay) => {
          const liste = ogeler();
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
        // Öğe tıklanınca menü kapanır; tıklama öğenin kendi işini yaptıktan sonra.
        // Bağlantı da kapatır (V4.3-B2): kalıcı yerleşimdeki bir menü (çalışma şeridi) sayfa değişince açık kalıyordu.
        onClick={(olay) => {
          if ((olay.target as Element).closest("button:not([data-acik-kalir]), a[href]")) setAcik(false);
        }}
      >
        {children}
      </div>
    </>
  );
}
