/*
  YAZIM ARAÇ ÇUBUĞUNUN DARALMASI (UX S3+S4, 07.11.2026). Saf modül;
  testi tests/unit/arac-cubugu.test.ts. Kullanan: manuscript-editor.tsx.

  ESKİ HATA: çubuk tek satırda yatay kayıyordu, kaydırma çubuğu gizliydi
  ve masaüstünde kaydığını söyleyen hiçbir işaret yoktu. Sağ panel
  açıkken 1440 pikselde "Belge" menüsü ve Odak modu, 1280'de atıf ve
  Ekle de görünür alanın dışında kalıyordu. Düğmeler fareli masaüstünde
  34×32 pikseldi; 40×40 hedefine büyütmek çubuğu ~100 piksel uzatıp
  taşmayı kötüleştirirdi. İkisi birlikte çözülüyor.

  KARAR: her grubun bir önceliği var. Sığmadığında EN DÜŞÜK öncelikli
  grup (eşitlikte sağdaki) çubuktan çıkar ve "⋯" (Belge) menüsünün
  başına taşınır; "⋯" hiç çıkmaz. Atıf ve temel biçim en son çıkar.
  Gruplar tek tek taşınır, düğme düğme değil: kullanıcı aynı aileyi
  (liste düğmeleri, hizalama) tek yerde bulur.
*/

export type AracGrubuAnahtari = "geri" | "yazi" | "bicim" | "ust" | "stil" | "liste" | "paragraf" | "ekle" | "atif" | "odak";

/** Çubuktaki sırayla; öncelik büyüdükçe çubukta daha uzun kalır. */
export const ARAC_GRUPLARI: readonly { anahtar: AracGrubuAnahtari; oncelik: number }[] = [
  { anahtar: "geri", oncelik: 7 },
  { anahtar: "yazi", oncelik: 1 },
  { anahtar: "bicim", oncelik: 9 },
  { anahtar: "ust", oncelik: 2 },
  { anahtar: "stil", oncelik: 6 },
  { anahtar: "liste", oncelik: 5 },
  { anahtar: "paragraf", oncelik: 3 },
  { anahtar: "ekle", oncelik: 4 },
  { anahtar: "atif", oncelik: 10 },
  { anahtar: "odak", oncelik: 2 },
];

/**
 * Sığmayan grupları seçer. `gruplar` çubuktaki sırayla, her biri ölçülmüş
 * genişliğiyle (aradaki boşluk dahil); `sabit` hep çubukta kalan "⋯"
 * grubunun genişliği. Dönen liste çubuktaki sırayla.
 */
export function gizlenecekGruplar(
  gruplar: readonly { anahtar: AracGrubuAnahtari; oncelik: number; genislik: number }[],
  kullanilabilir: number,
  sabit: number,
): AracGrubuAnahtari[] {
  let toplam = sabit + gruplar.reduce((t, g) => t + g.genislik, 0);
  const sira = gruplar
    .map((g, i) => ({ ...g, i }))
    .sort((a, b) => a.oncelik - b.oncelik || b.i - a.i);
  const gizli = new Set<AracGrubuAnahtari>();
  for (const g of sira) {
    if (toplam <= kullanilabilir) break;
    gizli.add(g.anahtar);
    toplam -= g.genislik;
  }
  return gruplar.filter((g) => gizli.has(g.anahtar)).map((g) => g.anahtar);
}
