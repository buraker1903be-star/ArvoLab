/*
  MAKALE BUL: ARAMA SIRASINDA OTOMATİK KÜNYE KONTROLÜ (20.11.2026).

  Arama sonuçları gelir gelmez her sonucun künyesi (DOI, başlık, ilk yazar,
  yıl) BAŞKA bir dizinle karşılaştırılır; öğrencinin ayrıca kaynakça
  denetimi çalıştırması gerekmez. Saf modül: ağ dışarıdan verilir
  (`getir`), testi tests/unit/arama-kunye-kontrolu.test.ts.

  BAĞIMSIZLIK KURALI. Sonucu OpenAlex getirdiyse Crossref'e, Crossref
  getirdiyse OpenAlex'e sorulur. Aynı dizini yeniden okumak "doğrulama"
  değildir — aynı kaydı iki kez görmek olur; bunu "eşleşti" diye sunmak
  kullanıcıyı yanıltır. Sonuç aramada İKİ dizinden birden geldiyse iki
  dizinin ham künyesi (lib/literatur-arama.ts `ham`) birbirine karşı
  sınanır, ağa yeniden çıkılmaz. Birleşik kayıt KULLANILMAZ: birleştirme
  yılı OpenAlex'ten, dergiyi Crossref'ten alıyor; birleşik kaydı bir
  dizinle karşılaştırmak o dizinin kendi verisini kendisiyle
  karşılaştırmaktır. (Not: OpenAlex verisinin bir kısmı Crossref'ten
  türer; iki dizin tamamen bağımsız değildir. Ekran bunu "dizinler
  arasında tutarlı" diye söyler, "kaynak doğru" diye değil.)

  BEŞ DURUM, birbirinin yerine geçmez:
    kontrol_ediliyor   istek sürüyor (yalnızca istemcide)
    eslesti            başlık, ilk yazar ve yıl öteki dizinle tuttu; DOI
                       iki tarafta da varsa o da tuttu
    eksik              temel alanlardan birine bakılamadı (bir tarafta yok)
    belirsiz           öteki dizindeki kayıtta bir temel alan FARKLI, DOI
                       başka bir başlığa çıkıyor ya da birden çok aday var
    kontrol_edilemedi  öteki dizine ulaşılamadı YA DA kayıt orada yok.
                       Hiçbiri "yanlış kaynak" demek değil: servis
                       arızası geçicidir (gecici: true, önbelleğe girmez),
                       dizinde olmamak da sahtelik kanıtı değildir (DOI
                       DataCite'ta olabilir, kaynak dizinlenmemiş olabilir).

  Bu yalnızca KÜNYE kontrolüdür: PDF'in varlığı ve pasajın PDF'te geçmesi
  ayrı kontroller (lib/kaynak-durumu.ts); burada ikisine de bakılmaz.
*/
import { crossrefWorkUrl } from "@/lib/doi";
import type { Metin } from "@/lib/dil";
import type { Getir } from "@/lib/kanit/dizin";
import {
  BASLIK_ESIGI,
  baslikBenzerligi,
  crossrefKaydi,
  doiAyikla,
  kunyeKarsilastir,
  openAlexKaydi,
  sade,
  soyadlar,
  type AlanSonucu,
  type DizinKaydi,
  type KaynakKunyesi,
} from "@/lib/kanit/kunye-karsilastirma";
import type { AramaSaglayici, HamKunye } from "@/lib/literatur-arama";

export type KunyeKontrolDurumu = "kontrol_ediliyor" | "eslesti" | "eksik" | "belirsiz" | "kontrol_edilemedi";
type TemelAlan = "baslik" | "ilk_yazar" | "yil" | "doi";

export type KunyeKontrolSonucu = {
  durum: Exclude<KunyeKontrolDurumu, "kontrol_ediliyor">;
  /** Karşılaştırılan (bağımsız) dizin; servis hatasında da hangi dizine sorulduğu. */
  dizin: AramaSaglayici;
  neden: Metin;
  alanlar: { alan: TemelAlan; sonuc: AlanSonucu }[];
  /**
   * Eklemede kullanılacak, öteki dizinin teyit ettiği bilgiler. YALNIZCA
   * başlık ve ilk yazar tutmuş, hiçbir temel alan farklı değilken dolar:
   * belirsiz bir eşleşmenin verisi kaynağa yazılmaz.
   */
  tamamlama: { doi?: string; yil?: number; dergi?: string } | null;
  /** Servis arızası: önbelleğe girmez, sonra yeniden denenebilir. */
  gecici: boolean;
};

