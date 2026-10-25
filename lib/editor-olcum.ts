/*
  Editör ölçümü — yalnızca `?olcum=1` ile açılır.

  Neden var: "uzun tezde harfler geç geliyor" şikâyeti 25.10.2026'da beş
  ayrı hipotezle ölçüldü ve HİÇBİRİ çıkmadı — tarayıcının yazım denetimi
  (açık 1,23 ms / kapalı 1,18 ms), CSS sayaçları (1,35 / 1,36 ms),
  `getJSON()` (190 sayfada 0,18 ms), `localStorage` yazımı (900 KB için
  1,0 ms) ve yapı denetimi (17,8 ms ama 2,5 sn gecikmeli, yazarken
  çalışmıyor). Sentetik belgede maliyet YOK; demek ki sorun gerçek
  belgenin kendisinde (boyut, resim, tablo, dipnot yoğunluğu) ya da
  gerçek cihazda. Kullanıcının tezini buraya taşıyamıyoruz, bu yüzden
  ölçüm tezin yanına gidiyor.

  Kapalıyken bedeli tek bir boolean kontrolü: `olc()` ölçmeden çağırır.
*/

export interface OlcumOzeti {
  ad: string;
  sayi: number;
  ortanca: number;
  p95: number;
  enKotu: number;
}

/** Sıralı dizide yüzdelik (en yakın sıra; boş dizide 0). */
export function yuzdelik(sirali: number[], oran: number): number {
  if (sirali.length === 0) return 0;
  const sira = Math.min(sirali.length - 1, Math.max(0, Math.ceil(oran * sirali.length) - 1));
  return sirali[sira];
}

export class Olcum {
  /*
    Son N ölçüm tutuluyor, hepsi değil: yarım saatlik yazma oturumunda
    "ortalama" artık hiçbir şey anlatmıyor, kullanıcı SON durumu soruyor.
  */
  private readonly veri = new Map<string, number[]>();
  private readonly enFazla: number;

  // Not: parametre özelliği (constructor(private …)) YAZILAMAZ — testleri
  // çalıştıran Node yalnızca tipleri sıyırıyor, o söz dizimini desteklemiyor.
  constructor(enFazla = 200) {
    this.enFazla = enFazla;
  }

  ekle(ad: string, ms: number) {
    const dizi = this.veri.get(ad) ?? [];
    dizi.push(ms);
    if (dizi.length > this.enFazla) dizi.shift();
    this.veri.set(ad, dizi);
  }

  ozet(): OlcumOzeti[] {
    const satirlar: OlcumOzeti[] = [];
    for (const [ad, dizi] of this.veri) {
      const sirali = [...dizi].sort((a, b) => a - b);
      satirlar.push({
        ad,
        sayi: dizi.length,
        ortanca: yuzdelik(sirali, 0.5),
        p95: yuzdelik(sirali, 0.95),
        enKotu: sirali[sirali.length - 1],
      });
    }
    // En kötüsü üstte: panelde aranan şey "neyi beklemişim".
    return satirlar.sort((a, b) => b.enKotu - a.enKotu);
  }

  bos() {
    this.veri.clear();
  }
}

/** `?olcum=1` (yalnızca bu değer; "0" ya da yokluk kapalı demek). */
export function olcumAcikMi(search: string): boolean {
  try {
    return new URLSearchParams(search).get("olcum") === "1";
  } catch {
    return false;
  }
}

/*
  Tek bir küresel toplayıcı: ölçüm noktaları editörün dört bir yanına
  dağılmış durumda (kayıt, taslak, istatistik, yapı denetimi) ve hepsini
  React bağlamından geçirmek çağrı yerlerini kirletirdi.
*/
let toplayici: Olcum | null = null;

export function olcumuAc(): Olcum {
  toplayici ??= new Olcum();
  return toplayici;
}

export function olcumuKapat() {
  toplayici = null;
}

export const olcumAcik = () => toplayici !== null;

/** İşi çalıştırır; ölçüm açıksa süresini kaydeder. Kapalıyken ek maliyet yok. */
export function olc<T>(ad: string, is: () => T): T {
  if (!toplayici) return is();
  const t0 = performance.now();
  try {
    return is();
  } finally {
    toplayici.ekle(ad, performance.now() - t0);
  }
}

/** Süresi dışarıda ölçülen işler için (tuş gecikmesi, uzun görev). */
export function olcumKaydet(ad: string, ms: number) {
  toplayici?.ekle(ad, ms);
}
