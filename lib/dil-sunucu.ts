/*
  Arayüz dilinin sunucu tarafı (karar lib/dil.ts'te).

  Bilerek "use server" DEĞİL (AGENTS.md): yardımcılar böyle dosyalarda durmaz.
  Sunucu bileşenleri ve sunucu işlemleri aynı çerezi okur; işlemin
  döndürdüğü hata mesajı da kullanıcının dilinde olur.
*/
import { cache } from "react";
import { cookies, headers } from "next/headers";
import {
  ceviriciKur,
  DIL_CEREZI,
  dilMi,
  INGILIZCE_YAYINDA,
  SAAT_DILIMI_CEREZI,
  saatDilimiMi,
  tarayicidanDil,
  VARSAYILAN_DIL,
  VARSAYILAN_SAAT_DILIMI,
  type Cevirici,
  type Dil,
} from "./dil";
import { tarihBicimleri, type TarihBicimleri } from "./tr-time";

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

/** Kullanıcının saat dilimi: Türkçede Türkiye, İngilizcede tarayıcının bildirdiği. */
export const aktifSaatDilimi = cache(async (): Promise<string> => {
  if ((await aktifDil()) === "tr") return VARSAYILAN_SAAT_DILIMI;
  const cerez = (await cookies()).get(SAAT_DILIMI_CEREZI)?.value;
  return saatDilimiMi(cerez) ? cerez : VARSAYILAN_SAAT_DILIMI;
});

/** Sunucuda tarih biçimleri: const { tarih, tarihSaat } = await tarihler(); */
export async function tarihler(): Promise<TarihBicimleri> {
  return tarihBicimleri(await aktifDil(), await aktifSaatDilimi());
}
