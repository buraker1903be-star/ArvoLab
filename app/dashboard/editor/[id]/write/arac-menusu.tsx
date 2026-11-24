"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useAcilirKonum } from "@/app/dashboard/_components/acilir-konum";

/*
  ARAÇ ÇUBUĞUNUN AÇILIR MENÜSÜ (04.11.2026, editörün yeni düzeni).

  Araçlar 26.10.2026'da sol sütunda dikey kartlara alınmıştı, çünkü
  belgenin üstündeki tek çubuk kırk düğmeyi iki satıra sarıyordu. Yeni
  düzen (kurum sahibinin isteği, Jenni'nin yazım ekranı örnek) tek satır:
  sık kullanılanlar çubukta, seyrek kullanılanlar (tablo, resim, dipnot,
  sayfa ayarı, sürümler…) adı yazan bir menüde. Kırk düğme sorunu
  çubuğu uzatarak değil, menüye gruplayarak çözülüyor.

  Pencere tarayıcının üst katmanında açılır (useAcilirKonum): yapışık ve
  bulanık araç çubuğunun içinde position:fixed bir çocuk ekrana göre
  konumlanmıyor. Bir öğeye basınca, dışarı tıklayınca ya da Esc'e basınca
  kapanır; odak düğmeye döner.

  Rol: açılır panel (disclosure), menü DEĞİL (18.11.2026). Eskiden
  pencere role="menu" taşıyordu ama içindeki düğmelerin menuitem rolü
  yoktu ve ok tuşlarıyla gezinme yazılmamıştı; ekran okuyucu "menü"
  deyip menü gibi davranmayan bir şeye sokuyordu (axe:
  aria-required-children, Kontroller menüsü). Düğme aria-expanded ve
  aria-controls ile paneli açar, panel adlı bir gruptur; öğeler Tab ile
  sırayla gezilir, Esc kapatır.
*/
export default function AracMenusu({
  ikon,
  etiket,
  aciklama,
  children,
  etiketiGizle = false,
  dugmeSinifi = "arac-menu-dugme",
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
}) {
  const [acik, setAcik] = useState(false);
  const dugme = useRef<HTMLButtonElement>(null);
  const pencere = useRef<HTMLDivElement>(null);
  const kimlik = useId();
  useAcilirKonum(acik, dugme, pencere);

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
      >
        {ikon}
        {etiketiGizle ? null : <span className="arac-metin">{etiket}</span>}
        {etiketiGizle ? null : <ChevronDown size={14} className="arac-menu-ok" aria-hidden="true" />}
      </button>
      <div
        ref={pencere}
        id={kimlik}
        className="arac-menu-pencere"
        role="group"
        aria-label={etiket}
        popover="manual"
        hidden={!acik}
        // Öğe tıklanınca menü kapanır; tıklama öğenin kendi işini yaptıktan sonra.
        onClick={(olay) => {
          if (!(olay.target as Element).closest("button:not([data-acik-kalir])")) return;
          setAcik(false);
          /*
            ODAK DÜĞMEYE, TIKLAMA SIRASINDA (24.11.2026). Menü kapanınca
            panel hidden olur ve tarayıcı, odaktaki öğe gizlendiği için
            odağı gövdeye alır. Menüden bir pencere açılıyorsa (Kısayollar,
            Sürümler, Paylaş) pencere "açılışta odakta olan öğe" diye
            gövdeyi kaydediyor ve kapanınca odağı oraya iade ediyordu:
            klavyeyle çalışan biri her pencereden sonra sayfanın en
            başından Tab'lamak zorunda kalıyordu. Odak burada, daha React
            yeniden çizmeden düğmeye alınıyor; bileşenin baştan beri
            söylediği davranış ("odak düğmeye döner") Escape dışındaki
            kapanışlarda da geçerli oluyor.
          */
          dugme.current?.focus();
        }}
      >
        {children}
      </div>
    </>
  );
}
