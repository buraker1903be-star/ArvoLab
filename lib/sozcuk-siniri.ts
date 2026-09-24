/*
  Türkçe metinde sözcük sınırı.

  JavaScript'te `\b` ASCII tabanlıdır: "Ş", "ç", "ı", "ğ" sözcük karakteri
  sayılmaz, bu yüzden bu harflerin ÖNÜNDE (ya da ardında) sınır OLUŞMAZ —
  ne satır başında ne boşluktan sonra. Türkçe bir üründe sonucu sessiz
  kaçaklardır: kalıp "çalışıyor" görünür, yalnızca Türkçe harfle başlayan
  sözcüklerde hiç eşleşmez. Canlıda üç ayrı yerde bulundu (24.09.2026):

    - Künye denetimi "Şahin, B. (2021)" uydurmasını hiç yakalamıyordu
      (Özdemir, Çelik, Ünal, İnce de öyle) — lib/ai/bulgu.ts.
    - Kılavuz kapağındaki "Şubat 2024" tarihi okunamıyordu; on iki ayın
      yalnızca biri Türkçe harfle başlıyor ve tam o biri kaçıyordu.
    - "Yılmaz vd. (2020)" künyesinde "vd." yazar sanılıyordu.

  Aynı önbakış kodda üç ayrı yerde üç farklı yazımla duruyordu; dördüncüsü
  yazıldığında yine yanlış yazılacaktı. Tek tanım burada.

  Rakam da sınır sayılıyor: "Tablo 31" içindeki "Tablo 3" eşleşmemeli.

  Saf modül; testi tests/unit/sozcuk-siniri.test.ts.
*/

/** Sözcüğün ÖNÜNDE harf ya da rakam yok. `u` bayrağı şart. */
export const SOZCUK_BASI = "(?<![\\p{L}\\p{N}])";

/** Sözcüğün ARDINDA harf ya da rakam yok. `u` bayrağı şart. */
export const SOZCUK_SONU = "(?![\\p{L}\\p{N}])";

/** Gövdeyi iki sınır arasına alır: sozcuk("tez|çalışma") → tam sözcük eşleşmesi. */
export const sozcuk = (govde: string) => `${SOZCUK_BASI}(?:${govde})${SOZCUK_SONU}`;
