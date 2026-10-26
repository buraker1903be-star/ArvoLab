/*
  Çalışmalarım listesinin öğrenci gözüyle iki kararı (26.10.2026).

  Saf modül; testi tests/unit/calisma-karti.test.ts.
*/

/*
  Arama, durum, sorumlu ve sıralama filtreleri: personelde her zaman
  (onlarca çalışmayı yönetiyorlar), öğrencide yalnızca listenin gerçekten
  aranacak kadar uzun olduğunda. Tek tezi olan öğrenciye dört filtre
  kutusu, tek kartın üstünde bir form doldurtuyor gibi duruyordu.
*/
export const FILTRE_ESIGI = 4;

export function filtrelerGorunsun(calismaSayisi: number, personel: boolean): boolean {
  return personel || calismaSayisi >= FILTRE_ESIGI;
}

export type KartIlerlemesi = { yuzde: number; etiket: string; ipucu: string };

/*
  KARTTAKİ YÜZDE GERÇEK YAZIMDAN. Eskiden "ilerleme" alanı elle
  giriliyordu ve kimse güncellemediği için yanıltıyordu: ekranda
  "Revizyonda" yazan çalışmanın yanında %100 duruyordu. Kılavuzun sayfa
  sınırı biliniyorsa yazılan kelimenin hedefe oranı gösteriliyor.

  Hedef yoksa elle girilen değer yalnızca personel bir değer GİRDİYSE
  (sıfırdan büyükse) ve "ilerleme" diye adlandırılarak gösteriliyor;
  hiçbiri yoksa yüzde hiç çizilmiyor — uydurma bir yüzde, yüzdesiz
  karttan kötüdür.
*/
export function kartIlerlemesi(girdi: {
  kelime: number | null;
  hedefKelime: number | null;
  elleIlerleme: number | null;
}): KartIlerlemesi | null {
  if (girdi.hedefKelime && girdi.hedefKelime > 0) {
    const yuzde = Math.min(100, Math.round(((girdi.kelime ?? 0) / girdi.hedefKelime) * 100));
    return {
      yuzde,
      etiket: "yazıldı",
      ipucu: `Kılavuzun sayfa sınırına göre ~${girdi.hedefKelime.toLocaleString("tr-TR")} kelimelik hedefin %${yuzde}'i`,
    };
  }
  if (girdi.elleIlerleme && girdi.elleIlerleme > 0) {
    const yuzde = Math.min(100, Math.max(0, Math.round(girdi.elleIlerleme)));
    return { yuzde, etiket: "ilerleme", ipucu: "Çalışma bilgilerinde girilen ilerleme" };
  }
  return null;
}
