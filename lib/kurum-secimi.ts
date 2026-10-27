/*
  İÇ EKİBİN KURUM SEÇİCİSİ (27.10.2026). Kurucu birden çok kurumun
  sahibi (AkademikMerkez, ArvoOS) ve RLS iç ekibe zaten bütün kurumları
  açıyor; ama ekranlar kurumları ayırmıyordu: Çalışmalarım, Ekip, Destek
  kuyrukları ve ana sayfa iki firmanın kayıtlarını karışık listeliyordu.

  Seçim yalnızca GÖRÜNÜMÜ süzer; yetki değişmez (RLS gerçek rolle).
  Saf modül; sunucu okuması lib/kurum-secimi-sunucu.ts, testi
  tests/unit/kurum-secimi.test.ts.
*/
export const KURUM_CEREZI = "arvolab_kurum";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
  Çerezdeki seçim geçerli mi: iç ekipten değilse, biçim bozuksa ya da
  kurum artık listede yoksa (silinmiş, yanlış ortam) seçim YOK sayılır —
  bütün kurumlar. Eskimiş bir çerez ekranı sessizce boşaltmamalı.
*/
export function kurumSecimi(cerez: string | null | undefined, kurumlar: { id: string }[], icEkip: boolean): string | null {
  if (!icEkip || !cerez || !UUID.test(cerez)) return null;
  return kurumlar.some((k) => k.id === cerez) ? cerez : null;
}

export const kurumKimligiMi = (deger: string) => UUID.test(deger);
