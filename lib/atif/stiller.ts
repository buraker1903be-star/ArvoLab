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
export type StilKimligi = "apa7" | "chicago" | "ieee" | "vancouver" | "mla";

/**
 * Atfın metinde nasıl göründüğü. Denetimin tamamı buna dayanır:
 * yazar-tarih stilinde atıf ile künye ADLA eşleşir, numara stilinde
 * SIRAYLA.
 */
export type AtifTuru = "yazar-tarih" | "yazar-sayfa" | "numara";

export type YazarBicimi = {
  /** Tek bir yazar alanının beklenen biçimi. */
  desen: RegExp;
  /** Kullanıcıya gösterilen örnek; hata mesajı bunu yazar. */
  ornek: string;
  /*
    MLA'da YALNIZCA ilk yazar ters yazılır ("Yılmaz, Ahmet"), sonrakiler
    düz ("Ahmet Demir"). Tek desenle denetlemek, kusursuz künyenin ikinci
    yazarına hata basmak demekti. Verilmezse bütün yazarlar `desen` ile
    denetlenir (APA, Chicago, IEEE, Vancouver böyle).
  */
  sonrakiDesen?: RegExp;
  sonrakiOrnek?: string;
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
  /**
   * Yazar listesi virgülle biter mi, noktayla mı?
   *
   * Numara stillerinin ortak kuralı "yazar bölümü ilk noktaya kadar"dı ve
   * Vancouver'da doğru ("Yılmaz A, Demir B. Başlık."). IEEE'de ad BAŞ
   * HARFLE başlar ("A. Yılmaz"), yani ilk nokta yazarın İÇİNDE: her IEEE
   * künyesinde yazar "A" diye okunuyordu. Bu stilde liste virgülle ilerler
   * ve yazar biçimine uymayan ilk parçada (tırnaklı başlık, kitap adı)
   * biter; nokta hiç ölçüt değildir.
   */
  yazarlarVirgulle?: boolean;
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
/*
  MLA'da ad KISALTILMAZ: "Yılmaz, Ahmet" doğru, "Yılmaz, A." APA'dır.
  Öğrencilerin MLA'da en sık yaptığı hata bu olduğu için desen adın
  yazıldığını arıyor (en az iki harf). Chicago'nun ilk yazarı da aynı
  biçimde yazılır, o yüzden ad MLA'ya özel değil.
*/
const TERS_TAM_AD = /^[\p{Lu}][\p{L}'’\-]+,\s*[\p{Lu}][\p{L}'’\-]{1,}(?:\s+[\p{Lu}][\p{L}'’\-]*\.?)*$/u;
/** İlkten sonrakiler düz yazılır: "Ahmet Demir" (MLA ve Chicago). */
const DUZ_TAM_AD = /^[\p{Lu}][\p{L}'’\-]+(?:\s+[\p{Lu}][\p{L}'’\-]*\.?)+$/u;
/** Baş harfli düz yazım: "A. Demir" — Chicago sonraki yazarlarda kabul eder. */
const DUZ_BAS_HARF = /^(?:[\p{Lu}]\.\s*){1,3}[\p{Lu}][\p{L}'’\-]+$/u;

/** İki biçimi de kabul eden tek desen; hangi alternatifin tuttuğu önemsiz. */
const yada = (...desenler: RegExp[]) =>
  new RegExp(`^(?:${desenler.map((desen) => desen.source.replace(/^\^/, "").replace(/\$$/, "")).join("|")})$`, "u");

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
    /*
      Chicago'nun deseni APA'nınkiydi: yalnızca baş harf ("Yılmaz, A.")
      geçiyordu. Oysa Chicago kaynakçasında ad AÇIK yazılır ("Yılmaz,
      Ahmet") ve ilkten sonrakiler düz gelir ("Ayşe Demir").

      Sonucu şuydu: Chicago'yu DOĞRU yazan öğrenci hata alıyor ve hata
      mesajı ona "beklenen: Soyad, Ad" diyordu — yani zaten yazdığı şey.
      Yanlış alarmın en kötü türü; kullanıcı bir süre sonra bütün
      uyarıları görmezden gelmeyi öğrenir.

      İkisi de kabul ediliyor: Chicago baş harfe de izin verir ve mevcut
      kayıtlarda öyle yazılmış künyeler var. Denetim yine iş görüyor —
      ters yazılmamış ilk yazarı, küçük harfle başlayanı yakalıyor.
    */
    yazarBicimi: {
      desen: yada(TERS_TAM_AD, APA_YAZAR),
      ornek: "Soyad, Ad",
      sonrakiDesen: yada(DUZ_TAM_AD, DUZ_BAS_HARF),
      sonrakiOrnek: "Ad Soyad",
    },
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
    // Ad baş harfle başlıyor; yazar listesi noktayla değil virgülle ilerler.
    yazarlarVirgulle: true,
    kaynakcaSirasi: "atif-sirasi",
    listeIsaretiSerbest: false,
  },
  mla: {
    id: "mla",
    ad: "MLA 9",
    /*
      MLA'nın metin içi atfında YIL YOKTUR: "(Yılmaz 45)" — yazar ve
      SAYFA. Bu yüzden ne yazar-tarih ne numara; üçüncü bir tür.
      Yazar-tarih sanılsaydı çapraz kontrol yılı arar ve hiçbir atıf
      künyesiyle eşleşmezdi: öğrenci bütün kaynakları için "metinde atıf
      yok" uyarısı alırdı.
    */
    tur: "yazar-sayfa",
    yilYeri: "sonda",
    yazarBicimi: {
      desen: TERS_TAM_AD,
      ornek: "Soyad, Ad",
      sonrakiDesen: DUZ_TAM_AD,
      sonrakiOrnek: "Ad Soyad",
    },
    kaynakcaSirasi: "alfabetik",
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

/**
 * Metin içi atıf çıkarıcısının (lib/apa7.ts) anladığı stil adı.
 *
 * Bu eşleme üç ayrı dosyada tek tek yazılmıştı (belge kontrolü, atıf
 * kontrolü, yapı denetimi) ve dördüncü çağıran eklenirken unutuldu:
 * belge yükleme ile çalışma tutarlılığı stili hiç geçirmiyor, her
 * kaynakçayı APA sanıyordu. Tek kaynak, unutulacak bir yer bırakmıyor.
 */
export const atifCikarmaStili = (stil: StilTanimi): "apa7" | "chicago" | "mla" =>
  stil.id === "mla" ? "mla" : stil.id === "chicago" ? "chicago" : "apa7";

/** Metin içi atıf künyeyle ADLA eşleşiyor mu (numara stillerinde eşleşmez). */
export const adlaEslesir = (stil: StilTanimi) => stil.tur !== "numara";

/** Eşleşmede yıl da aranıyor mu (MLA'nın atfında yıl yoktur). */
export const yilaBakilir = (stil: StilTanimi) => stil.tur === "yazar-tarih";

/*
  Seçim listeleri ve etiketler TEK kaynaktan.

  Aynı liste dört yerde elle yazılmıştı (çalışma formu, çalışma düzenleme,
  kılavuz ekranı, asistan bağlamı) ve yeni stil eklenince hepsi ayrı ayrı
  unutuluyordu: MLA eklenirken kılavuz ekranında hâlâ dört seçenek
  görünecekti. Sunucudaki doğrulama listesi de (app/actions/projects.ts)
  buradan okunuyor.
*/
export const STIL_SECENEKLERI: { deger: StilKimligi; etiket: string }[] = (
  Object.keys(STILLER) as StilKimligi[]
).map((id) => ({ deger: id, etiket: STILLER[id].ad }));

export const STIL_ETIKETLERI: Record<string, string> = Object.fromEntries(
  STIL_SECENEKLERI.map((secenek) => [secenek.deger, secenek.etiket]),
);
