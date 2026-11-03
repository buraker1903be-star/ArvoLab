"use server";

import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { abonelikKapaliMesaji, isSubscriptionBlocked } from "@/lib/access";
import { ceviri } from "@/lib/dil-sunucu";
import type { Dil } from "@/lib/dil";
import type { CitableSource } from "@/lib/citation-format";
import { cslCoz } from "@/lib/atif/csl-kimlik";
import { cslAra, cslBul, type CslSecenegi } from "@/lib/atif/csl-dizin";
import { cslBicimle, cslKaynakcaBicimle, type Parca } from "@/lib/atif/csl";
import { cslStilXml, cslYerelleri } from "@/lib/atif/csl-indir";

/*
  CSL STİLLERİ (03.11.2026): stil arama ve atıf/künye üretimi. Kurallar
  lib/atif/csl*.ts'te. Arama bir okuma, kapısız; atıf üretmek belgeye
  yeni içerik yazdığı için abonelik kapısından geçer (lib/access.ts).
*/

export async function cslStilAra(sorgu: string): Promise<{ hata?: string; stiller?: CslSecenegi[] }> {
  if (!(await getAuthContext())) return { hata: await oturumYokMesaji() };
  return { stiller: cslAra(String(sorgu ?? "").slice(0, 100)) };
}

/** Kayıtlı stilin gerçek başlığı (çalışma formunda seçili stili göstermek için). */
export async function cslStilBilgisi(deger: string): Promise<CslSecenegi | null> {
  if (!(await getAuthContext())) return null;
  const csl = cslCoz(deger);
  return csl ? cslBul(csl.ad, csl.kod) : null;
}

const kirp = (deger: unknown, uzunluk: number) => (typeof deger === "string" && deger.trim() ? deger.trim().slice(0, uzunluk) : null);

function kaynakTemizle(k: CitableSource): CitableSource | null {
  const baslik = kirp(k?.title, 500);
  if (!baslik) return null;
  return {
    title: baslik,
    authors: kirp(k.authors, 1000),
    year: kirp(k.year, 20),
    source_type: kirp(k.source_type, 20) ?? "other",
    doi_or_url: kirp(k.doi_or_url, 500),
    container_title: kirp(k.container_title, 500),
    volume: kirp(k.volume, 40),
    issue: kirp(k.issue, 40),
    pages: kirp(k.pages, 40),
    publisher: kirp(k.publisher, 300),
    publication_place: kirp(k.publication_place, 200),
  };
}

const bugunIstanbul = () => new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())}T12:00:00Z`);

/**
 * Literatür → "Kaynakçayı kopyala" CSL stilinde. Bir okuma/biçimleme:
 * belgeye yazmıyor, kullanıcı panoya kopyalıyor; kapı yok (dışa aktarmanın
 * öteki biçimleri, RIS ve BibTeX, de kapısız).
 */
export async function cslKaynakca(girdi: { stil: string; kaynaklar: CitableSource[]; dil: Dil }): Promise<{ hata?: string; satirlar?: Parca[][] }> {
  const t = await ceviri();
  if (!(await getAuthContext())) return { hata: await oturumYokMesaji() };
  const csl = cslCoz(girdi.stil);
  if (!csl || !cslBul(csl.ad, csl.kod)) return { hata: t({ tr: "Atıf stili tanınmadı.", en: "Citation style not recognized." }) };
  const kaynaklar = (Array.isArray(girdi.kaynaklar) ? girdi.kaynaklar : [])
    .slice(0, 2_000)
    .map(kaynakTemizle)
    .filter((k): k is CitableSource => k !== null);
  if (!kaynaklar.length) return { satirlar: [] };
  try {
    const stilXml = await cslStilXml(csl.ad);
    if (!stilXml) return { hata: t({ tr: "Atıf stili CSL deposunda bulunamadı.", en: "The citation style wasn't found in the CSL repository." }) };
    const erisim = bugunIstanbul();
    return {
      satirlar: cslKaynakcaBicimle({
        stilXml,
        yerel: await cslYerelleri(stilXml),
        kaynaklar: kaynaklar.map((k) => ({ ...k, erisimTarihi: erisim })),
        dil: girdi.dil === "en" ? "en" : "tr",
      }),
    };
  } catch (hata) {
    console.error("[csl] kaynakça biçimlenemedi:", csl.ad, hata);
    return { hata: t({ tr: "Kaynakça bu stille biçimlenemedi; birazdan tekrar deneyin.", en: "The reference list couldn't be formatted in this style; try again shortly." }) };
  }
}

export async function cslAtifUret(girdi: {
  stil: string;
  kaynak: CitableSource;
  numara: number;
  sayfa?: string | null;
  kisa?: boolean;
  dil: Dil;
  /** Erişim tarihi (web sayfası künyesi), ISO gün. */
  erisim?: string | null;
}): Promise<{ hata?: string; atif?: Parca[]; kunye?: Parca[] }> {
  const t = await ceviri();
  if (!(await getAuthContext())) return { hata: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { hata: await abonelikKapaliMesaji() };
  const csl = cslCoz(girdi.stil);
  if (!csl || !cslBul(csl.ad, csl.kod)) return { hata: t({ tr: "Atıf stili tanınmadı; çalışmanın stilini yeniden seçin.", en: "Citation style not recognized; choose the project's style again." }) };

  const kaynak = kaynakTemizle(girdi.kaynak);
  if (!kaynak) return { hata: t({ tr: "Kaynağın başlığı yok.", en: "The source has no title." }) };
  const numara = Number.isInteger(girdi.numara) && girdi.numara > 0 && girdi.numara < 10_000 ? girdi.numara : 1;
  const erisim = /^\d{4}-\d{2}-\d{2}$/.test(girdi.erisim ?? "") ? new Date(`${girdi.erisim}T12:00:00Z`) : null;

  let stilXml: string | null;
  try {
    stilXml = await cslStilXml(csl.ad);
  } catch (hata) {
    console.error("[csl] stil indirilemedi:", hata);
    return { hata: t({ tr: "Atıf stili şu an indirilemedi; birazdan tekrar deneyin.", en: "The citation style couldn't be downloaded right now; try again shortly." }) };
  }
  if (!stilXml) return { hata: t({ tr: "Atıf stili CSL deposunda bulunamadı; başka bir stil seçin.", en: "The citation style wasn't found in the CSL repository; choose another style." }) };

  try {
    const sonuc = cslBicimle({
      stilXml,
      yerel: await cslYerelleri(stilXml),
      kod: csl.kod,
      kaynak: { ...kaynak, erisimTarihi: erisim },
      numara,
      sayfa: kirp(girdi.sayfa, 40),
      kisa: Boolean(girdi.kisa),
      dil: girdi.dil === "en" ? "en" : "tr",
    });
    if (!sonuc.atif.length) return { hata: t({ tr: "Bu stil atıf üretemedi.", en: "This style couldn't produce a citation." }) };
    return sonuc;
  } catch (hata) {
    console.error("[csl] biçimlenemedi:", csl.ad, hata);
    return { hata: t({ tr: "Atıf bu stille biçimlenemedi; başka bir stil deneyin.", en: "The citation couldn't be formatted in this style; try another one." }) };
  }
}
