"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ceviriciKur, VARSAYILAN_DIL, type Cevirici, type Dil } from "@/lib/dil";

/*
  İstemci bileşenlerinin dili. Kök yerleşim sunucuda okuduğu dili buraya
  veriyor; istemci çerezi kendisi okumuyor — sunucu ile istemci aynı ekranda
  iki farklı dil çizerse hidrasyon uyuşmazlığı çıkar.
*/
const DilBaglami = createContext<Dil>(VARSAYILAN_DIL);

export function DilSaglayici({ dil, children }: { dil: Dil; children: ReactNode }) {
  return <DilBaglami.Provider value={dil}>{children}</DilBaglami.Provider>;
}

export function useDil(): Dil {
  return useContext(DilBaglami);
}

/** İstemcide çevirici: const t = useCeviri(); t({ tr: "…", en: "…" }) */
export function useCeviri(): Cevirici {
  const dil = useDil();
  return useMemo(() => ceviriciKur(dil), [dil]);
}
