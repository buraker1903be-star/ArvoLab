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

/* Çalışma türüne göre adımlar ve süre payları (toplam 1). */
const ADIMLAR: Record<string, [string, number][]> = {
  thesis: [
    ["Literatür taraması ve kuramsal çerçeve", 0.2],
    ["Yöntem bölümü", 0.15],
    ["Veri toplama", 0.2],
    ["Analiz ve bulgular", 0.2],
    ["Tartışma ve sonuç", 0.15],
    ["Son okuma, kaynakça ve biçim kontrolü", 0.1],
  ],
  article: [
    ["Giriş ve literatür", 0.25],
    ["Yöntem", 0.15],
    ["Bulgular", 0.25],
    ["Tartışma ve sonuç", 0.2],
    ["Dergi kurallarına göre son kontrol", 0.15],
  ],
  project: [
    ["Plan ve kaynak taraması", 0.25],
    ["İlk taslak", 0.4],
    ["Gözden geçirme", 0.2],
    ["Son kontrol", 0.15],
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
export function taslakTakvim(projeTuru: string, bugun: string, teslim: string | null): { baslik: string; hedef_tarih: string }[] {
  if (!teslim) return [];
  const toplamGun = gunFarki(bugun, teslim) - 2;
  if (toplamGun < TASLAK_EN_AZ_GUN - 2) return [];
  const adimlar = ADIMLAR[projeTuru] ?? ADIMLAR.project;
  let birikim = 0;
  return adimlar.map(([baslik, pay], i) => {
    birikim += pay;
    /* Son adım tam olarak teslim − 2'ye düşsün; yuvarlama kaydırmasın. */
    const gun = i === adimlar.length - 1 ? toplamGun : Math.round(toplamGun * birikim);
    return { baslik, hedef_tarih: gunEkle(bugun, gun) };
  });
}

/** Formdan gelen taşı doğrular; geçersizse hata metni. */
export function tasGirdisi(baslik: unknown, tarih: unknown): { baslik: string; hedef_tarih: string } | { hata: string } {
  const b = typeof baslik === "string" ? baslik.replace(/\s+/g, " ").trim() : "";
  if (!b) return { hata: "Kilometre taşının adını yazın." };
  if (b.length > 120) return { hata: "Ad en çok 120 karakter olabilir." };
  const t = typeof tarih === "string" ? tarih.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(`${t}T00:00:00Z`))) return { hata: "Hedef tarihi seçin." };
  return { baslik: b, hedef_tarih: t };
}

/** "3 gün kaldı", "bugün", "2 gün gecikti", "tamamlandı" */
export function kalanMetni(durum: TasDurumu, kalanGun: number) {
  if (durum === "tamam") return "tamamlandı";
  if (kalanGun === 0) return "bugün";
  return kalanGun > 0 ? `${kalanGun} gün kaldı` : `${-kalanGun} gün gecikti`;
}
