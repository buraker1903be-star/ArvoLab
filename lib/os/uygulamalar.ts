/*
  ArvoLab İŞLETİM SİSTEMİ KABUĞU: her iş alanı bir "uygulama"
  (25.10.2026, kurum sahibinin isteği: "docklu sistemi ArvoLab için
  de yap").

  Sözleşme ArvoOS ve ArvoARC'taki os-apps'in kopyası: dock, bölüm
  şeridi, başlatıcı, üst çubuktaki uygulama adı ve Ctrl+K AYNI
  listeden besleniyor. ArvoLab'da bugün menü (navigation.ts), mobil
  sekme çubuğu ve üst çubuk başlığı aynı listeden okuyor; dock da
  oraya eklenmiyor çünkü uygulama/bölüm ayrımı menüde yok: menü düz
  bir bağlantı listesi, dock ise "hangi uygulamadayım, onun
  bölümleri neler" sorusunu da yanıtlıyor.

  Fark: ArvoLab'ın kökü "/dashboard" (ArvoARC'ta "/", ArvoOS'ta
  "/panel").

  Saf modül: Next/React/Supabase'e dokunmaz; testi
  tests/unit/os-uygulamalar.test.ts.
*/

import { KAYIT_ROLLERI } from "@/lib/ai/kayit-gorunum";
import { ceviriciKur, type Cevirici, type Dil } from "@/lib/dil";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/project-labels";

export type OsIkon =
  | "home" | "tez" | "literatur" | "kaynakca" | "analiz" | "belge"
  | "kilavuz" | "docentlik" | "destek" | "settings" | "apps" | "abonelik";

/** altYollar: bölümün kendi yolu dışında onu etkin sayan yollar. */
export type Bolum = { key: string; href: string; label: string; altYollar?: string[] };

export type OsUygulama = {
  key: string;
  label: string;
  /** Telefonda ve dock etiketinde kullanılan kısa ad. */
  kisa?: string;
  href: string;
  ikon: OsIkon;
  /** Bu yollarla başlayan her sayfa bu uygulamanın içinde sayılır. */
  yollar: string[];
  /** Uygulamanın bölümleri: bölüm şeridi ve Ctrl+K. */
  bolumler?: Bolum[];
  /** Yalnızca "Tüm uygulamalar"da; dock'ta yer kaplamaz. */
  yalnizBaslatici?: boolean;
  /** Menüde görünmesi için gereken roller (navigation.ts ile aynı kural). */
  roller?: readonly string[];
  /**
   * Hesap menüsündeki yeri (Phase 5.1d-2, 14.11.2026). Yoksa uygulama ana
   * gezinmenin bir öğesidir. "hesap": kullanıcının kendi hesabıyla ilgili
   * sayfa (ayarlar, abonelik, kılavuz). "yonetim": rolle sınırlı personel
   * araçları — menüdeki adı "Personel Araçları". Görünürlüğü bu alan
   * DEĞİL `roller` belirler: yonetim yalnızca nerede çizileceğini söyler.
   */
  yer?: OsYer;
};

export type OsYer = "hesap" | "yonetim";

export const ANA_SAYFA = "/dashboard";

/*
  Etiketler çağıranın dilinde üretiliyor (lib/dil.ts): liste istemci
  bileşenlerine (dock, Ctrl+K) düz metin olarak gidiyor, onların dili
  bilmesi gerekmiyor. Varsayılan Türkçe, testler ve eski çağıranlar için.
*/

