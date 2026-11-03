/*
  CSL STİL KİMLİĞİ (03.11.2026). Zotero/Mendeley'in kullandığı Citation
  Style Language deposundaki ~10 600 stil (dergi, yayınevi, üniversite)
  ArvoLab'da seçilebiliyor. Kimlik veritabanına düz metin olarak yazılır:

      csl:<kod>:<depodaki stil adı>      ör. csl:s:american-medical-association

  Kod, stilin METİN İÇİ ATFININ BİÇİMİ. Neden kimliğin içinde: denetçi
  (lib/atif/kunye.ts, lib/structure-check.ts) tarayıcıda da çalışıyor ve
  atfı nasıl arayacağını bilmek zorunda; 1 MB'lık stil dizinini istemciye
  taşımak ya da her denetimde sunucuya sormak yerine biçim kimliğe
  gömüldü. Kod, dizin üretilirken (scripts/csl-dizini-uret.mjs) stilin
  XML'inden ve numaralı stillerde citeproc ile çizilen atıftan okunuyor,
  elle yazılmıyor.

      a  yazar-tarih              (Smith, 2020) / (Smith 2020)
      k  numara, köşeli parantez  [1]
      p  numara, parantez         (1)
      s  numara, üst simge        ¹
      d  dipnot
      y  yazar (MLA benzeri)       (Smith 45)

  Etiket ("[Smi20]") stilleri ve öneksiz numara stilleri (toplam ~40)
  dizine alınmadı: denetçi onların atfını metinden güvenle ayıramıyor ve
  yanlış alarm, hiç denetlememekten kötü.

  Saf modül; testi tests/unit/csl-kimlik.test.ts.
*/

export type CslKodu = "a" | "k" | "p" | "s" | "d" | "y";
export const CSL_KODLARI: CslKodu[] = ["a", "k", "p", "s", "d", "y"];

/** Veritabanı kısıtıyla AYNI desen (migration 20261103*_csl_stilleri). */
export const CSL_DESENI = /^csl:([akpsdy]):([a-z0-9][a-z0-9-]{0,119})$/;

export type CslKimligi = { kod: CslKodu; ad: string };

export function cslCoz(deger: string | null | undefined): CslKimligi | null {
  const m = CSL_DESENI.exec(String(deger ?? ""));
  return m ? { kod: m[1] as CslKodu, ad: m[2] } : null;
}

export const cslKimligi = (kod: CslKodu, ad: string) => `csl:${kod}:${ad}`;

export const cslMi = (deger: string | null | undefined) => cslCoz(deger) !== null;

/*
  Görünen ad: dizindeki başlık sunucuda; kayıtlı bir kimliği her ekranda
  dizinden okumak yerine depodaki dosya adından türetilir
  ("american-medical-association" → "American Medical Association").
  Seçim penceresi gerçek başlığı gösterir; burası yalnızca etiket.
*/
const KISALTMA = new Set(["apa", "ama", "ieee", "mla", "acs", "aip", "acm", "bmj", "nlm", "iso", "din", "un", "who", "sbl", "mhra", "oscola", "aglc", "asa", "cse", "aaa", "apsa", "uk", "us", "eu"]);
export function cslGorunenAd(deger: string | null | undefined): string {
  const csl = cslCoz(deger);
  if (!csl) return "";
  return csl.ad
    .split("-")
    .map((s) => (KISALTMA.has(s) || /\d/.test(s) ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1)))
    .join(" ");
}

/** Üst simge rakamlar: denetçi düz metinde ¹²³ görür, sıradan rakama çevirir. */
const UST = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/* Atıfın sayfa eki de üst simgede durur ("⁷⁽ᵖ⁵⁰⁾"); düz "(p" araya girince rakamlar ayrı atıf gibi görünüyordu. */
const UST_EK: Record<string, string> = { ",": "˒", "-": "⁻", "–": "⁻", "(": "⁽", ")": "⁾", p: "ᵖ" };
export const ustSimge = (metin: string) => metin.replace(/\d/g, (d) => UST[Number(d)]).replace(/[,–\-()p]/g, (c) => UST_EK[c]);
export const ustSimgedenRakam = (metin: string) =>
  metin.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (d) => String(UST.indexOf(d))).replace(/˒/g, ",").replace(/⁻/g, "–");
