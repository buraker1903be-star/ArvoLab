/*
  TEZ TAKVİMİ (28.10.2026): kilometre taşlarının durumu ve teslim
  tarihinden taslak takvim.

  Tablo calisma_takvimi (migration 20261028035441). Tarihler GÜN olarak
  tutuluyor (date) ve "bugün" Türkiye günüyle karşılaştırılıyor — UTC
  günüyle karşılaştırmak gece 00:00–03:00 arasında taşı bir gün erken
  "gecikti" gösterirdi.

  TASLAK TAKVİM bir öneri: öğrenci teslim tarihini girer, "Taslak takvim
  oluştur" bugünden teslime kalan süreyi çalışma türünün olağan
  adımlarına paylaştırır. Ağırlıklar Türk lisansüstü tezlerinin yaygın
  akışı (literatür ve yöntem önce, son okuma ve biçim kontrolü en son);
  öğrenci her tarihi değiştirebilir, silebilir. Teslime 14 günden az
  kaldıysa taslak üretilmez: o sürede altı aşamalı plan bir plan değil.

  Saf modül; testi tests/unit/tez-takvimi.test.ts.
*/

import type { Dil } from "./dil";

export interface TakvimTasi {
  id: string;
  baslik: string;
  hedef_tarih: string;
  tamamlandi: string | null;
}

export type TasDurumu = "tamam" | "gecikti" | "yaklasiyor" | "ileride";

export const YAKLASIYOR_GUN = 7;
export const TASLAK_EN_AZ_GUN = 14;

const gunSayisi = (gun: string) => Date.parse(`${gun.slice(0, 10)}T00:00:00Z`) / 86_400_000;

/** İki gün anahtarı arasındaki tam gün farkı (b − a). */
export const gunFarki = (a: string, b: string) => Math.round(gunSayisi(b) - gunSayisi(a));

export function tasDurumu(tas: Pick<TakvimTasi, "hedef_tarih" | "tamamlandi">, bugun: string): { durum: TasDurumu; kalanGun: number } {
  const kalanGun = gunFarki(bugun, tas.hedef_tarih);
  if (tas.tamamlandi) return { durum: "tamam", kalanGun };
  if (kalanGun < 0) return { durum: "gecikti", kalanGun };
  return { durum: kalanGun <= YAKLASIYOR_GUN ? "yaklasiyor" : "ileride", kalanGun };
}

/** Tarihe göre sıralı (aynı günde ada göre). */
export const takvimSirala = <T extends TakvimTasi>(taslar: T[]) =>
  [...taslar].sort((a, b) => a.hedef_tarih.localeCompare(b.hedef_tarih) || a.baslik.localeCompare(b.baslik, "tr"));

/** Sıradaki taş: tamamlanmamışların en erken tarihlisi (gecikmiş olan dahil). */
export function siradakiTas<T extends TakvimTasi>(taslar: T[], bugun: string) {
  const tas = takvimSirala(taslar).find((t) => !t.tamamlandi);
  return tas ? { tas, ...tasDurumu(tas, bugun) } : null;
}

export function takvimOzeti(taslar: TakvimTasi[], bugun: string) {
  return {
    toplam: taslar.length,
    tamam: taslar.filter((t) => t.tamamlandi).length,
    geciken: taslar.filter((t) => tasDurumu(t, bugun).durum === "gecikti").length,
  };
}

/* Çalışma türüne göre adımlar ve süre payları (toplam 1). Taslak başlıkları
   öğrencinin dilinde yazılır; kayda geçtikten sonra öğrencinin kendi metni
   sayılır ve dil değişince çevrilmez. */