export type KontrolGirdisi = {
  baslik: string;
  yazarlar: string[];
  kunyeYazarlari: string | null;
  yil: number | null;
  dergi: string | null;
  doi: string | null;
  saglayici: AramaSaglayici;
  ham?: Partial<Record<AramaSaglayici, HamKunye>>;
};

const DIZIN_ADI: Record<AramaSaglayici, string> = { openalex: "OpenAlex", crossref: "Crossref" };
export const bagimsizDizin = (saglayici: AramaSaglayici): AramaSaglayici => (saglayici === "openalex" ? "crossref" : "openalex");

/** Önbellek anahtarı: karşılaştırmaya giren alanlar. Aynı içerik → aynı sonuç (aramadan bağımsız). */
export function kontrolAnahtari(g: KontrolGirdisi): string {
  const hamlar = (["openalex", "crossref"] as const).map((d) => (g.ham?.[d] ? [d, doiAyikla(g.ham[d]!.doi), sade(g.ham[d]!.baslik), g.ham[d]!.yil, soyadlar(g.ham[d]!.yazarlar)[0] ?? ""] : null));
  return JSON.stringify([g.saglayici, doiAyikla(g.doi), sade(g.baslik), g.yil, soyadlar(g.kunyeYazarlari ?? g.yazarlar.join("; "))[0] ?? "", hamlar]);
}

// ---------- Karşılaştırma ve sınıflandırma (ağsız) ----------

const sonKelime = (s: string) => sade(s).split(" ").at(-1) ?? "";

/*
  İlk yazar: soyadının SON sözcüğü karşılaştırılır. OpenAlex adı tek dize
  verir ("Jan van der Berg" → "Berg"), Crossref soyadını ayrı ("van der
  Berg"); tam eşitlik doğru kaydı "belirsiz" gösterirdi. Yanlış alarm
  kaçırılan hatadan sinsidir: kullanıcı göstergeye güvenmeyi bırakır.
*/
function ilkYazarSonucu(bizimYazarlar: string, kayit: DizinKaydi): AlanSonucu {
  const ilk = soyadlar(bizimYazarlar)[0];
  if (!ilk) return "bizde_yok";
  if (!kayit.soyadlar.length) return "kayitta_yok";
  return kayit.soyadlar.some((s) => sonKelime(s) === sonKelime(ilk)) ? "eslesti" : "farkli";
}

const ALAN_ADI: Record<TemelAlan, Metin> = {
  baslik: { tr: "başlık", en: "title" },
  ilk_yazar: { tr: "ilk yazar", en: "first author" },
  yil: { tr: "yıl", en: "year" },
  doi: { tr: "DOI", en: "DOI" },
};
const liste = (alanlar: TemelAlan[], dil: "tr" | "en") => alanlar.map((a) => ALAN_ADI[a][dil]).join(", ");

