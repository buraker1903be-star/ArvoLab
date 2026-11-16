import {
  bosRapor,
  kesinligiBelirle,
  ortusmeliOfset,
  sayfalariBirlestir,
  kayibiDogrula,
  nesneyiSay,
  nesneyiSiniflandir,
  referansiSay,
  referansiSiniflandir,
  yetimiDogrula,
  yolCoz,
  type Karar,
  type NesneGozlemi,
  type Rapor,
  type ReferansGozlemi,
  type SahipDurumu,
  type SahipTuru,
} from "@/lib/depo-envanteri";

/*
  DEPO ENVANTERİ — tarayıcı (P52b-2A). Supabase'e doğrudan dokunmaz: depo ve
  veritabanı okuyucuları dışarıdan verilir (scripts/depo-envanteri.mjs gerçek
  istemciyi, testler sahtesini verir). Hiçbir okuyucu arayüzünde yazma,
  silme ya da güncelleme yöntemi YOK; olmayan bir şey yanlışlıkla
  çağrılamaz.

  İki geçiş:
   1. Bütün klasörler sayfa sayfa listelenir, bütün referanslar okunur,
      her nesne ve her referans ilk kez sınıflandırılır.
   2. Aday yetim ve aday kayıplar beklemeden sonra YENİDEN gözlenir:
      nesnenin klasörü yeniden listelenir, yol için referans yeniden sorulur,
      sahip yeniden okunur. Bu arada bağlanmış, gelmiş ya da gitmiş olan
      aday listeden düşer. Tek bir taramada görünen hiçbir nesne yetim
      sayılmaz.
*/

export type DepoGirdisi = { ad: string; klasorMu: boolean; boyut: number | null; olusturma: string | null };
export type ListeSonucu =
  | { ok: true; girdiler: DepoGirdisi[] }
  | { ok: false; tekrarDenenebilir: boolean };

export interface DepoOkuyucu {
  /** Bir klasörün bir sayfası. `ara`: yalnızca bu adla başlayanlar (ikinci geçiş). */
  listele(klasor: string, offset: number, limit: number, ara?: string): Promise<ListeSonucu>;
}

export interface VeriOkuyucu {
  /** Verilen kimliklerden var olanlar; okunamazsa null. */
  calismalar(idler: string[]): Promise<Set<string> | null>;
  profiller(idler: string[]): Promise<Set<string> | null>;
  /** Bütün dosya referansları (sayfalanmış okuma okuyucunun işi); okunamazsa null. */
  referanslar(): Promise<ReferansGozlemi[] | null>;
  /** Tek bir yol şu an herhangi bir referansta geçiyor mu; okunamazsa null. */
  yolReferansli(yol: string): Promise<boolean | null>;
}

export type TaramaAyari = {
  sayfa: number;
  /** İki listeleme isteği arasındaki en kısa süre (kota / hız sınırı). */
  istekAraligiMs: number;
  /** Geçici hatada (429, 5xx, ağ) en çok deneme. */
  enCokDeneme: number;
  /** Üstel geri çekilmenin tabanı: taban * 2^deneme. */
  geriCekilmeTabanMs: number;
  /** Bu yaştan genç nesne yetim adayı olamaz. */
  yasEsigiMs: number;
  /** İki geçiş arası bekleme. */
  ikinciGecisBeklemesiMs: number;
  enDerin: number;
  /** Güvenlik freni: bu kadar nesneden sonra tarama durur ve rapor "yarım" der. */
  enCokNesne: number;
  /** Listelenirken içeriği kayan klasör baştan en çok bu kadar kez yeniden listelenir. */
  kararsizYenidenDeneme?: number;
  simdi: () => number;
  uyu: (ms: number) => Promise<void>;
};

export const VARSAYILAN_AYAR: Omit<TaramaAyari, "simdi" | "uyu"> = {
  sayfa: 1000,
  istekAraligiMs: 100,
  enCokDeneme: 4,
  geriCekilmeTabanMs: 500,
  yasEsigiMs: 24 * 60 * 60 * 1000,
  ikinciGecisBeklemesiMs: 60_000,
  enDerin: 4,
  enCokNesne: 500_000,
};

