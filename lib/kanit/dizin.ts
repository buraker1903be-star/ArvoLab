/*
  Künye doğrulamasının ağ katmanı: Crossref ve OpenAlex.

  Akış:
    1. DOI varsa Crossref'te DOI kaydı; yoksa OpenAlex'te DOI.
    2. DOI yoksa Crossref'te başlık + ilk yazar araması; başlığı eşiği
       geçen en iyi aday karşılaştırılır.
    3. DOI bilinen her kayıt için OpenAlex'ten açık erişim bilgisi.

  ÜÇ AYRI SONUÇ, birbirine karıştırılmaz:
    - kayıt bulundu       → alan alan karşılaştırma (kunyeKarsilastir)
    - kayıt bulunamadı    → "doğrulanamadı". Sahte demek DEĞİL: DOI başka
                            bir kayıt kuruluşunda (DataCite, mEDRA) olabilir,
                            kaynak dizinlenmemiş olabilir.
    - dizine ulaşılamadı  → HİÇBİR sonuç yazılmaz. Geçici bir ağ hatasını
                            "doğrulanamadı" diye kaydetmek, kullanıcıya
                            kaynağıyla ilgili yanlış bir sinyal verirdi.

  Ağ dışarıdan verilebiliyor (`getir`): karar mantığı ağ olmadan
  sınanıyor (tests/unit/kanit-dizin.test.ts).
*/

import { CROSSREF_USER_AGENT, crossrefWorkUrl } from "@/lib/doi";
import {
  BASLIK_ESIGI,
  baslikBenzerligi,
  crossrefKaydi,
  doiAyikla,
  kunyeKarsilastir,
  openAlexErisim,
  openAlexKaydi,
  soyadlar,
  type DizinKaydi,
  type ErisimBilgisi,
  type KaynakKunyesi,
  type KunyeKarsilastirmasi,
} from "./kunye-karsilastirma";
import type { Dil } from "@/lib/dil";

export type Getir = (adres: string) => Promise<{ durum: number; veri: unknown }>;

