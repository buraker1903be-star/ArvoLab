/*
  DEPO ENVANTERİ — sınıflandırma (P52b-2A). Saf modül; testi
  tests/unit/depo-envanteri.test.ts. Tarayıcı lib/depo-envanteri-tarama.ts,
  komut scripts/depo-envanteri.mjs.

  Amaç SİLMEK DEĞİL, saymak: depodaki her nesne ile veritabanındaki her
  dosya referansı karşılaştırılır ve dört sınıftan birine konur. Bu modülün
  hiçbir çıktısı tek başına bir silme kararı değildir; kalıcı silme ayrı bir
  onayla, ayrı bir mekanizmayla (P52b-2C) gelecek.

    SAHIPLI        sahibi ve (gerekiyorsa) referansı var
    ADAY_YETIM     sahibi yok ya da referansı yok, YAŞ EŞİĞİNİ geçti ve
                   ikinci doğrulamada da öyle
    ADAY_KAYIP     veritabanı gösteriyor, depo (eksiksiz listelenen klasörde)
                   göstermiyor, ikinci doğrulamada da öyle
    DOGRULANAMADI  karar verilemedi: depo/veritabanı okunamadı, yol tanınmadı,
                   nesne çok taze, kategori kapsam dışı

  Kural: emin olunamayan her durum DOGRULANAMADI'dır; ADAY_YETIM'e asla
  "varsayılan" olarak düşülmez. Yanlış pozitif yetim, ileride gerçek bir
  dosyanın silinmesi demek; yanlış negatif yalnızca bir sonraki taramaya
  kalan bir kalabalık.
*/

export type Sinif = "SAHIPLI" | "ADAY_YETIM" | "ADAY_KAYIP" | "DOGRULANAMADI";

/*
  Kategoriler ve kimin klasöründe durdukları. Yollar uygulamadaki yükleme
  noktalarından çıkarıldı (grep: `.upload(`, `${user.id}/…`):
    kaynak-pdf     <çalışma>/kaynak-pdf/…      kaynak_pdfleri.depo_yolu
    editor-images  <çalışma|kullanıcı>/editor-images/…  metindeki bağlantı; görsel
                   kütüphanesi klasördeki HER dosyayı yeniden kullandırıyor,
                   yani metinde geçmeyen görsel de sahiplidir
    imports        <kullanıcı>/imports/…       geçici (Word içe aktarma işleyince siler)
    belge          <kullanıcı>/<zaman>-<ad>    document_uploads.storage_path
    kilavuz, uak, docentlik, etik, exports  <kullanıcı>/<alt>/…  (2A kapsamı dışında:
                   yalnızca sahip denetlenir)
*/
export type Kategori =
  | "kaynak-pdf"
  | "editor-images"
  | "imports"
  | "belge"
  | "kilavuz"
  | "uak"
  | "docentlik"
  | "etik"
  | "exports"
  | "bilinmeyen";

export type SahipTuru = "calisma" | "kullanici" | "calisma_ya_da_kullanici";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ALT_KLASOR: Record<string, { kategori: Exclude<Kategori, "bilinmeyen" | "belge">; sahip: SahipTuru }> = {
  "kaynak-pdf": { kategori: "kaynak-pdf", sahip: "calisma" },
  "editor-images": { kategori: "editor-images", sahip: "calisma_ya_da_kullanici" },
  imports: { kategori: "imports", sahip: "kullanici" },
  kilavuz: { kategori: "kilavuz", sahip: "kullanici" },
  uak: { kategori: "uak", sahip: "kullanici" },
  docentlik: { kategori: "docentlik", sahip: "kullanici" },
  etik: { kategori: "etik", sahip: "kullanici" },
  exports: { kategori: "exports", sahip: "kullanici" },
};

export type YolBilgisi =
  | { gecerli: true; kategori: Exclude<Kategori, "bilinmeyen">; sahipId: string; sahip: SahipTuru }
  | { gecerli: false; kategori: "bilinmeyen" };

