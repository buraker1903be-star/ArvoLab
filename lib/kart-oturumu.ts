/*
  Kart ödeme oturumunun çerezi (28.10.2026). lib/kart-odeme.ts'ten ayrı
  tutuldu çünkü Buffer kullanıyor ve kart formu (istemci bileşeni) o
  modülü içe aktarıyor: tarayıcı paketine Node'a özgü kod girmesin.

  Saf modül; testi tests/unit/kart-odeme.test.ts.
*/

import { kartOdemesiOku, type KartOdemesi } from "./kart-odeme";

/*
  ÖDEME OTURUMU ÇEREZİ. card_checkout her çağrıda yeni bir ödeme kaydı
  açıyor; bu yüzden ödeme sunucu İŞLEMİNDE başlatılıyor, sayfa çiziminde
  değil (yenilenen ya da önceden getirilen bir sayfa kayıt üretmesin).
  Kart sayfasının ihtiyacı yanıtın kendisi ve yeniden istenemiyor: kısa
  ömürlü, httpOnly bir çerezde taşınıyor. İçinde kart verisi yok; PayTR'nin
  imzalı belirteci ve gizli alanlar var. Kullanıcı kimliği de yazılıyor:
  ortak bir bilgisayarda başkasının açtığı ödeme sayfası gösterilmesin.
*/
export const KART_CEREZI_YOLU = "/dashboard/abonelik/kart";
export const KART_CEREZI_OMRU = 15 * 60;
/* Tarayıcılar 4 KB'ı aşan çerezi sessizce atıyor; sayfa o zaman nedensiz 404 verirdi. */
export const KART_CEREZI_AZAMI = 3800;

export const kartCereziAdi = (merchantOid: string) => `arvolab_kart_${merchantOid}`;

export function kartOturumuYaz(kullaniciId: string, odeme: KartOdemesi): string {
  return Buffer.from(JSON.stringify({ u: kullaniciId, o: odeme }), "utf8").toString("base64url");
}

export function kartOturumuOku(deger: string | null | undefined, merchantOid: string, kullaniciId: string): KartOdemesi | null {
  if (!deger) return null;
  try {
    const cozulen = JSON.parse(Buffer.from(deger, "base64url").toString("utf8")) as { u?: unknown; o?: unknown };
    if (cozulen.u !== kullaniciId) return null;
    const odeme = kartOdemesiOku(cozulen.o);
    return odeme && odeme.merchantOid === merchantOid ? odeme : null;
  } catch {
    return null;
  }
}