export type TaramaSonucu = {
  rapor: Rapor;
  /** Yalnızca sayılar dışında: yolun SHA-256 özeti, kategori ve karar (ayrıntı dosyası için; yol yok). */
  ayrinti: { ozet: string; kategori: string; sinif: string; sebep: string; boyut: number | null }[];
  yarim: boolean;
};

class Listeleyici {
  sonIstek = 0;
  private depo: DepoOkuyucu;
  private a: TaramaAyari;
  private r: Rapor;
  // Node'un tip sıyırma kipi parametre özelliklerini desteklemiyor: alanlar elle atanıyor.
  constructor(depo: DepoOkuyucu, a: TaramaAyari, r: Rapor) {
    this.depo = depo;
    this.a = a;
    this.r = r;
  }

  /* Bir sayfa: hız sınırına uyar, geçici hatayı üstel geri çekilmeyle yeniden dener. */
  get sayfaBoyu(): number {
    // Örtüşme bir öğe yer; 1'lik sayfa hiç ilerlemez.
    return Math.max(2, this.a.sayfa);
  }

  async sayfa(klasor: string, offset: number, ara?: string): Promise<DepoGirdisi[] | null> {
    for (let deneme = 0; ; deneme++) {
      const bekle = this.sonIstek + this.a.istekAraligiMs - this.a.simdi();
      if (bekle > 0) await this.a.uyu(bekle);
      this.sonIstek = this.a.simdi();
      this.r.istek.listeleme += 1;
      let s: ListeSonucu;
      try {
        s = await this.depo.listele(klasor, offset, this.sayfaBoyu, ara);
      } catch {
        s = { ok: false, tekrarDenenebilir: true };
      }
      if (s.ok) return s.girdiler;
      if (!s.tekrarDenenebilir || deneme + 1 >= this.a.enCokDeneme) return null;
      this.r.istek.yeniden_deneme += 1;
      await this.a.uyu(this.a.geriCekilmeTabanMs * 2 ** deneme);
    }
  }

  /*
    Klasörün TAMAMI, örtüşen sayfalarla. Bir sayfa bile düşerse null (yarım liste
    "yok" demeye yetmez). İçerik listelenirken kaydıysa klasör baştan yeniden
    listelenir; denemeler bitince `kararli: false` döner: görülen nesneler
    gerçektir (tekilleştirilmiş), ama atlanan olabilir.
  */
  async hepsi(klasor: string, ara?: string): Promise<{ girdiler: DepoGirdisi[]; kararli: boolean } | null> {
    const deneme = 1 + (this.a.kararsizYenidenDeneme ?? 2);
    const birlesik = new Map<string, DepoGirdisi>();
    for (let d = 0; d < deneme; d++) {
      const sayfalar: DepoGirdisi[][] = [];
      for (let k = 0; ; k++) {
        const s = await this.sayfa(klasor, ortusmeliOfset(k, this.sayfaBoyu), ara);
        if (s === null) return null;
        sayfalar.push(s);
        if (s.length < this.sayfaBoyu) break;
      }
      const b = sayfalariBirlestir(sayfalar, this.sayfaBoyu);
      this.r.tekrar_ayiklanan += b.tekrar;
      if (b.kararli) return { girdiler: b.girdiler, kararli: true };
      for (const g of b.girdiler) birlesik.set(`${g.klasorMu ? "d" : "f"}:${g.ad}`, g);
    }
    return { girdiler: [...birlesik.values()], kararli: false };
  }
}

async function ozet(yol: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(yol).digest("hex").slice(0, 16);
}

