/*
  Ana sayfanın (genel bakış) saf hesapları: grafik serisi ve selamlama.

  Düzen ArvoOS'un genel bakış şablonu (app/panel/os/genel-bakis.tsx):
  selamlama · tam genişlikte son 14 günün grafiği · altında dört liste
  kartı. Sayım veritabanında yapılıyor (public.calisma_hareketlerim);
  burası yalnızca dönen gün × tür sayılarını çubuklara diziyor. Kayıt
  olmayan gün de çubuk olarak görünmeli — yoksa "dün hiç çalışmadım"
  bilgisi kaybolur ve çubuklar yanıltıcı biçimde sıkışır.

  Gün sınırı Türkiye saatiyle (lib/tr-time.ts). Saat dışarıdan verilir;
  testi tests/unit/genel-bakis.test.ts.
*/

import { YEREL, type Dil } from "./dil";
import { TR } from "./tr-time";

const GUN_MS = 24 * 60 * 60 * 1000;

const gunAnahtari = (an: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TR, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(an));

export type HareketTuru = "surum" | "kaynak" | "denetim" | "asistan" | "kanit";
export type HareketSatiri = { gun: string; tur: string; adet: number };

export type SeriGunu = { anahtar: string; adet: number; gun: string; baslik: string; bugun: boolean };
export type HareketSerisi = {
  gunler: SeriGunu[];
  toplam: number;
  onceki: number;
  /** Önceki döneme göre yüzde değişim; önceki dönem boşsa null (sıfıra bölünmez). */
  degisim: number | null;
  enBuyuk: number;
  /** Pencere içindeki türlere göre toplamlar (grafik başlığındaki özet). */
  turler: Record<HareketTuru, number>;
};

/*
  Çubuk etiketleri İngilizcede de TÜRKİYE gününe göre yazılır: gün
  anahtarları (ve veritabanındaki sayım) Türkiye günüyle, etiketi başka
  dilimde yazmak çubuğu komşu günün adıyla gösterirdi.
*/
export function hareketSerisi(satirlar: HareketSatiri[], simdi: number, gun = 14, dil: Dil = "tr"): HareketSerisi {
  const indeks = new Map<string, number>();
  const gunler: SeriGunu[] = Array.from({ length: gun }, (_, sira) => {
    const an = simdi - (gun - 1 - sira) * GUN_MS;
    const anahtar = gunAnahtari(an);
    indeks.set(anahtar, sira);
    return {
      anahtar,
      adet: 0,
      gun: new Intl.DateTimeFormat(YEREL[dil], { timeZone: TR, day: "numeric" }).format(new Date(an)),
      baslik: new Intl.DateTimeFormat(YEREL[dil], { timeZone: TR, weekday: "short", day: "numeric", month: "short" }).format(new Date(an)),
      bugun: sira === gun - 1,
    };
  });

  const turler: Record<HareketTuru, number> = { surum: 0, kaynak: 0, denetim: 0, asistan: 0, kanit: 0 };
  const ilkGun = gunler[0].anahtar;
  /* Önceki dönem: pencerenin hemen öncesindeki aynı uzunluk. Anahtarlar
     YYYY-AA-GG olduğu için dizgi karşılaştırması tarih sırasıdır. */
  const oncekiBasi = gunAnahtari(simdi - (2 * gun - 1) * GUN_MS);
  let onceki = 0;

  for (const satir of satirlar) {
    const adet = Number(satir.adet) || 0;
    const yer = indeks.get(satir.gun);
    if (yer !== undefined) {
      gunler[yer].adet += adet;
      if (Object.hasOwn(turler, satir.tur)) turler[satir.tur as HareketTuru] += adet;
    } else if (satir.gun >= oncekiBasi && satir.gun < ilkGun) {
      onceki += adet;
    }
  }

  const toplam = gunler.reduce((t, g) => t + g.adet, 0);
  return {
    gunler,
    toplam,
    onceki,
    degisim: onceki ? Math.round(((toplam - onceki) / onceki) * 100) : null,
    enBuyuk: Math.max(1, ...gunler.map((g) => g.adet)),
    turler,
  };
}

/**
 * Saate göre selamlama; varsayılan Türkiye saati. İngilizce kullanıcı yurt
 * dışında olabilir: çağıran aktifSaatDilimi() verirse sabah onun sabahıdır.
 */
export function selamlama(simdi: number, dil: Dil = "tr", saatDilimi: string = TR): string {
  const saat = Number(new Intl.DateTimeFormat("en-GB", { timeZone: saatDilimi, hour: "2-digit", hourCycle: "h23" }).format(new Date(simdi)));
  const en = dil === "en";
  if (saat >= 5 && saat < 11) return en ? "Good morning" : "Günaydın";
  if (saat >= 11 && saat < 18) return en ? "Good afternoon" : "İyi günler";
  /* "Good night" İngilizcede vedadır; gece yarısı da "Good evening" denir. */
  if (saat >= 18 && saat < 23) return en ? "Good evening" : "İyi akşamlar";
  return en ? "Good evening" : "İyi geceler";
}

/** "Burak Erdoğan" → "Burak": selamlamada yalnızca ad, ArvoOS'taki gibi. */
export const ilkAd = (adSoyad: string | null | undefined) => (adSoyad ?? "").trim().split(/\s+/)[0] || null;

/*
  Saat bir fonksiyondan: sayfa bileşeni gövdesinde Date.now() çağırmak
  React'in saflık kuralına takılıyor (react-hooks/purity). Ana sayfa
  sunucuda bir kez çiziliyor; ArvoOS'taki genel-bakis.tsx de aynı yolu
  kullanıyor.
*/
export const simdi = () => Date.now();
