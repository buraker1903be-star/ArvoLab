/*
  KILAVUZ METNİNDEN SAYI BİÇİMİ ÖNERİSİ (25.10.2026).

  Akademik yönetici ondalık ayırıcıyı ve baştaki sıfır kuralını elle
  giriyor; bu modül kılavuzun kendi metninden ÖNERİ üretir. Hiçbir
  şeyi kendiliğinden uygulamaz — kılavuz tarama aracının bütününde
  olduğu gibi, insan onayı şart (README: "Önemli Sınırlama").

  ÖLÇÜT SAYIMA VE BASKINLIĞA DAYANIR, atıf sistemi seçimindeki kalıbın
  aynısı (lib/atif-sistemi): bir biçim hem yeterince çok geçmeli hem
  ikinciyi açık ara geçmeli. Aksi hâlde null döner ve yönetici elle
  seçer. "Bilmiyorum" demek, yanlış bilmekten iyidir: yanlış bir
  kural öğrencinin bütün istatistiklerini kılavuza aykırı yazdırır ve
  araç bunu doğruymuş gibi sunar.

  YALNIZCA İSTATİSTİK DEĞERLERİNE BAKILIR. Metindeki her ondalığı
  saymak felaket olurdu: kılavuzlar bölüm numarasıyla dolu ("1.2.3",
  "Tablo 4.1") ve bunların hepsi nokta taşıyor — ölçüt her kılavuzda
  "nokta" derdi. O yüzden sayı, bir istatistik işaretinin HEMEN
  ARDINDAN gelmek zorunda (p, r, t, F, χ², α, Ort., SS).

  Saf modül; testi tests/unit/kilavuz-sayi-onerisi.test.ts.
*/
import type { OndalikAyirici } from "@/lib/sayi-bicimi";
import type { Dil } from "@/lib/dil";

/** En az bu kadar örnek bulunmayan metinden öneri çıkarılmaz. */
const EN_AZ_ORNEK = 3;
/** Kazanan, ikinciyi en az bu katsayıyla geçmeli. */
const BASKINLIK = 2;

/*
  İstatistik işaretinden sonra gelen ondalık değer. Simgeler bitişik
  de yazılabiliyor ("p<0,05"), o yüzden boşluk isteğe bağlı.
  "Ort." ve "SS" Türkçe kılavuzlarda sık; İngilizce karşılıkları da
  (M, SD) geçiyor ama tek harfli oldukları için metinde çok yanlış
  eşleşme üretiyorlar — bilerek dışarıda.
*/
const ISTATISTIK_DEGERI =
  /(?:(?<![\p{L}])(?:p|r|t|F|z|α|χ\s*²?)|Ort\.?|SS)\s*[<>=≤≥]\s*(-?\d*[.,]\d+)/giu;

export type SayiGecisi = { etiket: string; sayim: number };

export type SayiOnerisi = {
  /** Net kazanan yoksa null: yönetici elle seçer. */
  ayirici: OndalikAyirici | null;
  bastakiSifir: boolean | null;
  /** Karar verilemese de sayımlar gösterilir; yöneticinin kararı buna dayanıyor. */
  ayiriciGecisleri: SayiGecisi[];
  sifirGecisleri: SayiGecisi[];
  uyarilar: string[];
};

/** Metinde geçen istatistik değerleri (ham yazımlarıyla). */
export function istatistikDegerleri(metin: string): string[] {
  return [...metin.matchAll(ISTATISTIK_DEGERI)].map((es) => es[1]);
}

function sec<T extends string>(
  sayimlar: Map<T, number>,
): { kazanan: T | null; gecisler: SayiGecisi[]; ikinci: number } {
  const gecisler = [...sayimlar.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([etiket, sayim]) => ({ etiket, sayim }));

  const ilk = gecisler[0];
  const ikinci = gecisler[1]?.sayim ?? 0;
  if (!ilk || ilk.sayim < EN_AZ_ORNEK) return { kazanan: null, gecisler, ikinci };
  if (ikinci > 0 && ilk.sayim < ikinci * BASKINLIK) return { kazanan: null, gecisler, ikinci };
  return { kazanan: ilk.etiket as T, gecisler, ikinci };
}

/*
  dil: uyarıların dili (28.10.2026). Sonuç kılavuz kaydına yazılıyor;
  kayıttaki Türkçe uyarıyı ekranda çevirmek için
  lib/guideline-scan.ts → taramaUyarisiCevir.
*/
export function sayiKuraliOner(metin: string, dil: Dil = "tr"): SayiOnerisi {
  const en = dil === "en";
  const degerler = istatistikDegerleri(metin);

  const ayiriciSayim = new Map<"comma" | "period", number>([
    ["comma", 0],
    ["period", 0],
  ]);
  const sifirSayim = new Map<"yazilir" | "yazilmaz", number>([
    ["yazilir", 0],
    ["yazilmaz", 0],
  ]);

  for (const ham of degerler) {
    const govde = ham.replace("-", "");
    if (govde.includes(",")) ayiriciSayim.set("comma", ayiriciSayim.get("comma")! + 1);
    else if (govde.includes(".")) ayiriciSayim.set("period", ayiriciSayim.get("period")! + 1);

    /*
      BAŞTAKİ SIFIR YALNIZCA BİRDEN KÜÇÜK DEĞERLERDE anlamlı. "t = 2,45"
      bir kural taşımıyor; onu "sıfır yazılır" sayan bir ölçüt her
      kılavuzda "yazılır" derdi.
    */
    const tamKisim = govde.split(/[.,]/)[0];
    if (tamKisim === "0") sifirSayim.set("yazilir", sifirSayim.get("yazilir")! + 1);
    else if (tamKisim === "") sifirSayim.set("yazilmaz", sifirSayim.get("yazilmaz")! + 1);
  }

  const ayiriciSecim = sec(ayiriciSayim);
  const sifirSecim = sec(sifirSayim);

  const uyarilar: string[] = [];
  if (degerler.length === 0) {
    uyarilar.push(
      en
        ? "No statistical examples were found in the text; the number format cannot be derived from the guideline."
        : "Metinde istatistik örneği bulunamadı; sayı biçimi kılavuzdan çıkarılamıyor.",
    );
  }
  if (ayiriciSecim.ikinci > 0) {
    uyarilar.push(
      en
        ? `Both decimal separators appear in the text (${ayiriciSecim.gecisler
            .map((g) => `${g.etiket === "comma" ? "comma" : "period"}: ${g.sayim}`)
            .join(", ")}); this may be an example or a comparison.`
        : `Metinde iki ondalık ayırıcı da geçiyor (${ayiriciSecim.gecisler
            .map((g) => `${g.etiket === "comma" ? "virgül" : "nokta"}: ${g.sayim}`)
            .join(", ")}); örnek ya da karşılaştırma olabilir.`,
    );
  }
  if (sifirSecim.ikinci > 0) {
    uyarilar.push(
      en
        ? "The text uses both leading-zero and no-leading-zero forms; open the guideline and verify."
        : "Metinde hem sıfırlı hem sıfırsız yazım geçiyor; kılavuzu açıp doğrulayın.",
    );
  }

  return {
    ayirici: ayiriciSecim.kazanan,
    bastakiSifir: sifirSecim.kazanan === null ? null : sifirSecim.kazanan === "yazilir",
    ayiriciGecisleri: ayiriciSecim.gecisler,
    sifirGecisleri: sifirSecim.gecisler,
    uyarilar,
  };
}
