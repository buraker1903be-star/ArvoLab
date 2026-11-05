import type { EkranSinifi } from "@/lib/os/kirilimlar";

/*
  ORTAK SAYFA STANDARDI — SAF KARARLAR (Signature OS 4.1, 05.11.2026).

  Bileşenler app/dashboard/_components/sayfa/ altında; burada yalnızca
  ekrandan bağımsız kararlar duruyor, birim testi sınıyor
  (tests/unit/sayfa-standardi.test.ts).

  1) EYLEMLERİN YERİ. Sayfa başlığında üç tür eylem var: birincil (yalnızca
     kullanıcının gerçek ana görevi varsa — her sayfada zorunlu DEĞİL),
     ikincil (sık kullanılan) ve taşma (seyrek: dışa aktarma, eski
     kayıtlar). Eskiden her sayfa düğmelerini yan yana diziyordu: Kaynaklar
     kartının başında dört düğme vardı ve telefonda iki satıra sarıyordu.
     Telefonda ikinciller de taşma menüsüne girer — ama tek bir eylem için
     menü açtırmak, düğmeyi göstermekten kötüdür; bu yüzden toplam bir
     taneyse satırda kalır.

  2) SIRALAMA. Liste ve tablolarda boş değer yönden bağımsız SONA gider:
     "yılı olmayan kaynak" azalan sıralamada başa çıkıp listenin en
     görünür yerini kaplamamalı. Sayılar sayı, metinler dilin kurallarıyla
     ("İ" ve "ı" Türkçede doğru yerde) karşılaştırılır.
*/

export type EylemYeri = "satir" | "menu";

export function eylemYerlesimi(
  ekran: EkranSinifi,
  sayi: { ikincil: number; tasma: number },
): { ikincil: EylemYeri; menuVar: boolean } {
  const toplam = sayi.ikincil + sayi.tasma;
  const ikincil: EylemYeri = ekran === "telefon" && toplam > 1 ? "menu" : "satir";
  const menuVar = sayi.tasma > 0 || (ikincil === "menu" && sayi.ikincil > 0);
  return { ikincil, menuVar };
}

export type SiralamaDegeri = string | number | null | undefined;
export type SiralamaYonu = "artan" | "azalan";

const bosMu = (d: SiralamaDegeri) => d === null || d === undefined || (typeof d === "string" && d.trim() === "") || (typeof d === "number" && Number.isNaN(d));

/** Kararlı sıralama; girdi dizisini değiştirmez. Boş değerler her iki yönde de sonda. */
export function sirala<T>(satirlar: readonly T[], deger: (satir: T) => SiralamaDegeri, yon: SiralamaYonu, yerel: string): T[] {
  const karsilastir = new Intl.Collator(yerel, { numeric: true, sensitivity: "base" });
  const isaret = yon === "artan" ? 1 : -1;
  return satirlar
    .map((satir, sira) => ({ satir, sira, d: deger(satir) }))
    .sort((a, b) => {
      const aBos = bosMu(a.d);
      const bBos = bosMu(b.d);
      if (aBos || bBos) return aBos === bBos ? a.sira - b.sira : aBos ? 1 : -1;
      const fark =
        typeof a.d === "number" && typeof b.d === "number" ? a.d - b.d : karsilastir.compare(String(a.d), String(b.d));
      return fark === 0 ? a.sira - b.sira : fark * isaret;
    })
    .map((x) => x.satir);
}

/** Başlıktaki sıralama düğmesinin bir sonraki durumu: artan → azalan → artan. Yeni sütun artanla başlar. */
export function sonrakiSiralama(
  simdiki: { anahtar: string; yon: SiralamaYonu } | null,
  anahtar: string,
): { anahtar: string; yon: SiralamaYonu } {
  if (simdiki?.anahtar !== anahtar) return { anahtar, yon: "artan" };
  return { anahtar, yon: simdiki.yon === "artan" ? "azalan" : "artan" };
}
