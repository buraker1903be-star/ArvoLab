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
import { ceviriciKur, type Cevirici } from "@/lib/dil";

export type OsIkon =
  | "home" | "tez" | "literatur" | "kaynakca" | "analiz" | "belge"
  | "kilavuz" | "destek" | "settings" | "apps" | "abonelik";

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

/*
  PREMIUM ÇALIŞMA ALANI (17.11.2026, kurum sahibinin onaylı tasarımı): ana
  gezinmede yalnızca üç öğe kalır (Ana Sayfa, Çalışmalarım, Kaynaklar).
  "arac": ileri araçlar (Analiz Merkezi, Belge Kontrol) kenar çubuğunda
  açık adlı "Araçlar" grubunda; "yardim": Kullanım Kılavuzu ve Destek
  kenar çubuğunun altındaki "Yardım" grubunda. Eskiden altısı da ana
  listedeydi; öğrenci ilk açılışta hangisinin günlük iş olduğunu
  ayıramıyordu. Hiçbiri kaldırılmadı: yalnızca yeri değişti.
*/
export type OsYer = "hesap" | "yonetim" | "arac" | "yardim";

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
    { key: "analiz", label: t({ tr: "Analiz Merkezi", en: "Analysis Center" }), kisa: t({ tr: "Analiz", en: "Analysis" }), href: "/dashboard/analysis", ikon: "analiz", yollar: ["/dashboard/analysis"], yer: "arac" },
    { key: "belge", label: t({ tr: "Belge Kontrol", en: "Document Check" }), kisa: t({ tr: "Belge", en: "Documents" }), href: "/dashboard/documents", ikon: "belge", yollar: ["/dashboard/documents"], yer: "arac" },
    /*
      Kılavuz Kataloğu KALDIRILDI (26.10.2026, kurum sahibinin kararı):
      kılavuz her çalışmaya öğrencinin kendisi tarafından yükleniyor.
      Eski adres ana sayfaya yönleniyor (app/dashboard/guidelines/page.tsx).
    */
    /*
      Doçentlik Puanı KALDIRILDI (20.11.2026, kurum sahibinin ürün kararı:
      ArvoLab tek tip, editör odaklı bir araştırma ve yazma ürünü). Eskiden
      personelin başlatıcısında ve Ctrl+K'da duruyordu. Eski adresler Ana
      Sayfa'ya yönleniyor (next.config.ts redirects); tablolar ve
      kayıtlar veritabanında duruyor, silinmedi.
    */
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
      yer: "yardim",
      /* Bölüm yok: uzman ve uygulama desteği aynı sayfanın iki kartı
         (Kaynaklar'la aynı karar, 26.10.2026). */
    },
    { key: "ayarlar", label: t({ tr: "Ayarlar", en: "Settings" }), href: "/dashboard/settings", ikon: "settings", yollar: ["/dashboard/settings"], yer: "hesap" },
    /*
      Kullanım Kılavuzu (30.10.2026): dock'ta yer kaplamıyor (yeni başlayan
      birkaç kez açar); başlatıcıda, Ctrl+K'da ve kullanıcı menüsünde.
    */
    { key: "yardim", label: t({ tr: "Kullanım Kılavuzu", en: "User Guide" }), kisa: t({ tr: "Kılavuz", en: "Guide" }), href: "/dashboard/yardim", ikon: "kilavuz", yollar: ["/dashboard/yardim"], yalnizBaslatici: true, yer: "yardim" },
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
    /*
      Yönetim (kurumun çalışmaları, onay, kuyruklar) PR #113'te bir süre
      buradaydı; 20.11.2026'daki güncel ürün kararıyla kalktı: ArvoLab'da
      kurum ekranı yok, görevlendirme ve operasyon ArvoOS'ta.
    */
    { key: "asistan", label: t({ tr: "Asistan Kayıtları", en: "Assistant Logs" }), href: "/dashboard/asistan", ikon: "apps", yollar: ["/dashboard/asistan"], yalnizBaslatici: true, roller: KAYIT_ROLLERI, yer: "yonetim" },
    /* Ekip Yönetimi 20.11.2026'da kalktı: üyelik, davet ve rol ArvoOS'ta. */
    /* Ürün Ölçümü 26.10.2026'da kaldırıldı (app/dashboard/olcum/page.tsx). */
  ];
}

