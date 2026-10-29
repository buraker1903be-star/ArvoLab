/*
  Bibliyografik doğrulama: kullanıcının kaydettiği künye ile dizindeki
  kayıt ALAN ALAN karşılaştırılır.

  Tek bir "doğrulandı / doğrulanmadı" yetmiyor. "Bu kaynakta yayın yılı
  ile kaynakça kaydı uyuşmuyor" diyebilmek için hangi alanın tuttuğunu,
  hangisinin tutmadığını ve hangisine hiç bakılamadığını ayrı ayrı
  bilmek gerekiyor. Sonuç:

    dogrulandi  başlık, yıl ve ilk yazar karşılaştırıldı ve hepsi tuttu;
                karşılaştırılabilen diğer alanlar da tuttu
    kismen      başlık tuttu ama bir alan farklı ya da temel alanlardan
                birine bakılamadı
    uyusmuyor   başlık tutmuyor: dizindeki kayıt başka bir yayın

  Dizinde kaydın BULUNAMAMASI burada ele alınmıyor; o "doğrulanamadı"dır
  ve "sahte" anlamına gelmez (çağıran yazar, app/actions/kanit.ts).

  Saf modül; testi tests/unit/kanit-kunye.test.ts.
*/

import type { Dil, Metin } from "@/lib/dil";

export type DizinKaydi = {
  dizin: "crossref" | "openalex";
  baslik: string;
  /** Yazarların soyadları (dizindeki sırayla). */
  soyadlar: string[];
  yil: number | null;
  yayin: string | null;
  cilt: string | null;
  sayi: string | null;
  sayfalar: string | null;
  doi: string | null;
  adres: string | null;
};

/** literature_sources satırının karşılaştırılan alanları. */
export type KaynakKunyesi = {
  title: string;
  authors?: string | null;
  year?: string | null;
  container_title?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  doi_or_url?: string | null;
};

export type AlanSonucu = "eslesti" | "farkli" | "bizde_yok" | "kayitta_yok";
export type KunyeSonucu = "dogrulandi" | "kismen" | "uyusmuyor";

export type AlanKarsilastirmasi = {
  alan: "baslik" | "yil" | "ilk_yazar" | "yayin" | "cilt" | "sayi" | "sayfalar" | "doi";
  etiket: string;
  bizde: string | null;
  kayitta: string | null;
  sonuc: AlanSonucu;
};

export type KunyeKarsilastirmasi = {
  durum: KunyeSonucu;
  dizin: DizinKaydi["dizin"];
  alanlar: AlanKarsilastirmasi[];
  adres: string | null;
};

/*
  Alan etiketleri iki dilde (28.10.2026). Karşılaştırma kunye_ayrintisi
  olarak veritabanına yazılıyor ve içindeki `etiket` yazıldığı günün
  dilinde kalıyor; ekran etiketi `alan` anahtarından alanEtiketi ile
  yeniden kurmalı, kayıttaki metne güvenmemeli.
*/
const ETIKET: Record<AlanKarsilastirmasi["alan"], Metin> = {
  baslik: { tr: "Başlık", en: "Title" },
  yil: { tr: "Yıl", en: "Year" },
  ilk_yazar: { tr: "İlk yazar", en: "First author" },
  yayin: { tr: "Dergi / kitap", en: "Journal / book" },
  cilt: { tr: "Cilt", en: "Volume" },
  sayi: { tr: "Sayı", en: "Issue" },
  sayfalar: { tr: "Sayfalar", en: "Pages" },
  doi: { tr: "DOI", en: "DOI" },
};

/** Karşılaştırılan alanın adı, istenen dilde. */
export function alanEtiketi(alan: AlanKarsilastirmasi["alan"], dil: Dil = "tr"): string {
  return ETIKET[alan][dil];
}

const DURAK = new Set([
  "a", "an", "and", "the", "of", "in", "on", "for", "to", "ve", "ile", "bir", "bu", "da", "de", "için", "üzerine",
]);

