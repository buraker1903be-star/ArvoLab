/*
  VERİ HAZIRLAMA: TERS MADDE VE ÖLÇEK PUANI (27.10.2026).

  Türkçe tezlerin çoğu Likert ölçeğiyle çalışıyor ve analizden önce iki
  iş yapılıyor: olumsuz yazılmış maddeler ters çevriliyor, sonra madde
  puanlarından alt boyut ve toplam puan hesaplanıyor. Analiz Merkezi
  ikisini de yapamıyordu; öğrenci dosyayı Excel'de elle düzenleyip
  yeniden yüklüyordu — ters çevirmeyi unutmak ya da formülü bir satır
  kaydırmak sessiz ve yaygın bir hataydı (Cronbach α düşük çıkıyor,
  öğrenci ölçeği "güvenilmez" sanıyordu).

  Türetilen sütun yalnızca bu oturumda, tarayıcıda: dosya değişmiyor,
  sunucuya gitmiyor. Her işlemin SPSS karşılığı (COMPUTE) da üretiliyor;
  jüri "puanı nasıl hesapladın" diye sorduğunda öğrenci gösterebilsin ve
  SPSS'te aynı sütunu kurabilsin.

  EKSİK MADDE: maddelerden biri boşsa o kişinin puanı BOŞ kalır. Kalan
  maddelerin ortalamasını almak kişiyi eksik maddeye göre farklı bir
  ölçekle puanlamak olur; SPSS karşılığı da bu yüzden MEAN.k / SUM.k
  (k madde, hepsi dolu olmalı). Kaç kişinin boş kaldığı söylenir.

  Saf modül; testi tests/unit/veri-hazirlama.test.ts.
*/
import type { Dil } from "@/lib/dil";
import { sayisalMi, type VeriSatiri } from "@/lib/veri-eslestirme";

export type PuanTuru = "ortalama" | "toplam";

export type TuretmeSonucu = {
  /** Yeni sütunu taşıyan satırlar (girdi değişmez). */
  satirlar: VeriSatiri[];
  /** Kullanılan (benzersizleştirilmiş) sütun adı. */
  sutun: string;
  /** Boş kalan satır sayısı (eksik ya da aralık dışı değer). */
  bos: number;
  /** Aynı hesabın SPSS sözdizimi. */
  spss: string;
};

/** Mevcut adlarla çakışmayan sütun adı: "puan", "puan_2", "puan_3"… */
export function benzersizAd(oneri: string, mevcut: string[]): string {
  const temel = oneri.trim() || "yeni_sutun";
  if (!mevcut.includes(temel)) return temel;
  let i = 2;
  while (mevcut.includes(`${temel}_${i}`)) i += 1;
  return `${temel}_${i}`;
}

/*
  Ölçek aralığı tahmini: seçili maddelerde görülen en küçük ve en büyük
  TAM SAYI. Yalnızca varsayılan değer; kullanıcı düzeltebilir (hiç kimse
  "1" işaretlememişse veri 2–5 görünür ama ölçek 1–5'tir).
*/
export function aralikTahmini(satirlar: VeriSatiri[], sutunlar: string[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const s of satirlar) {
    for (const c of sutunlar) {
      if (!sayisalMi(s[c])) continue;
      const d = Number(s[c]);
      if (d < min) min = d;
      if (d > max) max = d;
    }
  }
  if (!Number.isFinite(min) || !Number.isInteger(min) || !Number.isInteger(max) || min >= max) return null;
  return { min, max };
}

/* SPSS değişken adı boşluk taşıyamaz (analiz-betik ile aynı kural). */
const spssAd = (ad: string) => ad.replace(/\s+/g, "_");

/*
  TERS KODLAMA: x' = (min + max) − x. 1–5 ölçekte 1↔5, 2↔4, 3 yerinde.
  Aralık dışındaki değer (ör. 1–5 ölçekte 7, veri giriş hatası) ters
  çevrilmez, BOŞ bırakılır ve sayılır: çevrilseydi −1 gibi imkânsız bir
  puan sessizce ortalamaya karışırdı.
*/
export function tersKodla(
  satirlar: VeriSatiri[],
  sutun: string,
  aralik: { min: number; max: number },
  mevcutSutunlar: string[],
  dil: Dil = "tr",
): TuretmeSonucu {
  if (!(aralik.min < aralik.max)) {
    throw new Error(
      dil === "en"
        ? "The scale's minimum value must be smaller than its maximum."
        : "Ölçeğin en küçük değeri en büyüğünden küçük olmalı.",
    );
  }
  const yeni = benzersizAd(`${sutun}_ters`, mevcutSutunlar);
  let bos = 0;
  const sonuc = satirlar.map((s) => {
    const deger = s[sutun];
    if (!sayisalMi(deger)) {
      if (deger !== null && deger !== "") bos += 1;
      return { ...s, [yeni]: null };
    }
    const d = Number(deger);
    if (d < aralik.min || d > aralik.max) {
      bos += 1;
      return { ...s, [yeni]: null };
    }
    return { ...s, [yeni]: aralik.min + aralik.max - d };
  });
  return {
    satirlar: sonuc,
    sutun: yeni,
    bos,
    spss: `COMPUTE ${spssAd(yeni)} = ${aralik.min + aralik.max} - ${spssAd(sutun)}.\nEXECUTE.`,
  };
}

/** Madde puanlarından ölçek ya da alt boyut puanı (ortalama ya da toplam). */
export function olcekPuani(
  satirlar: VeriSatiri[],
  maddeler: string[],
  tur: PuanTuru,
  ad: string,
  mevcutSutunlar: string[],
  dil: Dil = "tr",
): TuretmeSonucu {
  if (maddeler.length < 2) {
    throw new Error(dil === "en" ? "Select at least two items for a scale score." : "Ölçek puanı için en az iki madde seçin.");
  }
  const yeni = benzersizAd(ad, mevcutSutunlar);
  let bos = 0;
  const sonuc = satirlar.map((s) => {
    if (!maddeler.every((m) => sayisalMi(s[m]))) {
      bos += 1;
      return { ...s, [yeni]: null };
    }
    const toplam = maddeler.reduce((t, m) => t + Number(s[m]), 0);
    return { ...s, [yeni]: tur === "toplam" ? toplam : toplam / maddeler.length };
  });
  const islev = tur === "toplam" ? "SUM" : "MEAN";
  return {
    satirlar: sonuc,
    sutun: yeni,
    bos,
    spss: `COMPUTE ${spssAd(yeni)} = ${islev}.${maddeler.length}(${maddeler.map(spssAd).join(", ")}).\nEXECUTE.`,
  };
}
