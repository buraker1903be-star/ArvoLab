import type { KaynakPdfSatiri } from "@/lib/kaynak-pdf";

/*
  MAKALE BUL'DA PDF DURUMU (M6/M7, 20.11.2026). Beş durum ayrı ayrı:
    - aranmadi: öğrenci henüz "PDF'yi oku" demedi. Arama sonuçlarının her
      biri için PDF İNDİRİLMEZ (yirmi sonuç = yirmi dış indirme ve yirmi
      depo yazımı; öğrenci çoğunu okumayacak).
    - araniyor: istek uçuşta.
    - bulundu: PDF depoda, çekmece açılır.
    - bulunamadi: dizin açık erişim konumu göstermedi ya da DOI yok —
      KALICI bir hüküm.
    - servis_hatasi: dizine/yayıncıya ulaşılamadı, depoya yazılamadı ya da
      işlem düştü — GEÇİCİ; "bulunamadı" denmez, tekrar denenebilir.
  "Bulunamadı" ile "servis hatası"nı karıştırmak öğrenciye yanlış bilgi
  verir: geçici bir arızada "bu makalenin PDF'i yok" demiş oluruz.
  Saf modül: tests/unit/makale-pdf-durumu.test.ts.
*/
export type MakalePdfDurumu = "aranmadi" | "araniyor" | "bulundu" | "bulunamadi" | "servis_hatasi";

export type PdfAramaSonucu = { error?: string; satirlar?: Pick<KaynakPdfSatiri, "id" | "durum" | "kaynak_adres">[]; sorunlar?: Record<string, number> };

/** kaynakPdfleriniBul cevabından durum, açılacak PDF ve (varsa) yayıncı adresi. */
export function pdfAramaDurumu(sonuc: PdfAramaSonucu | null | undefined): { durum: MakalePdfDurumu; pdfId: string | null; adres: string | null } {
  if (!sonuc || sonuc.error) return { durum: "servis_hatasi", pdfId: null, adres: null };
  const satir = sonuc.satirlar?.[0];
  if (!satir) {
    /* Satır dönmedi: süre bütçesi doldu ya da hazır PDF zaten vardı (çağıran
       önce mevcut PDF'e bakar). Hüküm verilmez: geçici sayılır. */
    return { durum: "servis_hatasi", pdfId: null, adres: null };
  }
  if (satir.durum === "indirildi" || satir.durum === "yuklendi") return { durum: "bulundu", pdfId: satir.id, adres: satir.kaynak_adres };
  if (satir.durum === "bulunamadi" || satir.durum === "kayit_yok") return { durum: "bulunamadi", pdfId: null, adres: null };
  // erisilemedi: konum var ama indirilemedi (yayıncı engeli, ağ, depo) — geçici; adres "Kaynağa git" için.
  return { durum: "servis_hatasi", pdfId: null, adres: satir.kaynak_adres };
}

/** APA'ya yakın, PDF kaydının künye anahtarı için yeterli düz künye (yazar listesi, yıl, başlık, dergi, DOI). */
export function aramaKunyesi(k: { baslik: string; yazarlar: string[]; yil: number | null; dergi?: string | null; doi?: string | null }): string {
  const yazar = k.yazarlar.slice(0, 20).join(", ");
  return [yazar ? `${yazar} (${k.yil ?? "t.y."}).` : `(${k.yil ?? "t.y."}).`, `${k.baslik.replace(/\.$/, "")}.`, k.dergi ? `${k.dergi}.` : "", k.doi ? `https://doi.org/${k.doi}` : ""]
    .filter(Boolean)
    .join(" ");
}
