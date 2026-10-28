/*
  Asistan sunucu işlemini İSTEMCİDEN çağırırken: işlem kendi hatalarını
  `hata` alanıyla döndürüyor, ama işlemin KENDİSİ düşerse (fonksiyon süre
  aşımıyla öldürüldü, bağlantı koptu, sayfa eski bir dağıtımdan açık kaldı)
  çağrı fırlatıyor. Eskiden bu hata panelin hata ekranına gidiyordu: Analiz
  Merkezi'nde yüklenen veri ve hesaplanan sonuçlar kayboluyordu. Analiz
  penceresinin süresi 60 sn, asistan ise genişletilmiş yeniden denemeyle
  45 + 45 sn sürebiliyor; yani bu yol gerçek.
*/
import type { Dil, Metin } from "@/lib/dil";

export const ASISTANA_ULASILAMADI_METIN: Metin = {
  tr: "Asistana ulaşılamadı (bağlantı kesildi ya da yanıt çok uzun sürdü). Verileriniz ve sonuçlarınız yerinde; birazdan tekrar deneyin.",
  en: "Could not reach the assistant (the connection dropped or the response took too long). Your data and results are intact; try again shortly.",
};

export const ASISTANA_ULASILAMADI = ASISTANA_ULASILAMADI_METIN.tr;

export async function asistanCagir<T extends { hata?: string }>(cagri: () => Promise<T>, dil: Dil = "tr"): Promise<T> {
  try {
    return await cagri();
  } catch (hata) {
    console.error("[asistan] çağrı düştü:", hata);
    return { hata: ASISTANA_ULASILAMADI_METIN[dil] } as T;
  }
}
