/*
  Sunucuda çizilen tarih ve saatler. Vercel UTC'de çalışır; timeZone
  verilmeden toLocaleString("tr-TR") saatleri 3 saat geri gösteriyordu
  (14:00'te açılan destek talebi 11:00 görünüyordu) ve gece 00:00–03:00
  arasında günü bir gün geri yazıyordu. Teslim tarihi hesabı için
  lib/due-date.ts kullanılır. Saf modül; testi tests/unit/tr-time.test.ts.
*/
export const TR = "Europe/Istanbul";

const bicim = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("tr-TR", { timeZone: TR, ...opts });

/** "20.09.2026 14:05" */
export const trTarihSaat = (value: string | number | Date) =>
  bicim({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

/** "20.09.2026" */
export const trTarih = (value: string | number | Date) =>
  bicim({ day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));

/** "20 Eylül 2026" */
export const trUzunTarih = (value: string | number | Date) =>
  bicim({ day: "numeric", month: "long", year: "numeric" }).format(new Date(value));

/** Türkiye gününe göre iki tarih arasındaki tam gün farkı (saat farkından etkilenmez). */
export function trGunFarki(a: string | number | Date, b: string | number | Date) {
  const gun = (value: string | number | Date) => bicim({ year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  return Math.round((Date.parse(gun(a).split(".").reverse().join("-")) - Date.parse(gun(b).split(".").reverse().join("-"))) / 86_400_000);
}
