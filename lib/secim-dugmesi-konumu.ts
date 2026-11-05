/*
  SEÇİMDEKİ ARVO AI DÜĞMESİNİN KONUMU (Signature OS 4.3, 05.11.2026). Saf
  modül; testi tests/unit/secim-dugmesi-konumu.test.ts. Kullanan:
  app/dashboard/editor/[id]/write/secim-ai.tsx.

  Kural: düğme SEÇİMİ ÖRTMEZ. Seçimin son satırının altına açılır; altta
  yer yoksa (ekranın dibi, telefonda klavye açıkken) ilk satırının
  üstüne. İkisine de sığmıyorsa (seçim ekrandan uzun) ekranın altına
  yapışır — seçimin ortasına konmaz; öğrenci seçimi okurken düğme
  yazının üstünde durmamalı. Yatayda ekran kenarından en az KENAR kadar
  içeride kalır.

  Görünür alan pencereden dar olabilir: editörün yapışkan araç çubuğu
  üstte, telefonda durum çubuğu altta. `ekran.ust` ve `ekran.yukseklik`
  bu alanı verir; düğme araç çubuğunun altına girmez (telefonda seçim
  araç çubuğunun altına kaydığında düğme çubuğun üstüne biniyordu).
*/
export type SecimKutusu = { ust: number; alt: number; sol: number };
export type Boyut = { genislik: number; yukseklik: number };
export type Alan = Boyut & { ust?: number };

const BOSLUK = 6;
const KENAR = 8;

export function secimDugmesiKonumu(secim: SecimKutusu, dugme: Boyut, ekran: Alan): { x: number; y: number; yukari: boolean } {
  const x = Math.round(Math.max(KENAR, Math.min(secim.sol, ekran.genislik - dugme.genislik - KENAR)));
  const ust = (ekran.ust ?? 0) + KENAR;
  const enAlt = ekran.yukseklik - dugme.yukseklik - KENAR;
  const asagi = secim.alt + BOSLUK;
  if (asagi >= ust && asagi <= enAlt) return { x, y: Math.round(asagi), yukari: false };
  const yukari = secim.ust - BOSLUK - dugme.yukseklik;
  if (yukari >= ust && yukari <= enAlt) return { x, y: Math.round(yukari), yukari: true };
  // Seçim görünür alanın dışına taşıyor: alanın içine, seçime yakın kenara.
  return { x, y: Math.round(asagi < ust ? ust : enAlt), yukari: false };
}
