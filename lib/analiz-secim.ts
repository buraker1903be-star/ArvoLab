import type { AnalizTuru } from "@/lib/analiz-turleri";
import { kodluGrupSutunlari } from "@/lib/veri-okuma";

/*
  DEĞİŞKEN SEÇİMİNİN DOĞRULANMASI (23.11.2026).

  Ekrandaki seçim kutusu ile hesaplamanın kullandığı değer ayrışabiliyordu.
  İki yol vardı ve ikisi ayrı kurallar uyguluyordu:

    1. Analiz değiştirince (data-analyzer.tsx `analiziSec`) yalnızca
       McNemar/lojistik için bir düzeltme yapılıyordu — hem de veri
       yüklenmeden seçilirse boş listeyle çalışıp seçimi "" yapıyordu.
    2. Dosya yüklenince (`handleFile`) seçili analiz NE OLURSA OLSUN
       varA = ilk sayısal sütun, varB = ikinci sayısal sütun atanıyordu.

  Sonuç: önce lojistik seçip sonra dosya yükleyen kullanıcıda state
  "yas" (sayısal), kutuda görünen ise "basari (gecti / kaldi)" oluyordu.
  Kontrollü bir <select>'in value'su hiçbir seçeneğe uymazsa tarayıcı
  İLK seçeneği gösterir ama React state değişmez; ekran doğru görünürken
  hesap "Bağımlı değişken olarak iki kategorili bir sütun seçin" diye
  düşüyordu. Kullanıcı ekrana bakarak bunu düzeltemiyordu.

  Burası o iki yolun ORTAK kuralı. Saf: React, DOM ve veri okuma yok;
  yalnızca sütun havuzları ve mevcut seçim. Hem analiz değişiminde hem
  dosya yükleme/değiştirme sonrasında aynı fonksiyon çağrılıyor.
*/

export type IkiDegerliSutun = { ad: string; degerler: string[] };
export type VeriSatiri = Record<string, string | number | null>;

/*
  İki kategorili sütunlar: McNemar ve ikili lojistik regresyonun
  kullanabileceği tek sütun türü. Eskiden bu hesap data-analyzer.tsx
  içinde bir useMemo'ydu ve dosya yüklenirken HENÜZ GÜNCELLENMEMİŞ
  olduğu için oradan okunamıyordu; saf fonksiyona alındı ki yükleme
  akışı da taze sütunlarla aynı kuralı uygulayabilsin.
*/
export function ikiDegerliSutunlariBul(sutunlar: string[], satirlar: VeriSatiri[]): IkiDegerliSutun[] {
  return sutunlar.flatMap((ad) => {
    const degerler = new Set<string>();
    for (const satir of satirlar) {
      const deger = satir[ad];
      if (deger === null || deger === "" || deger === undefined) continue;
      degerler.add(String(deger));
      if (degerler.size > 2) return [];
    }
    return degerler.size === 2 ? [{ ad, degerler: [...degerler].sort() }] : [];
  });
}

/** Grup değişkeni olabilecekler: kategorikler + sayıyla kodlanmış gruplar. */
export function grupSutunlariniBul(kategorik: string[], sayisal: string[], satirlar: VeriSatiri[]): string[] {
  return [...kategorik, ...kodluGrupSutunlari(sayisal, satirlar)];
}

export type SutunHavuzlari = {
  sayisal: string[];
  grup: string[];
  ikiDegerli: string[];
};

export function havuzlariKur(
  sutunlar: { sayisal: string[]; kategorik: string[] },
  satirlar: VeriSatiri[],
): SutunHavuzlari {
  return {
    sayisal: sutunlar.sayisal,
    grup: grupSutunlariniBul(sutunlar.kategorik, sutunlar.sayisal, satirlar),
    ikiDegerli: ikiDegerliSutunlariBul([...sutunlar.kategorik, ...sutunlar.sayisal], satirlar).map((x) => x.ad),
  };
}

export type SecimAlani = "varA" | "varB" | "groupVar" | "groupVar2" | "varY";
export type DegiskenSecimi = Record<SecimAlani, string>;

type Havuz = keyof SutunHavuzlari;
/* `zorunlu: false` → boş ("Seçin") geçerli bir değer; yalnızca listede
   olmayan bir ad temizlenir (ikiyonluanova 2. faktör, aracılıkta Y). */
type AlanKurali = { havuz: Havuz; zorunlu: boolean; farkli?: SecimAlani };

