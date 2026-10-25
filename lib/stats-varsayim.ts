/*
  VARSAYIM SINAMALARI (25.10.2026).

  t-testi ve ANOVA parametrik testler: verinin normale yakın
  dağılması ve grup varyanslarının benzer olması gerekiyor. Modül bu
  iki soruyu HİÇ sormuyordu — kullanıcı uygulanamayacak bir testi
  uygulayıp çıkan p değerine güveniyordu. Yanlış bir test, yanlış bir
  cümleden ağır bir hatadır: sonuç makul görünür, hiçbir yerde hata
  yazmaz ve bütün bulgular bölümü onun üstüne kurulur.

  SHAPIRO-WILK BİLEREK YOK. Royston'ın algoritması uzun katsayı
  tablolarına dayanıyor; elle yazılan bir kopyasındaki tek bir
  rakam hatası GÖRÜNMEZ olurdu — çıktı makul bir p değeri verir ve
  kimse fark etmez. Bu modülün bütün değerleri elle doğrulanabilir
  kapalı formüllerden geliyor. Çarpıklık/basıklık zaten Türkçe tez
  kılavuzlarının çoğunun kullandığı ölçüt.

  Saf modül; testi tests/unit/stats-varsayim.test.ts.
*/
import { mean, median, oneWayAnova } from "@/lib/stats-tests-core";
import { fTestP } from "@/lib/stats-math";

/** k. merkezi moment: Σ(x − ortalama)^k / n */
function moment(dizi: number[], k: number): number {
  const ort = mean(dizi);
  return dizi.reduce((t, x) => t + (x - ort) ** k, 0) / dizi.length;
}

export interface NormallikSonucu {
  n: number;
  /** SPSS'in G1'i (örneklem çarpıklığı). */
  carpiklik: number;
  carpiklikSH: number;
  /** Çarpıklık / standart hatası. */
  carpiklikZ: number;
  /** SPSS'in G2'si (fazlalık basıklık; normalde 0). */
  basiklik: number;
  basiklikSH: number;
  basiklikZ: number;
  /** |z| ikisinde de eşiğin altındaysa dağılım normale yakın sayılır. */
  normaleYakin: boolean;
}

/*
  EŞİK 1.96 DEĞİL. Büyük örneklemde standart hata küçüldüğü için z
  değeri önemsiz bir sapmada bile 1.96'yı aşıyor ve ölçüt "hiçbir
  veri normal değil" demeye başlıyor. Tez kılavuzlarında yaygın olan
  ölçüt çarpıklık ve basıklığın KENDİSİNE bakmak: |değer| < 1.5
  (Tabachnick & Fidell). z değerleri yine de döndürülüyor çünkü bazı
  kılavuzlar onu istiyor; karar hangi ölçütle verildiği ekranda
  yazmalı.
*/
export const NORMALLIK_SINIRI = 1.5;

export function normallikOlcutu(dizi: number[]): NormallikSonucu {
  const n = dizi.length;
  const bos = {
    n,
    carpiklik: NaN, carpiklikSH: NaN, carpiklikZ: NaN,
    basiklik: NaN, basiklikSH: NaN, basiklikZ: NaN,
    normaleYakin: false,
  };
  /* Basıklığın SPSS düzeltmesi n > 3 istiyor; dörtten azında değer
     tanımsız. Sıfır yazmak "basıklık yok" demek olurdu. */
  if (n < 4) return bos;

  const m2 = moment(dizi, 2);
  if (m2 === 0) return bos; // değişkenlik yok: sapma ölçülemez

  const g1 = moment(dizi, 3) / m2 ** 1.5;
  const g2 = moment(dizi, 4) / m2 ** 2 - 3;

  /* SPSS'in düzeltilmiş kestirimleri: ürün SPSS çıktısını
     yorumladığı için aynı sayıyı üretmeli, yoksa kullanıcı iki
     farklı değer görüp hangisine güveneceğini bilemez. */
  const carpiklik = (g1 * Math.sqrt(n * (n - 1))) / (n - 2);
  const basiklik = ((n + 1) * g2 + 6) * ((n - 1) / ((n - 2) * (n - 3)));

  const carpiklikSH = Math.sqrt((6 * n * (n - 1)) / ((n - 2) * (n + 1) * (n + 3)));
  const basiklikSH = 2 * carpiklikSH * Math.sqrt((n * n - 1) / ((n - 3) * (n + 5)));

  return {
    n,
    carpiklik,
    carpiklikSH,
    carpiklikZ: carpiklik / carpiklikSH,
    basiklik,
    basiklikSH,
    basiklikZ: basiklik / basiklikSH,
    normaleYakin: Math.abs(carpiklik) < NORMALLIK_SINIRI && Math.abs(basiklik) < NORMALLIK_SINIRI,
  };
}

export interface LeveneSonucu {
  f: number;
  df1: number;
  df2: number;
  p: number;
  /** p ≥ .05 ise varyanslar homojen sayılır (sıfır hipotezi korunur). */
  homojen: boolean;
}

/*
  LEVENE — MEDYAN SÜRÜMÜ (Brown-Forsythe).

  Ortalama yerine MEDYAN kullanılıyor: ortalama sürümü çarpık
  dağılımlarda varyans farkı olmadığı hâlde anlamlı çıkıyor ve
  kullanıcı gereksiz yere parametrik olmayan teste yönlendiriliyor.
  SPSS de varsayılan olarak medyan sürümünü raporluyor.

  Hesap, mutlak sapmalar üzerinde tek yönlü ANOVA'dan ibaret; ayrı
  bir F dağılımı gerekmiyor.
*/
export function leveneTesti(gruplar: number[][]): LeveneSonucu {
  const sapmalar = gruplar.map((g) => {
    const med = median(g);
    return g.map((x) => Math.abs(x - med));
  });
  const { f, dfb, dfw } = oneWayAnova(sapmalar);
  const p = fTestP(f, dfb, dfw);
  return { f, df1: dfb, df2: dfw, p, homojen: Number.isFinite(p) ? p >= 0.05 : false };
}

/*
  HANGİ TEST UYGULANABİLİR.

  Karar kullanıcıya bırakılmıyor ama ONUN YERİNE de verilmiyor:
  işlev yalnızca varsayımların durumunu ve bunun ne anlama geldiğini
  söylüyor. Asistanın "denetler, yazmaz" ilkesinin istatistik
  karşılığı.
*/
export type TestOnerisi = {
  parametrikUygun: boolean;
  gerekce: string;
};

export function ikiGrupOnerisi(a: number[], b: number[]): TestOnerisi {
  const na = normallikOlcutu(a);
  const nb = normallikOlcutu(b);
  const levene = leveneTesti([a, b]);

  if (na.n < 4 || nb.n < 4) {
    return {
      parametrikUygun: false,
      gerekce: "Gruplardan birinde dörtten az gözlem var; normallik ölçülemiyor.",
    };
  }
  if (!na.normaleYakin || !nb.normaleYakin) {
    return {
      parametrikUygun: false,
      gerekce:
        "Dağılım normalden uzak (çarpıklık ya da basıklık ±1,5 sınırının dışında). " +
        "Parametrik olmayan karşılığı (Mann-Whitney U) daha uygun olabilir.",
    };
  }
  if (!levene.homojen) {
    return {
      parametrikUygun: false,
      gerekce:
        "Varyanslar homojen değil (Levene p < .05). Eşit varyans varsaymayan " +
        "t-testi (Welch) ya da parametrik olmayan karşılığı kullanılmalı.",
    };
  }
  return { parametrikUygun: true, gerekce: "Normallik ve varyans homojenliği sağlanıyor." };
}
