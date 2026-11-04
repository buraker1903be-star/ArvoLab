"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useCeviri } from "./dil-saglayici";
import { temaAbone, temaDurumu, temaTercihiniUygula } from "./tema";
import { TEMA_TERCIHLERI, type TemaTercihi } from "@/lib/tema";
import type { Metin } from "@/lib/dil";

/*
  TEMA SEÇİCİ: AÇIK / KOYU / SİSTEM (Phase 4.1, 04.11.2026).

  Eskiden düğme iki tema arasında geçiş yapıyordu ve bir kez basılınca
  "işletim sistemine uy"a dönmenin yolu kalmıyordu. Şimdi düğme küçük
  bir menü açar; üç seçenek, seçili olan işaretli. Karar lib/tema.ts'te,
  uygulama app/_components/tema.ts'te; sistem değişikliğini izleyen
  dinleyici ön boyama betiğinde (her sayfada, bu düğme olmasa da).

  Düğmenin simgesi SEÇİLİ tercihi gösterir (güneş, ay, ekran). Eskiden
  simge gidilecek temayı gösteriyordu (açıkta ay); menüyle birlikte bu
  ters okunurdu.

  Menü kendi başına kapanır (dışarı dokunuş, Escape, seçim): bileşen
  giriş akışı sayfalarında da kullanılıyor, panelin AcilirKapatici'si
  orada yok. Klavye: ↑/↓/Home/End seçenekler arasında, Escape odağı
  düğmeye geri verir.
*/
const SECENEK: Record<TemaTercihi, { ad: Metin; ipucu?: Metin; simge: LucideIcon }> = {
  light: { ad: { tr: "Açık", en: "Light" }, simge: Sun },
  dark: { ad: { tr: "Koyu", en: "Dark" }, simge: Moon },
  system: { ad: { tr: "Sistem", en: "System" }, ipucu: { tr: "Cihazınızın ayarını izler", en: "Follows your device" }, simge: Monitor },
};

// Sunucuda tercih bilinmiyor; ilk çizim "system" der, istemci hemen gerçeğine geçer.
const sunucuDurumu = () => "system:light";
const istemciDurumu = () => {
  const { tercih, tema } = temaDurumu();
  return `${tercih}:${tema}`;
};

export default function ThemeToggle({ className = "dashboard-icon-button" }: { className?: string }) {
  const t = useCeviri();
  const durum = useSyncExternalStore(temaAbone, istemciDurumu, sunucuDurumu);
  const tercih = durum.split(":")[0] as TemaTercihi;
  const [acik, setAcik] = useState(false);
  const kok = useRef<HTMLDivElement>(null);
  const dugme = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const Simge = SECENEK[tercih].simge;

  useEffect(() => {
    if (!acik) return;
    // Açılınca odak seçili seçenekte: klavye kullanıcısı nerede olduğunu görür.
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const disari = (olay: PointerEvent) => {
      if (!kok.current?.contains(olay.target as Node)) setAcik(false);
    };
    document.addEventListener("pointerdown", disari);
    return () => document.removeEventListener("pointerdown", disari);
  }, [acik]);

  const kapat = (odakGeriDonsun: boolean) => {
    setAcik(false);
    if (odakGeriDonsun) dugme.current?.focus();
  };

  const sec = (yeni: TemaTercihi) => {
    temaTercihiniUygula(yeni);
    kapat(true);
  };

  const tus = (olay: KeyboardEvent<HTMLDivElement>) => {
    if (olay.key === "Escape") {
      olay.preventDefault();
      kapat(true);
      return;
    }
    const ogeler = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    const simdiki = ogeler.indexOf(document.activeElement as HTMLButtonElement);
    const hedef =
      olay.key === "ArrowDown" ? (simdiki + 1) % ogeler.length
      : olay.key === "ArrowUp" ? (simdiki - 1 + ogeler.length) % ogeler.length
      : olay.key === "Home" ? 0
      : olay.key === "End" ? ogeler.length - 1
      : null;
    if (hedef === null) return;
    olay.preventDefault();
    ogeler[hedef]?.focus();
  };

  const etiket = t({ tr: `Tema: ${t(SECENEK[tercih].ad)}`, en: `Theme: ${t(SECENEK[tercih].ad)}` });

  return (
    <div className="tema-secici" ref={kok}>
      <button
        ref={dugme}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={acik}
        aria-label={etiket}
        data-ipucu={etiket}
        onClick={() => setAcik((a) => !a)}
      >
        <Simge size={17} strokeWidth={1.9} aria-hidden="true" />
      </button>
      {acik ? (
        <div ref={menu} className="tema-menu" role="menu" aria-label={t({ tr: "Tema", en: "Theme" })} onKeyDown={tus}>
          {TEMA_TERCIHLERI.map((secenek) => {
            const { ad, ipucu, simge: SecenekSimgesi } = SECENEK[secenek];
            const secili = secenek === tercih;
            return (
              <button
                key={secenek}
                type="button"
                role="menuitemradio"
                aria-checked={secili}
                tabIndex={secili ? 0 : -1}
                onClick={() => sec(secenek)}
              >
                <SecenekSimgesi size={16} strokeWidth={1.9} aria-hidden="true" />
                <span className="tema-menu-ad">
                  {t(ad)}
                  {ipucu ? <small>{t(ipucu)}</small> : null}
                </span>
                {secili ? <Check className="tema-menu-isaret" size={16} strokeWidth={2} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