/** Depo yolunu kategoriye ve sahip klasörüne çözer. `..`, boş bölüm, büyük harfli kimlik, tanınmayan alt klasör: bilinmeyen. */
export function yolCoz(yol: string): YolBilgisi {
  if (typeof yol !== "string" || !yol || yol.length > 1024 || yol.includes("\\")) return { gecerli: false, kategori: "bilinmeyen" };
  const bolumler = yol.split("/");
  if (bolumler.some((b) => b === "" || b === "." || b === "..")) return { gecerli: false, kategori: "bilinmeyen" };
  const [kok, ...geri] = bolumler;
  if (!UUID.test(kok) || geri.length === 0) return { gecerli: false, kategori: "bilinmeyen" };
  // <kullanıcı>/<dosya>: belge yüklemesi (document-upload-form.tsx) alt klasörsüz.
  if (geri.length === 1) return { gecerli: true, kategori: "belge", sahipId: kok, sahip: "kullanici" };
  const alt = ALT_KLASOR[geri[0]];
  if (!alt || geri.length !== 2) return { gecerli: false, kategori: "bilinmeyen" };
  return { gecerli: true, kategori: alt.kategori, sahipId: kok, sahip: alt.sahip };
}

/** Bu kategoride veritabanı referansı denetleniyor mu (2A kapsamı)? */
export const REFERANS_DENETLENEN: ReadonlySet<Kategori> = new Set(["kaynak-pdf", "belge", "kilavuz", "uak", "docentlik"]);

export type NesneGozlemi = {
  yol: string;
  boyut: number | null;
  /** Depodaki oluşturma zamanı (ISO). Yoksa yaş bilinmiyor. */
  olusturma: string | null;
};

export type SahipDurumu = "var" | "yok" | "bilinmiyor";

export type Baglam = {
  /** Sahip klasörünün durumu (çalışma/profil tablosuna göre). */
  sahip: (id: string, tur: SahipTuru) => SahipDurumu;
  /** Yol bir veritabanı referansında geçiyor mu; referanslar okunamadıysa null. */
  referansli: (yol: string) => boolean | null;
  simdi: number;
  /** Bu yaştan genç nesne yetim ADAYI olamaz (eşzamanlı yükleme penceresi). */
  yasEsigiMs: number;
};

export type Karar = { sinif: Sinif; sebep: string };

/*
  Tek bir nesnenin İLK GEÇİŞ kararı. ADAY_YETIM burada yalnızca "ikinci
  doğrulamaya aday" demek; rapora girmeden önce tarayıcı nesneyi yeniden
  görür, referansı ve sahibi yeniden okur.
*/
export function nesneyiSiniflandir(n: NesneGozlemi, b: Baglam): Karar {
  const y = yolCoz(n.yol);
  if (!y.gecerli) return { sinif: "DOGRULANAMADI", sebep: "bilinmeyen_kalip" };

  // Referansı olan nesne kategorisi ne olursa olsun sahiplidir.
  const ref = b.referansli(n.yol);
  if (ref === true) return { sinif: "SAHIPLI", sebep: "referansli" };
  // Referanslar okunamadıysa hiçbir nesne için "referansı yok" denemez (sahibi gitmiş olsa bile).
  if (ref === null) return { sinif: "DOGRULANAMADI", sebep: "referans_okunamadi" };

  const sahip = b.sahip(y.sahipId, y.sahip);
  if (sahip === "bilinmiyor") return { sinif: "DOGRULANAMADI", sebep: "sahip_okunamadi" };

  const yas = n.olusturma ? b.simdi - Date.parse(n.olusturma) : NaN;
  const yasBilinmiyor = !Number.isFinite(yas);
  const taze = !yasBilinmiyor && yas < b.yasEsigiMs;

  if (sahip === "yok") {
    if (yasBilinmiyor) return { sinif: "DOGRULANAMADI", sebep: "yas_bilinmiyor" };
    if (taze) return { sinif: "DOGRULANAMADI", sebep: "taze" };
    return { sinif: "ADAY_YETIM", sebep: "sahip_yok" };
  }

  // Sahip var.
  switch (y.kategori) {
    case "editor-images":
      // Görsel kütüphanesi klasördeki her dosyayı sunuyor: metinde geçmese de kullanıcının.
      return { sinif: "SAHIPLI", sebep: "kutuphane" };
    case "imports":
      if (yasBilinmiyor) return { sinif: "DOGRULANAMADI", sebep: "yas_bilinmiyor" };
      if (taze) return { sinif: "DOGRULANAMADI", sebep: "taze" };
      // İçe aktarma dosyayı işledikten sonra siliyor; yaşlı olan geride kalmış demek.
      return { sinif: "ADAY_YETIM", sebep: "gecici_eski" };
    case "kaynak-pdf":
    case "belge":
      if (yasBilinmiyor) return { sinif: "DOGRULANAMADI", sebep: "yas_bilinmiyor" };
      if (taze) return { sinif: "DOGRULANAMADI", sebep: "taze" };
      return { sinif: "ADAY_YETIM", sebep: "referanssiz" };
    default:
      // kilavuz, uak, docentlik (referansı yoksa), etik, exports: 2A'da kurala bağlanmadı.
      return { sinif: "DOGRULANAMADI", sebep: "kapsam_disi" };
  }
}

