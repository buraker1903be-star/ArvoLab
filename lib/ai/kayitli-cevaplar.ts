import { yazimCozumle, type YazimGorevi } from "./yazim-asistani";

/*
  KAYITLI AI CEVAPLARI (19.11.2026, kabul turu 2; onaylı prototipin "Kayıtlı"
  sekmesi). Yazım asistanının her tamamlanmış çalışması zaten
  ai_assistant_runs'a yazılıyor (lib/ai/kayit.ts); sohbet ise yalnızca panelin
  belleğindeydi ve panel kapanınca kayboluyordu. Kayıtlı sekme YENİ bir kayıt
  tutmaz: aynı satırları geri okur.

  Saf modül (testi tests/unit/kayitli-cevaplar.test.ts): satırı gösterilecek
  cevaba çevirir. Çözümleme asistanın kendi çözümleyicisiyle (yazimCozumle):
  kaydedilen ham çıktı, cevap üretildiği gün nasıl okunduysa öyle okunur.
  Okunamayan satır listeden düşer; yarım bir cevabı belgeye eklenebilir gibi
  göstermek, doğrulanmamış metni öğrencinin önüne koymak olurdu.
*/

export type KayitliCevap = {
  id: string;
  tarih: string;
  gorev: YazimGorevi | null;
  /** Kullanıcının isteği; 19.11.2026'dan önceki kayıtlarda yok (istem metninin içinde kalmıştı). */
  istek: string | null;
  yanit: string;
  metin: string;
};

const GOREVLER: YazimGorevi[] = ["serbest", "devam", "paragraf", "akademik", "kisalt", "genislet", "anahat", "tamamla"];

export type KayitSatiri = { id: string; created_at: string; output: string | null; findings: unknown };

export function kayitliCevapOku(satir: KayitSatiri): KayitliCevap | null {
  if (!satir?.id || !satir.output) return null;
  const cozum = yazimCozumle(satir.output);
  if (!cozum) return null;
  const bulgular = satir.findings && typeof satir.findings === "object" ? (satir.findings as Record<string, unknown>) : {};
  const gorev = GOREVLER.includes(bulgular.gorev as YazimGorevi) ? (bulgular.gorev as YazimGorevi) : null;
  const istek = typeof bulgular.istek === "string" && bulgular.istek.trim() ? bulgular.istek.trim().slice(0, 300) : null;
  return { id: satir.id, tarih: satir.created_at, gorev, istek, yanit: cozum.yanit, metin: cozum.metin };
}

/** Bir sayfadaki kayıt sayısı. Sayfalama tarihe göre (önceki sayfanın son kaydından eskiler). */
export const KAYITLI_SAYFA = 20;
