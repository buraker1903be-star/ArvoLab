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

/*
  İki liste kabul edilir: kişisel Çalışmalarım ve Yönetim'deki kurum listesi
  (lib/yonetim.ts). Eskiden yalnızca ilki kabul ediliyordu; personel Yönetim'den
  bir öğrencinin çalışmasını açıp "dön"e basınca kişisel listesine düşüyor,
  süzgeci ve seçimi kayboluyor, öğrencinin çalışması da orada görünmüyordu
  (kod incelemesi, PR #113).
*/
const LISTE_YOLU = /^\/dashboard\/(?:editor|yonetim\/calismalar)(\?[^#\s]*)?$/;

/** Saklanan adres listenin kendisi mi? Değilse varsayılan liste. */
export function listeAdresiOku(deger: string | null | undefined): string {
  if (!deger) return LISTE_VARSAYILAN;
  // Yalnızca listenin kendi yolu ve sorgusu — alt yol (bir çalışma) ya da başka site değil.
  if (!LISTE_YOLU.test(deger)) return LISTE_VARSAYILAN;
  return deger;
}

/** "Dön" bağlantısının adı: Yönetim listesine dönerken "Çalışmalarıma" demez. */
export function listeDonusEtiketi(adres: string): { tr: string; en: string } {
  return adres.startsWith("/dashboard/yonetim/")
    ? { tr: "Yönetim listesine dön", en: "Back to the management list" }
    : { tr: "Çalışmalarıma dön", en: "Back to my works" };
}

/** Kaydırma konumu: sonlu, negatif olmayan bir sayı; bozuksa 0. */
export function listeKonumuOku(deger: string | null | undefined): number {
  const n = Number(deger);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