/** Aksan ve Türkçe harf farkı gözetilmeden: dizinler "Yilmaz" da yazabiliyor. */
export function sade(metin: string): string {
  return metin
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const kelimeler = (metin: string) => sade(metin).split(" ").filter((k) => k.length > 1 && !DURAK.has(k));

/*
  Payda KISA tarafa göre (lib/academic-reference-verification.ts'teki
  gerekçe): künyede alt başlık yazılmamışsa eşleşme cezalandırılmamalı.
  Kısa başlıkta tesadüf yüksek; kapsama yalnızca yeterince ortak kelime
  varken uygulanıyor.
*/
export function baslikBenzerligi(sol: string, sag: string): number {
  const a = new Set(kelimeler(sol));
  const b = new Set(kelimeler(sag));
  if (!a.size || !b.size) return 0;
  let ortak = 0;
  for (const k of a) if (b.has(k)) ortak += 1;
  const payda = ortak >= 3 ? Math.min(a.size, b.size) : Math.max(a.size, b.size);
  return ortak / payda;
}

export const BASLIK_ESIGI = 0.85;

/**
 * APA biçimindeki yazar dizisinden soyadları: "Yılmaz, A., Demir, B. C., & Kaya, D."
 * Biçim tanınmazsa her parçanın son sözcüğü alınır ("Ali Taş; Ayşe Kara").
 */
export function soyadlar(yazarlar: string | null | undefined): string[] {
  const metin = (yazarlar ?? "").trim();
  if (!metin) return [];
  /* Küçük harfli önek ("de Souza", "van Dijk") soyadın parçası: eskiden
     "Souza" alınıyor, Crossref'in "de Souza"sıyla eşleşmiyor ve doğru
     künye "kısmen" çıkıyordu. Bağlaç ("ve", "and") önek sayılmaz. */
  const apa = [...metin.matchAll(/(?<![\p{L}])((?:(?!(?:ve|and)\s)\p{Ll}+\s+)*\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*)*),\s*(?:\p{Lu}\.\s*-?\s*)+/gu)].map((m) => m[1]);
  if (apa.length) return apa;
  return metin
    .split(/\s*(?:;|&|\bve\b|\band\b|,)\s*/u)
    .map((parca) => parca.trim().split(/\s+/).at(-1) ?? "")
    .filter((s) => s.length > 1);
}

const yilOku = (deger: string | null | undefined) => {
  const m = /\b(1[5-9]\d{2}|20\d{2})\b/.exec(deger ?? "");
  return m ? Number(m[1]) : null;
};

const rakam = (deger: string | null | undefined) => (deger ?? "").replace(/[^\p{N}]/gu, "") || null;

const ilkSayfa = (deger: string | null | undefined) => {
  const m = /([A-Za-z]?\d+)/.exec((deger ?? "").replace(/[\u2010-\u2015]/g, "-"));
  return m ? m[1].toLowerCase() : null;
};

export function doiAyikla(deger: string | null | undefined): string | null {
  // Eski Wiley SICI DOI'leri "<…>" taşıyor; eskiden "<"da kesilip kalıcı "doğrulanamadı" yazılıyordu.
  const m = /10\.\d{4,9}\/(?:[^\s"<>]|<[^\s"<>]*>)+/i.exec(deger ?? "");
  return m ? m[0].replace(/[.,;)\]]+$/, "").toLowerCase() : null;
}

function alan(
  ad: AlanKarsilastirmasi["alan"],
  bizde: string | null,
  kayitta: string | null,
  esit: (a: string, b: string) => boolean,
  dil: Dil,
): AlanKarsilastirmasi {
  const sonuc: AlanSonucu = !bizde ? "bizde_yok" : !kayitta ? "kayitta_yok" : esit(bizde, kayitta) ? "eslesti" : "farkli";
  return { alan: ad, etiket: ETIKET[ad][dil], bizde, kayitta, sonuc };
}