/*
  Her analizin her alan için izin verdiği sütun havuzu. Liste
  data-analyzer.tsx'teki <select> seçeneklerinin kaynağıyla birebir:
  bir alan orada hangi listeden besleniyorsa burada da o havuz yazılı.
  Testi (tests/unit/analiz-secim.test.ts) her analiz türü için bir
  giriş olmasını zorunlu kılıyor.
*/
const SAYISAL_VARA: AnalizTuru[] = [
  "ttest", "anova", "correlation", "pairedttest", "wilcoxon", "regression", "mannwhitney",
  "kruskalwallis", "spearman", "ikiyonluanova", "tekorneklem", "ancova", "kismikorelasyon",
  "aracilik", "duzenleyicilik",
];
const SAYISAL_VARB: AnalizTuru[] = ["correlation", "spearman", "pairedttest", "wilcoxon", "kismikorelasyon", "duzenleyicilik"];
const GRUP_VARI: AnalizTuru[] = ["ttest", "anova", "chisquare", "mannwhitney", "kruskalwallis", "ikiyonluanova", "ancova", "karmaanova"];

export function alanKurali(tur: AnalizTuru, alan: SecimAlani): AlanKurali | null {
  if (alan === "varA") {
    if (tur === "mcnemar" || tur === "lojistik") return { havuz: "ikiDegerli", zorunlu: true };
    if (tur === "chisquare") return { havuz: "grup", zorunlu: true };
    return SAYISAL_VARA.includes(tur) ? { havuz: "sayisal", zorunlu: true } : null;
  }
  if (alan === "varB") {
    /* McNemar iki AYRI iki kategorili sütun ister: aynı sütunla hesap yapılamaz. */
    if (tur === "mcnemar") return { havuz: "ikiDegerli", zorunlu: true, farkli: "varA" };
    return SAYISAL_VARB.includes(tur) ? { havuz: "sayisal", zorunlu: true } : null;
  }
  if (alan === "groupVar") return GRUP_VARI.includes(tur) ? { havuz: "grup", zorunlu: true } : null;
  if (alan === "groupVar2") return tur === "ikiyonluanova" ? { havuz: "grup", zorunlu: false } : null;
  if (alan === "varY") return tur === "aracilik" || tur === "duzenleyicilik" ? { havuz: "sayisal", zorunlu: false } : null;
  return null;
}

export type SecimSonucu = {
  secim: DegiskenSecimi;
  /** Zorunlu olduğu hâlde uygun sütun bulunamayan alanlar: hesap başlatılamaz. */
  eksikAlanlar: SecimAlani[];
  /** Düzeltme sırasında değeri değişen alanlar. */
  duzeltilenAlanlar: SecimAlani[];
};

/**
 * Seçimi analizin izin verdiği sütunlara göre düzeltir.
 * GEÇERLİ MEVCUT SEÇİM KORUNUR; yalnızca geçersiz olan değişir.
 * O analizde kullanılmayan alanlara dokunulmaz (geri dönülürse dursun).
 */
export function secimiDuzelt(tur: AnalizTuru, mevcut: DegiskenSecimi, havuzlar: SutunHavuzlari): SecimSonucu {
  const secim: DegiskenSecimi = { ...mevcut };
  const eksikAlanlar: SecimAlani[] = [];
  const duzeltilenAlanlar: SecimAlani[] = [];
  /* Sıra önemli: varB'nin "varA'dan farklı" kuralı düzeltilmiş varA'ya bakar. */
  const alanlar: SecimAlani[] = ["groupVar", "groupVar2", "varA", "varB", "varY"];

  for (const alan of alanlar) {
    const kural = alanKurali(tur, alan);
    if (!kural) continue;
    const havuz = havuzlar[kural.havuz];
    const yasak = kural.farkli ? secim[kural.farkli] : null;
    const uygun = havuz.filter((ad) => ad !== yasak);
    const simdiki = secim[alan];
    const gecerli = simdiki !== "" && uygun.includes(simdiki);
    if (gecerli) continue;
    /* Boş, bu analizde isteğe bağlı bir alan için geçerli bir değer. */
    if (!kural.zorunlu && simdiki === "") continue;
    const yeni = uygun[0] ?? "";
    if (yeni !== simdiki) {
      secim[alan] = yeni;
      duzeltilenAlanlar.push(alan);
    }
    if (kural.zorunlu && yeni === "") eksikAlanlar.push(alan);
  }
  return { secim, eksikAlanlar, duzeltilenAlanlar };
}

/** Hesap başlatılabilir mi: zorunlu alanların hepsi dolu mu. */
export function hesaplanabilirMi(tur: AnalizTuru, secim: DegiskenSecimi, havuzlar: SutunHavuzlari): boolean {
  return secimiDuzelt(tur, secim, havuzlar).eksikAlanlar.length === 0;
}
