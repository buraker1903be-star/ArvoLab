/*
  AÇILIR PENCERENİN KONUMU (29.10.2026). Saf modül; testi
  tests/unit/acilir-konum.test.ts. Kullanan: app/dashboard/_components/acilir-konum.ts.

  Seçici (secici.tsx) ve tarih seçici (tarih-secici.tsx) ilk sürümde
  düğmenin altına `position: absolute` ile açılıyordu. Ana sayfanın tek
  ekran kartı (`overflow: hidden`), çekmece gövdesi (`overflow-y: auto`)
  ve çalışma kartı (`overflow: hidden`) pencereyi KIRPIYORDU: teslim
  tarihi takviminin alt yarısı görünmüyor ya da kartın içinde kayan bir
  kutuya dönüşüyordu. Pencere artık tarayıcının üst katmanında (popover)
  ve ekrana göre konumlanıyor; konumu bu fonksiyon veriyor.
*/

export interface Kutu {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
}

export interface Konum {
  x: number;
  y: number;
  /** Düğmenin üstüne mi açıldı (aşağıda yer yoksa). */
  yukari: boolean;
}

/**
 * Pencere düğmenin altına, sol kenarı hizalı açılır. Altta yer yoksa ve
 * üstte daha çok yer varsa üste; sağa taşıyorsa sağ kenarı düğmeyle
 * hizalanır; hiçbir durumda ekranın `kenar` piksel içine girmez.
 */
export function acilirKonum(
  dugme: Kutu,
  pencere: { genislik: number; yukseklik: number },
  ekran: { genislik: number; yukseklik: number },
  bosluk = 6,
  kenar = 8,
): Konum {
  const altta = ekran.yukseklik - dugme.bottom - bosluk - kenar;
  const ustte = dugme.top - bosluk - kenar;
  const yukari = pencere.yukseklik > altta && ustte > altta;
  let y = yukari ? dugme.top - bosluk - pencere.yukseklik : dugme.bottom + bosluk;
  y = Math.max(kenar, Math.min(y, ekran.yukseklik - kenar - pencere.yukseklik));

  let x = dugme.left;
  if (x + pencere.genislik > ekran.genislik - kenar) x = dugme.right - pencere.genislik;
  x = Math.max(kenar, Math.min(x, ekran.genislik - kenar - pencere.genislik));
  return { x: Math.round(x), y: Math.round(y), yukari };
}
