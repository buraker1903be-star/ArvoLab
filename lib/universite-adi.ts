/*
  Üniversite adının karşılaştırma anahtarı.

  Aynı gövde üç yerde ayrı ayrı duruyordu: kılavuz keşfi
  (normalizeTurkish), YÖK dizini eşleştirmesi (normalize) ve şimdi toplu
  kılavuz ekleme. Üçünün ayrışması, kullanıcının panele yazdığı adın
  keşfin bulduğu adla eşleşmemesi demekti — aynı üniversite iki kayıt
  olurdu.

  Türkçe'ye özgü iki dikkat noktası:
   * NFKD ayrıştırması "İ" harfini "I" + birleşen nokta yapıyor; nokta
     atılınca "I" kalıyor. "Ü", "Ö", "Ç", "Ğ", "Ş" de böyle sadeleşiyor.
   * Noktasız "ı" birleşen işaret taşımadığı için ayrıştırmayla
     sadeleşmiyor; elle "i"ye çevriliyor. Yapılmazsa sonraki [^a-zA-Z0-9]
     süzgeci onu ATAR ve "Ağrı" → "AGR" olur.

  Saf modül; testi tests/unit/universite-adi.test.ts.
*/
export function universiteAnahtari(ad: string): string {
  return ad
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

/** Ada göre eşleşen kaydı bulur; yoksa null. Tahmin YAPMAZ. */
export function universiteBul<T extends { name: string }>(universiteler: T[], ad: string): T | null {
  const anahtar = universiteAnahtari(ad);
  if (!anahtar) return null;
  return universiteler.find((universite) => universiteAnahtari(universite.name) === anahtar) ?? null;
}