/** Bizim künye ile öteki dizinin kaydını karşılaştırıp beş durumdan birine indirger. */
export function siniflandir(bizim: KaynakKunyesi & { yilSayi: number | null }, kayit: DizinKaydi, doiIleBulundu: boolean): KunyeKontrolSonucu {
  const k = kunyeKarsilastir(bizim, kayit);
  const al = (ad: TemelAlan) => k.alanlar.find((a) => a.alan === ad)!.sonuc;
  const alanlar: KunyeKontrolSonucu["alanlar"] = [
    { alan: "baslik", sonuc: al("baslik") },
    { alan: "ilk_yazar", sonuc: ilkYazarSonucu(bizim.authors ?? "", kayit) },
    { alan: "yil", sonuc: al("yil") },
    { alan: "doi", sonuc: al("doi") },
  ];
  const dizin = kayit.dizin;
  const ad = DIZIN_ADI[dizin];

  if (alanlar[0].sonuc !== "eslesti") {
    return {
      durum: "belirsiz",
      dizin,
      alanlar,
      tamamlama: null,
      gecici: false,
      neden: doiIleBulundu
        ? { tr: `Bu DOI ${ad}'de başka bir başlığa çıkıyor; DOI ya da başlık hatalı olabilir.`, en: `This DOI leads to a different title in ${ad}; the DOI or the title may be wrong.` }
        : { tr: `${ad}'deki en yakın kaydın başlığı tutmuyor.`, en: `The closest ${ad} record has a different title.` },
    };
  }

  /*
    YIL ±1: Crossref'in yılı çevrim içi ilk yayımın, OpenAlex'inki sayının
    yılı olabiliyor (lib/literatur-arama.ts birleştirme notu). Aynı yayında
    sık görülen bu fark "belirsiz" sayılmaz; künyede sayının yılı (OpenAlex)
    kullanılır ve kullanıcıya söylenir. Daha büyük fark belirsizdir.
  */
  let yilNotu: Metin | null = null;
  let sayiYili: number | undefined;
  const yilAlani = alanlar[2];
  if (yilAlani.sonuc === "farkli" && bizim.yilSayi != null && kayit.yil != null && Math.abs(bizim.yilSayi - kayit.yil) === 1) {
    yilAlani.sonuc = "eslesti";
    sayiYili = dizin === "openalex" ? kayit.yil : bizim.yilSayi;
    yilNotu = {
      tr: ` Yıl dizinler arasında bir farklı (${bizim.yilSayi} / ${kayit.yil}): çevrim içi ilk yayım ile sayı yılı; künyede ${sayiYili} kullanılır.`,
      en: ` The year differs by one between indexes (${bizim.yilSayi} / ${kayit.yil}): online-first vs. issue year; ${sayiYili} is used in the reference.`,
    };
  }

  const farkli = alanlar.filter((a) => a.sonuc === "farkli").map((a) => a.alan);
  const eksik = alanlar.filter((a) => (a.sonuc === "bizde_yok" || a.sonuc === "kayitta_yok") && a.alan !== "doi").map((a) => a.alan);
  if (farkli.length) {
    return {
      durum: "belirsiz",
      dizin,
      alanlar,
      tamamlama: null,
      gecici: false,
      neden: { tr: `${ad} kaydıyla uyuşmayan: ${liste(farkli, "tr")}.`, en: `Doesn't match the ${ad} record: ${liste(farkli, "en")}.` },
    };
  }

  // Başlık ve ilk yazar tuttu, hiçbir alan farklı değil: öteki dizinin teyit ettiği eksikler eklemede kullanılabilir.
  const tamamlama: NonNullable<KunyeKontrolSonucu["tamamlama"]> = {};
  if (!doiAyikla(bizim.doi_or_url) && kayit.doi) tamamlama.doi = kayit.doi;
  if (bizim.yilSayi == null && kayit.yil != null) tamamlama.yil = kayit.yil;
  if (sayiYili != null && sayiYili !== bizim.yilSayi) tamamlama.yil = sayiYili;
  if (!bizim.container_title && kayit.yayin) tamamlama.dergi = kayit.yayin;
  const yazarTuttu = alanlar[1].sonuc === "eslesti";

  if (eksik.length) {
    const bizdeYok = alanlar.filter((a) => a.sonuc === "bizde_yok" && a.alan !== "doi").map((a) => a.alan);
    const kayittaYok = alanlar.filter((a) => a.sonuc === "kayitta_yok" && a.alan !== "doi").map((a) => a.alan);
    const parcalar: Metin[] = [
      ...(bizdeYok.length ? [{ tr: `arama sonucunda ${liste(bizdeYok, "tr")} yok`, en: `the search result has no ${liste(bizdeYok, "en")}` }] : []),
      ...(kayittaYok.length ? [{ tr: `${ad} kaydında ${liste(kayittaYok, "tr")} yok`, en: `the ${ad} record has no ${liste(kayittaYok, "en")}` }] : []),
    ];
    return {
      durum: "eksik",
      dizin,
      alanlar,
      tamamlama: yazarTuttu && Object.keys(tamamlama).length ? tamamlama : null,
      gecici: false,
      neden: {
        tr: `Karşılaştırılamadı: ${parcalar.map((p) => p.tr).join("; ")}.${tamamlama.yil && bizdeYok.includes("yil") && yazarTuttu ? ` ${ad} yılı ${tamamlama.yil} veriyor; eklerken kullanılır.` : ""}`,
        en: `Couldn't compare: ${parcalar.map((p) => p.en).join("; ")}.${tamamlama.yil && bizdeYok.includes("yil") && yazarTuttu ? ` ${ad} gives the year ${tamamlama.yil}; it's used when adding.` : ""}`,
      },
    };
  }

  return {
    durum: "eslesti",
    dizin,
    alanlar,
    tamamlama: Object.keys(tamamlama).length ? tamamlama : null,
    gecici: false,
    neden: {
      tr: `Başlık, ilk yazar ve yıl ${ad} kaydıyla tutarlı${alanlar[3].sonuc === "eslesti" ? ", DOI aynı" : ""}.${yilNotu?.tr ?? ""}`,
      en: `Title, first author and year are consistent with the ${ad} record${alanlar[3].sonuc === "eslesti" ? "; same DOI" : ""}.${yilNotu?.en ?? ""}`,
    },
  };
}

