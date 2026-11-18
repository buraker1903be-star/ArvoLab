/*
  PDF GÖRÜNTÜLEYİCİ VE YAN PANEL SINIRLARI (16.11.2026, Yazım Stüdyosu).
  Saf modül; testi tests/unit/pdf-goruntu.test.ts.

  Yakınlaştırma %50–%300: altı okunmaz, üstü tek sayfayı yüzlerce
  megapiksellik kanvasa çevirip telefonda belleği tüketir (görüntüleyici
  ayrıca kanvas alanını da sınırlıyor).

  Panel genişliği: editör hiçbir zaman okunamayacak kadar daralmamalı
  (en az EDITOR_EN_DAR), PDF de bir sayfa sütununu gösterebilmeli (en az
  PANEL_EN_DAR). Kayıtlı tercih ekran küçülünce de bu sınırlara çekilir;
  yoksa geniş ekranda kaydedilen 900 px dizüstünde editörü yok ederdi.
*/

export const OLCEK_EN_AZ = 0.5;
export const OLCEK_EN_COK = 3;
export const OLCEK_ADIM = 0.25;

export function olcekSinirla(olcek: number): number {
  if (!Number.isFinite(olcek)) return 1;
  return Math.round(Math.min(OLCEK_EN_COK, Math.max(OLCEK_EN_AZ, olcek)) * 100) / 100;
}

export const PANEL_EN_DAR = 360;
export const PANEL_EN_GENIS = 960;
export const PANEL_VARSAYILAN = 520;
export const EDITOR_EN_DAR = 420;

/** Panelin genişliği: kaplanan alan (editör + ayırıcı + panel) içinde iki tarafın da en az sınırları korunur. */
export function panelGenisligiSinirla(istenen: number, kapGenisligi: number): number {
  const ust = Math.max(PANEL_EN_DAR, Math.min(PANEL_EN_GENIS, kapGenisligi - EDITOR_EN_DAR));
  const deger = Number.isFinite(istenen) ? istenen : PANEL_VARSAYILAN;
  return Math.round(Math.min(ust, Math.max(PANEL_EN_DAR, deger)));
}
