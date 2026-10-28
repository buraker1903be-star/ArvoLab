/*
  DESTEK KUYRUKLARI (26.10.2026, kurum sahibinin isteği: "destek
  kuyruklarına geçelim"). Personelin dört kuyruğu tek ekranda: üstte
  sayaçlar, solda seçili kuyruğun listesi, sağda seçili kayıt.

  Eskiden kuyruklar başlıktaki üç ayrı açılır penceredeydi: "Uzman
  kuyruğu · 3" düğmesine basmadan neyin beklediği görünmüyordu,
  talebi kimin açtığı hiç yazmıyordu ve bir talebe yanıt yazarken öbür
  kuyruğa bakmak için pencereyi kapatmak gerekiyordu.

  Kuyruk ve seçim adres satırında (?kuyruk=…&sec=…): yenileyince ve
  bağlantı paylaşılınca aynı talep açık kalır.

  Saf modül; testi tests/unit/destek-kuyrugu.test.ts.
*/

import type { Dil, Metin } from "@/lib/dil";

export type KuyrukTuru = "uzman-acik" | "uzman-bana" | "destek" | "geri-bildirim";

export const KUYRUK_ETIKETI_METIN: Record<KuyrukTuru, Metin> = {
  "uzman-acik": { tr: "Açık uzman talebi", en: "Open expert requests" },
  "uzman-bana": { tr: "Bana atanan", en: "Assigned to me" },
  destek: { tr: "Uygulama desteği", en: "App support" },
  "geri-bildirim": { tr: "Geri bildirim", en: "Feedback" },
};

/** Eski (yalnızca Türkçe) harita; değerleri KUYRUK_ETIKETI_METIN'den. */
export const KUYRUK_ETIKETI: Record<KuyrukTuru, string> = {
  "uzman-acik": KUYRUK_ETIKETI_METIN["uzman-acik"].tr,
  "uzman-bana": KUYRUK_ETIKETI_METIN["uzman-bana"].tr,
  destek: KUYRUK_ETIKETI_METIN.destek.tr,
  "geri-bildirim": KUYRUK_ETIKETI_METIN["geri-bildirim"].tr,
};

export const kuyrukEtiketi = (tur: KuyrukTuru, dil: Dil = "tr") => KUYRUK_ETIKETI_METIN[tur][dil];

export const KUYRUK_SIRASI: KuyrukTuru[] = ["uzman-acik", "uzman-bana", "destek", "geri-bildirim"];

const SAYFA = "/dashboard/expert-requests";

export function kuyrukAdresi(tur: KuyrukTuru, sec?: string | null): string {
  const p = new URLSearchParams({ kuyruk: tur });
  if (sec) p.set("sec", sec);
  return `${SAYFA}?${p.toString()}`;
}

/** Kendi taleplerim sekmesi (personel de uzmana ya da bize yazabilir). */
export const TALEPLERIM_ADRESI = `${SAYFA}?sekme=taleplerim`;

/**
 * Açık kuyruk: istenen erişilebilir kuyruksa o; değilse içinde iş
 * bekleyen İLK kuyruk (personel sayfayı açınca boş bir listeye bakmasın),
 * hiçbirinde iş yoksa erişilebilen ilk kuyruk.
 */
export function acikKuyruk(
  erisilebilir: KuyrukTuru[],
  istenen: string | null | undefined,
  sayi: (tur: KuyrukTuru) => number,
): KuyrukTuru | null {
  const sirali = KUYRUK_SIRASI.filter((t) => erisilebilir.includes(t));
  if (istenen && sirali.includes(istenen as KuyrukTuru)) return istenen as KuyrukTuru;
  return sirali.find((t) => sayi(t) > 0) ?? sirali[0] ?? null;
}

/** Seçili kayıt: istenen listedeyse o, değilse listenin ilki (en eski bekleyen). */
export function seciliKayit(idler: string[], istenen: string | null | undefined): string | null {
  if (istenen && idler.includes(istenen)) return istenen;
  return idler[0] ?? null;
}
