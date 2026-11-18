/*
  ÇALIŞMALARIMA DÖNÜŞ (19.11.2026, bağlamlı çalışma alanı). Çalışma
  gezinmesindeki "Çalışmalarıma dön" kullanıcıyı listeye, AYRILDIĞI
  hâliyle götürür: süzgeç ve arama adresin sorgu değişkenlerinde (?q=,
  ?durum=…), kaydırma konumu ayrıca. Eskiden yazım ekranının geri düğmesi
  çalışmanın özetine gidiyordu; listeye dönen öğrenci süzgecini ve
  listede nerede olduğunu yeniden kuruyordu.

  Saf modül: tarayıcıya dokunan kısım app/dashboard/_components/
  liste-donusu.tsx. Saklanan adres güvenilir bir kaynaktan gelmez
  (sessionStorage'a sayfadaki herhangi bir betik yazabilir); yalnızca
  Çalışmalarım listesinin kendi yolu kabul edilir, yoksa "dön" bağlantısı
  başka bir yere ya da başka bir siteye götürebilirdi.
*/

export const LISTE_ADRESI_ANAHTARI = "arvolab.calismalar.adres";
export const LISTE_KONUMU_ANAHTARI = "arvolab.calismalar.konum";
export const LISTE_VARSAYILAN = "/dashboard/editor";

/** Saklanan adres listenin kendisi mi? Değilse varsayılan liste. */
export function listeAdresiOku(deger: string | null | undefined): string {
  if (!deger) return LISTE_VARSAYILAN;
  // Yalnızca "/dashboard/editor" ya da "/dashboard/editor?..." — alt yol (bir çalışma) ya da başka site değil.
  if (!/^\/dashboard\/editor(\?[^#\s]*)?$/.test(deger)) return LISTE_VARSAYILAN;
  return deger;
}

/** Kaydırma konumu: sonlu, negatif olmayan bir sayı; bozuksa 0. */
export function listeKonumuOku(deger: string | null | undefined): number {
  const n = Number(deger);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
