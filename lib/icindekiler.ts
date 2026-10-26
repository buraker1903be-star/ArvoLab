/*
  EDİTÖRDEKİ İÇİNDEKİLER (26.10.2026, kurum sahibinin isteği: "içindekiler
  bölümü popup pencere şeklinde açılacak ve sayfa sayıları düzenlenmiş
  şeklinde yer alacak").

  Editör sayfalara bölünmüyor; sayfa numarası, başlıktan ÖNCEKİ kelime
  sayısından tahmin ediliyor (lib/page-estimate.ts ile aynı sayfa başına
  kelime). Birinci düzey başlık (bölüm) yeni sayfada başlar — tez
  kılavuzlarının ortak kuralı; yoksa her bölüm bir öncekinin son
  sayfasında başlıyormuş gibi görünür ve numaralar giderek geride kalır.

  TAHMİNDİR, ekranda da öyle yazılır: şekil, tablo ve kapak hesaba
  girmiyor. Kesin numaralar Word çıktısındaki içindekiler tablosunda.

  Saf modül; testi tests/unit/icindekiler.test.ts.
*/
import { numberHeadings } from "@/lib/heading-numbering";

export type IcindekilerBasligi = { pos: number; level: number; text: string; kelimeOncesi: number };
export type IcindekilerSatiri = IcindekilerBasligi & { numara: string | null; sayfa: number };

export function icindekiler(
  basliklar: IcindekilerBasligi[],
  numaralama: boolean,
  sayfaBasiKelime: number,
): IcindekilerSatiri[] {
  const numaralar = numaralama ? numberHeadings(basliklar) : basliklar.map(() => null);
  const kelime = sayfaBasiKelime > 0 ? sayfaBasiKelime : 500;
  let kayma = 0;
  let onceki = 0;
  return basliklar.map((b, i) => {
    const ham = Math.floor(Math.max(0, b.kelimeOncesi) / kelime) + 1;
    let sayfa = ham + kayma;
    if (b.level === 1 && i > 0 && sayfa <= onceki) {
      sayfa = onceki + 1;
      kayma = sayfa - ham;
    }
    onceki = Math.max(onceki, sayfa);
    return { ...b, numara: numaralar[i], sayfa };
  });
}