export async function depoEnvanteri(depo: DepoOkuyucu, veri: VeriOkuyucu, ayar: TaramaAyari): Promise<TaramaSonucu> {
  const r = bosRapor();
  const l = new Listeleyici(depo, ayar, r);
  const nesneler: NesneGozlemi[] = [];
  const tamKlasorler = new Set<string>();
  /** Eksiksiz listelenen her klasörün alt klasör adları: "klasör hiç yok" ile "okunamadı"yı ayırmak için. */
  const altKlasorler = new Map<string, Set<string>>();
  let yarim = false;
  const gorulenYollar = new Set<string>();

  /* ---------- 1. geçiş: depo ---------- */
  const gez = async (klasor: string, derinlik: number): Promise<void> => {
    if (yarim) return;
    if (derinlik > ayar.enDerin) {
      r.okunamayan_klasor += 1;
      return;
    }
    const liste = await l.hepsi(klasor);
    if (liste === null) {
      r.okunamayan_klasor += 1;
      return;
    }
    const girdiler = liste.girdiler;
    if (liste.kararli) {
      tamKlasorler.add(klasor);
      altKlasorler.set(klasor, new Set(girdiler.filter((g) => g.klasorMu).map((g) => g.ad)));
    } else {
      // Görülen nesneler sayılır, ama klasör "eksiksiz" sayılmaz: içindeki referans kayıp olamaz.
      r.degisen_klasor += 1;
    }
    for (const g of girdiler) {
      const yol = klasor ? `${klasor}/${g.ad}` : g.ad;
      if (g.klasorMu) await gez(yol, derinlik + 1);
      else {
        // Aynı yol iki kez görülürse (klasör yeniden listelendiyse) bir kez sayılır.
        if (gorulenYollar.has(yol)) {
          r.tekrar_ayiklanan += 1;
          continue;
        }
        gorulenYollar.add(yol);
        nesneler.push({ yol, boyut: g.boyut, olusturma: g.olusturma });
        if (nesneler.length >= ayar.enCokNesne) {
          yarim = true;
          return;
        }
      }
    }
  };
  await gez("", 0);

  /* ---------- 1. geçiş: veritabanı ---------- */
  const referanslar = await veri.referanslar();
  r.istek.veritabani += 1;
  const referansKumesi = referanslar ? new Set(referanslar.map((x) => x.yol)) : null;

  const kimlikler = [...new Set(nesneler.map((n) => yolCoz(n.yol)).filter((y) => y.gecerli).map((y) => (y as { sahipId: string }).sahipId))];
  const calismalar = await parcaParca(kimlikler, (p) => veri.calismalar(p));
  const profiller = await parcaParca(kimlikler, (p) => veri.profiller(p));
  r.istek.veritabani += 2;

  const sahip = (id: string, tur: SahipTuru): SahipDurumu => {
    const c = calismalar === null ? null : calismalar.has(id);
    const p = profiller === null ? null : profiller.has(id);
    if (tur === "calisma") return c === null ? "bilinmiyor" : c ? "var" : "yok";
    if (tur === "kullanici") return p === null ? "bilinmiyor" : p ? "var" : "yok";
    if (c === true || p === true) return "var";
    return c === null || p === null ? "bilinmiyor" : "yok";
  };

  const kararlar = new Map<NesneGozlemi, Karar>();
  for (const n of nesneler) {
    kararlar.set(
      n,
      nesneyiSiniflandir(n, {
        sahip,
        referansli: (yol) => (referansKumesi ? referansKumesi.has(yol) : null),
        simdi: ayar.simdi(),
        yasEsigiMs: ayar.yasEsigiMs,
      }),
    );
  }

  const depoKumesi = new Set(nesneler.map((n) => n.yol));
  /*
    Klasörün içeriği BİLİNİYOR mu? Ya kendisi eksiksiz listelendi, ya da üst
    klasörü eksiksiz listelendi ve bu klasör orada hiç görünmedi (kesin boş).
    Eskiden yalnızca ilki sayılıyordu: dosyası klasörüyle birlikte gitmiş bir
    referans (silinen çalışmanın kaydı gibi) "kayıp" yerine "okunamadı" çıkıyordu.
    Üst klasör okunamadıysa bilinmiyor; tarama yarım kaldıysa hiçbir şey bilinmiyor.
  */
  const klasorBilinen = (k: string): boolean => {
    if (yarim) return false;
    if (tamKlasorler.has(k)) return true;
    if (k === "") return false;
    const i = k.lastIndexOf("/");
    const ust = i < 0 ? "" : k.slice(0, i);
    if (!klasorBilinen(ust)) return false;
    // Üst klasör eksiksiz listelendiyse ve bu ad orada klasör olarak varsa, listelemesi düşmüş demek.
    return tamKlasorler.has(ust) ? !altKlasorler.get(ust)!.has(k.slice(i + 1)) : true;
  };
  const refKararlar: [ReferansGozlemi, Karar][] = (referanslar ?? []).map((x) => [
    x,
    referansiSiniflandir(x, klasorBilinen, (y) => depoKumesi.has(y)),
  ]);
  if (referanslar === null) r.kayip_dogrulanamadi += 1;

  /* ---------- 2. geçiş ---------- */
  const adayVar = [...kararlar.values()].some((k) => k.sinif === "ADAY_YETIM") || refKararlar.some(([, k]) => k.sinif === "ADAY_KAYIP");
  if (adayVar && ayar.ikinciGecisBeklemesiMs > 0) await ayar.uyu(ayar.ikinciGecisBeklemesiMs);

  const depodaMi = async (yol: string): Promise<"var" | "yok" | "bilinmiyor"> => {
    const i = yol.lastIndexOf("/");
    const ad = yol.slice(i + 1);
    const g = await l.hepsi(yol.slice(0, i), ad);
    if (g === null) return "bilinmiyor";
    if (g.girdiler.some((x) => !x.klasorMu && x.ad === ad)) return "var";
    // Kararsız listede görünmemek "yok" demek değildir.
    return g.kararli ? "yok" : "bilinmiyor";
  };
  const sahipYeniden = async (yol: string): Promise<SahipDurumu> => {
    const y = yolCoz(yol);
    if (!y.gecerli) return "bilinmiyor";
    r.istek.veritabani += 1;
    const c = y.sahip === "kullanici" ? new Set<string>() : await veri.calismalar([y.sahipId]);
    const p = y.sahip === "calisma" ? new Set<string>() : await veri.profiller([y.sahipId]);
    if (c === null || p === null) return "bilinmiyor";
    return c.has(y.sahipId) || p.has(y.sahipId) ? "var" : "yok";
  };

  const ayrinti: TaramaSonucu["ayrinti"] = [];
  for (const n of nesneler) {
    let k: Karar | null = kararlar.get(n)!;
    if (k.sinif === "ADAY_YETIM") {
      r.istek.veritabani += 1;
      k = yetimiDogrula(k, { depoda: await depodaMi(n.yol), referansli: await veri.yolReferansli(n.yol), sahip: await sahipYeniden(n.yol) });
    }
    if (k === null) {
      r.ikinci_geciste_kaybolan += 1;
      continue;
    }
    nesneyiSay(r, n, k);
    ayrinti.push({ ozet: await ozet(n.yol), kategori: yolCoz(n.yol).kategori, sinif: k.sinif, sebep: k.sebep, boyut: n.boyut });
  }
  for (const [ref, ilk] of refKararlar) {
    let k: Karar | null = ilk;
    if (k.sinif === "ADAY_KAYIP") {
      r.istek.veritabani += 1;
      k = kayibiDogrula(k, { depoda: await depodaMi(ref.yol), referansli: await veri.yolReferansli(ref.yol) });
    }
    if (k === null) continue;
    referansiSay(r, k);
    if (k.sinif !== "SAHIPLI") ayrinti.push({ ozet: await ozet(ref.yol), kategori: `ref:${ref.kaynak}`, sinif: k.sinif, sebep: k.sebep, boyut: null });
  }

  kesinligiBelirle(r, {
    yarim,
    referansOkunamadi: referanslar === null,
    sahipOkunamadi: kimlikler.length > 0 && (calismalar === null || profiller === null),
  });
  return { rapor: r, ayrinti, yarim };
}

/* Kimlik listesi büyük olabilir: PostgREST `in` filtresi URL'ye sığsın diye parça parça. */
async function parcaParca(idler: string[], oku: (parca: string[]) => Promise<Set<string> | null>): Promise<Set<string> | null> {
  const sonuc = new Set<string>();
  for (let i = 0; i < idler.length; i += 100) {
    const s = await oku(idler.slice(i, i + 100));
    if (s === null) return null;
    for (const x of s) sonuc.add(x);
  }
  return sonuc;
}
