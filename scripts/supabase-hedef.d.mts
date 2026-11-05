/* scripts/supabase-hedef.mjs'in tipleri (birim testi içe aktarıyor). */
export type HedefDenetimiSonucu =
  | { tur: "izin"; hedef: "test" | "uretim"; ref: string | null; kaynak: string; betik: string }
  | { tur: "red"; mesaj: string; ref?: string | null; kaynak?: string; betik?: string };
export function hedefRefOku(argv?: string[], env?: Record<string, string | undefined>): { ref: string | null; kaynak: string };
export function hedefDenetimi(argv?: string[], env?: Record<string, string | undefined>): HedefDenetimiSonucu;
