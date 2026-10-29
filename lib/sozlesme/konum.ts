/*
  SÖZLEŞME ONAYININ YAKLAŞIK KONUMU (29.10.2026) — saf.

  Barındırıcı (Vercel) her isteğe IP'den çıkardığı yaklaşık konumu
  ekliyor: x-vercel-ip-country / -country-region / -city / -latitude /
  -longitude / -timezone. Şehir adı URL kodlu geliyor ("%C4%B0stanbul").
  Başlık yoksa (yerel geliştirme) konum boş kalır; uydurulmaz. Tarayıcıdan
  GPS istenmiyor: gerekçesi migration'da (20261029163058).

  ArvoOS'ta aynı kural lib/sozlesme/delil.ts'te; iki depo arasında ortak
  kod yok.
*/

type Baslik = (ad: string) => string | null;

export type Konum = {
  ulke: string | null;
  bolge: string | null;
  sehir: string | null;
  enlem: number | null;
  boylam: number | null;
  saatDilimi: string | null;
};

const coz = (deger: string | null, sinir: number) => {
  if (!deger) return null;
  let metin = deger;
  try { metin = decodeURIComponent(deger); } catch { /* bozuk kodlama: olduğu gibi */ }
  return metin.trim().slice(0, sinir) || null;
};

const sayi = (deger: string | null, sinir: number) => {
  if (!deger) return null;
  const n = Number(deger);
  return Number.isFinite(n) && Math.abs(n) <= sinir ? n : null;
};

export function konumOku(baslik: Baslik): Konum {
  return {
    ulke: coz(baslik("x-vercel-ip-country"), 10),
    bolge: coz(baslik("x-vercel-ip-country-region"), 100),
    sehir: coz(baslik("x-vercel-ip-city"), 120),
    enlem: sayi(baslik("x-vercel-ip-latitude"), 90),
    boylam: sayi(baslik("x-vercel-ip-longitude"), 180),
    saatDilimi: coz(baslik("x-vercel-ip-timezone"), 60),
  };
}

/** Tek satır: "İstanbul, 34, TR (41.01, 28.97)". Hiçbiri yoksa null. */
export function konumYazisi(k: { ulke: string | null; bolge: string | null; sehir: string | null; enlem: number | string | null; boylam: number | string | null }): string | null {
  const yer = [k.sehir, k.bolge, k.ulke].filter(Boolean).join(", ");
  const koordinat = k.enlem !== null && k.enlem !== undefined && k.boylam !== null && k.boylam !== undefined ? `(${k.enlem}, ${k.boylam})` : "";
  return [yer, koordinat].filter(Boolean).join(" ") || null;
}
