/*
  AD VE SOYAD: TEK ALANDAN İKİ ALANA (24.11.2026).

  Profilde yıllardır tek bir `full_name` var ve her ekran onu okuyor.
  Ayarlar penceresi adı ve soyadı ayrı soruyor; eski hesaplarda bu iki
  alan BOŞ (migration bilerek backfill yapmıyor).

  Buradaki bölme bir ÖNERİDİR, karar değil. Son kelimeyi soyad saymak
  Türkçede çoğu adda doğru çalışır ama "Ayşe Nur Demir Kaya" gibi çok
  parçalı adlarda yanılır; o yüzden `belirsiz` ile işaretleniyor ve ekran
  kullanıcıya bölünüşü doğrulatıyor. Kaydetme yolu, kullanıcı alanlara
  dokunmadıkça sütunları NULL bırakıyor: yanlış bölünmüş bir ad kalıcı
  olmasın.

  Saf modül; testi tests/unit/profil-adi.test.ts.
*/

export type AdBolumu = {
  ad: string;
  soyad: string;
  /** Bölme bir tahmin mi: iki kelimeden fazlası ya da hiç soyad yok. */
  belirsiz: boolean;
};

/** Arada kalan çoklu boşlukları ve görünmez boşlukları temizler. */
const sadelestir = (metin: string): string => metin.replace(/\s+/g, " ").trim();

/**
 * Tek alandaki adı Ad / Soyad önerisine böler.
 *
 * Tek kelimelik ad soyadsız kalır (uydurma bir soyad üretmek, olmayan
 * bir bilgiyi varmış gibi göstermek olurdu) ve `belirsiz` işaretlenir.
 */
export function adiBol(tamAd: string | null | undefined): AdBolumu {
  const temiz = sadelestir(String(tamAd ?? ""));
  if (!temiz) return { ad: "", soyad: "", belirsiz: false };
  const parcalar = temiz.split(" ");
  if (parcalar.length === 1) return { ad: parcalar[0], soyad: "", belirsiz: true };
  const soyad = parcalar[parcalar.length - 1];
  const ad = parcalar.slice(0, -1).join(" ");
  return { ad, soyad, belirsiz: parcalar.length > 2 };
}

/** Ad ve soyaddan görünen adı kurar (full_name sütununa yazılan değer). */
export function tamAdiKur(ad: string, soyad: string): string {
  return sadelestir(`${sadelestir(ad)} ${sadelestir(soyad)}`);
}

/**
 * Formda gösterilecek değerler: kayıtlı ad/soyad varsa onlar, yoksa
 * full_name'den öneri.
 */
export function formAdlari(profil: {
  ad?: string | null;
  soyad?: string | null;
  full_name?: string | null;
}): AdBolumu {
  const ad = sadelestir(String(profil.ad ?? ""));
  const soyad = sadelestir(String(profil.soyad ?? ""));
  /* Biri bile yazılıysa kayıtlı değerler geçerli; öneriye dönülmez. */
  if (ad || soyad) return { ad, soyad, belirsiz: false };
  return adiBol(profil.full_name);
}

export const AD_EN_AZ = 1;
export const AD_EN_FAZLA = 80;

/** Ad ve soyad birlikte geçerli mi (ikisi de dolu ve sınırlar içinde)? */
export function adlarGecerliMi(ad: string, soyad: string): boolean {
  const a = sadelestir(ad);
  const s = sadelestir(soyad);
  if (a.length < AD_EN_AZ || a.length > AD_EN_FAZLA) return false;
  if (s.length < AD_EN_AZ || s.length > AD_EN_FAZLA) return false;
  /* Görünen ad eskiden en az 2 karakterdi; o sınır korunuyor. */
  return tamAdiKur(a, s).length >= 2;
}
