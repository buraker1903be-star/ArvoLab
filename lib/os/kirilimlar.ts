/*
  EKRAN KIRILIMLARI (Phase 3, 04.11.2026). CSS değişkeni medya
  sorgusunda kullanılamadığı için değerler burada; CSS'te
  (os-shell.css, tokens.css açıklaması) aynı sayılar elle yazılır.
  Gezinme üç biçim alır:
    telefon  ≤ 760px   alt çubuk (dört ana uygulama + "Daha fazla")
    tablet   761–1199  dar ray (simge + kısa ad)
    masaüstü ≥ 1200    geniş kenar çubuğu (+ çalışmanın kendi bölümleri)
*/
export const TELEFON_EN_FAZLA = 760;
export const MASAUSTU_EN_AZ = 1200;

export type EkranSinifi = "telefon" | "tablet" | "masaustu";

export function ekranSinifi(genislik: number): EkranSinifi {
  if (genislik <= TELEFON_EN_FAZLA) return "telefon";
  return genislik >= MASAUSTU_EN_AZ ? "masaustu" : "tablet";
}
