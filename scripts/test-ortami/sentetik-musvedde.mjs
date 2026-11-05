/*
  SENTETİK MÜSVEDDE SATIRI (05.11.2026).

  Eskiden sentetik veri betiği örnek tezi `plain_text: ""` ve
  `word_count: 0` ile yazıyordu ("kelime sayısı ilk kayıtta hesaplanır").
  Çalışmalarım listesi kelime sayısını yalnızca bu sütundan okuduğu için
  tez "0 kelime" görünüyordu; düzelmesi editörün açılışta belgeye dokunmadan
  kaydetmesine (hayalet kayıt) bağlıydı. O kayıt kaldırıldı
  (lib/tiptap-belge-degisti.ts), yani artık sütunlar ilk yazımda doğru
  olmalı.

  Değerler editörün kaydıyla AYNI fonksiyonlardan gelir
  (app/actions/manuscript.ts → lib/tiptap-text.ts): ayrı bir sayım,
  liste ile editörün iki farklı sayı göstermesinin en kolay yolu olurdu.

  lib/tiptap-text.ts "@/…" takma adıyla içe aktarıyor; betik düz `node`
  ile çalıştığı için çözümleyici (tests/register.mjs, birim testleriyle
  aynı) DİNAMİK içe aktarmadan ÖNCE kurulur. Statik içe aktarma olsaydı
  takma ad, çözümleyici kurulmadan çözülmeye çalışılırdı.
  Testi: tests/unit/sentetik-musvedde.test.ts.
*/
let araclar = null;

async function metinAraclari() {
  if (!araclar) {
    await import("../../tests/register.mjs");
    araclar = await import("../../lib/tiptap-text.ts");
  }
  return araclar;
}

/** Yalnızca eklenecek satırın alanları; veritabanına dokunmaz. */
export async function musveddeSatiri(icerik, { projeId, sahipId }) {
  const { countWords, extractPlainText } = await metinAraclari();
  return {
    project_id: projeId,
    content: icerik,
    plain_text: extractPlainText(icerik),
    word_count: countWords(icerik),
    updated_by: sahipId,
  };
}
