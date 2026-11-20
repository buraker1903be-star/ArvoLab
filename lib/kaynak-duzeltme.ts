import type { DoiMetadata } from "@/lib/doi";
import { htmlVarliklariniCoz } from "@/lib/html-varlik";
import { splitAuthors } from "@/lib/citation-format";

/*
  ESKİ KAYNAKLAR İÇİN ONAYLI DÜZELTME ÖNERİSİ (20.11.2026). Eski kayıtlarda
  yazar listesi "A. Smith and B. Jones" gibi belirsiz biçimde, sayfa ya da
  cilt eksik olabiliyor. TOPLU dönüştürme yapılmıyor (kurum sahibinin
  kararı): yanlış bir otomatik düzeltme öğrencinin elle düzelttiği bir
  alanı ezer ve fark edilmez. Bunun yerine güvenilir dizin verisi (DOI ile
  Crossref) alan alan karşılaştırılır, fark gösterilir, YALNIZCA öğrencinin
  işaretlediği alanlar uygulanır.

  Kurallar:
    - Dizinde boş olan alan önerilmez: öneri bir alanı asla SİLMEZ.
    - Yalnızca biçim farkı (boşluk, büyük/küçük harf, HTML varlığı) öneri
      sayılmaz: "aynı şey" için öğrenciyi rahatsız etmeyiz.
    - Uygulama sunucuda dizin YENİDEN sorgulanarak yapılır; istemciden
      gelen değere güvenilmez (app/actions/kaynak-duzeltme.ts).
  Saf modül: tests/unit/kaynak-duzeltme.test.ts.
*/
export type DuzeltmeAlani = "title" | "authors" | "year" | "container_title" | "volume" | "issue" | "pages" | "publisher";
export const DUZELTME_ALANLARI: DuzeltmeAlani[] = ["authors", "year", "title", "container_title", "volume", "issue", "pages", "publisher"];

export type MevcutKaynak = Partial<Record<DuzeltmeAlani, string | null>>;
export type DuzeltmeFarki = { alan: DuzeltmeAlani; mevcut: string | null; onerilen: string };

const DIZIN_ALANI: Record<DuzeltmeAlani, keyof DoiMetadata> = {
  title: "title",
  authors: "authors",
  year: "year",
  container_title: "containerTitle",
  volume: "volume",
  issue: "issue",
  pages: "pages",
  publisher: "publisher",
};

const normal = (s: string | null | undefined) =>
  htmlVarliklariniCoz(String(s ?? ""))
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[.\s]+$/, "");

export function duzeltmeFarklari(mevcut: MevcutKaynak, dizin: DoiMetadata): DuzeltmeFarki[] {
  const farklar: DuzeltmeFarki[] = [];
  for (const alan of DUZELTME_ALANLARI) {
    const onerilen = String(dizin[DIZIN_ALANI[alan]] ?? "").trim();
    if (!onerilen) continue;
    const simdiki = mevcut[alan] ?? null;
    if (normal(simdiki) === normal(onerilen)) continue;
    farklar.push({ alan, mevcut: simdiki?.trim() ? simdiki.trim() : null, onerilen });
  }
  return farklar;
}

/**
 * Yazar alanı APA dışı ya da belirsiz biçimde mi (listede rozet için).
 * "Smith, J., & Jones, B." gibi bir dizi kendi kendine geri çözülebiliyorsa
 * belirsiz değildir; "J. Smith and B. Jones", "Smith J; Jones B" ya da
 * "et al." taşıyan kayıt belirsizdir.
 */
export function yazarBicimiBelirsiz(authors: string | null | undefined): boolean {
  const a = String(authors ?? "").trim();
  if (!a) return false;
  if (/\bet al\.?|\bvd\.?(?!\w)/i.test(a)) return true;
  if (/\s(and|ve)\s/i.test(a) && !/,\s*&\s|,\s*ve\s/.test(a)) return true;
  /* Ad önce yazılmış parça ("B. Demir"): virgülsüz ve baş harfle başlıyor.
     Tek sözcüklü kurum adı ("UNESCO") belirsiz sayılmaz. */
  return splitAuthors(a).some((p) => !p.includes(",") && /^(\p{Lu}\.\s*)+\p{L}/u.test(p.trim()));
}
