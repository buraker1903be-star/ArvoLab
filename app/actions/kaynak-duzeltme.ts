"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { ceviri } from "@/lib/dil-sunucu";
import { normalizeDoi } from "@/lib/doi";
import { DUZELTME_ALANLARI, duzeltmeFarklari, type DuzeltmeAlani, type DuzeltmeFarki } from "@/lib/kaynak-duzeltme";
import { lookupDoi } from "./literature";

/*
  ESKİ KAYNAK DÜZELTME (20.11.2026). Öneri ve uygulama ayrı eylemler:
  öğrenci farkı GÖRMEDEN hiçbir alan değişmez. Uygulamada dizin yeniden
  sorgulanır ve yalnızca öğrencinin işaretlediği alanlar, dizinin ŞU ANKİ
  değeriyle yazılır: istemciden gelen bir değer künyeye yazılmaz (yoksa bu
  eylem herhangi bir alanı herhangi bir değerle değiştirme aracına
  dönüşürdü). DOI sorgusu lookupDoi'nin kapılarından (oturum, abonelik,
  saatlik hak) geçer.
*/
const SECIM = "id, title, authors, year, container_title, volume, issue, pages, publisher, doi_or_url";

async function kaynakVeDizin(sourceId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { hata: await oturumYokMesaji() } as const;
  const t = await ceviri();
  const { data: kaynak, error } = await ctx.supabase.from("literature_sources").select(SECIM).eq("id", sourceId).eq("owner_id", ctx.user.id).maybeSingle();
  if (error) {
    console.error("[kaynak-duzeltme] okunamadı:", error.message);
    return { hata: t({ tr: "Kaynak okunamadı; tekrar deneyin.", en: "The source couldn't be read; please try again." }) } as const;
  }
  if (!kaynak) return { hata: t({ tr: "Kaynak bulunamadı ya da size ait değil.", en: "Source not found or it doesn't belong to you." }) } as const;
  const doi = normalizeDoi(String(kaynak.doi_or_url ?? ""));
  if (!doi) return { hata: t({ tr: "Bu kaynağın DOI'si yok; dizinden düzeltme önerilemez. Bilgileri elle düzenleyin.", en: "This source has no DOI, so no index correction can be suggested. Edit the details manually." }) } as const;
  const dizin = await lookupDoi(doi);
  if (dizin.error || !dizin.metadata) return { hata: dizin.error ?? t({ tr: "Dizin bilgisi alınamadı.", en: "Couldn't get index details." }) } as const;
  return { ctx, t, kaynak, farklar: duzeltmeFarklari(kaynak, dizin.metadata) } as const;
}

/** Dizinle mevcut kayıt arasındaki farklar; hiçbir şey yazmaz. */
export async function kaynakDuzeltmeOnerisi(sourceId: string): Promise<{ farklar: DuzeltmeFarki[] } | { hata: string }> {
  const sonuc = await kaynakVeDizin(String(sourceId ?? ""));
  if ("hata" in sonuc) return { hata: sonuc.hata ?? "" };
  return { farklar: sonuc.farklar };
}

/** Yalnızca seçilen alanları dizinin şu anki değeriyle yazar. */
export async function kaynakDuzeltmeUygula(sourceId: string, alanlar: string[]): Promise<{ guncellenen: DuzeltmeAlani[] } | { hata: string }> {
  // Yeni içerik yazıyor: abonelik kapısı (lib/access.ts listesi).
  if (await isSubscriptionBlocked()) return { hata: await abonelikKapaliMesaji() };
  const secilen = new Set((Array.isArray(alanlar) ? alanlar : []).filter((a): a is DuzeltmeAlani => (DUZELTME_ALANLARI as string[]).includes(a)));
  const sonuc = await kaynakVeDizin(String(sourceId ?? ""));
  if ("hata" in sonuc) return { hata: sonuc.hata ?? "" };
  const { ctx, t, kaynak, farklar } = sonuc;
  const uygulanacak = farklar.filter((f) => secilen.has(f.alan));
  if (!uygulanacak.length) return { guncellenen: [] };
  const degisiklik = Object.fromEntries(uygulanacak.map((f) => [f.alan, f.onerilen.slice(0, f.alan === "title" ? 500 : 300)]));
  const { error } = await ctx.supabase.from("literature_sources").update(degisiklik).eq("id", kaynak.id).eq("owner_id", ctx.user.id);
  if (error) {
    console.error("[kaynak-duzeltme] yazılamadı:", error.message);
    return { hata: t({ tr: "Düzeltme kaydedilemedi; tekrar deneyin.", en: "The correction couldn't be saved; please try again." }) };
  }
  revalidatePath("/dashboard/literature");
  return { guncellenen: uygulanacak.map((f) => f.alan) };
}
