/*
  SATIR EŞLEŞTİRME (liste bazlı eleme).

  Eşleştirilmiş analizler (korelasyon, eşleştirilmiş t-testi, Spearman,
  regresyon, güvenilirlik) aynı KİŞİNİN iki ya da daha çok ölçümünü yan
  yana koymak zorunda. Veri çıkarma bunu yapmıyordu: her sütun ayrı ayrı
  okunuyor, boş ve sayısal olmayan hücreler ATILIYOR — yani sütun
  kısalıyor ve kalanlar BAŞA kayıyor — sonra iki sütun en kısa olanın
  uzunluğuna kesiliyordu.

  Sonuç: tek bir boş hücre bütün eşleşmeyi kaydırıyor. 100 kişilik bir
  veride 1. kişinin ön testi boşsa, ön test dizisi 2–100. kişiler,
  son test dizisi 1–100. kişiler oluyor; kesme sonrası 2. kişinin ön
  testi 1. kişinin son testiyle eşleşiyor ve bu BAŞTAN SONA böyle
  gidiyor. Test hiç olmayan bir farkı raporluyor ya da olanı
  gizliyor. Hiçbir uyarı yok, çünkü sayılar makul görünüyor.

  Doğrusu liste bazlı eleme (SPSS'in "listwise" davranışı): seçili
  sütunların HEPSİNDE sayısal değer taşıyan satırlar alınır, geri kalan
  satır tümüyle düşer. Kaç satırın düştüğü de döndürülüyor — eleme
  sessiz kalırsa kullanıcı N'in neden küçüldüğünü anlayamaz.

  Saf modül: testi tests/unit/veri-eslestirme.test.ts.
*/

export type HucreDegeri = string | number | null;
export type VeriSatiri = Record<string, HucreDegeri>;

export interface EslesenVeri {
  /** Sütun başına, satır sırası KORUNMUŞ değerler; hepsi aynı uzunlukta. */
  sutunlar: number[][];
  /** Eşleşen satır sayısı. */
  n: number;
  /** Eksik değer yüzünden düşen satır sayısı. */
  dusen: number;
}

/** Hücre sayıya çevrilebiliyor mu? Boş dize ve null sayı DEĞİLDİR (Number("") === 0). */
export function sayisalMi(deger: HucreDegeri): boolean {
  if (deger === null || deger === "") return false;
  return Number.isFinite(Number(deger));
}

export function eslesenSatirlar(satirlar: VeriSatiri[], sutunAdlari: string[]): EslesenVeri {
  const sutunlar: number[][] = sutunAdlari.map(() => []);
  let dusen = 0;
  for (const satir of satirlar) {
    if (!sutunAdlari.every((ad) => sayisalMi(satir[ad]))) {
      dusen += 1;
      continue;
    }
    sutunAdlari.forEach((ad, i) => sutunlar[i].push(Number(satir[ad])));
  }
  return { sutunlar, n: sutunlar[0]?.length ?? 0, dusen };
}

/** "N = 97 (3 satır eksik veri yüzünden düştü)" — eleme sessiz kalmamalı. */
export function elemeNotu(veri: EslesenVeri): string | null {
  if (veri.dusen === 0) return null;
  return `${veri.dusen} satır eksik veri yüzünden analiz dışı bırakıldı (N = ${veri.n}).`;
}

/**
 * Sütunu TAM boyda okur; sayısal olmayan hücre `null` kalır.
 *
 * Satır sırası korunduğu için çiftler sonradan eşleştirilebiliyor —
 * boşları atıp kısalan bir dizide bu bilgi geri getirilemez.
 */
export function sayisalSutun(satirlar: VeriSatiri[], sutunAdi: string): (number | null)[] {
  return satirlar.map((satir) => (sayisalMi(satir[sutunAdi]) ? Number(satir[sutunAdi]) : null));
}

/** İki sütunun ikisinde de değer taşıyan satırlar (çift bazlı eleme). */
export function ciftEslestir(a: (number | null)[], b: (number | null)[]): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  const uzunluk = Math.min(a.length, b.length);
  for (let i = 0; i < uzunluk; i++) {
    if (a[i] === null || b[i] === null) continue;
    x.push(a[i] as number);
    y.push(b[i] as number);
  }
  return { x, y };
}