export type IkinciGozlem = {
  /** Nesne hâlâ depoda mı (yeniden listeleme). */
  depoda: "var" | "yok" | "bilinmiyor";
  /** Yol şimdi bir referansta geçiyor mu (yola özel yeniden sorgu). */
  referansli: boolean | null;
  /** Sahip şimdi var mı. */
  sahip: SahipDurumu;
};

/*
  Yetim adayının İKİNCİ doğrulaması. İlk taramadan bu yana nesne bir kayda
  bağlanmış olabilir (eşzamanlı yükleme, gecikmiş kayıt yazımı) ya da sahip
  geri gelmiş olabilir (yeniden açılan hesap). Her okuma hatası DOGRULANAMADI.
*/
export function yetimiDogrula(ilk: Karar, ikinci: IkinciGozlem): Karar | null {
  if (ilk.sinif !== "ADAY_YETIM") return ilk;
  if (ikinci.depoda === "bilinmiyor" || ikinci.referansli === null || ikinci.sahip === "bilinmiyor") {
    return { sinif: "DOGRULANAMADI", sebep: "ikinci_dogrulama_okunamadi" };
  }
  if (ikinci.depoda === "yok") return null; // arada silinmiş: artık sayılacak bir nesne yok
  if (ikinci.referansli) return { sinif: "SAHIPLI", sebep: "ikinci_geciste_referansli" };
  if (ilk.sebep === "sahip_yok" && ikinci.sahip === "var") return { sinif: "SAHIPLI", sebep: "ikinci_geciste_sahipli" };
  return ilk;
}

export type ReferansGozlemi = {
  yol: string;
  /** Referansın geldiği tablo/alan (rapor için; yol değil). */
  kaynak: string;
};

/*
  Kayıp adayı: veritabanı gösteriyor, depo göstermiyor. YALNIZCA nesnenin
  klasörü EKSİKSİZ listelendiyse "yok" denir; listeleme yarım kaldıysa ya da
  düştüyse DOGRULANAMADI. HEAD (exists) kullanılmıyor: Storage API ona dosya
  yokken de, jeton geçersizken de aynı 400'ü veriyor (P52b-1, RAPOR.md).
*/
export function referansiSiniflandir(r: ReferansGozlemi, klasorTam: (klasor: string) => boolean, depoda: (yol: string) => boolean): Karar {
  const y = yolCoz(r.yol);
  if (!y.gecerli) return { sinif: "DOGRULANAMADI", sebep: "gecersiz_referans_yolu" };
  const klasor = r.yol.slice(0, r.yol.lastIndexOf("/"));
  if (!klasorTam(klasor)) return { sinif: "DOGRULANAMADI", sebep: "klasor_okunamadi" };
  if (depoda(r.yol)) return { sinif: "SAHIPLI", sebep: "depoda" };
  return { sinif: "ADAY_KAYIP", sebep: "depoda_yok" };
}

