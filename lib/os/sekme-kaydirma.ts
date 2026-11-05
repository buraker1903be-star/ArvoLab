/*
  ETKİN SEKMENİN GÖRÜNÜR KALMASI (Signature OS, Makale Aşama 1, 05.11.2026).

  Çalışma sekmeleri (Özet · Yazım · Kanıt · Etik · Makale) telefonda yatay
  kayan bir şeritte. Eskiden şerit hep en solda açılıyordu: 390 pikselde
  Makale sekmesindeyken etkin sekme "Maka…" diye kesik görünüyor,
  kullanıcı hangi sekmede olduğunu şeritten okuyamıyordu.

  Karar: etkin sekme şeride zaten tamamen sığıyorsa şerit KIPIRDAMAZ
  (Özet sekmesindeyken şerit sola yaslı kalır); sığmıyorsa sekme şeridin
  ortasına getirilir, şeridin iki ucunun dışına taşmadan. Saf modül;
  testi tests/unit/sekme-kaydirma.test.ts.
*/
export function sekmeKaydirmasi(olcu: {
  /** Şeridin görünen genişliği (clientWidth). */
  serit: number;
  /** Şeridin içeriğinin toplam genişliği (scrollWidth). */
  icerik: number;
  /** Şeridin şu anki kaydırması (scrollLeft). */
  kaydirma: number;
  /** Etkin sekmenin şerit içindeki sol kenarı (offsetLeft). */
  sol: number;
  /** Etkin sekmenin genişliği (offsetWidth). */
  genislik: number;
}): number {
  const { serit, icerik, kaydirma, sol, genislik } = olcu;
  const enCok = Math.max(0, icerik - serit);
  if (sol >= kaydirma && sol + genislik <= kaydirma + serit) return kaydirma;
  const orta = sol - (serit - genislik) / 2;
  return Math.round(Math.min(enCok, Math.max(0, orta)));
}
