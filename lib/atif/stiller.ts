/*
  Atıf stillerinin TANIMI — kural değil, veri.

  Eskiden stil bilgisi koda gömülüydü: `lib/apa7.ts` APA'nın "(Yıl)"
  kalıbına göre ayrıştırıyor, `structure-check.ts` içinde
  `style === "chicago" ? parseChicagoReference : parseReferenceEntry`
  yazıyordu. Sonuçları şunlardı:

    - APA dışındaki stiller gerçekte DENETLENMİYORDU. Chicago'da
      ayrıştırıcı hiç sorun üretmiyordu (issues her zaman boş); IEEE ve
      Vancouver'da yalnızca numara eşleşmesine bakılıyor, künyenin kendisi
      hiç okunmuyordu. Yani öğrenci Vancouver seçtiğinde belge kontrolü
      "sorun yok" diyordu — çünkü hiç bakmamıştı. Sessiz bir "temiz"
      raporu, hiç rapor vermemekten kötüdür.
    - Yeni bir stil eklemek iki dosyayı birden değiştirmek demekti.

  Burada her stil NE OLDUĞUNU söyler; motor (lib/atif/kunye.ts) tek ve
  stilden habersizdir. Yeni stil eklemek bu listeye bir satır yazmaktır.

  Saf modül; testi tests/unit/atif-kunye.test.ts.
*/

/** Veritabanının kabul ettiği değerler (thesis_projects.citation_style). */
export type StilKimligi = "apa7" | "chicago" | "ieee" | "vancouver";

/**
 * Atfın metinde nasıl göründüğü. Denetimin tamamı buna dayanır:
 * yazar-tarih stilinde atıf ile künye ADLA eşleşir, numara stilinde
 * SIRAYLA.
 */
export type AtifTuru = "yazar-tarih" | "numara";

export type YazarBicimi = {
  /** Tek bir yazar alanının beklenen biçimi. */
  desen: RegExp;
  /** Kullanıcıya gösterilen örnek; hata mesajı bunu yazar. */
  ornek: string;
};

export type StilTanimi = {
  id: StilKimligi;
  ad: string;
  tur: AtifTuru;
  /**
   * Künyede yılın yeri. Ayrıştırıcı yılı buradan bulur:
   *   parantez        → "Yılmaz, A. (2020). Başlık."      (APA)
   *   yazardan-sonra  → "Yılmaz, A. 2020. Başlık."        (Chicago)
   *   sonda           → "… Dergi. 2020;12(3):1-20."       (Vancouver, IEEE)
   */
  yilYeri: "parantez" | "yazardan-sonra" | "sonda";
  /** Numara stillerinde metin içi atıf kalıbı ve künye numarası. */
  numara?: {
    metinKalibi: RegExp;
    etiket: (sira: number) => string;
    /** Künyenin başındaki numara: "[1] " ya da "1. " */
    kunyeKalibi: RegExp;
  };
  yazarBicimi: YazarBicimi | null;
  /** Kaynakçanın sırası; alfabetik olmayan stilde alfabe uyarısı verilmez. */
  kaynakcaSirasi: "alfabetik" | "atif-sirasi";
  /** Kaynaklar madde işaretli liste olarak yazılabilir mi. */
  listeIsaretiSerbest: boolean;
};

/*
  Yazar biçimi desenleri neden bu kadar gevşek: kaynakçada kurum adı
  ("Türkiye İstatistik Kurumu"), editörlü kitap ("Yılmaz, A. (Ed.)") ve
  çok baş harfli ad ("Deci, E. L. M.") hepsi geçerli. Dar bir desen,
  kusursuz künyelere hata basar; kullanıcı da bütün uyarıları görmezden
  gelmeyi öğrenir — 20.09.2026'da APA'da tam olarak bu yaşandı.
*/
const APA_YAZAR = /^[\p{Lu}][\p{L}'\-]+,(\s*[\p{Lu}]\.){1,3}$/u;
/** Vancouver/IEEE: "Yılmaz A" ya da "A. Yılmaz" — virgül yok, nokta isteğe bağlı. */
const NUMARA_YAZAR = /^(?:[\p{Lu}][\p{L}'\-]+\s+[\p{Lu}]{1,3}\.?|(?:[\p{Lu}]\.\s*){1,3}[\p{Lu}][\p{L}'\-]+)$/u;

export const STILLER: Record<StilKimligi, StilTanimi> = {
  apa7: {
    id: "apa7",
    ad: "APA 7",
    tur: "yazar-tarih",
    yilYeri: "parantez",
    yazarBicimi: { desen: APA_YAZAR, ornek: "Soyad, A." },
    kaynakcaSirasi: "alfabetik",
    listeIsaretiSerbest: false,
  },
  chicago: {
    id: "chicago",
    ad: "Chicago",
    tur: "yazar-tarih",
    yilYeri: "yazardan-sonra",
    yazarBicimi: { desen: APA_YAZAR, ornek: "Soyad, Ad" },
    kaynakcaSirasi: "alfabetik",
    listeIsaretiSerbest: false,
  },
  ieee: {
    id: "ieee",
    ad: "IEEE",
    tur: "numara",
    yilYeri: "sonda",
    numara: {
      metinKalibi: /\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g,
      etiket: (sira) => `[${sira}]`,
      kunyeKalibi: /^\[(\d+)\]\s*/,
    },
    yazarBicimi: { desen: NUMARA_YAZAR, ornek: "A. Yılmaz" },
    kaynakcaSirasi: "atif-sirasi",
    listeIsaretiSerbest: false,
  },
  vancouver: {
    id: "vancouver",
    ad: "Vancouver",
    tur: "numara",
    yilYeri: "sonda",
    numara: {
      metinKalibi: /\((\d+(?:\s*[,–-]\s*\d+)*)\)/g,
      etiket: (sira) => `(${sira})`,
      kunyeKalibi: /^(\d+)[.)]\s*/,
    },
    yazarBicimi: { desen: NUMARA_YAZAR, ornek: "Yılmaz A" },
    kaynakcaSirasi: "atif-sirasi",
    listeIsaretiSerbest: false,
  },
};

/** Bilinmeyen değer APA'ya düşer: kayıtların varsayılanı da odur. */
export function stilTanimi(deger: string | null | undefined): StilTanimi {
  return STILLER[(deger ?? "") as StilKimligi] ?? STILLER.apa7;
}

export const stilAdi = (deger: string | null | undefined) => stilTanimi(deger).ad;