const kunyeOl = (h: { baslik: string; yazarlar: string; yil: number | null; dergi: string | null; doi: string | null }) => ({
  title: h.baslik,
  authors: h.yazarlar,
  year: h.yil != null ? String(h.yil) : null,
  yilSayi: h.yil,
  container_title: h.dergi,
  doi_or_url: h.doi,
});

/** Ham künyeyi, karşılaştırıcının beklediği dizin kaydına çevirir (iki dizinden gelmiş sonuç için). */
const hamKayit = (dizin: AramaSaglayici, h: HamKunye): DizinKaydi => ({
  dizin,
  baslik: h.baslik,
  soyadlar: soyadlar(h.yazarlar),
  yil: h.yil,
  yayin: h.dergi,
  cilt: null,
  sayi: null,
  sayfalar: null,
  doi: doiAyikla(h.doi),
  adres: null,
});

// ---------- Ağ ----------

class Ulasilamadi extends Error {}

async function oku(getir: Getir, adres: string): Promise<unknown | null> {
  let s: { durum: number; veri: unknown };
  try {
    s = await getir(adres);
  } catch {
    throw new Ulasilamadi(adres);
  }
  if (s.durum === 404) return null;
  if (s.durum < 200 || s.durum >= 300 || s.veri === null) throw new Ulasilamadi(adres);
  return s.veri;
}

export const openAlexDoiAdresi = (doi: string) => `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`;
export function openAlexBaslikAdresi(baslik: string): string {
  const u = new URL("https://api.openalex.org/works");
  u.searchParams.set("search", baslik.replace(/[,:|]/g, " ").slice(0, 300));
  u.searchParams.set("per-page", "5");
  return u.toString();
}
export function crossrefBaslikAdresi(baslik: string, ilkYazar: string | undefined): string {
  const u = new URL("https://api.crossref.org/works");
  u.searchParams.set("query.bibliographic", [baslik, ilkYazar].filter(Boolean).join(" ").slice(0, 400));
  u.searchParams.set("rows", "5");
  u.searchParams.set("select", "DOI,title,author,editor,issued,published-print,published-online,container-title,volume,issue,page");
  return u.toString();
}

const bulunamadi = (dizin: AramaSaglayici, doiIle: boolean): KunyeKontrolSonucu => ({
  durum: "kontrol_edilemedi",
  dizin,
  alanlar: [],
  tamamlama: null,
  gecici: false,
  neden: doiIle
    ? {
        tr: `Bu DOI'nin ${DIZIN_ADI[dizin]}'de kaydı yok; başka bir kayıt kuruluşunda (ör. DataCite) olabilir. Bu, kaynağın yanlış olduğu anlamına gelmez.`,
        en: `This DOI has no ${DIZIN_ADI[dizin]} record; it may be registered elsewhere (e.g., DataCite). This doesn't mean the source is wrong.`,
      }
    : {
        tr: `${DIZIN_ADI[dizin]}'de başlığı tutan bir kayıt bulunamadı; kaynak orada dizinlenmemiş olabilir. Bu, kaynağın yanlış olduğu anlamına gelmez.`,
        en: `No ${DIZIN_ADI[dizin]} record with a matching title was found; it may not be indexed there. This doesn't mean the source is wrong.`,
      },
});

export const servisHatasi = (dizin: AramaSaglayici): KunyeKontrolSonucu => ({
  durum: "kontrol_edilemedi",
  dizin,
  alanlar: [],
  tamamlama: null,
  gecici: true,
  neden: {
    tr: `${DIZIN_ADI[dizin]}'e şu anda ulaşılamadı; künye kontrol edilemedi. Bu, kaynağın yanlış olduğu anlamına gelmez.`,
    en: `${DIZIN_ADI[dizin]} couldn't be reached right now, so the reference wasn't checked. This doesn't mean the source is wrong.`,
  },
});

