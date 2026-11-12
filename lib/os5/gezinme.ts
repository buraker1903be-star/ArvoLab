/*
  SIGNATURE OS 5 — KABUK GEZİNMESİNİN SAF KARARLARI (Phase 3, 12.11.2026).

  Gezinme bileşeni (app/dashboard/_components/os-gezinme.tsx) React'e
  bağlı; burada yalnızca "bu alt menü açık mı" ve "kayıtlı tercih ne
  diyor" kararları durur ki test üretimle aynı kodu sınasın.

  Liste, roller ve etkin uygulama kararı burada DEĞİL: onlar
  lib/os/uygulamalar.ts'te kaldı (tek liste kuralı). Bu modül yalnızca
  sunum durumunu yönetir; kimin neyi göreceğine karar vermez.
*/

/** "Diğer" grubunun kayıtlı açık/kapalı tercihi (tarayıcıda, kişiye özel). */
export const DIGER_GRUBU_ANAHTARI = "arvolab.gezinme.diger";

/** Kayıtlı değer: "1" açık, "0" kapalı; başka her şey "tercih yok". */
export function kayitliTercih(deger: string | null | undefined): boolean | null {
  if (deger === "1") return true;
  if (deger === "0") return false;
  return null;
}

export const tercihDegeri = (acik: boolean) => (acik ? "1" : "0");

/*
  Alt menü açık mı:
   1. Etkin sayfa grubun içindeyse AÇIK. Kullanıcı bulunduğu sayfayı
      gezinmede görmeli; kapalı bir grubun içinde kalan "etkin" işareti
      görünmez olurdu. Bu oturumda elle kapattıysa (secim === false)
      saygı gösterilir; sayfa değişince seçim sıfırlanır (bileşende).
   2. Bu oturumdaki seçim.
   3. Kayıtlı tercih.
   4. Varsayılan.
*/
export function grupAcikMi({
  secim,
  etkinIcinde,
  kayitli,
  varsayilan,
}: {
  secim: boolean | null;
  etkinIcinde: boolean;
  kayitli: boolean | null;
  varsayilan: boolean;
}): boolean {
  if (secim !== null) return secim;
  if (etkinIcinde) return true;
  if (kayitli !== null) return kayitli;
  return varsayilan;
}