/*
  DOCK DİZİLİMİ. Sıra günlük işin sırası: önce yazdığın şey, sonra
  onu denetleyen araçlar, sonra destek. Ayarlar ve "Tüm uygulamalar"
  sonda — ArvoOS ve ArvoARC'taki dizilimin aynısı.

  Yol öneklerinde UZUNLUK önemli: "/dashboard" her şeyin öneki
  olduğu için Ana Sayfa'nın `yollar` listesi BOŞ; etkinUygulama onu
  yalnızca tam eşleşmede seçiyor. Aksi hâlde bütün sayfalar Ana
  Sayfa'ya düşerdi.
*/
export function labUygulamalari(t: Cevirici = ceviriciKur("tr")): OsUygulama[] {
  return [
    { key: "home", label: t({ tr: "Ana Sayfa", en: "Home" }), href: ANA_SAYFA, ikon: "home", yollar: [] },
    /*
      ÇALIŞMANIN KENDİ SEKMELERİ (merkez, yazım, kanıt, makale) burada
      bölüm olarak DURMUYOR: adresleri çalışmanın kimliğini taşıyor ve
      "Makale" yalnızca makale türünde anlamlı. Sabit bir bölüm listesi
      tezde de boş bir Makale sekmesi gösterirdi; sekmeler çalışma
      sayfalarının içinde, türü bilen sunucu bileşeninde
      (calisma-sekmeleri.tsx).
    */
    {
      key: "tez",
      label: t({ tr: "Çalışmalarım", en: "My works" }),
      kisa: t({ tr: "Çalışmalar", en: "Works" }),
      href: "/dashboard/editor",
      ikon: "tez",
      yollar: ["/dashboard/editor"],
    },
    /*
      KAYNAKLAR TEK UYGULAMA (26.10.2026, kurum sahibinin isteği: "gereksiz
      modülleri birleştirelim"). Literatür ve kaynakça doğrulama aynı
      nesneyle — kaynakla — çalışıyor; dock'ta iki simge olmaları
      öğrenciye iki ayrı iş varmış gibi görünüyordu.
    */
    {
      key: "kaynaklar",
      label: t({ tr: "Kaynaklar", en: "Sources" }),
      href: "/dashboard/literature",
      ikon: "literatur",
      yollar: ["/dashboard/literature", "/dashboard/citations"],
      /*
        Bölüm YOK: literatür ve kaynakça aynı sayfanın iki kartı. Eskiden
        iki bölümdü ve dock'tan girince üstte iki sekme çıkıyordu; kurum
        sahibi "iki sekme çıkmasın, tek sayfa" dedi.
      */
    },
    { key: "analiz", label: t({ tr: "Analiz Merkezi", en: "Analysis Center" }), kisa: t({ tr: "Analiz", en: "Analysis" }), href: "/dashboard/analysis", ikon: "analiz", yollar: ["/dashboard/analysis"] },
    { key: "belge", label: t({ tr: "Belge Kontrol", en: "Document Check" }), kisa: t({ tr: "Belge", en: "Documents" }), href: "/dashboard/documents", ikon: "belge", yollar: ["/dashboard/documents"] },
    /*
      Kılavuz kataloğu ve doçentlik dock'tan çıktı: öğrencinin kılavuzu
      çalışma merkezinde zaten görünüyor, katalog çoğunlukla personelin
      sayfası; doçentlik puanı ayrı bir kullanıcı kitlesinin aracı.
      İkisi de "Tüm uygulamalar"da ve Ctrl+K'da.
    */
    /*
      Kılavuz Kataloğu KALDIRILDI (26.10.2026, kurum sahibinin kararı):
      kılavuz her çalışmaya öğrencinin kendisi tarafından yükleniyor.
      Eski adres ana sayfaya yönleniyor (app/dashboard/guidelines/page.tsx).
    */
    /*
      DOÇENTLİK PUANI YALNIZCA PERSONELDE (26.10.2026, kurum sahibinin
      isteği: "öğrencilerin görmesine gerek yok"). Doçent adayı akademisyen
      ayrı bir kitle; öğrencinin başlatıcısında yer kaplamamalı.
    */
    { key: "docentlik", label: t({ tr: "Doçentlik Puanı", en: "Associate Professorship Score" }), kisa: t({ tr: "Doçentlik", en: "Assoc. Prof." }), href: "/dashboard/associate-professorship", ikon: "docentlik", yollar: ["/dashboard/associate-professorship"], yalnizBaslatici: true, roller: STAFF_ROLES, yer: "yonetim" },
    /*
      İKİ DESTEK YOLU TEK UYGULAMADA. Dock'ta iki ayrı simge
      olsalardı günlük işin simgelerini sıkıştırırlardı; ikisi de
      "yardım isteme" eylemi ve bölüm olarak ayrılıyorlar.
    */
    {
      key: "destek",
      label: t({ tr: "Destek", en: "Support" }),
      href: "/dashboard/expert-requests",
      ikon: "destek",
      yollar: ["/dashboard/expert-requests", "/dashboard/support"],
      /* Bölüm yok: uzman ve uygulama desteği aynı sayfanın iki kartı
         (Kaynaklar'la aynı karar, 26.10.2026). */
    },
    { key: "ayarlar", label: t({ tr: "Ayarlar", en: "Settings" }), href: "/dashboard/settings", ikon: "settings", yollar: ["/dashboard/settings"], yer: "hesap" },
    /*
      Kullanım Kılavuzu (30.10.2026): dock'ta yer kaplamıyor (yeni başlayan
      birkaç kez açar); başlatıcıda, Ctrl+K'da ve kullanıcı menüsünde.
    */
    { key: "yardim", label: t({ tr: "Kullanım Kılavuzu", en: "User Guide" }), kisa: t({ tr: "Kılavuz", en: "Guide" }), href: "/dashboard/yardim", ikon: "kilavuz", yollar: ["/dashboard/yardim"], yalnizBaslatici: true, yer: "hesap" },
    /*
      Abonelik ve kredi (26.10.2026): bireysel abone aboneliğini ve asistan
      kredisini buradan yönetiyor. Dock'ta yer kaplamıyor (ayda bir açılan
      sayfa); başlatıcıda, Ctrl+K'da, Ayarlar'da ve kullanıcı menüsünde.
    */
    { key: "abonelik", label: t({ tr: "Abonelik ve Kredi", en: "Subscription and Credits" }), href: "/dashboard/abonelik", ikon: "abonelik", yollar: ["/dashboard/abonelik"], yalnizBaslatici: true, yer: "hesap" },
    /*
      ROLE BAĞLI UYGULAMALAR dock'ta yer kaplamıyor: iç ekibin günde
      bir kez açtığı sayfalar, öğrencinin her gün gördüğü simgelerin
      arasına girmemeli. Başlatıcıda ve Ctrl+K'da duruyorlar.
    */
    /*
      Roller SAYFANIN kendi kapısından geliyor, elle yazılmıyor:
      liste "controller"ı atlamıştı, yani Kontrolör yetkisi olduğu
      sayfayı başlatıcıda göremiyordu (AGENTS.md'deki kural).
    */
    { key: "asistan", label: t({ tr: "Asistan Kayıtları", en: "Assistant Logs" }), href: "/dashboard/asistan", ikon: "apps", yollar: ["/dashboard/asistan"], yalnizBaslatici: true, roller: KAYIT_ROLLERI, yer: "yonetim" },
    { key: "ekip", label: t({ tr: "Ekip Yönetimi", en: "Team Management" }), href: "/dashboard/team", ikon: "apps", yollar: ["/dashboard/team"], yalnizBaslatici: true, roller: ADMIN_ROLES, yer: "yonetim" },
    /* Ürün Ölçümü 26.10.2026'da kaldırıldı (app/dashboard/olcum/page.tsx). */
  ];
}

