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

export type OsIkon =
  | "home" | "tez" | "literatur" | "kaynakca" | "analiz" | "belge"
  | "kilavuz" | "docentlik" | "destek" | "settings" | "apps";

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
};

export const ANA_SAYFA = "/dashboard";

/*
  DOCK DİZİLİMİ. Sıra günlük işin sırası: önce yazdığın şey, sonra
  onu denetleyen araçlar, sonra destek. Ayarlar ve "Tüm uygulamalar"
  sonda — ArvoOS ve ArvoARC'taki dizilimin aynısı.

  Yol öneklerinde UZUNLUK önemli: "/dashboard" her şeyin öneki
  olduğu için Ana Sayfa'nın `yollar` listesi BOŞ; etkinUygulama onu
  yalnızca tam eşleşmede seçiyor. Aksi hâlde bütün sayfalar Ana
  Sayfa'ya düşerdi.
*/
export function labUygulamalari(): OsUygulama[] {
  return [
    { key: "home", label: "Ana Sayfa", href: ANA_SAYFA, ikon: "home", yollar: [] },
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
      label: "Çalışmalarım",
      kisa: "Çalışmalar",
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
      label: "Kaynaklar",
      href: "/dashboard/literature",
      ikon: "literatur",
      yollar: ["/dashboard/literature", "/dashboard/citations"],
      /*
        Bölüm YOK: literatür ve kaynakça aynı sayfanın iki kartı. Eskiden
        iki bölümdü ve dock'tan girince üstte iki sekme çıkıyordu; kurum
        sahibi "iki sekme çıkmasın, tek sayfa" dedi.
      */
    },
    { key: "analiz", label: "Analiz Merkezi", kisa: "Analiz", href: "/dashboard/analysis", ikon: "analiz", yollar: ["/dashboard/analysis"] },
    { key: "belge", label: "Belge Kontrol", kisa: "Belge", href: "/dashboard/documents", ikon: "belge", yollar: ["/dashboard/documents"] },
    /*
      Kılavuz kataloğu ve doçentlik dock'tan çıktı: öğrencinin kılavuzu
      çalışma merkezinde zaten görünüyor, katalog çoğunlukla personelin
      sayfası; doçentlik puanı ayrı bir kullanıcı kitlesinin aracı.
      İkisi de "Tüm uygulamalar"da ve Ctrl+K'da.
    */
    { key: "kilavuz", label: "Kılavuz Kataloğu", href: "/dashboard/guidelines", ikon: "kilavuz", yollar: ["/dashboard/guidelines"], yalnizBaslatici: true },
    { key: "docentlik", label: "Doçentlik Puanı", kisa: "Doçentlik", href: "/dashboard/associate-professorship", ikon: "docentlik", yollar: ["/dashboard/associate-professorship"], yalnizBaslatici: true },
    /*
      İKİ DESTEK YOLU TEK UYGULAMADA. Dock'ta iki ayrı simge
      olsalardı günlük işin simgelerini sıkıştırırlardı; ikisi de
      "yardım isteme" eylemi ve bölüm olarak ayrılıyorlar.
    */
    {
      key: "destek",
      label: "Destek",
      href: "/dashboard/expert-requests",
      ikon: "destek",
      yollar: ["/dashboard/expert-requests", "/dashboard/support"],
      /* Bölüm yok: uzman ve uygulama desteği aynı sayfanın iki kartı
         (Kaynaklar'la aynı karar, 26.10.2026). */
    },
    { key: "ayarlar", label: "Ayarlar", href: "/dashboard/settings", ikon: "settings", yollar: ["/dashboard/settings"] },
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
    { key: "asistan", label: "Asistan Kayıtları", href: "/dashboard/asistan", ikon: "apps", yollar: ["/dashboard/asistan"], yalnizBaslatici: true, roller: KAYIT_ROLLERI },
    { key: "ekip", label: "Ekip Yönetimi", href: "/dashboard/team", ikon: "apps", yollar: ["/dashboard/team"], yalnizBaslatici: true, roller: ["system_admin", "founder"] },
    { key: "olcum", label: "Ürün Ölçümü", href: "/dashboard/olcum", ikon: "apps", yollar: ["/dashboard/olcum"], yalnizBaslatici: true, roller: ["system_admin", "founder"] },
  ];
}

/** Rolü olmayan (ya da yetkisi yetmeyen) kullanıcıdan gizlenen uygulamalar düşer. */
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

/** Ctrl+K'da aranabilen sayfalar: uygulamaların bölümleri + yalnızca başlatıcıdakiler. */
export function osSayfalari(uygulamalar: OsUygulama[]): OsSayfa[] {
  const sayfalar: OsSayfa[] = uygulamalar.flatMap((u) =>
    (u.bolumler ?? []).map((b) => ({ label: b.label, href: b.href, uygulama: u.key }))
  );
  /*
    Dock'ta yer kaplamayan uygulamalar (asistan kayıtları, ekip, ölçüm)
    burada bulunabilmeli: başlatıcıyı açıp aramak yerine adını yazmak
    bu sayfaların tek hızlı yolu.
  */
  for (const u of uygulamalar) if (u.yalnizBaslatici) sayfalar.push({ label: u.label, href: u.href, uygulama: u.key });
  return sayfalar;
}
