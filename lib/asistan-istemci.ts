/*
  Asistan sunucu işlemini İSTEMCİDEN çağırırken: işlem kendi hatalarını
  `hata` alanıyla döndürüyor, ama işlemin KENDİSİ düşerse (fonksiyon süre
  aşımıyla öldürüldü, bağlantı koptu, sayfa eski bir dağıtımdan açık kaldı)
  çağrı fırlatıyor. Eskiden bu hata panelin hata ekranına gidiyordu: Analiz
  Merkezi'nde yüklenen veri ve hesaplanan sonuçlar kayboluyordu. Analiz
  penceresinin süresi 60 sn, asistan ise genişletilmiş yeniden denemeyle
  45 + 45 sn sürebiliyor; yani bu yol gerçek.
*/
export const ASISTANA_ULASILAMADI =
  "Asistana ulaşılamadı (bağlantı kesildi ya da yanıt çok uzun sürdü). Verileriniz ve sonuçlarınız yerinde; birazdan tekrar deneyin.";

export async function asistanCagir<T extends { hata?: string }>(cagri: () => Promise<T>): Promise<T> {
  try {
    return await cagri();
  } catch (hata) {
    console.error("[asistan] çağrı düştü:", hata);
    return { hata: ASISTANA_ULASILAMADI } as T;
  }
}