/*
  YALNIZCA TÜRKİYE'DE ANLAMLI UYGULAMALAR (28.10.2026). Doçentlik puanı
  ÜAK'ın Türk akademik sistemine ait; İngilizce arayüzdeki kullanıcıya
  göstermek, başka ülkedeki bir akademisyene kendi sisteminde karşılığı
  olmayan bir araç sunmak olurdu.
*/
const YALNIZ_TURKCE = new Set(["docentlik"]);

/** Rolü olmayan (ya da yetkisi yetmeyen) kullanıcıdan ve başka dildeki kullanıcıdan gizlenen uygulamalar düşer. */
export function gorunenUygulamalar(uygulamalar: OsUygulama[], rol: string | undefined, dil: Dil = "tr"): OsUygulama[] {
  return uygulamalar.filter(
    (u) => (!u.roller || (!!rol && u.roller.includes(rol))) && (dil === "tr" || !YALNIZ_TURKCE.has(u.key)),
  );
}

/**
 * Açık uygulama: yolu en UZUN eşleşen.
 *
 * Ana Sayfa yalnızca TAM eşleşmede seçiliyor; "/dashboard" her
 * sayfanın öneki olduğu için önek eşleşmesine bırakılsaydı bütün
 * panel Ana Sayfa'da görünürdü.
 */
