import type { EkranSinifi } from "@/lib/os/kirilimlar";

/*
  YAZIM EKRANININ SAĞ PANELİ (Signature OS Phase 2, 04.11.2026).

  Eskiden yazım ekranının sağında iki ayrı panel vardı: "İncele" paneli
  (ızgaranın bir sütunu, yedi kart) ve yazım asistanı (ekranın sağına
  sabitlenmiş, İncele panelinin ÜSTÜNE binen ayrı bir kutu). İkisi aynı
  anda açılınca asistan inceleme kartlarını örtüyordu; "Teslim kontrolü"
  başlıkta, kılavuz kartı panelde, kaynaklar bir pencerede duruyordu.

  Artık TEK panel ve dört görünüm. Görünümler yeni özellik değil, var
  olan araçların ihtiyaca göre gruplanması:
    asistan   — yazım asistanı (sohbette yazar, ekleme kullanıcının)
    inceleme  — canlı yapı denetimi, ölçüler, yazım ipuçları, yazarlık, yorumlar
    kaynaklar — atıf ekle, cümleye kaynak bul, metinde atıfı olmayan kaynaklar
    teslim    — kılavuz, bölümler, ön sayfalar, içindekiler, teslim listesi,
                kılavuz ve kaynakça kontrolü

  Bu dosya saf: hangi görünümün açılacağı ve panelin ekran boyuna göre
  nasıl davranacağı burada karar verilir, birim testi sınar
  (tests/unit/yazim-yan-panel.test.ts).
*/

export const PANEL_GORUNUMLERI = ["asistan", "inceleme", "kaynaklar", "teslim"] as const;
export type PanelGorunumu = (typeof PANEL_GORUNUMLERI)[number];

/** Depodan ya da adresten gelen ham değer → görünüm. Bilinmeyen her şey varsayılan. */
export function gorunumOku(ham: unknown, varsayilan: PanelGorunumu = "inceleme"): PanelGorunumu {
  return (PANEL_GORUNUMLERI as readonly unknown[]).includes(ham) ? (ham as PanelGorunumu) : varsayilan;
}

/*
  PANEL NASIL DURUR:
  - masaüstü: belgenin yanında bir SÜTUN. Açık/kapalı tercihi tarayıcıda
    hatırlanır (varsayılan açık: kılavuz ve yapı uyarıları orada).
  - tablet ve telefon: belgenin ÜSTÜNE açılan sayfa. Hatırlanan tercih
    burada okunmaz: masaüstünde açık bırakılan panel, tablette her
    açılışta belgeyi örterdi. Yalnızca bu oturumda kullanıcı açtıysa açık.
*/
export type PanelBicimi = "sutun" | "sayfa";

export function panelBicimi(ekran: EkranSinifi): PanelBicimi {
  return ekran === "masaustu" ? "sutun" : "sayfa";
}

export function panelAcikMi(girdi: { ekran: EkranSinifi; tercih: boolean; oturumdaAcildi: boolean | null }): boolean {
  if (panelBicimi(girdi.ekran) === "sutun") return girdi.oturumdaAcildi ?? girdi.tercih;
  return girdi.oturumdaAcildi ?? false;
}

/*
  Açılış isteği (adres değişkenleri ve sayfa içi düğmeler):
  "?asistan=1" asistanı, "?teslim=<madde>" teslim görünümünü açar. İkisi
  birden gelirse teslim kazanır: ana sayfadaki "eksik madde" bağlantısı
  belirli bir maddeyi gösteriyor, asistan genel bir davet.
*/
export function acilisGorunumu(girdi: { asistan: boolean; teslim: string | null }): PanelGorunumu | null {
  if (girdi.teslim) return "teslim";
  if (girdi.asistan) return "asistan";
  return null;
}