/** Bir arama sonucunun künyesini öteki dizine karşı kontrol eder. Ağ hatası fırlatmaz, "kontrol_edilemedi" döner. */
export async function aramaKunyesiniKontrolEt(g: KontrolGirdisi, getir: Getir): Promise<KunyeKontrolSonucu> {
  // 1) Aramada iki dizinden birden geldiyse: iki ham künye birbirine karşı, ağsız.
  const oa = g.ham?.openalex;
  const cr = g.ham?.crossref;
  if (oa && cr) {
    const bizim = g.saglayici === "openalex" ? oa : cr;
    const oteki = g.saglayici === "openalex" ? cr : oa;
    return siniflandir(kunyeOl(bizim), hamKayit(bagimsizDizin(g.saglayici), oteki), Boolean(doiAyikla(bizim.doi)));
  }

  // 2) Tek dizinden geldiyse: o dizinin HAM künyesi öteki dizine sorulur.
  const bizimHam: HamKunye = g.ham?.[g.saglayici] ?? { baslik: g.baslik, yazarlar: g.kunyeYazarlari ?? g.yazarlar.join("; "), yil: g.yil, dergi: g.dergi, doi: g.doi };
  const bizim = kunyeOl(bizimHam);
  const dizin = bagimsizDizin(g.saglayici);
  const doi = doiAyikla(bizimHam.doi);
  try {
    if (doi) {
      let kayit: DizinKaydi | null;
      if (dizin === "crossref") {
        const v = (await oku(getir, crossrefWorkUrl(doi))) as { message?: unknown } | null;
        kayit = v ? crossrefKaydi(v.message, doi) : null;
      } else {
        const v = await oku(getir, openAlexDoiAdresi(doi));
        kayit = v ? openAlexKaydi(v) : null;
      }
      return kayit ? siniflandir(bizim, kayit, true) : bulunamadi(dizin, true);
    }
    if (!bizimHam.baslik.trim()) return bulunamadi(dizin, false);
    let adaylar: DizinKaydi[];
    if (dizin === "crossref") {
      const v = (await oku(getir, crossrefBaslikAdresi(bizimHam.baslik, soyadlar(bizimHam.yazarlar)[0]))) as { message?: { items?: unknown[] } } | null;
      adaylar = (v?.message?.items ?? []).map((o) => crossrefKaydi(o, String((o as { DOI?: unknown })?.DOI ?? ""))).filter((k): k is DizinKaydi => Boolean(k));
    } else {
      const v = (await oku(getir, openAlexBaslikAdresi(bizimHam.baslik))) as { results?: unknown[] } | null;
      adaylar = (v?.results ?? []).map((o) => openAlexKaydi(o)).filter((k): k is DizinKaydi => Boolean(k));
    }
    const tutan = adaylar
      .map((k) => ({ k, b: baslikBenzerligi(bizimHam.baslik, k.baslik) }))
      .filter((x) => x.b >= BASLIK_ESIGI)
      .sort((a, b) => b.b - a.b);
    if (!tutan.length) return bulunamadi(dizin, false);
    /*
      Birden çok aday başlığı tutuyor ve aralarında ilk yazar ya da yıl
      ayrışıyorsa (aynı başlıklı farklı yayınlar: bildiri ve dergi sürümü,
      kitap ve bölüm) hangisinin bu sonuç olduğu bilinemez: belirsiz.
      Kullanıcıya tek bir adayı "eşleşti" diye sunmak tahmin olurdu.
    */
    const uyan = tutan.filter((x) => ilkYazarSonucu(bizimHam.yazarlar, x.k) !== "farkli" && (bizimHam.yil == null || x.k.yil == null || Math.abs(x.k.yil - bizimHam.yil) <= 1));
    if (uyan.length > 1 && new Set(uyan.map((x) => x.k.doi ?? x.k.baslik)).size > 1 && new Set(uyan.map((x) => x.k.yil)).size > 1) {
      return {
        durum: "belirsiz",
        dizin,
        alanlar: [],
        tamamlama: null,
        gecici: false,
        neden: { tr: `${DIZIN_ADI[dizin]}'de bu başlıkla birden çok yayın var (ör. bildiri ve dergi sürümü); hangisi olduğu kesinleşmedi.`, en: `${DIZIN_ADI[dizin]} has several publications with this title (e.g., conference and journal versions); which one this is isn't certain.` },
      };
    }
    return siniflandir(bizim, (uyan[0] ?? tutan[0]).k, false);
  } catch (hata) {
    if (hata instanceof Ulasilamadi) return servisHatasi(dizin);
    throw hata;
  }
}