/*
  Rolü olmayan (ya da yetkisi yetmeyen) kullanıcıdan gizlenen uygulamalar
  düşer. 28.10–20.11.2026 arasında bir de dil süzgeci vardı: yalnızca
  Türkçe arayüzde anlamlı olan Doçentlik Puanı İngilizcede gizleniyordu.
  Modül kaldırılınca süzgecin konusu kalmadı.
*/
export function gorunenUygulamalar(uygulamalar: OsUygulama[], rol: string | undefined): OsUygulama[] {
  return uygulamalar.filter((u) => !u.roller || (!!rol && u.roller.includes(rol)));
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
 * Doçentlik Puanı (kaldırıldı), Kullanım Kılavuzu, Abonelik ve Kredi, Asistan Kayıtları
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
  HESAP MENÜSÜ SEÇİCİLERİ (Phase 5.1d-2, 14.11.2026). Hesap menüsü
  (kullanici-menusu.tsx) 5.1d-3'ten beri bağlantılarını bunlardan okuyor;
  eskiden elle yazılıydı. İkisi de rolle SÜZÜLMÜŞ listeyi alır ve kendi rol
  kararını vermez: görünürlük tek yerde (gorunenUygulamalar), yoksa menü
  ile palet ayrı ayrı karar verip birbirinden sapardı. Sıra uygulama
  listesindeki sıradır.
*/

/** Kullanıcının kendi hesabıyla ilgili sayfalar: Ayarlar, Abonelik ve Kredi. (Kullanım Kılavuzu 17.11.2026'dan beri Yardım grubunda.) */
export const hesapUygulamalari = (gorunen: OsUygulama[]) => gorunen.filter((u) => u.yer === "hesap");

/** "Personel Araçları": yalnızca rolü yetenlere görünen araçlar (öğrencide boş). */
export const personelAraclari = (gorunen: OsUygulama[]) => gorunen.filter((u) => u.yer === "yonetim");
/** Kenar çubuğundaki "Araçlar" grubu: Analiz Merkezi, Belge Kontrol. */
export const aracUygulamalari = (gorunen: OsUygulama[]) => gorunen.filter((u) => u.yer === "arac");
/** Kenar çubuğunun altındaki "Yardım" grubu: Destek, Kullanım Kılavuzu. */
export const yardimUygulamalari = (gorunen: OsUygulama[]) => gorunen.filter((u) => u.yer === "yardim");

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
/* 17.11.2026: üç ana öğe (onaylı tasarım). Analiz Merkezi "Daha fazla"ya geçti; eskiden dördüncü sıradaydı. */
export const ALT_CUBUK = ["home", "tez", "kaynaklar"] as const;

/*
  ANA GEZİNME (Phase 5.1d-3, 14.11.2026, kurum sahibinin kararı). Kenar
  çubuğunda ve tablet rayında yalnızca akademik uygulamalar durur; hesap
  sayfaları (`yer: "hesap"`) ve personel araçları (`yer: "yonetim"`) hesap
  menüsünde. Eskiden kenar çubuğunun altında bir "Diğer" grubu (Doçentlik,
  Kılavuz, Abonelik, Asistan Kayıtları, Ekip) ve ayrı bir Ayarlar bağlantısı
  vardı; aynı sayfalar hesap menüsünde ve Ctrl+K'da da duruyordu.
*/
export const anaUygulamalar = (uygulamalar: OsUygulama[]) => uygulamalar.filter((u) => !u.yer && !u.yalnizBaslatici);

/**
 * "Daha fazla" (telefon, tablet ve dar masaüstü): alt çubukta olmayan
 * uygulamalar. Ayarlar, Kılavuz ve Abonelik burada da KALIR (telefonda
 * kenar çubuğu yok, hesap menüsü tek yol olmasın). Personel araçları
 * yalnızca hesap menüsünde (5.1d-3); eskiden burada da listeleniyordu.
 */
export function dahaFazlasi(uygulamalar: OsUygulama[]): OsUygulama[] {
  const cubukta = new Set<string>(ALT_CUBUK);
  return uygulamalar.filter((u) => !cubukta.has(u.key) && u.yer !== "yonetim");
}

export type CalismaBaglami = { id: string; baslik: string; tur: string };

/*
  ÇALIŞMA GEZİNMESİ (19.11.2026, bağlamlı çalışma alanı; onaylı tasarım,
  tasarim/baglamli-calisma-alani). Bir çalışmanın içine girilince sol
  yuvadaki GENEL gezinme yerini bu listeye bırakır: başta "Çalışmalarıma
  dön", sonra çalışmanın adı ve dört ana giriş (aşağıda, 20.11.2026).

  17.11.2026'da kural tersiydi ("editör açılınca gezinme değişmez",
  333e76e): bölümler sayfanın içindeki bir sekme satırındaydı
  (calisma-sekmeleri.tsx), üstünde genel kenar çubuğu, yanında ayrıca bir
  "Çalışmalarım" düğmesi duruyordu. Editörde üç gezinme katmanı oluyordu
  ve hangisinin bu çalışmaya ait olduğu belli değildi. Kurum sahibi 2. tur
  tasarımı onaylayınca (19.11.2026) sekme satırı kalktı; liste yine TEK
  yerde, burada.

  Öğeler GERÇEK sayfalara gider: "Kaynaklar" çalışmaya süzülü kütüphane,
  "Özet ve teslim" çalışmanın özeti. Yazım ekranının içindeki araçlar
  (bölümler, makale arama, Arvo AI) adreste `sol`/`sag` değişkeniyle
  açılır; böylece geri/ileri ve doğrudan bağlantı onları da taşır.
*/
/*
  DÖRT ANA GİRİŞ (20.11.2026, kurum sahibinin onaylı kararı). Eskiden menü
  "Yaz / Araştır / Kontrol et" başlıkları altında dokuz öğe artı "Diğer
  araçlar"dı (19.11.2026, kabul turu 2); öğrenci aynı işi (kaynak bulmak,
  kaynakçaya bakmak) üç ayrı yerde arıyordu. Şimdi grup başlığı yok, dört
  giriş var:
    Belge            — yazım ekranı; bölüm ağacı Belge'nin içinden açılıp
                       kapanır (adreste ?sol=bolumler).
    Kaynaklar        — Kütüphanem ve Kaynakça sekmeleri; "Makale bul" aynı
                       alandan belirgin bir eylemle açılır (?sol=kaynaklar |
                       kaynakca | arama). Üçü aynı yazım sayfasının sol
                       aracıdır: editörün içeriği, imleci ve kaydırması yerinde
                       kalır.
    Arvo AI          — sağ panel (?sag=ai).
    Kontrol ve teslim — kılavuz, biçim, teslim hazırlığı ve eskiden "Diğer
                       araçlar"da duran kanıt matrisi, etik kurul, makale,
                       analiz ve belge kontrolü (?sol=kontrol). Hiçbir işlev
                       silinmedi; sayfaları ve yetkileri aynı.
  Eski adresler doğru girişe düşer: ?sol=arama ve ?sol=kaynakca Kaynaklar'ı,
  ?sol=kilavuz Kontrol ve teslim'i açar; Özet ve teslim, Kanıt matrisi gibi
  ayrı sayfalarda menüde "Kontrol ve teslim" seçili görünür. Masaüstü,
  tablet ve telefon aynı dört girişi kullanır.
*/
export type CalismaGrubu = "ana";
export type CalismaIkon =
  | "belge" | "bolumler" | "kaynaklar" | "arama" | "ai" | "kanit" | "ozet" | "etik" | "makale" | "analiz" | "kontrol"
  | "kaynakca" | "kilavuz";
export type BaglamBaglantisi = { key: string; label: string; href: string; grup: CalismaGrubu; ikon: CalismaIkon };

/** Yazım ekranının sol araçları; adres değişkeni `sol`. "kilavuz" eski adres: Kontrol ve teslim'e düşer. */
export const SOL_ARACLAR = ["bolumler", "kaynaklar", "arama", "kaynakca", "kontrol", "kilavuz"] as const;
export type SolArac = (typeof SOL_ARACLAR)[number];
/** Yazım ekranının sağ paneli; adres değişkeni `sag`. */
export const SAG_PANELLER = ["ai", "pdf"] as const;
export type SagPanel = (typeof SAG_PANELLER)[number];

/** Eski adres değerleri bugünkü araca indirgenir: kilavuz → kontrol. */
export const solAracOku = (deger: string | null | undefined): SolArac | null => {
  if (!(SOL_ARACLAR as readonly string[]).includes(deger ?? "")) return null;
  return deger === "kilavuz" ? "kontrol" : (deger as SolArac);
};
export const sagPanelOku = (deger: string | null | undefined): SagPanel | null =>
  (SAG_PANELLER as readonly string[]).includes(deger ?? "") ? (deger as SagPanel) : null;

/** Sol aracın ait olduğu ana giriş (menüde seçili görünen). */
export function solAracGirisi(arac: SolArac): "yazim" | "kaynaklar" | "kontrol" {
  if (arac === "bolumler") return "yazim";
  if (arac === "kontrol" || arac === "kilavuz") return "kontrol";
  return "kaynaklar";
}

/** Sol alanın başlığı: araç değil, girişin adı (Bölümler Belge'nin içinde kendi adıyla). */
export function solAracBasligi(arac: SolArac, t: Cevirici = ceviriciKur("tr")): string {
  if (arac === "bolumler") return t({ tr: "Bölümler", en: "Sections" });
  if (solAracGirisi(arac) === "kontrol") return t({ tr: "Kontrol ve teslim", en: "Review and submit" });
  return t({ tr: "Kaynaklar", en: "Sources" });
}

export function calismaBaglantilari(calisma: CalismaBaglami, t: Cevirici = ceviriciKur("tr")): BaglamBaglantisi[] {
  const id = encodeURIComponent(calisma.id);
  const yazim = `/dashboard/editor/${id}/write`;
  return [
    { key: "yazim", label: t({ tr: "Belge", en: "Document" }), href: yazim, grup: "ana", ikon: "belge" },
    { key: "kaynaklar", label: t({ tr: "Kaynaklar", en: "Sources" }), href: `${yazim}?sol=kaynaklar`, grup: "ana", ikon: "kaynaklar" },
    { key: "ai", label: "Arvo AI", href: `${yazim}?sag=ai`, grup: "ana", ikon: "ai" },
    { key: "kontrol", label: t({ tr: "Kontrol ve teslim", en: "Review and submit" }), href: `${yazim}?sol=kontrol`, grup: "ana", ikon: "kontrol" },
  ];
}

/**
 * Kontrol ve teslim'in içindeki sayfalar (eskiden menüde ayrı öğelerdi).
 * Başkasının çalışmasıysa Özet ve teslim, Çalışmalarım'da seçili görünmez
 * (liste yalnızca kişinin kendi çalışmaları).
 */
export function kontrolSayfalari(calisma: CalismaBaglami, t: Cevirici = ceviriciKur("tr")): { key: string; label: string; href: string; ikon: CalismaIkon }[] {
  const id = encodeURIComponent(calisma.id);
  return [
    { key: "merkez", label: t({ tr: "Özet ve teslim", en: "Overview and submission" }), href: `/dashboard/editor?sec=${id}`, ikon: "ozet" },
    { key: "kanit", label: t({ tr: "Kanıt matrisi", en: "Evidence matrix" }), href: `/dashboard/editor/${id}/kanit`, ikon: "kanit" },
    ...(calisma.tur === "article" ? [{ key: "makale", label: t({ tr: "Makale", en: "Article" }), href: `/dashboard/editor/${id}/makale`, ikon: "makale" as const }] : []),
    { key: "etik", label: t({ tr: "Etik kurul", en: "Ethics" }), href: `/dashboard/editor/${id}/etik`, ikon: "etik" },
    { key: "analiz", label: t({ tr: "Analiz", en: "Analysis" }), href: `/dashboard/analysis?calisma=${id}`, ikon: "analiz" },
    { key: "belge", label: t({ tr: "Belge kontrolü", en: "Document check" }), href: `/dashboard/documents?calisma=${id}`, ikon: "kontrol" },
  ];
}

/**
 * Adresteki çalışma: çalışmanın kendi sayfaları (/dashboard/editor/<id>/…)
 * ve ona süzülmüş araçlar (?calisma=<id>). Çalışmalarım listesi
 * (/dashboard/editor, ?sec= ile seçili olsa da) GENEL düzeydir: orası
 * çalışmalar arasında seçim yapılan yer.
 *
 * Kimlik ADRESTEN okunur, sayfanın yayınladığı bağlamdan değil: bağlam
 * istemcide, sayfa çizildikten sonra geliyor; ona bakan gezinme ilk
 * boyamada genel menüyü gösterip sonra çalışma menüsüne zıplardı.
 */
export function adrestekiCalisma(yol: string, sorgu: URLSearchParams): string | null {
  const m = /^\/dashboard\/editor\/([^/?#]+)(?:\/|$)/.exec(yol);
  if (m && m[1] !== "new") return decodeURIComponent(m[1]);
  if (yol.startsWith("/dashboard/editor")) return null;
  return sorgu.get("calisma") || null;
}

/**
 * Bu adres şu çalışmanın içinde mi? Gezinme ile adres aynı kuralla
 * karar verir (adrestekiCalisma); başka bir çalışmaya ya da genel
 * sayfaya geçince çalışma menüsü kalkar.
 */
export function calismaIcindeMi(calismaId: string, yol: string, sorgu: URLSearchParams): boolean {
  return adrestekiCalisma(yol, sorgu) === calismaId;
}

/**
 * Etkin giriş. Yazım ekranında adresteki `sol`/`sag` değişkeninden okunur:
 * Kaynaklar'ın sekmeleri ve Makale bul "Kaynaklar"ı, bölüm ağacı "Belge"yi,
 * kılavuz "Kontrol ve teslim"i seçili gösterir. Ayrı sayfalar: kütüphane
 * "Kaynaklar", Özet ve teslim ile Kontrol ve teslim'in öteki sayfaları
 * "Kontrol ve teslim".
 */
export function etkinBaglanti(baglantilar: BaglamBaglantisi[], yol: string, sorgu: URLSearchParams = new URLSearchParams()): BaglamBaglantisi | null {
  const bul = (key: string) => baglantilar.find((b) => b.key === key) ?? null;
  if (/^\/dashboard\/editor\/[^/]+\/write\/?$/.test(yol)) {
    const sol = solAracOku(sorgu.get("sol"));
    if (sol) return bul(solAracGirisi(sol));
    return bul(sagPanelOku(sorgu.get("sag")) === "ai" ? "ai" : "yazim");
  }
  if (yol.startsWith("/dashboard/literature") || yol.startsWith("/dashboard/citations")) return bul("kaynaklar");
  if (yol === "/dashboard/editor" || /^\/dashboard\/editor\/[^/]+\/(kanit|makale|etik)(\/|$)/.test(yol) || yol.startsWith("/dashboard/analysis") || yol.startsWith("/dashboard/documents")) {
    return bul("kontrol");
  }
  return null;
}

