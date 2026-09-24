/*
  Kurum adlarını EŞLEŞTİRMEK için katlama.

  Neden gerekli: JavaScript'te de Postgres'te de büyük/küçük harf dönüşümü
  Türkçenin i/ı çiftinde tökezler.

    "İ".toLowerCase()                  → "i̇"  (i + birleşik nokta, İKİ karakter)
    "İSTANBUL".toLowerCase() === "istanbul"  → false
    /istanbul/i.test("İSTANBUL")             → false

  Postgres'in lower()'ı İ'yi tek karakterli "i" yapıyor, orası daha iyi; ama
  I ile ı hâlâ ayrışıyor:

    lower('IŞIK ÜNİVERSİTESİ') = lower('Işık Üniversitesi')  → FALSE

  Işık ve Iğdır gerçek üniversiteler. Dizinde adı büyük harfle ("IŞIK
  ÜNİVERSİTESİ"), elle yazarken karışık ("Işık Üniversitesi") geçiyor ve
  ikisi eşleşmiyordu.

  Katlama i/ı/İ/I'yı tek harfe indirir, şapkaları atar, noktalamayı boşluğa
  çevirir. YALNIZCA KARŞILAŞTIRMA İÇİN: gösterilecek ad her zaman dizindeki
  kanonik addır, katlanmış hâli değil.

  Saf modül; testi tests/unit/turkce-ad.test.ts.
*/

/** Karşılaştırma anahtarı. Aynı kurumun iki yazımı aynı anahtarı verir. */
export function turkceKatla(ad: string | null | undefined): string {
  return (ad ?? "")
    /*
      İ/ı önce ASCII karşılığına çekiliyor. Sonra yapılsaydı NFKD "İ"yi
      "I + birleşik nokta"ya ayırır, nokta silinir ve yine "I" kalırdı —
      ama "ı" hiç dokunulmadan kalır ve iki yazım ayrışmaya devam ederdi.
    */
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    // Kalan şapkalar (ü, ö, ç, ş, ğ) ayrıştırılıp atılıyor.
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // Artık saf ASCII; toLowerCase güvenli.
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** İki kurum adı aynı kurumu mu gösteriyor? */
export const ayniKurum = (a: string | null | undefined, b: string | null | undefined) =>
  turkceKatla(a) !== "" && turkceKatla(a) === turkceKatla(b);
