/*
  Deneme süresi bitmeden önce hatırlatma: kime, ne zaman.

  Bugüne kadar deneme süresi SESSİZCE bitiyordu. Kullanıcı bunu ancak
  tezini kaydetmeye çalışıp "aboneliğiniz sona erdi" görünce öğreniyordu —
  yani üründen en kötü anda kopuyordu. Uyarı, bitişten önce gelmeli.

  Saf modül; testi tests/unit/deneme-hatirlatma.test.ts.
*/

/** Bitişe kaç gün kala hatırlatılır. */
export const HATIRLATMA_GUNU = 3;
/** Tek çalıştırmada en fazla kaç kişiye bakılır (cron'un işi sınırlı kalsın). */
export const TEK_SEFERDE = 200;

export interface AbonelikSatiri {
  user_id: string;
  status: string;
  trial_ends_at: string | null;
  deneme_hatirlatildi_at: string | null;
}

export interface Hatirlatilacak {
  userId: string;
  kalanGun: number;
}

const GUN = 24 * 60 * 60 * 1000;

/**
 * Sorgunun bakacağı zaman aralığı: ŞİMDİ ile bitişe HATIRLATMA_GUNU kalan an
 * arasında biten denemeler.
 *
 * Alt sınır hayati. Eskiden yalnızca üst sınır vardı ("bitişi 3 günden yakın")
 * ve sorgu bitişe en yakından başlayarak TEK_SEFERDE satır alıyordu. En yakın
 * bitişler ise süresi ÇOKTAN DOLMUŞ olanlar: denemesini kullanmayıp bir daha
 * uğramamış kişiler. Onların satırı 'trialing' olarak ve hatırlatma işareti
 * boş olarak sonsuza kadar duruyor — ayna ancak kullanıcı ürüne girince
 * tazeleniyor.
 *
 * Yani bu küme her bırakan kişiyle büyüyor ve TEK_SEFERDE'yi aştığı gün
 * pencere tamamen onlarla doluyor: hatırlatma yazılımı hiç kimseye posta
 * göndermemeye başlıyor. Üstelik sessizce — uç nokta "aday: 0" diyor, yani
 * "bugün hatırlatılacak kimse yoktu" gibi görünüyor. Dönüşümü koruyan tek
 * mekanizma böyle ölürdü.
 */
export function hatirlatmaPenceresi(simdi = Date.now()) {
  return {
    altSinir: new Date(simdi).toISOString(),
    ustSinir: new Date(simdi + HATIRLATMA_GUNU * GUN).toISOString(),
  };
}

/**
 * Hatırlatılacak aboneler. Sıra bitişe en yakın olandan başlar: sınıra
 * takılan varsa en acil olanlar elenmemiş olur.
 */
export function hatirlatilacaklar(satirlar: AbonelikSatiri[], simdi = Date.now()): Hatirlatilacak[] {
  const secilenler: (Hatirlatilacak & { biter: number })[] = [];
  for (const satir of satirlar) {
    // Bir kez hatırlatılan bir daha hatırlatılmaz: kimse aynı uyarıyı iki kez almaz.
    if (satir.deneme_hatirlatildi_at) continue;
    if (satir.status !== "trialing" || !satir.trial_ends_at) continue;
    const biter = new Date(satir.trial_ends_at).getTime();
    if (!Number.isFinite(biter)) continue;
    const kalan = biter - simdi;
    /*
      Süresi DOLMUŞ olana "bitiyor" denmez: geç kalmış bir uyarı, yanlış
      bilgi. Bitmiş aboneliği zaten ürünün kendisi söylüyor.
    */
    if (kalan <= 0 || kalan > HATIRLATMA_GUNU * GUN) continue;
    secilenler.push({ userId: satir.user_id, kalanGun: Math.max(1, Math.ceil(kalan / GUN)), biter });
  }
  return secilenler
    .sort((a, b) => a.biter - b.biter)
    .slice(0, TEK_SEFERDE)
    .map(({ userId, kalanGun }) => ({ userId, kalanGun }));
}