const ADIMLAR_METIN: Record<string, [Record<Dil, string>, number][]> = {
  thesis: [
    [{ tr: "Literatür taraması ve kuramsal çerçeve", en: "Literature review and theoretical framework" }, 0.2],
    [{ tr: "Yöntem bölümü", en: "Methods chapter" }, 0.15],
    [{ tr: "Veri toplama", en: "Data collection" }, 0.2],
    [{ tr: "Analiz ve bulgular", en: "Analysis and findings" }, 0.2],
    [{ tr: "Tartışma ve sonuç", en: "Discussion and conclusion" }, 0.15],
    [{ tr: "Son okuma, kaynakça ve biçim kontrolü", en: "Final read-through, reference list and formatting check" }, 0.1],
  ],
  article: [
    [{ tr: "Giriş ve literatür", en: "Introduction and literature" }, 0.25],
    [{ tr: "Yöntem", en: "Methods" }, 0.15],
    [{ tr: "Bulgular", en: "Results" }, 0.25],
    [{ tr: "Tartışma ve sonuç", en: "Discussion and conclusion" }, 0.2],
    [{ tr: "Dergi kurallarına göre son kontrol", en: "Final check against journal guidelines" }, 0.15],
  ],
  project: [
    [{ tr: "Plan ve kaynak taraması", en: "Plan and source search" }, 0.25],
    [{ tr: "İlk taslak", en: "First draft" }, 0.4],
    [{ tr: "Gözden geçirme", en: "Revision" }, 0.2],
    [{ tr: "Son kontrol", en: "Final check" }, 0.15],
  ],
};

const gunEkle = (gun: string, n: number) => {
  const d = new Date(`${gun.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Bugünden teslime kalan süreyi adımlara paylaştırır. Son adım teslimden
 * iki gün önce biter (danışmana son okuma payı). Teslim yoksa ya da
 * TASLAK_EN_AZ_GUN'den yakınsa boş döner.
 */
export function taslakTakvim(
  projeTuru: string,
  bugun: string,
  teslim: string | null,
  dil: Dil = "tr",
): { baslik: string; hedef_tarih: string }[] {
  if (!teslim) return [];
  const toplamGun = gunFarki(bugun, teslim) - 2;
  if (toplamGun < TASLAK_EN_AZ_GUN - 2) return [];
  const adimlar = ADIMLAR_METIN[projeTuru] ?? ADIMLAR_METIN.project;
  let birikim = 0;
  return adimlar.map(([metin, pay], i) => {
    const baslik = metin[dil];
    birikim += pay;
    /* Son adım tam olarak teslim − 2'ye düşsün; yuvarlama kaydırmasın. */
    const gun = i === adimlar.length - 1 ? toplamGun : Math.round(toplamGun * birikim);
    return { baslik, hedef_tarih: gunEkle(bugun, gun) };
  });
}

/** Formdan gelen taşı doğrular; geçersizse hata metni. */
export function tasGirdisi(
  baslik: unknown,
  tarih: unknown,
  dil: Dil = "tr",
): { baslik: string; hedef_tarih: string } | { hata: string } {
  const en = dil === "en";
  const b = typeof baslik === "string" ? baslik.replace(/\s+/g, " ").trim() : "";
  if (!b) return { hata: en ? "Enter a name for the milestone." : "Kilometre taşının adını yazın." };
  if (b.length > 120) return { hata: en ? "The name can be at most 120 characters." : "Ad en çok 120 karakter olabilir." };
  const t = typeof tarih === "string" ? tarih.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(`${t}T00:00:00Z`)))
    return { hata: en ? "Choose a target date." : "Hedef tarihi seçin." };
  return { baslik: b, hedef_tarih: t };
}

/** "3 gün kaldı", "bugün", "2 gün gecikti", "tamamlandı" (en: "3 days left", "today", …) */
export function kalanMetni(durum: TasDurumu, kalanGun: number, dil: Dil = "tr") {
  if (dil === "en") {
    if (durum === "tamam") return "completed";
    if (kalanGun === 0) return "today";
    const n = Math.abs(kalanGun);
    const gun = `${n} ${n === 1 ? "day" : "days"}`;
    return kalanGun > 0 ? `${gun} left` : `${gun} overdue`;
  }
  if (durum === "tamam") return "tamamlandı";
  if (kalanGun === 0) return "bugün";
  return kalanGun > 0 ? `${kalanGun} gün kaldı` : `${-kalanGun} gün gecikti`;
}
