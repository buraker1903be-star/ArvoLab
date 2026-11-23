/*
  KAYNAKÇA BULGULARININ SATIRLARI (23.11.2026).

  Kart eskiden yalnızca KATEGORİ ve ADET gösteriyordu: "Biçim uyarısı
  olan künye: 2". Öğrenci hangi künyenin, neden uyarı aldığını görmek
  için sonuç penceresini açmak zorundaydı. Burada denetimin kendi
  kaydından (parsed_references, cross_check, academicVerification, tyk)
  künye/atıf metni ile GERÇEK uyarı metni birlikte çıkarılıyor.

  AYNI KÜNYENİN uyarıları TEK satırda toplanıyor: üç uyarısı olan bir
  künye üç satır olarak sayılınca ekran, denetimin saymadığı bir
  "bulgu sayısı" uyduruyordu. Satır sayısı bir TOPLAM DEĞİLDİR; toplam
  lib/kaynakca-ozeti.ts'ten gelir.

  Eski kayıtlarda ayrıntı olmayabilir (ör. dizin doğrulaması listesi
  boş ama "bulunamayan" sayısı var). O zaman kategori için satır
  üretilmez; ekran kategori+adet satırına düşer ve ayrıntı için sonuç
  penceresine yollar.

  Saf modül; testi tests/unit/kaynakca-bulgulari.test.ts.
*/
import type { KategoriAnahtari } from "@/lib/kaynakca-ozeti";

export interface BulguSatiri {
  anahtar: KategoriAnahtari;
  /** Künye ya da atıf metni (ham). */
  metin: string;
  /** Bu künyeye/atfa ait gerçek uyarılar. */
  uyarilar: string[];
}

export interface BulguGirdisi {
  references?: { raw?: string; issues?: { message?: string; severity?: string }[] }[];
  crossCheck?: { referencesWithoutCitation?: { raw?: string }[]; citationsWithoutReference?: { raw?: string }[] };
  academicVerification?: { reference?: string; status?: string }[];
  tyk?: { atif?: string; aciklama?: string }[] | null;
}

/** Kategori ağırlığı: düzeltilmesi zorunlu olan başta, geçici arıza sonda. */
const AGIRLIK: Record<KategoriAnahtari, number> = {
  bicimHatali: 0,
  karsiliksizAtif: 1,
  bicimUyarili: 2,
  atifsizKaynak: 3,
  bulunamayan: 4,
  kilavuzAtifi: 5,
  ulasilamayan: 6,
};

/** Dizin doğrulamasının bu metinler için verdiği hüküm. */
const dizinDurumu = (g: BulguGirdisi, durum: string): string[] =>
  (g.academicVerification ?? []).filter((d) => d.status === durum && d.reference).map((d) => String(d.reference));

export function bulguSatirlari(g: BulguGirdisi, metinler: { atifsiz: string; karsiliksiz: string; bulunamayan: string; ulasilamayan: string }): BulguSatiri[] {
  const satirlar: BulguSatiri[] = [];
  for (const r of g.references ?? []) {
    const uyarilar = (r.issues ?? []).map((i) => String(i.message ?? "")).filter(Boolean);
    if (!uyarilar.length || !r.raw) continue;
    const hatali = (r.issues ?? []).some((i) => i.severity === "error");
    satirlar.push({ anahtar: hatali ? "bicimHatali" : "bicimUyarili", metin: r.raw, uyarilar });
  }
  for (const a of g.crossCheck?.citationsWithoutReference ?? []) {
    if (a.raw) satirlar.push({ anahtar: "karsiliksizAtif", metin: a.raw, uyarilar: [metinler.karsiliksiz] });
  }
  for (const k of g.crossCheck?.referencesWithoutCitation ?? []) {
    if (k.raw) satirlar.push({ anahtar: "atifsizKaynak", metin: k.raw, uyarilar: [metinler.atifsiz] });
  }
  for (const metin of dizinDurumu(g, "not_found")) satirlar.push({ anahtar: "bulunamayan", metin, uyarilar: [metinler.bulunamayan] });
  for (const metin of dizinDurumu(g, "ulasilamadi")) satirlar.push({ anahtar: "ulasilamayan", metin, uyarilar: [metinler.ulasilamayan] });
  for (const t of g.tyk ?? []) {
    if (t.atif) satirlar.push({ anahtar: "kilavuzAtifi", metin: t.atif, uyarilar: [String(t.aciklama ?? "")].filter(Boolean) });
  }
  return satirlar.sort((a, b) => AGIRLIK[a.anahtar] - AGIRLIK[b.anahtar]);
}

/**
 * Bulgunun KARARLI anahtarı: adrese konup sonuç ekranında aynı
 * künyeyi/atfı bulmak için. Ham metin adrese sığmayacak kadar uzun ve
 * değişken; sıra numarası ise denetim yeniden çalıştırılınca kayıyor.
 * FNV-1a: saf, sunucuda ve tarayıcıda aynı sonucu veriyor.
 */
export function bulguAnahtari(metin: string): string {
  const düz = metin.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
  let h = 0x811c9dc5;
  for (let i = 0; i < düz.length; i += 1) {
    h ^= düz.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Bir kategorinin ayrıntısı var mı? Yoksa ekran kategori+adet satırına düşer. */
export function ayrintiVar(satirlar: BulguSatiri[], anahtar: KategoriAnahtari): boolean {
  return satirlar.some((s) => s.anahtar === anahtar);
}
