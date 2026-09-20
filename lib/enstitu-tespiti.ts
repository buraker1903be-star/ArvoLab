/*
  Bir kılavuzun hangi ENSTİTÜYE ait olduğunun belirlenmesi.

  Neden gerekli: Türkiye'de tez yazım kılavuzu neredeyse her zaman enstitü
  düzeyinde yayımlanır. Aynı üniversitenin Sosyal Bilimler ve Fen Bilimleri
  enstitüleri farklı kurallar koyar — atıf sistemi bile farklı olabilir.
  Otomatik keşif ise `institute_name` ve `academic_unit_id` alanlarını hep
  null bırakıyordu; sonuç, üniversite başına TEK ve çoğu zaman yanlış
  düzeyde bir kılavuzdu. Öğrenci Fen Bilimleri'nde okurken Sosyal
  Bilimler'in kurallarını görebiliyordu.

  Tespit önce BELGENİN METNİNE bakar: kapak sayfası neredeyse istisnasız
  "T.C. … ÜNİVERSİTESİ … ENSTİTÜSÜ" biçimindedir. Adres yalnızca yedektir;
  alt alan adı kısaltmaları (sbe, fbe) üniversiteden üniversiteye farklı
  şeylere karşılık gelebiliyor.

  Atıf sistemi seçimindeki ilkeyle aynı: net bir kazanan yoksa null döner.
  Yanlış enstitüye bağlanmış bir kılavuz, bağlanmamış olmasından kötüdür —
  öğrenci yanlış kurallara uyar ve bunu jüri önünde öğrenir.

  Saf modül; testi tests/unit/enstitu-tespiti.test.ts.
*/

export type EnstituTespiti = {
  /** Normalleştirilmiş ad: "Sosyal Bilimler Enstitüsü". */
  ad: string;
  /** metin = kapak sayfasından, adres = alt alan adından. */
  kaynak: "metin" | "adres";
  /** Metinden gelen tespitte adın kaç kez geçtiği. */
  gecis: number;
};

/*
  Bilinen enstitüler ve yazım varyantları. Eşleşme normalleştirilmiş
  (aksansız, büyük harf) metin üzerinde yapılır; kanonik ad panelde ve
  veritabanında bu listeden yazılır ki aynı enstitü iki farklı yazımla iki
  ayrı kayıt olmasın.
*/
const BILINEN_ENSTITULER: { kanonik: string; desenler: string[] }[] = [
  { kanonik: "Sosyal Bilimler Enstitüsü", desenler: ["SOSYAL BILIMLER"] },
  { kanonik: "Fen Bilimleri Enstitüsü", desenler: ["FEN BILIMLERI"] },
  { kanonik: "Sağlık Bilimleri Enstitüsü", desenler: ["SAGLIK BILIMLERI"] },
  { kanonik: "Eğitim Bilimleri Enstitüsü", desenler: ["EGITIM BILIMLERI"] },
  { kanonik: "Güzel Sanatlar Enstitüsü", desenler: ["GUZEL SANATLAR"] },
  // Çok sayıda üniversite enstitülerini bu tek çatı altında birleştirdi.
  { kanonik: "Lisansüstü Eğitim Enstitüsü", desenler: ["LISANSUSTU EGITIM", "LISANSUSTU EGITIM VE ARASTIRMA"] },
  { kanonik: "Lisansüstü Eğitim-Öğretim Enstitüsü", desenler: ["LISANSUSTU EGITIM OGRETIM"] },
  { kanonik: "Bilişim Enstitüsü", desenler: ["BILISIM"] },
  { kanonik: "Nükleer Bilimler Enstitüsü", desenler: ["NUKLEER BILIMLER"] },
  { kanonik: "Deniz Bilimleri Enstitüsü", desenler: ["DENIZ BILIMLERI"] },
  { kanonik: "Enerji Enstitüsü", desenler: ["ENERJI"] },
  { kanonik: "Adli Bilimler Enstitüsü", desenler: ["ADLI BILIMLER"] },
  { kanonik: "Biyoteknoloji Enstitüsü", desenler: ["BIYOTEKNOLOJI"] },
  { kanonik: "Avrupa Birliği Enstitüsü", desenler: ["AVRUPA BIRLIGI"] },
  { kanonik: "Atatürk İlkeleri ve İnkılap Tarihi Enstitüsü", desenler: ["ATATURK ILKELERI VE INKILAP TARIHI"] },
];

