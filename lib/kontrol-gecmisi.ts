/*
  KILAVUZ VE KAYNAKÇA KONTROLÜ GEÇMİŞİ (26.10.2026, migration
  20261026202222). Her çalıştırma yazim_kontrolleri'ne bir satır;
  editör son kaydı açılışta gösteriyor, öncekiler pencerede listeleniyor.

  Yapı sorunları TARAYICIDA hesaplanıyor (lib/structure-check.ts) ve
  sunucuya istemciden geliyor. Kendi çalışmasının kaydı olduğu için
  güvenlik sınırı değil; yine de olduğu gibi yazılmıyor: biçimi tutmayan
  öğe atılıyor, sayı ve uzunluk sınırlanıyor — bozuk bir istemci geçmişe
  okunamayan bir kayıt bırakmasın.

  Saf modül; testi tests/unit/kontrol-gecmisi.test.ts.
*/
import { SORUN_TURLERI, type StructureIssue } from "@/lib/structure-check";

export type KontrolKaydiOzeti = {
  id: string;
  createdAt: string;
  hata: number;
  uyari: number;
  eksikBolum: number;
  kelime: number;
};

const EN_FAZLA_SORUN = 80;
const TURLER = new Set(SORUN_TURLERI.map((t) => t.tur));
const EYLEMLER = new Set([
  "sort-references",
  "fix-reference-punctuation",
  "convert-reference-lists",
  "apply-paragraph-format",
  "apply-hanging-indent",
  "clear-manual-text-format",
]);

const kirp = (d: unknown, n: number) => (typeof d === "string" && d.trim() ? d.slice(0, n) : undefined);

export function yapiSorunlariniTemizle(girdi: unknown): StructureIssue[] {
  if (!Array.isArray(girdi)) return [];
  const sonuc: StructureIssue[] = [];
  for (const oge of girdi.slice(0, EN_FAZLA_SORUN)) {
    if (!oge || typeof oge !== "object") continue;
    const o = oge as Record<string, unknown>;
    const message = kirp(o.message, 600);
    if (!message || (o.tone !== "danger" && o.tone !== "warning")) continue;
    const sorun: StructureIssue = { tone: o.tone, message };
    const target = kirp(o.target, 200);
    if (target) sorun.target = target;
    if (typeof o.kategori === "string" && TURLER.has(o.kategori as never)) sorun.kategori = o.kategori as StructureIssue["kategori"];
    if (typeof o.action === "string" && EYLEMLER.has(o.action)) sorun.action = o.action as StructureIssue["action"];
    sonuc.push(sorun);
  }
  return sonuc;
}

/** Listede görünen özet: hata/uyarı yapı sorunlarından, eksik bölüm kılavuz uygunluğundan. */
export function kontrolSayilari(yapi: StructureIssue[], eksikBolum: number, kelime: number) {
  const hata = yapi.filter((s) => s.tone === "danger").length;
  return { hata, uyari: yapi.length - hata, eksik_bolum: Math.max(0, eksikBolum), kelime: Math.max(0, Math.round(kelime)) };
}

export function ozetOku(satir: {
  id: string;
  created_at: string;
  hata: number;
  uyari: number;
  eksik_bolum: number;
  kelime: number;
}): KontrolKaydiOzeti {
  return {
    id: satir.id,
    createdAt: satir.created_at,
    hata: satir.hata,
    uyari: satir.uyari,
    eksikBolum: satir.eksik_bolum,
    kelime: satir.kelime,
  };
}