export const varsayilanGetir: Getir = async (adres) => {
  const yanit = await fetch(adres, {
    headers: { Accept: "application/json", "User-Agent": CROSSREF_USER_AGENT },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  return { durum: yanit.status, veri: yanit.ok ? await yanit.json().catch(() => null) : null };
};

export type DogrulamaSonucu =
  | { tur: "bulundu"; karsilastirma: KunyeKarsilastirmasi; erisim: ErisimBilgisi; doi: string | null }
  | { tur: "bulunamadi"; neden: string; erisim: ErisimBilgisi; doi: string | null }
  | { tur: "ulasilamadi"; neden: string };

class Ulasilamadi extends Error {}

/** 404 → null (kayıt yok); başka bir başarısızlık → Ulasilamadi. */
async function oku(getir: Getir, adres: string): Promise<unknown | null> {
  let sonuc: { durum: number; veri: unknown };
  try {
    sonuc = await getir(adres);
  } catch {
    throw new Ulasilamadi(adres);
  }
  if (sonuc.durum === 404) return null;
  if (sonuc.durum < 200 || sonuc.durum >= 300 || sonuc.veri === null) throw new Ulasilamadi(adres);
  return sonuc.veri;
}

const openAlexDoiAdresi = (doi: string) => `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`;

async function erisimBilgisi(getir: Getir, doi: string | null): Promise<ErisimBilgisi> {
  if (!doi) return { durum: "bilinmiyor", adres: null };
  try {
    const veri = await oku(getir, openAlexDoiAdresi(doi));
    return veri ? openAlexErisim(veri) : { durum: "bilinmiyor", adres: null };
  } catch {
    // Erişim bilgisi künyeye ek; alınamaması doğrulamayı düşürmez.
    return { durum: "bilinmiyor", adres: null };
  }
}

/*
  dil: `neden` ve karşılaştırma özetinin dili (28.10.2026). Dizine giden
  istek dilden bağımsız; yalnızca kullanıcıya dönen cümle değişiyor.
*/
export async function kunyeDogrula(kaynak: KaynakKunyesi, getir: Getir = varsayilanGetir, dil: Dil = "tr"): Promise<DogrulamaSonucu> {
  const t = (tr: string, en: string) => (dil === "en" ? en : tr);
  const doi = doiAyikla(kaynak.doi_or_url);

  try {
    let kayit: DizinKaydi | null = null;

    if (doi) {
      const crossref = (await oku(getir, crossrefWorkUrl(doi))) as { message?: unknown } | null;
      kayit = crossref ? crossrefKaydi(crossref.message, doi) : null;
      if (!kayit) {
        const openalex = await oku(getir, openAlexDoiAdresi(doi));
        kayit = openalex ? openAlexKaydi(openalex) : null;
      }
      if (!kayit) {
        return {
          tur: "bulunamadi",
          neden: t(
            "DOI Crossref'te ve OpenAlex'te bulunamadı. DOI yanlış yazılmış ya da başka bir kayıt kuruluşunda (ör. DataCite) olabilir; bu, kaynağın sahte olduğunu göstermez.",
            "The DOI was not found in Crossref or OpenAlex. It may be mistyped or registered with another agency (e.g., DataCite); this does not show that the source is fake.",
          ),
          erisim: { durum: "bilinmiyor", adres: null },
          doi,
        };
      }
    } else {
      if (!kaynak.title?.trim()) return { tur: "bulunamadi", neden: t("Kaynağın başlığı yok; arama yapılamadı.", "The source has no title; the search could not be run."), erisim: { durum: "bilinmiyor", adres: null }, doi: null };
      const adres = new URL("https://api.crossref.org/works");
      adres.searchParams.set("query.bibliographic", [kaynak.title, soyadlar(kaynak.authors)[0]].filter(Boolean).join(" "));
      adres.searchParams.set("rows", "5");
      adres.searchParams.set("select", "DOI,title,author,editor,issued,published-print,published-online,container-title,volume,issue,page");
      const arama = (await oku(getir, adres.toString())) as { message?: { items?: unknown[] } } | null;
      const adaylar = (arama?.message?.items ?? [])
        .map((oge) => crossrefKaydi(oge, String((oge as { DOI?: unknown })?.DOI ?? "")))
        .filter((k): k is DizinKaydi => Boolean(k?.doi))
        .map((k) => ({ k, benzerlik: baslikBenzerligi(kaynak.title, k.baslik) }))
        .sort((a, b) => b.benzerlik - a.benzerlik);
      const en = adaylar[0];
      if (!en || en.benzerlik < BASLIK_ESIGI) {
        return {
          tur: "bulunamadi",
          neden: t(
            "Crossref'te başlığı eşleşen bir kayıt bulunamadı. Kaynak dizinlenmemiş olabilir; DOI ekleyip tekrar deneyin ya da yayıncı sayfasından kontrol edin.",
            "No Crossref record with a matching title was found. The source may not be indexed; add a DOI and try again, or check the publisher's page.",
          ),
          erisim: { durum: "bilinmiyor", adres: null },
          doi: null,
        };
      }
      kayit = en.k;
    }

    const karsilastirma = kunyeKarsilastir(kaynak, kayit, dil);
    return { tur: "bulundu", karsilastirma, erisim: await erisimBilgisi(getir, kayit.doi ?? doi), doi: kayit.doi ?? doi };
  } catch (hata) {
    if (hata instanceof Ulasilamadi)
      return { tur: "ulasilamadi", neden: t("Dizinlere şu anda ulaşılamıyor. Sonuç kaydedilmedi; birazdan tekrar deneyin.", "The indexes cannot be reached right now. No result was saved; try again shortly.") };
    throw hata;
  }
}