export function etkinUygulama(uygulamalar: OsUygulama[], yol: string): OsUygulama | null {
  if (yol === ANA_SAYFA) return uygulamalar.find((u) => u.key === "home") ?? null;
  let enIyi: OsUygulama | null = null;
  let enUzun = 0;
  for (const uygulama of uygulamalar) {
    for (const onek of uygulama.yollar) {
      if ((yol === onek || yol.startsWith(`${onek}/`)) && onek.length > enUzun) {
        enIyi = uygulama;
        enUzun = onek.length;
      }
    }
  }
  return enIyi;
}

/** Açık bölüm: yolu en UZUN eşleşen. */
export function etkinBolum(bolumler: Bolum[], yol: string): Bolum | null {
  let enIyi: Bolum | null = null;
  let enUzun = 0;
  for (const bolum of bolumler) {
    for (const onek of [bolum.href, ...(bolum.altYollar ?? [])]) {
      if ((yol === onek || yol.startsWith(`${onek}/`)) && onek.length > enUzun) {
        enIyi = bolum;
        enUzun = onek.length;
      }
    }
  }
  return enIyi;
}

/** Dock'ta görünenler (başlatıcıya ayrılanlar hariç). */
export const docktakiler = (uygulamalar: OsUygulama[]) => uygulamalar.filter((u) => !u.yalnizBaslatici);