/*
  Alt alan adı kısaltmaları yalnızca YEDEK: "sbe" bir üniversitede Sosyal
  Bilimler, başka birinde Sağlık Bilimleri Enstitüsü olabiliyor. Metinden
  tespit varsa buraya hiç bakılmaz.
*/
const ADRES_IPUCLARI: { parca: RegExp; kanonik: string }[] = [
  { parca: /(^|[^a-z])(sosyalbilimler|sosbil|sbe)([^a-z]|$)/i, kanonik: "Sosyal Bilimler Enstitüsü" },
  { parca: /(^|[^a-z])(fenbilimleri|fenbil|fbe)([^a-z]|$)/i, kanonik: "Fen Bilimleri Enstitüsü" },
  { parca: /(^|[^a-z])(saglikbilimleri|sagbil|sagbilens|sabe)([^a-z]|$)/i, kanonik: "Sağlık Bilimleri Enstitüsü" },
  { parca: /(^|[^a-z])(egitimbilimleri|egitimbil|ebe)([^a-z]|$)/i, kanonik: "Eğitim Bilimleri Enstitüsü" },
  { parca: /(^|[^a-z])(guzelsanatlar|gse)([^a-z]|$)/i, kanonik: "Güzel Sanatlar Enstitüsü" },
  { parca: /(^|[^a-z])(lisansustu|lee)([^a-z]|$)/i, kanonik: "Lisansüstü Eğitim Enstitüsü" },
];

/** Türkçe harfleri aksansızlaştırıp büyük harfe çevirir. */
function normalize(deger: string) {
  return deger
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Belge metninden enstitüyü çıkarır.
 *
 * Kapak sayfasında "… ÜNİVERSİTESİ SOSYAL BİLİMLER ENSTİTÜSÜ" biçimi
 * yakalanır; "ÜNİVERSİTESİ"nden önceki kısım atılır ki üniversite adı
 * enstitü adına karışmasın.
 */
function metindenTespit(metin: string): EnstituTespiti | null {
  const duz = normalize(metin);
  const sayimlar = new Map<string, number>();

  for (const enstitu of BILINEN_ENSTITULER) {
    for (const desen of enstitu.desenler) {
      // Ad, "ENSTITUSU" sözcüğüyle birlikte geçmeli; tek başına "SOSYAL
      // BILIMLER" bir bölüm ya da alan adı olabilir.
      const re = new RegExp(`${desen} ENSTITUSU`, "g");
      const adet = duz.match(re)?.length ?? 0;
      if (adet) sayimlar.set(enstitu.kanonik, (sayimlar.get(enstitu.kanonik) ?? 0) + adet);
    }
  }

  const sirali = [...sayimlar.entries()].sort((a, b) => b[1] - a[1]);
  if (!sirali.length) return null;

  /*
    Birden fazla enstitü adı geçiyorsa (ortak kılavuzlar, örnek kapaklar)
    kazanan açık ara önde olmalı. Değilse karar verilmez: yanlış enstitüye
    bağlamak, bağlamamaktan kötüdür.
  */
  const [kazananAd, kazananSayi] = sirali[0];
  const ikinciSayi = sirali[1]?.[1] ?? 0;
  if (ikinciSayi > 0 && kazananSayi < ikinciSayi * 2) return null;

  return { ad: kazananAd, kaynak: "metin", gecis: kazananSayi };
}

/** Adresteki alt alan adı / yol parçasından enstitü tahmini. */
function adrestenTespit(url: string): EnstituTespiti | null {
  let hedef: URL;
  try {
    hedef = new URL(url);
  } catch {
    return null;
  }
  // Yalnızca ana bilgisayar adı ve yol; sorgu dizesi gürültü üretir.
  const aday = `${hedef.hostname}${hedef.pathname}`;
  for (const ipucu of ADRES_IPUCLARI) {
    if (ipucu.parca.test(aday)) return { ad: ipucu.kanonik, kaynak: "adres", gecis: 0 };
  }
  return null;
}

/**
 * Kılavuzun enstitüsü; belirlenemezse null.
 *
 * Metin her zaman adresin önündedir: kapak sayfası kurumun kendi
 * beyanıdır, alt alan adı kısaltması ise tahmindir.
 */
export function enstituTespitEt(input: { metin?: string | null; url?: string | null; baslik?: string | null }): EnstituTespiti | null {
  // Başlık da metin sayılır: "Sosyal Bilimler Enstitüsü Tez Yazım Kılavuzu".
  const metin = [input.baslik ?? "", input.metin ?? ""].join("\n");
  return metindenTespit(metin) ?? (input.url ? adrestenTespit(input.url) : null);
}

/**
 * Belge enstitü düzeyinde mi, yoksa fakülte/bölüm düzeyinde mi?
 *
 * Canlıda "Hacettepe Üniversitesi — Tıp Fakültesi" ve "Bilkent
 * Üniversitesi — Arkeoloji Bölümü" kayıtları oluşmuştu. Bunlar tez yazım
 * kılavuzu olabilir ama enstitü kuralı değildir; üniversite geneline
 * uygulanırsa yanlış olur.
 */
export function fakulteVeyaBolumBelgesi(input: { metin?: string | null; baslik?: string | null }): boolean {
  const duz = normalize([input.baslik ?? "", input.metin ?? ""].join("\n"));
  if (/ENSTITUSU/.test(duz)) return false;
  return /FAKULTESI|BOLUMU|YUKSEKOKULU|MESLEK YUKSEKOKULU/.test(duz);
}
