/*
  HESAP MENÜSÜNDEKİ "KULLANIM" SATIRI (23.11.2026).

  Kullanıcı kalan hakkını yalnızca Abonelik ve Kredi sayfasına giderek
  görebiliyordu; menüde hiçbir sayı yoktu. Artık menüde, Ayarlar'ın
  hemen üstünde açılır bir satır var.

  SAYI UYDURULMAZ (lib/ai/kredi-ozeti.ts ile aynı ilke). Üç durum
  birbirinden AYRI: sınırsız hak (iç ekip), tükenmiş hak (0 kaldı) ve
  verisi alınamayan hak (ArvoOS'tan bildirilmemiş, okunamamış ya da
  limitsiz kayıt). "0 kredi" yazmak, hakkı olmayanla ölçümü okunamayanı
  aynı göstermek olurdu.

  Saf modül; testi tests/unit/kullanim-ozeti.test.ts.
*/
import type { KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { krediOzeti } from "@/lib/ai/kredi-ozeti";

export type HakDurumu = "sayili" | "sinirsiz" | "tukendi" | "bilinmiyor";

export interface KullanimHakki {
  anahtar: "asistanKredisi" | "denemeHakki";
  durum: HakDurumu;
  /** sayili ve tukendi durumunda kalan; ötekinde null. */
  kalan: number | null;
  /** Toplam hak biliniyorsa; satın alınan bakiye dahil. */
  toplam: number | null;
  /** Aylık hakkın yenileneceği gün (ISO); bilinmiyorsa null. */
  yenilenme: string | null;
}

export interface KullanimGirdisi {
  /** ai_kredi_durumum() satırı; okunamadıysa null. */
  kredi: KrediSatiri | null;
  /** Deneme hakkı (lib/ai/deneme-hakki.ts); denemede değilse null. */
  deneme: { kalan: number; toplam: number } | null;
  /** Dönem sonu / yenilenme günü (lib/access.ts periodEnd). */
  yenilenme: string | null;
}

export function kullanimOzeti(g: KullanimGirdisi): KullanimHakki[] {
  const satirlar: KullanimHakki[] = [];
  const ozet = krediOzeti(g.kredi);
  if (ozet.goster) {
    satirlar.push({
      anahtar: "asistanKredisi",
      durum: ozet.tukendi ? "tukendi" : "sayili",
      kalan: ozet.toplam,
      /* Satın alınan bakiye aylık hakkın üstüne biniyor: toplam ikisinin
         toplamı, yoksa ekranla tutarsız görünürdü. */
      toplam: ozet.aylikLimit + ozet.ekBakiye,
      yenilenme: g.yenilenme,
    });
  } else if (g.kredi?.ic_ekip) {
    satirlar.push({ anahtar: "asistanKredisi", durum: "sinirsiz", kalan: null, toplam: null, yenilenme: null });
  } else {
    /* Okunamadı ya da hak hiç bildirilmedi: sayı yerine durum yazılır. */
    satirlar.push({ anahtar: "asistanKredisi", durum: "bilinmiyor", kalan: null, toplam: null, yenilenme: null });
  }
  if (g.deneme) {
    satirlar.push({
      anahtar: "denemeHakki",
      durum: g.deneme.kalan > 0 ? "sayili" : "tukendi",
      kalan: g.deneme.kalan,
      toplam: g.deneme.toplam,
      yenilenme: null,
    });
  }
  return satirlar;
}

/** Menüdeki başlığın yanındaki kısa özet: ilk sayılı hak. */
export function kisaOzet(satirlar: KullanimHakki[]): KullanimHakki | null {
  return satirlar.find((s) => s.durum === "sayili" || s.durum === "tukendi") ?? satirlar[0] ?? null;
}
