/*
  ANA SAYFADAKİ PLAN SEÇİMİ (25.11.2026).

  Deneme üyesine üç eşit plan kartı gösteriliyor. Kartın SATIŞ METNİ
  ürünün sözü (kurum sahibinin yazdığı cümleler), kartın SAYILARI ise
  ArvoOS kataloğunun: fiyat, faturalama dönemi, plana dahil asistan
  kredisi ve planı ayıran somut avantajlar. İkisini birbirine bu modül
  bağlıyor ve bağlayamazsa bölüm HİÇ açılmıyor.

  NEDEN KAPI VAR. Satış metni tek başına "daha fazla alan" diyor;
  müşterinin ne aldığını söyleyen şey katalogdaki sayı. Katalog
  eksikken üç kartı yine de çizmek, fiyatı ve kapsamı bilinmeyen bir
  plana "seç" dedirtmek olurdu — ArvoLab'ın hiçbir yerde yapmadığı şey.
  Kapı kapalıyken çağıran mevcut ödeme yolunu sunuyor.

  EŞLEME ADLA. Katalogdan gelen plan adı ("Standart", "Plus", "Pro")
  satış metnini seçiyor. Katalog tanımadığımız bir ad bildirirse o plan
  kartı metinsiz çizilmiyor, bölüm açılmıyor: tanımadığımız bir plana
  kendi cümlemizi iliştirmek, olmayan bir vaat vermek olurdu.

  Saf modül; testi tests/unit/plan-satis.test.ts.
*/

import type { BillingInterval, BillingPlan } from "./billing-plan";
import type { Metin } from "./dil";

/** Satış metinleri plan ADINA göre; kurum sahibinin yazdığı cümleler. */
export const SATIS_METINLERI: Record<string, { metin: Metin; dugme: Metin }> = {
  standart: {
    metin: {
      tr: "Tez, makale veya projeniz için yazımınızı ve kaynaklarınızı tek yerde düzenleyin.",
      en: "Keep your writing and sources for your thesis, article or project in one place.",
    },
    dugme: { tr: "Standart'ı seç", en: "Choose Standard" },
  },
  plus: {
    metin: {
      tr: "Düzenli yazıyor ve kaynak tarıyorsanız, araştırma ve revizyon için daha fazla alan açın.",
      en: "If you write and search sources regularly, open up more room for research and revision.",
    },
    dugme: { tr: "Plus'ı seç", en: "Choose Plus" },
  },
  pro: {
    metin: {
      tr: "Birden fazla yayın ya da yoğun bir tez süreci yürütüyorsanız, en yüksek kullanım kapasitesiyle ilerleyin.",
      en: "If you run several publications or an intensive thesis, go with the highest usage capacity.",
    },
    dugme: { tr: "Pro'yu seç", en: "Choose Pro" },
  },
};

export type PlanKarti = {
  /** Ödeme akışına giden kod. */
  kod: string;
  /** Katalogdaki görünen ad. */
  ad: string;
  /** Kuruş. */
  fiyat: number;
  donem: BillingInterval;
  /** Plana dahil aylık asistan kredisi. */
  kredi: number;
  /** Planı ayıran somut avantajlar (katalogdan). */
  avantajlar: string[];
  metin: Metin;
  dugme: Metin;
  /*
    AYNI KADEMENİN YILLIK SÜRÜMÜ (25.11.2026). Katalogda varsa kartın
    İÇİNDE gösteriliyor: yıllık seçenek ayrı bir listede dursaydı
    hangi plana ait olduğu belirsiz kalırdı. Yoksa null.
  */
  yillik: { kod: string; fiyat: number } | null;
};

/** Satış metni anahtarı: "Standart" → "standart". */
const anahtar = (ad: string) => ad.trim().toLocaleLowerCase("tr-TR").replace(/[’']/g, "");

/**
 * Üç kartı kurar. Kapı: katalogda satış metni tanıdığımız ÜÇ ayrı plan
 * olmalı ve her birinin kodu, adı, fiyatı, dönemi, kredisi ve en az bir
 * avantajı bulunmalı. Biri bile eksikse boş dizi döner ve çağıran
 * bölümü çizmez.
 */
export function planKartlari(planlar: BillingPlan[]): PlanKarti[] {
  /*
    KADEME BAŞINA TEK KART. Katalog her kademenin aylık ve yıllık
    sürümünü ayrı plan olarak bildiriyor; üç kartlı ekranda kademe
    başına bir tane gösteriliyor ve AYLIK olan yeğleniyor (giriş
    noktası o; kart dönemi zaten yazıyor). Aylığı olmayan kademede
    katalogdaki ilk sürüm alınıyor.
  */
  const kademeler = new Map<string, PlanKarti>();
  for (const p of planlar) {
    if (!p.code || !p.ad || p.price === null || !p.interval) continue;
    if (typeof p.kredi !== "number" || p.kredi <= 0) continue;
    const avantajlar = p.avantajlar ?? [];
    if (!avantajlar.length) continue;
    const anah = anahtar(p.ad);
    const metinler = SATIS_METINLERI[anah];
    if (!metinler) continue;
    const mevcut = kademeler.get(anah);
    if (mevcut && !(mevcut.donem !== "month" && p.interval === "month")) continue;
    kademeler.set(anah, {
      kod: p.code,
      ad: p.ad,
      fiyat: p.price,
      donem: p.interval,
      kredi: p.kredi,
      avantajlar,
      metin: metinler.metin,
      dugme: metinler.dugme,
      yillik: null,
    });
  }
  /* Yıllık sürümler: kartın kendi kademesine bağlanıyor. */
  for (const p of planlar) {
    if (!p.code || !p.ad || p.price === null || p.interval !== "year") continue;
    const kart = kademeler.get(anahtar(p.ad));
    if (!kart || kart.kod === p.code || kart.yillik) continue;
    kart.yillik = { kod: p.code, fiyat: p.price };
  }
  const kartlar = [...kademeler.values()];
  /*
    İKİ KADEME AYNI KODU TAŞIYAMAZ. Taşırsa "Pro'yu seç" düğmesi Plus'ı
    satın alırdı: müşteri seçtiğinden başkasını öder. Böyle bir katalogda
    bölüm hiç açılmıyor.
  */
  if (new Set(kartlar.map((k) => k.kod)).size !== kartlar.length) return [];
  /* Sıra krediye göre artan: kartlar "az → çok" okunuyor ve en yüksek
     kapasite sağda kalıyor. Katalogun sırasına güvenmiyoruz. */
  kartlar.sort((a, b) => a.kredi - b.kredi);
  /* ÜÇ KADEME birden olmalı: iki kartlı bir "üç plan" ekranı, eksik
     olanın var olmadığını söylerdi. */
  return kademeler.size === 3 ? kartlar : [];
}

/** Satış bölümü açılabilir mi? */
export const satisHazir = (planlar: BillingPlan[]): boolean => planKartlari(planlar).length === 3;
