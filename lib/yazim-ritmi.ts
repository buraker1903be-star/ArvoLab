/*
  Öğrencinin yazım ritmi: gün gün NET yazılan kelime.

  Veritabanı her gün için o günün son kelime sayısını ve pencerenin
  öncesindeki son sayıyı (taban) veriyor (public.yazim_ritmi). Net
  yazım = günün son sayısı − bir önceki bilinen sayı. Sürüm alınmayan
  gün 0'dır; sayı düşmüşse (bölüm silindi, taşındı) net eksidir ve öyle
  gösterilir — "bu hafta +1.200" derken silineni saklamak öğrenciyi
  yanıltırdı.

  Bugünün sayısı ayrıca verilebiliyor (müsveddenin anlık kelime sayısı):
  otomatik sürüm en fazla 10 dakikada bir alınıyor, son yazılanlar
  henüz bir sürümde olmayabilir.

  Saf modül; testi tests/unit/yazim-ritmi.test.ts.
*/

import { YEREL, type Dil } from "./dil";
import { TR } from "./tr-time";

const GUN_MS = 24 * 60 * 60 * 1000;
const gunAnahtari = (an: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TR, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(an));

export type RitimSatiri = { gun: string; kelime: number };
export type RitimGunu = { anahtar: string; net: number; gun: string; baslik: string; bugun: boolean };
export type YazimRitmi = {
  gunler: RitimGunu[];
  /** Son 7 günün net toplamı. */
  buHafta: number;
  /** Pencerede yazı yazılan (net > 0) gün sayısı. */
  aktifGun: number;
  /** Bugün ya da dün biten, arka arkaya yazılan gün sayısı. */
  seri: number;
  enBuyuk: number;
};

/* Etiketler İngilizcede de Türkiye gününe göre: gün anahtarlarıyla aynı sınır. */
export function yazimRitmi(
  satirlar: RitimSatiri[],
  simdi: number,
  gun = 14,
  bugunKelime?: number | null,
  dil: Dil = "tr",
): YazimRitmi {
  const sirali = [...satirlar].sort((a, b) => a.gun.localeCompare(b.gun));
  const sonSayi = new Map(sirali.map((s) => [s.gun, Number(s.kelime) || 0]));
  const anahtarlar = Array.from({ length: gun }, (_, i) => gunAnahtari(simdi - (gun - 1 - i) * GUN_MS));
  const bugunAnahtar = anahtarlar[gun - 1];
  if (bugunKelime !== null && bugunKelime !== undefined) sonSayi.set(bugunAnahtar, bugunKelime);

  // Pencereden önceki son bilinen sayı: taban.
  let onceki: number | null = null;
  for (const s of sirali) if (s.gun < anahtarlar[0]) onceki = Number(s.kelime) || 0;

  const gunler: RitimGunu[] = anahtarlar.map((anahtar, i) => {
    const an = simdi - (gun - 1 - i) * GUN_MS;
    const sayi = sonSayi.get(anahtar);
    let net = 0;
    if (sayi !== undefined) {
      net = onceki === null ? 0 : sayi - onceki;
      onceki = sayi;
    }
    return {
      anahtar,
      net,
      gun: new Intl.DateTimeFormat(YEREL[dil], { timeZone: TR, day: "numeric" }).format(new Date(an)),
      baslik: new Intl.DateTimeFormat(YEREL[dil], { timeZone: TR, weekday: "short", day: "numeric", month: "short" }).format(new Date(an)),
      bugun: i === gun - 1,
    };
  });

  const buHafta = gunler.slice(-7).reduce((t, g) => t + g.net, 0);
  const aktifGun = gunler.filter((g) => g.net > 0).length;
  /* Seri bugünden geriye sayılır; bugün henüz yazılmadıysa dünden başlar
     (sabah açan öğrenciye "seri bitti" demek haksızlık olurdu). */
  let seri = 0;
  let i = gunler.length - 1;
  if (gunler[i].net <= 0) i -= 1;
  for (; i >= 0 && gunler[i].net > 0; i -= 1) seri += 1;

  return { gunler, buHafta, aktifGun, seri, enBuyuk: Math.max(1, ...gunler.map((g) => Math.abs(g.net))) };
}
