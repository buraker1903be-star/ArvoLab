"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { ceviriciKur, SAAT_DILIMI_CEREZI, VARSAYILAN_DIL, VARSAYILAN_SAAT_DILIMI, type Cevirici, type Dil } from "@/lib/dil";
import { tarihBicimleri, type TarihBicimleri } from "@/lib/tr-time";

/*
  İstemci bileşenlerinin dili. Kök yerleşim sunucuda okuduğu dili buraya
  veriyor; istemci çerezi kendisi okumuyor — sunucu ile istemci aynı ekranda
  iki farklı dil çizerse hidrasyon uyuşmazlığı çıkar.
*/
const DilBaglami = createContext<{ dil: Dil; saatDilimi: string }>({ dil: VARSAYILAN_DIL, saatDilimi: VARSAYILAN_SAAT_DILIMI });

export function DilSaglayici({ dil, saatDilimi, children }: { dil: Dil; saatDilimi: string; children: ReactNode }) {
  /*
    Tarayıcının saat dilimini çereze yaz: sunucu bir SONRAKİ istekte tarihleri
    kullanıcının saatiyle çizer. Bu istekte değiştirmiyoruz — sunucunun
    çizdiğiyle aynı değeri kullanmak hidrasyon uyuşmazlığını önlüyor.
  */
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && !document.cookie.includes(`${SAAT_DILIMI_CEREZI}=${encodeURIComponent(tz)}`)) {
        document.cookie = `${SAAT_DILIMI_CEREZI}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      }
    } catch {
      // saat dilimi okunamazsa varsayılan kalır
    }
  }, []);
  const deger = useMemo(() => ({ dil, saatDilimi }), [dil, saatDilimi]);
  return <DilBaglami.Provider value={deger}>{children}</DilBaglami.Provider>;
}

export function useDil(): Dil {
  return useContext(DilBaglami).dil;
}

/** İstemcide tarih biçimleri, sunucuyla aynı dil ve saat dilimiyle. */
export function useTarihler(): TarihBicimleri {
  const { dil, saatDilimi } = useContext(DilBaglami);
  return useMemo(() => tarihBicimleri(dil, saatDilimi), [dil, saatDilimi]);
}

/** İstemcide çevirici: const t = useCeviri(); t({ tr: "…", en: "…" }) */
export function useCeviri(): Cevirici {
  const dil = useDil();
  return useMemo(() => ceviriciKur(dil), [dil]);
}
