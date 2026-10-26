/*
  Çalışmanın yapılacakları: saf yardımcılar (app/actions/yapilacaklar.ts).
  Bilerek "use server" DEĞİL (AGENTS.md). Testi tests/unit/yapilacaklar.test.ts.
*/

export type Yapilacak = { id: string; baslik: string; aciklama: string | null; olusturuldu: string };

/* Veritabanı sınırlarıyla aynı (migration 20261026101921). Asistan bulgusu
   zaten 60/400 ile sınırlı; elle gelen girdi de taşmasın. */
export const BASLIK_SINIRI = 120;
export const ACIKLAMA_SINIRI = 600;

/** Girdiyi kırpar ve boşlukları sadeleştirir; başlık boşsa null. */
export function yapilacakGirdisi(girdi: { baslik?: string | null; aciklama?: string | null }) {
  const sade = (metin: string | null | undefined, sinir: number) => (metin ?? "").replace(/\s+/g, " ").trim().slice(0, sinir);
  const baslik = sade(girdi.baslik, BASLIK_SINIRI);
  if (!baslik) return null;
  const aciklama = sade(girdi.aciklama, ACIKLAMA_SINIRI);
  return { baslik, aciklama: aciklama || null };
}