export function kunyeKarsilastir(kaynak: KaynakKunyesi, kayit: DizinKaydi, dil: Dil = "tr"): KunyeKarsilastirmasi {
  const ilkYazar = soyadlar(kaynak.authors)[0] ?? null;
  const alanlar: AlanKarsilastirmasi[] = [
    alan("baslik", kaynak.title?.trim() || null, kayit.baslik || null, (a, b) => baslikBenzerligi(a, b) >= BASLIK_ESIGI, dil),
    alan("yil", yilOku(kaynak.year)?.toString() ?? null, kayit.yil?.toString() ?? null, (a, b) => a === b, dil),
    /* İlk yazar, dizindeki yazarların HERHANGİ biriyle eşleşirse tutmuş
       sayılır; sıra farkı burada yazar uydurmasından ayırt edilemez. */
    alan("ilk_yazar", ilkYazar, kayit.soyadlar.length ? kayit.soyadlar.join(", ") : null, (a) =>
      kayit.soyadlar.some((s) => sade(s) === sade(a)),
    dil,
    ),
    alan("yayin", kaynak.container_title?.trim() || null, kayit.yayin, (a, b) => {
      const x = sade(a);
      const y = sade(b);
      return x === y || (Math.min(x.length, y.length) >= 8 && (x.includes(y) || y.includes(x)));
    }, dil),
    alan("cilt", rakam(kaynak.volume), rakam(kayit.cilt), (a, b) => a === b, dil),
    alan("sayi", rakam(kaynak.issue), rakam(kayit.sayi), (a, b) => a === b, dil),
    alan("sayfalar", kaynak.pages?.trim() || null, kayit.sayfalar, (a, b) => ilkSayfa(a) === ilkSayfa(b), dil),
    alan("doi", doiAyikla(kaynak.doi_or_url), kayit.doi?.toLowerCase() ?? null, (a, b) => a === b, dil),
  ];

  const sonucu = (ad: AlanKarsilastirmasi["alan"]) => alanlar.find((a) => a.alan === ad)!.sonuc;
  const temel = (["baslik", "yil", "ilk_yazar"] as const).map(sonucu);

  const durum: KunyeSonucu =
    sonucu("baslik") !== "eslesti"
      ? "uyusmuyor"
      : temel.every((s) => s === "eslesti") && !alanlar.some((a) => a.sonuc === "farkli")
        ? "dogrulandi"
        : "kismen";

  return { durum, dizin: kayit.dizin, alanlar, adres: kayit.adres };
}

/** Kullanıcıya gösterilecek tek cümle: hangi alan uyuşmuyor ya da bakılamadı. */
export function kunyeOzeti(k: KunyeKarsilastirmasi, dil: Dil = "tr"): string {
  const dizin = k.dizin === "crossref" ? "Crossref" : "OpenAlex";
  if (dil === "en") {
    // Etiket kayıttan değil anahtardan: kayıt Türkçe yazılmış olabilir.
    const ad = (a: AlanKarsilastirmasi) => alanEtiketi(a.alan, "en").toLowerCase();
    const farkli = k.alanlar.filter((a) => a.sonuc === "farkli").map(ad);
    const eksik = k.alanlar.filter((a) => a.sonuc === "bizde_yok" && ["baslik", "yil", "ilk_yazar"].includes(a.alan)).map(ad);
    if (k.durum === "uyusmuyor") return `The title of the ${dizin} record does not match your record; the DOI may belong to another publication.`;
    if (k.durum === "dogrulandi") return `Title, year and first author matched the ${dizin} record.`;
    const parcalar = [farkli.length ? `mismatched: ${farkli.join(", ")}` : "", eksik.length ? `missing in your record: ${eksik.join(", ")}` : ""].filter(Boolean);
    return `Partially matched the ${dizin} record (${parcalar.join("; ") || "some fields could not be checked"}).`;
  }
  const farkli = k.alanlar.filter((a) => a.sonuc === "farkli").map((a) => a.etiket.toLocaleLowerCase("tr-TR"));
  const eksik = k.alanlar
    .filter((a) => a.sonuc === "bizde_yok" && ["baslik", "yil", "ilk_yazar"].includes(a.alan))
    .map((a) => a.etiket.toLocaleLowerCase("tr-TR"));
  if (k.durum === "uyusmuyor") return `${dizin} kaydının başlığı sizin kaydınızla uyuşmuyor; DOI başka bir yayına ait olabilir.`;
  if (k.durum === "dogrulandi") return `${dizin} kaydıyla başlık, yıl ve ilk yazar eşleşti.`;
  const parcalar = [
    farkli.length ? `uyuşmayan: ${farkli.join(", ")}` : "",
    eksik.length ? `kaydınızda eksik: ${eksik.join(", ")}` : "",
  ].filter(Boolean);
  return `${dizin} kaydıyla kısmen eşleşti (${parcalar.join("; ") || "bazı alanlara bakılamadı"}).`;
}

// ---------- Dizin yanıtlarını DizinKaydi'na çevirenler ----------

type CrossrefTarih = { "date-parts"?: (number | null)[][] };