export function kayibiDogrula(ilk: Karar, ikinci: { depoda: "var" | "yok" | "bilinmiyor"; referansli: boolean | null }): Karar | null {
  if (ilk.sinif !== "ADAY_KAYIP") return ilk;
  if (ikinci.depoda === "bilinmiyor" || ikinci.referansli === null) return { sinif: "DOGRULANAMADI", sebep: "ikinci_dogrulama_okunamadi" };
  if (ikinci.depoda === "var") return { sinif: "SAHIPLI", sebep: "ikinci_geciste_depoda" };
  if (!ikinci.referansli) return null; // referans kalkmış: kayıp değil
  return ilk;
}

/* ---------- Metindeki görsel bağlantıları (editor-images referansı) ---------- */

const DEPO_BAGLANTISI = /\/storage\/v1\/object\/(?:sign|public|authenticated)\/project-files\/([^?#"\s]+)/;

/** Metin JSON'undaki görsel düğümlerinden depo yollarını çıkarır. Yalnızca verilen Supabase kökene ait bağlantılar. */
export function metindekiGorselYollari(icerik: unknown, koken: string): string[] {
  const yollar: string[] = [];
  let beklenenKoken: string;
  try {
    beklenenKoken = new URL(koken).origin;
  } catch {
    return yollar;
  }
  const gez = (d: unknown, derinlik: number) => {
    if (!d || typeof d !== "object" || derinlik > 200) return;
    const dugum = d as { type?: unknown; attrs?: { src?: unknown }; content?: unknown };
    if (dugum.type === "image" && typeof dugum.attrs?.src === "string") {
      try {
        const u = new URL(dugum.attrs.src);
        const m = u.origin === beklenenKoken ? DEPO_BAGLANTISI.exec(u.pathname) : null;
        if (m) yollar.push(decodeURIComponent(m[1]));
      } catch {
        /* geçersiz bağlantı: referans değil */
      }
    }
    if (Array.isArray(dugum.content)) for (const c of dugum.content) gez(c, derinlik + 1);
  };
  gez(icerik, 0);
  return yollar;
}

/* ---------- Rapor (yalnızca sayılar) ---------- */

export type Sayac = { adet: number; bayt: number };
export type Rapor = {
  toplam_dosya: number;
  toplam_bayt: number;
  sinif: Record<Exclude<Sinif, "ADAY_KAYIP">, Sayac>;
  aday_kayip: number;
  kayip_dogrulanamadi: number;
  kategori: Record<string, Record<string, Sayac>>;
  sebep: Record<string, number>;
  okunamayan_klasor: number;
  /**
   * Listelenirken içeriği kayan (sayfa sınırında ekleme/silme görülen) ve yeniden
   * denemelerde de kararlı listelenemeyen klasörler. İçlerinde atlanmış nesne
   * olabilir: eksiksiz sayılmazlar.
   */
  degisen_klasor: number;
  /** Aynı yol birden çok kez göründü ve TEK kez sayıldı (ofsetli sayfalamada ekleme). */
  tekrar_ayiklanan: number;
  ikinci_geciste_kaybolan: number;
  istek: { listeleme: number; yeniden_deneme: number; veritabani: number };
  /**
   * Rapor kesin mi? Yalnızca bütün klasörler eksiksiz ve kararlı listelendiyse,
   * referanslar ve sahipler okunabildiyse ve tarama yarıda kesilmediyse.
   * Kesin olmayan raporda sayılar "en az" anlamına gelir ve kayıp kararları
   * yalnızca okunabilen klasörler için geçerlidir.
   */
  kesin: boolean;
  kesin_degil_cunku: string[];
  /**
   * Her rapor bir ADAY raporudur; hiçbir koşulda silme kararı değildir. Kalıcı
   * silme (P52b-2C tasarımı) her yolu kendi anında, kilit altında, rapordan
   * bağımsız olarak yeniden doğrular. Alan sabit: raporu okuyan bir sonraki
   * araç bunu "kesin = true ise sil" diye yorumlamasın diye yazılıyor.
   */
  nitelik: "yalnizca_aday";
};

export function bosRapor(): Rapor {
  const s = (): Sayac => ({ adet: 0, bayt: 0 });
  return {
    toplam_dosya: 0,
    toplam_bayt: 0,
    sinif: { SAHIPLI: s(), ADAY_YETIM: s(), DOGRULANAMADI: s() },
    aday_kayip: 0,
    kayip_dogrulanamadi: 0,
    kategori: {},
    sebep: {},
    okunamayan_klasor: 0,
    degisen_klasor: 0,
    tekrar_ayiklanan: 0,
    ikinci_geciste_kaybolan: 0,
    istek: { listeleme: 0, yeniden_deneme: 0, veritabani: 0 },
    kesin: false,
    kesin_degil_cunku: ["tamamlanmadi"],
    nitelik: "yalnizca_aday",
  };
}

/**
 * Taramanın sonunda raporun kesin olup olmadığına karar verir. Varsayılan
 * "kesin değil"dir (bosRapor): bu işlev çağrılmadan dönen bir rapor kesin
 * görünmez.
 */
export function kesinligiBelirle(
  r: Rapor,
  d: { yarim: boolean; referansOkunamadi: boolean; sahipOkunamadi: boolean },
): void {
  const n: string[] = [];
  if (d.yarim) n.push("nesne_ust_siniri");
  if (r.okunamayan_klasor > 0) n.push("okunamayan_klasor");
  if (r.degisen_klasor > 0) n.push("tarama_sirasinda_degisen_klasor");
  if (d.referansOkunamadi) n.push("referanslar_okunamadi");
  if (d.sahipOkunamadi) n.push("sahipler_okunamadi");
  r.kesin = n.length === 0;
  r.kesin_degil_cunku = n;
}

export type SayfaGirdisi = { ad: string; klasorMu: boolean };
const anahtar = (g: SayfaGirdisi) => `${g.klasorMu ? "d" : "f"}:${g.ad}`;

/**
 * Ofsetli listelemeyi örtüşen sayfalarla okur: k. sayfa (k ≥ 1) bir önceki
 * sayfanın SON öğesiyle başlamalıdır (offset = k·(sayfa−1)). Başlamıyorsa
 * sınırın önünde net bir ekleme ya da silme olmuştur ve ofsetli sayfalama o
 * klasörde bir öğeyi ya İKİ KEZ verir ya da HİÇ vermez (gerçek PostgreSQL'de
 * gösterildi: denetim/p52b2/yaris, C1).
 *
 * Neden yeter: adlar tekil ve sıra deterministik. Sınır öğesinin kimliği
 * yalnızca sınırın önünde net kayma olursa değişir; net kayma yoksa sonraki
 * sayfa doğru devamdır (önde biri eklenip biri silindiyse eklenen tarama
 * başladıktan sonra gelmiştir, silinen zaten okunmuştur). Yani "kararlı"
 * çıkan bir listelemede, listeleme boyunca var olan her öğe tam bir kez
 * görülür. Sınırın ARKASINDAKİ değişiklik henüz okunmamış bölgededir.
 *
 * Eskiden sayfalar uç uca (offset = k·sayfa) okunuyor ve birleştiriliyordu:
 * tekrar eden yol iki kez sayılıyor, atlanan yol hiç bilinmiyordu ve klasör
 * yine de "eksiksiz listelendi" sayılıyordu.
 */
export function sayfalariBirlestir<G extends SayfaGirdisi>(
  sayfalar: G[][],
  sayfaBoyu: number,
): { girdiler: G[]; kararli: boolean; tekrar: number; bitti: boolean } {
  const gorulen = new Map<string, G>();
  let tekrar = 0;
  let kararli = true;
  for (let k = 0; k < sayfalar.length; k++) {
    const s = sayfalar[k];
    let ortusuyor = false;
    if (k > 0) {
      const onceki = sayfalar[k - 1];
      const sinir = onceki[onceki.length - 1];
      // Dolu bir sayfadan sonra en az örtüşen öğe gelmeliydi; boş ya da farklı başlangıç = kayma.
      ortusuyor = !!s.length && !!sinir && anahtar(s[0]) === anahtar(sinir);
      if (!ortusuyor) kararli = false;
    }
    for (let i = 0; i < s.length; i++) {
      if (i === 0 && ortusuyor) continue; // örtüşen öğe: beklenen tekrar, sayılmaz
      const a = anahtar(s[i]);
      if (gorulen.has(a)) tekrar += 1;
      else gorulen.set(a, s[i]);
    }
  }
  const son = sayfalar[sayfalar.length - 1];
  return { girdiler: [...gorulen.values()], kararli, tekrar, bitti: !son || son.length < sayfaBoyu };
}

/** Örtüşmeli sayfalamada k. sayfanın ofseti. */
export function ortusmeliOfset(k: number, sayfaBoyu: number): number {
  return k * (sayfaBoyu - 1);
}

/** Bir nesnenin son kararını rapora işler. Yol rapora GİRMEZ. */
export function nesneyiSay(r: Rapor, n: NesneGozlemi, k: Karar): void {
  if (k.sinif === "ADAY_KAYIP") return;
  const bayt = n.boyut ?? 0;
  r.toplam_dosya += 1;
  r.toplam_bayt += bayt;
  r.sinif[k.sinif].adet += 1;
  r.sinif[k.sinif].bayt += bayt;
  const kat = yolCoz(n.yol).kategori;
  r.kategori[kat] ??= {};
  r.kategori[kat][k.sinif] ??= { adet: 0, bayt: 0 };
  r.kategori[kat][k.sinif].adet += 1;
  r.kategori[kat][k.sinif].bayt += bayt;
  r.sebep[`${k.sinif}:${k.sebep}`] = (r.sebep[`${k.sinif}:${k.sebep}`] ?? 0) + 1;
}

export function referansiSay(r: Rapor, k: Karar): void {
  if (k.sinif === "ADAY_KAYIP") r.aday_kayip += 1;
  else if (k.sinif === "DOGRULANAMADI") r.kayip_dogrulanamadi += 1;
  else return;
  r.sebep[`KAYIP_${k.sinif}:${k.sebep}`] = (r.sebep[`KAYIP_${k.sinif}:${k.sebep}`] ?? 0) + 1;
}

/* ---------- Salt okunur istemci ---------- */

/*
  Envanter istemcisi YALNIZCA okur. Bu bir sözleşme değil, kod: fetch
  sarmalayıcısı GET/HEAD dışındaki her isteği, Storage'ın listeleme ucu
  (POST /storage/v1/object/list/…) hariç, AĞA ÇIKMADAN reddeder. Yanlışlıkla
  eklenmiş bir remove/update/delete çağrısı tarama sırasında patlar.
*/
export function saltOkunurMu(url: string, yontem: string): boolean {
  const y = yontem.toUpperCase();
  if (y === "GET" || y === "HEAD") return true;
  if (y !== "POST") return false;
  try {
    return /^\/storage\/v1\/object\/list\/[^/]+\/?$/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Yalnızca yerel yığın: Production/Test'e bu araçla bağlanılmaz (P52b-2A kuralı). */
export function yerelAdresMi(adres: string): boolean {
  try {
    const h = new URL(adres).hostname;
    return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]";
  } catch {
    return false;
  }
}
