/*
  OTOMATİK ÖNERİNİN İSTEMCİ SINIRI (20.11.2026). Saatlik asistan hakkı
  KULLANICI başına ve tek sayaçtır (lib/ai/erisim.ts, yetenek başına sayaç
  bilerek yok). Otomatik öneri o hakkı sohbetle paylaşıyor: sınırsız
  bırakılsaydı öğrenci bir saat yazınca sohbet asistanını kullanamaz hâle
  gelirdi. Burası ikinci bir sunucu sayacı DEĞİL; yalnızca otomatik yolun
  kendi isteğini seyreltir: iki otomatik istek arası en az `aralikMs`, bir
  saatte en çok `saatlik`. Elle istek (Alt+/) bu sınıra girmez.
  Saf modül: tests/unit/oneri-siniri.test.ts.
*/
export const OTOMATIK_SINIR = { aralikMs: 12_000, saatlik: 12 } as const;
const SAAT = 3_600_000;

export type SinirKarari = { izin: true; zamanlar: number[] } | { izin: false; neden: "aralik" | "saatlik"; zamanlar: number[] };

export function otomatikIzin(zamanlar: readonly number[], simdi: number, sinir: { aralikMs: number; saatlik: number } = OTOMATIK_SINIR): SinirKarari {
  const pencere = zamanlar.filter((z) => Number.isFinite(z) && z > simdi - SAAT && z <= simdi).sort((a, b) => a - b);
  const son = pencere.at(-1);
  if (son !== undefined && simdi - son < sinir.aralikMs) return { izin: false, neden: "aralik", zamanlar: pencere };
  if (pencere.length >= sinir.saatlik) return { izin: false, neden: "saatlik", zamanlar: pencere };
  return { izin: true, zamanlar: [...pencere, simdi] };
}