const yilTarihten = (...tarihler: (CrossrefTarih | undefined)[]) => {
  for (const t of tarihler) {
    const yil = t?.["date-parts"]?.[0]?.[0];
    if (typeof yil === "number" && yil > 1000) return yil;
  }
  return null;
};

const temiz = (deger: unknown) =>
  typeof deger === "string" ? deger.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null : null;

/** Crossref /works/{doi} yanıtındaki "message" nesnesi. Başlık yoksa null. */
export function crossrefKaydi(mesaj: unknown, doi: string): DizinKaydi | null {
  const w = (mesaj ?? {}) as Record<string, unknown>;
  const baslik = temiz(Array.isArray(w.title) ? w.title[0] : null);
  if (!baslik) return null;
  const kisiler = (Array.isArray(w.author) && w.author.length ? w.author : Array.isArray(w.editor) ? w.editor : []) as {
    family?: unknown;
    name?: unknown;
  }[];
  return {
    dizin: "crossref",
    baslik,
    soyadlar: kisiler.map((k) => temiz(k.family) ?? temiz(k.name)?.split(" ").at(-1) ?? "").filter(Boolean),
    yil: yilTarihten(
      w.issued as CrossrefTarih,
      w["published-print"] as CrossrefTarih,
      w["published-online"] as CrossrefTarih,
    ),
    yayin: temiz(Array.isArray(w["container-title"]) ? w["container-title"][0] : null),
    cilt: temiz(w.volume),
    sayi: temiz(w.issue),
    sayfalar: temiz(w.page),
    doi: doi.toLowerCase(),
    adres: `https://doi.org/${doi}`,
  };
}

/** OpenAlex /works/{id} yanıtı. Başlık yoksa null. */
export function openAlexKaydi(veri: unknown): DizinKaydi | null {
  const w = (veri ?? {}) as Record<string, unknown>;
  const baslik = temiz(w.title ?? w.display_name);
  if (!baslik) return null;
  const yazarlar = (Array.isArray(w.authorships) ? w.authorships : []) as { author?: { display_name?: unknown } }[];
  const biblio = (w.biblio ?? {}) as Record<string, unknown>;
  const konum = (w.primary_location ?? {}) as { source?: { display_name?: unknown }; landing_page_url?: unknown };
  const doi = doiAyikla(typeof w.doi === "string" ? w.doi : null);
  const ilk = temiz(biblio.first_page);
  const son = temiz(biblio.last_page);
  return {
    dizin: "openalex",
    baslik,
    soyadlar: yazarlar.map((y) => temiz(y.author?.display_name)?.split(" ").at(-1) ?? "").filter(Boolean),
    yil: typeof w.publication_year === "number" ? w.publication_year : null,
    yayin: temiz(konum.source?.display_name),
    cilt: temiz(biblio.volume),
    sayi: temiz(biblio.issue),
    sayfalar: ilk ? (son ? `${ilk}-${son}` : ilk) : null,
    doi,
    adres: doi ? `https://doi.org/${doi}` : temiz(konum.landing_page_url) ?? temiz(w.id),
  };
}

export type ErisimBilgisi = { durum: "acik_erisim" | "acik_erisim_yok" | "bilinmiyor"; adres: string | null };

/*
  Açık erişim bilgisi OpenAlex'ten. İÇERİK GETİRİLMİYOR: yalnızca tam
  metnin açıkça erişilebilir olup olmadığı ve adresi. "Tam metin
  incelendi" demek için kullanıcının metni okuyup ilgili bölümü eklemesi
  gerekiyor; erişilebilir olması incelendiği anlamına gelmez.
*/
export function openAlexErisim(veri: unknown): ErisimBilgisi {
  const w = (veri ?? {}) as Record<string, unknown>;
  const oa = (w.open_access ?? null) as { is_oa?: unknown; oa_url?: unknown } | null;
  if (!oa || typeof oa.is_oa !== "boolean") return { durum: "bilinmiyor", adres: null };
  const en = (w.best_oa_location ?? {}) as { pdf_url?: unknown; landing_page_url?: unknown };
  return oa.is_oa
    ? { durum: "acik_erisim", adres: temiz(oa.oa_url) ?? temiz(en.pdf_url) ?? temiz(en.landing_page_url) }
    : { durum: "acik_erisim_yok", adres: null };
}
