"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LISTE_ADRESI_ANAHTARI, LISTE_KONUMU_ANAHTARI, LISTE_VARSAYILAN, listeAdresiOku, listeKonumuOku } from "@/lib/os/liste-donusu";

/*
  Çalışmalarım listesinin son hâli (lib/os/liste-donusu.ts). Liste sayfası
  <ListeKonumunuSakla /> ile adresini ve kaydırma konumunu sessionStorage'a
  yazar; çalışma gezinmesi useListeAdresi ile "Çalışmalarıma dön"
  bağlantısını kurar. sessionStorage sekmeye özgü: iki sekmede iki ayrı
  liste hâli birbirini ezmez. Depolama kapalıysa (gizli sekme) dönüş düz
  listeye gider; akış düşmez.
*/
const DONUS_ISARETI = "arvolab.calismalar.donus";

function oku(anahtar: string): string | null {
  try {
    return window.sessionStorage.getItem(anahtar);
  } catch {
    return null;
  }
}
function yaz(anahtar: string, deger: string) {
  try {
    window.sessionStorage.setItem(anahtar, deger);
  } catch {
    // Depolama kapalı: dönüş düz listeye gider.
  }
}

export function ListeKonumunuSakla() {
  const yol = usePathname();
  const sorgu = useSearchParams();
  const adres = sorgu.toString() ? `${yol}?${sorgu.toString()}` : yol;

  useEffect(() => {
    yaz(LISTE_ADRESI_ANAHTARI, adres);
  }, [adres]);

  useEffect(() => {
    /*
      "Çalışmalarıma dön" ile gelindiyse konum geri yüklenir. Bağlantı
      ileri bir gezinme (push); Next yalnızca tarayıcının geri düğmesinde
      kaydırmayı kendisi geri getiriyor.
    */
    if (oku(DONUS_ISARETI) === "1") {
      yaz(DONUS_ISARETI, "");
      const konum = listeKonumuOku(oku(LISTE_KONUMU_ANAHTARI));
      if (konum) window.requestAnimationFrame(() => window.scrollTo({ top: konum }));
    }
    let bekleyen = 0;
    const kaydet = () => {
      window.cancelAnimationFrame(bekleyen);
      bekleyen = window.requestAnimationFrame(() => yaz(LISTE_KONUMU_ANAHTARI, String(Math.round(window.scrollY))));
    };
    window.addEventListener("scroll", kaydet, { passive: true });
    return () => {
      window.cancelAnimationFrame(bekleyen);
      window.removeEventListener("scroll", kaydet);
    };
  }, []);

  return null;
}

const abone = () => () => {};

/** "Çalışmalarıma dön" adresi. Sunucuda ve ilk boyamada düz liste. */
export function useListeAdresi(): string {
  return useSyncExternalStore(
    abone,
    () => listeAdresiOku(oku(LISTE_ADRESI_ANAHTARI)),
    () => LISTE_VARSAYILAN,
  );
}

/** Dönüş bağlantısına tıklanınca: liste açıldığında kaydırma konumunu geri yüklesin. */
export function listeyeDonusIsaretle() {
  yaz(DONUS_ISARETI, "1");
}