// ---------- Önbellek ----------

/**
 * Süreli, boyutu sınırlı önbellek. Geçici (servis arızası) sonuç YAZILMAZ:
 * arıza geçince aynı kayıt yeniden denenebilmeli. Saat dışarıdan verilir (test).
 */
export class KunyeOnbellegi {
  private kayitlar = new Map<string, { sonuc: KunyeKontrolSonucu; son: number }>();
  private omurMs: number;
  private enFazla: number;
  private simdi: () => number;
  // Parametre özelliği (constructor(private …)) yazılmadı: Node'un tip ayıklayıcısı onu çalıştıramıyor (birim testleri).
  constructor(omurMs = 24 * 60 * 60 * 1000, enFazla = 2000, simdi: () => number = Date.now) {
    this.omurMs = omurMs;
    this.enFazla = enFazla;
    this.simdi = simdi;
  }
  al(anahtar: string): KunyeKontrolSonucu | null {
    const k = this.kayitlar.get(anahtar);
    if (!k) return null;
    if (k.son < this.simdi()) {
      this.kayitlar.delete(anahtar);
      return null;
    }
    return k.sonuc;
  }
  koy(anahtar: string, sonuc: KunyeKontrolSonucu) {
    if (sonuc.gecici) return;
    this.kayitlar.delete(anahtar);
    this.kayitlar.set(anahtar, { sonuc, son: this.simdi() + this.omurMs });
    while (this.kayitlar.size > this.enFazla) this.kayitlar.delete(this.kayitlar.keys().next().value!);
  }
}

// ---------- İstemci kuyruğu ----------

/**
 * Sınırlı eşzamanlı kontrol kuyruğu. `yeniArama` bekleyenleri atar ve
 * nesli artırır; uçuştaki eski istekler bitince sonuçları `bitti`'ye
 * ESKİ nesille gelir ve çağıran onları yeni listeye uygulamaz (yalnızca
 * önbelleğe yazar). `one` görünür sonuçları sıranın başına alır.
 */
export class KontrolKuyrugu<T> {
  private bekleyen: string[] = [];
  private ucusta = new Set<string>();
  private nesil = 0;
  private sinir: number;
  private calistir: (anahtar: string) => Promise<T>;
  private bitti: (nesil: number, anahtar: string, sonuc: T | null) => void;
  constructor(sinir: number, calistir: (anahtar: string) => Promise<T>, bitti: (nesil: number, anahtar: string, sonuc: T | null) => void) {
    this.sinir = sinir;
    this.calistir = calistir;
    this.bitti = bitti;
  }
  get guncelNesil() {
    return this.nesil;
  }
  yeniArama(anahtarlar: string[]) {
    this.nesil += 1;
    this.bekleyen = [...new Set(anahtarlar)].filter((a) => !this.ucusta.has(a));
    this.pompala();
    return this.nesil;
  }
  one(anahtarlar: string[]) {
    const on = anahtarlar.filter((a) => this.bekleyen.includes(a));
    if (!on.length) return;
    this.bekleyen = [...on, ...this.bekleyen.filter((a) => !on.includes(a))];
  }
  /** Bekleyen ve uçuştaki sayısı (test ve kabul için). */
  get durum() {
    return { bekleyen: this.bekleyen.length, ucusta: this.ucusta.size };
  }
  private pompala() {
    while (this.ucusta.size < this.sinir && this.bekleyen.length) {
      const anahtar = this.bekleyen.shift()!;
      const nesil = this.nesil;
      this.ucusta.add(anahtar);
      this.calistir(anahtar)
        .then((s) => this.bitti(nesil, anahtar, s))
        .catch(() => this.bitti(nesil, anahtar, null))
        .finally(() => {
          this.ucusta.delete(anahtar);
          this.pompala();
        });
    }
  }
}
