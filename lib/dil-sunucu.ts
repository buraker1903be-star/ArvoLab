/*
  Arayüz dilinin sunucu tarafı (karar lib/dil.ts'te).

  Bilerek "use server" DEĞİL (AGENTS.md): yardımcılar böyle dosyalarda durmaz.
  Sunucu bileşenleri ve sunucu işlemleri aynı çerezi okur; işlemin
  döndürdüğü hata mesajı da kullanıcının dilinde olur.
*/
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { ceviriciKur, DIL_CEREZI, dilMi, INGILIZCE_YAYINDA, tarayicidanDil, VARSAYILAN_DIL, type Cevirici, type Dil } from "./dil";

/** İstek başına bir kez: çerez, yoksa tarayıcının dili (çerez proxy'de yazılıyor). */
export const aktifDil = cache(async (): Promise<Dil> => {
  const cerez = (await cookies()).get(DIL_CEREZI)?.value;
  if (dilMi(cerez)) return cerez;
  if (!INGILIZCE_YAYINDA) return VARSAYILAN_DIL;
  return tarayicidanDil((await headers()).get("accept-language"));
});

/** Sunucuda çevirici: const t = await ceviri(); t({ tr: "…", en: "…" }) */
export async function ceviri(): Promise<Cevirici> {
  return ceviriciKur(await aktifDil());
}
