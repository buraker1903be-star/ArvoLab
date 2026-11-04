/*
  Belge başına EN YENİ kaydın kimliği (Phase 2, 04.11.2026).

  Belgeler sayfası her denetlenmiş belge için iki ayrı sorgu atıyordu
  (son orijinallik taraması, son asistan geri bildirimi): 10 belgede 20
  sorgu. Artık her tablo için iki sorgu var: önce yalnızca hafif sütunlar
  (id, document_id, created_at) bütün belgeler için, sonra bu fonksiyonun
  seçtiği en yeni satırların tamamı. Ağır sütun (taramanın eşleşme
  listesi) yalnızca gösterilecek satır için iniyor.

  Sıralamaya güvenilmiyor: satırlar hangi sırayla gelirse gelsin en büyük
  created_at kazanır; eşitlikte ilk görülen kalır.
*/
export type ZamanliSatir = { id: string; document_id: string; created_at: string };

export function belgeBasinaEnYeni(satirlar: readonly ZamanliSatir[]): Map<string, string> {
  const en = new Map<string, ZamanliSatir>();
  for (const satir of satirlar) {
    const mevcut = en.get(satir.document_id);
    if (!mevcut || satir.created_at > mevcut.created_at) en.set(satir.document_id, satir);
  }
  return new Map([...en].map(([belge, satir]) => [belge, satir.id]));
}