/*
  Arama anahtarı: Türkçe harf farkları aramayı bozmasın.

  Sıra ÖNEMLİ. `toLocaleLowerCase("tr")` "I"yı "ı" yapıyor ve "İ"yi
  "i" + birleşen nokta olarak bırakıyor; "ı" elle "i"ye çevriliyor,
  birleşen noktayı da NFD ayrıştırması siliyor. Düz `toLowerCase()`
  ile "İLERİ" yazan kullanıcı "ileri"yi bulamazdı.
*/
export function aramaAnahtari(metin: string): string {
  return metin
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export type OsSayfa = { label: string; href: string; uygulama: string };

/**
 * Uygulamaların gerçek alt bölümleri (bölüm şeridi ve Ctrl+K'nın "Sayfalar"
 * grubu). Uygulamanın kendisi burada YOK: o zaten "Uygulamalar"da.
 *
 * Eskiden (14.11.2026'ya kadar) "yalnızca başlatıcıda" duran uygulamalar da
 * buraya eklenirdi; palet ise bütün uygulamaları ayrıca listelediği için
 * Doçentlik Puanı, Kullanım Kılavuzu, Abonelik ve Kredi, Asistan Kayıtları
 * ve Ekip Yönetimi Ctrl+K'da İKİ kez çıkıyordu. Ekleme, dock'un uygulamaları
 * gösterip başlatıcının göstermediği dönemden kalmaydı; palet bütün
 * uygulamaları listelemeye başlayınca gereksizleşti.
 */
export function osSayfalari(uygulamalar: OsUygulama[]): OsSayfa[] {
  return uygulamalar.flatMap((u) => (u.bolumler ?? []).map((b) => ({ label: b.label, href: b.href, uygulama: u.key })));
}

export type OsKomutHedefi = { key: string; label: string; href: string; ikon: OsIkon; grup: "uygulama" | "sayfa"; uygulama: string };

/**
 * Ctrl+K'nın gezinme hedefleri: önce uygulamalar, sonra bölümleri. Her
 * adres EN FAZLA bir kez — bir bölümün adresi uygulamanınkiyle aynıysa
 * (ilk bölüm çoğunlukla öyle) uygulama kalır. Liste çağırana rolle
 * süzülmüş gelir (gorunenUygulamalar); burada rol kararı verilmez.
 * Hızlı işlemler (yeni çalışma, DOI, analiz başlat) burada değil: aynı
 * adrese gitseler de başka bir işi anlatıyorlar, palet onları ayrıca ekler.
 */
export function komutHedefleri(uygulamalar: OsUygulama[]): OsKomutHedefi[] {
  const gorulen = new Set<string>();
  const hedefler: OsKomutHedefi[] = [];
  const ekle = (h: OsKomutHedefi) => {
    if (gorulen.has(h.href)) return;
    gorulen.add(h.href);
    hedefler.push(h);
  };
  for (const u of uygulamalar) ekle({ key: `app:${u.key}`, label: u.label, href: u.href, ikon: u.ikon, grup: "uygulama", uygulama: u.key });
  const ikonu = new Map(uygulamalar.map((u) => [u.key, u.ikon]));
  for (const s of osSayfalari(uygulamalar)) ekle({ key: `sayfa:${s.href}`, label: s.label, href: s.href, ikon: ikonu.get(s.uygulama) ?? "apps", grup: "sayfa", uygulama: s.uygulama });
  return hedefler;
}

/*
  HESAP MENÜSÜ SEÇİCİLERİ (Phase 5.1d-2, 14.11.2026). Profil menüsündeki
  bağlantılar bugün kullanici-menusu.tsx'te elle yazılı; 5.1d-3'te bu
  seçicilerden okunacak. İkisi de rolle SÜZÜLMÜŞ listeyi alır ve kendi rol
  kararını vermez: görünürlük tek yerde (gorunenUygulamalar), yoksa menü
  ile palet ayrı ayrı karar verip birbirinden sapardı. Sıra uygulama
  listesindeki sıradır.
*/

/** Kullanıcının kendi hesabıyla ilgili sayfalar: Ayarlar, Kullanım Kılavuzu, Abonelik ve Kredi. */
export const hesapUygulamalari = (gorunen: OsUygulama[]) => gorunen.filter((u) => u.yer === "hesap");

/** "Personel Araçları": yalnızca rolü yetenlere görünen araçlar (öğrencide boş). */
export const personelAraclari = (gorunen: OsUygulama[]) => gorunen.filter((u) => u.yer === "yonetim");

/*
  ═══ UYARLANIR GEZİNME (Phase 3, 04.11.2026) ═══

  Dört ayrı gezinme vardı: dock, "Tüm uygulamalar" ızgarası, çalışma
  sekmeleri ve Çalışmalarım'daki araç çipleri. Kullanıcı aynı yere üç
  yoldan gidebiliyor, hangisinin "ana" olduğunu bilemiyordu. Artık tek
  gezinme (os-gezinme.tsx) aynı listeden üç biçimde çiziliyor
  (lib/os/kirilimlar.ts); başlatıcı ızgarası kalktı, bütün uygulamalar
  ya gezinmede ya "Daha fazla"da ya da Ctrl+K'da.
*/

/** Telefondaki alt çubukta kalıcı duran uygulamalar (geri kalanı "Daha fazla"da). */
export const ALT_CUBUK = ["home", "tez", "kaynaklar", "analiz"] as const;

/** Gezinmenin altında, ana listeden ayrı duranlar: ayarlar ve başlatıcıya ayrılmış uygulamalar. */
export function gezinmeGruplari(uygulamalar: OsUygulama[]) {
  const ana = uygulamalar.filter((u) => !u.yalnizBaslatici && u.key !== "ayarlar");
  const diger = uygulamalar.filter((u) => u.yalnizBaslatici);
  const ayarlar = uygulamalar.find((u) => u.key === "ayarlar") ?? null;
  return { ana, diger, ayarlar };
}

/** Telefonda alt çubukta olmayan her şey "Daha fazla" sayfasında (ayarlar dahil). */
export function dahaFazlasi(uygulamalar: OsUygulama[]): OsUygulama[] {
  const cubukta = new Set<string>(ALT_CUBUK);
  return uygulamalar.filter((u) => !cubukta.has(u.key));
}

export type CalismaBaglami = { id: string; baslik: string; tur: string };
export type BaglamBaglantisi = { key: string; label: string; href: string; grup: "calisma" | "arac" };

/*
  ÇALIŞMANIN İÇİNDEYKEN GEZİNME. Çalışmanın kendi bölümleri (Özet,
  Yazım, Kanıt, Etik, makalede Makale) ve o çalışmaya süzülmüş araçlar
  (Kaynaklar, Analiz, Belge Kontrol). Araçların adresleri `calisma`
  değişkeniyle çalışmayı seçili açar; o sayfalar bunu zaten tanıyor.
  Makale bölümü yalnızca makale türünde: tezde boş bir sekme göstermek
  calisma-sekmeleri.tsx'teki kuralla çelişirdi.
*/
export function calismaBaglantilari(calisma: CalismaBaglami, t: Cevirici = ceviriciKur("tr")): BaglamBaglantisi[] {
  const id = encodeURIComponent(calisma.id);
  return [
    { key: "merkez", label: t({ tr: "Özet", en: "Overview" }), href: `/dashboard/editor?sec=${id}`, grup: "calisma" },
    { key: "yazim", label: t({ tr: "Yazım", en: "Writing" }), href: `/dashboard/editor/${id}/write`, grup: "calisma" },
    { key: "kanit", label: t({ tr: "Kanıt matrisi", en: "Evidence matrix" }), href: `/dashboard/editor/${id}/kanit`, grup: "calisma" },
    { key: "etik", label: t({ tr: "Etik kurul", en: "Ethics" }), href: `/dashboard/editor/${id}/etik`, grup: "calisma" },
    ...(calisma.tur === "article"
      ? [{ key: "makale", label: t({ tr: "Makale", en: "Article" }), href: `/dashboard/editor/${id}/makale`, grup: "calisma" as const }]
      : []),
    { key: "kaynaklar", label: t({ tr: "Kaynaklar", en: "Sources" }), href: `/dashboard/literature?calisma=${id}`, grup: "arac" },
    { key: "analiz", label: t({ tr: "Analiz", en: "Analysis" }), href: `/dashboard/analysis?calisma=${id}`, grup: "arac" },
    { key: "belge", label: t({ tr: "Belge Kontrol", en: "Document Check" }), href: `/dashboard/documents?calisma=${id}`, grup: "arac" },
  ];
}

/**
 * Bu adres şu çalışmanın içinde mi? Çalışmanın kendi sayfaları
 * (/dashboard/editor/<id>/…), Özet (?sec=<id>) ve ona süzülmüş araçlar
 * (?calisma=<id>). Başka bir çalışmaya ya da genel sayfaya geçince
 * bağlam gizlenir: kullanıcı yanlış çalışmanın bölümlerini görmesin.
 */
export function calismaIcindeMi(calismaId: string, yol: string, sorgu: URLSearchParams): boolean {
  if (yol.startsWith(`/dashboard/editor/${calismaId}/`) || yol === `/dashboard/editor/${calismaId}`) return true;
  if (yol === "/dashboard/editor" && sorgu.get("sec") === calismaId) return true;
  return sorgu.get("calisma") === calismaId;
}

/** Bağlamdaki etkin bağlantı: yol eşleşmesi; Özet ve araçlar sorgu değişkeniyle. */
export function etkinBaglanti(baglantilar: BaglamBaglantisi[], yol: string): BaglamBaglantisi | null {
  for (const b of baglantilar) {
    const [bYol] = b.href.split("?");
    if (b.grup === "calisma" && b.key !== "merkez" && (yol === bYol || yol.startsWith(`${bYol}/`))) return b;
  }
  for (const b of baglantilar) {
    const [bYol] = b.href.split("?");
    if ((b.key === "merkez" || b.grup === "arac") && yol === bYol) return b;
  }
  return null;
}

