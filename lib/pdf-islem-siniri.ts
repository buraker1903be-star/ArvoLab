/*
  KAYNAK PDF İŞLEME SINIRI (17.11.2026, RELEASE CLOSURE 05). Saf modül;
  testi tests/unit/pdf-islem-siniri.test.ts. Sayacı lib/kaynak-pdf-okuma.ts
  çağırır.

  NEDEN: Görüntüleyicide seçilen pasajın doğrulanması (kaynakSecimiDogrula)
  ve kaynak sohbeti (kaynaklaSohbet) PDF'i depodan indirip (en çok 20 MB)
  metnini çıkarıyor. 16.11.2026'ya kadar kullanıcı başına bir sınır yoktu:
  oturumu olan biri sunucuyu bir PDF çözümleme aracına çevirebilirdi.

  ASİSTAN HAKKINDAN AYRI: Bu sayaç sunucunun İŞLEM maliyetini sınırlar,
  ücretli asistan hakkını (lib/ai/erisim.ts, "ai-asistan:" anahtarı) değil.
  Reddedilen bir seçim asistan hakkı yakmaz; yalnızca bu sayaçtan, ve
  yalnızca PDF gerçekten çözümlendiyse (önbellekte değilse) bir birim düşer.

  SAYAÇ: public.rate_limit_hit (migration 20260924100002; Production'da
  17.11.2026'da salt okunur katalog sorgusuyla doğrulandı: imza, gövde ve
  yalnızca service_role yetkisi depodakiyle aynı). rate_limit_take'e
  bilerek bağlanmadı: Production'da yok.

  ARIZADA KAPALI: Asistan kapısı sayaç okunamazsa akışı durdurmuyor (geçici
  arıza kullanıcıyı dışarıda bırakmasın). Burada tersi: sayaç yoksa ya da
  cevabı okunamıyorsa pahalı işlem YAPILMAZ ve kullanıcıya nedeni söylenir.
  Önbellekteki PDF ise sayaçtan bağımsız okunmaya devam eder (çözümleme yok).
*/

export const PDF_ISLEM_VARSAYILAN = 60;
export const PDF_ISLEM_PENCERE = "1 hour";

/** Saatlik hak. PDF_ISLEM_SAATLIK yalnızca kabul testinde düşürmek için; geçersiz değer varsayılana döner. */
export function pdfIslemHakki(ortam: string | undefined): number {
  const sayi = Number(ortam);
  return Number.isInteger(sayi) && sayi >= 1 && sayi <= 1000 ? sayi : PDF_ISLEM_VARSAYILAN;
}

/** Sayaç anahtarı; kullanıcı kimliği yalnızca sunucuda (tablo service_role'e açık). */
export function pdfIslemAnahtari(kullaniciId: string): string {
  return `pdf-islem:${kullaniciId}`;
}

export type PdfIslemKarari = "izin" | "doldu" | "ariza";

/**
 * rate_limit_hit cevabından karar. Yalnızca açıkça `true` izin verir,
 * yalnızca açıkça `false` "doldu" der; geri kalan her şey (sayaç yok, hata,
 * beklenmeyen şekil) arızadır ve işlem yapılmaz.
 */
export function pdfIslemKarari(g: { sayacVar: boolean; hata?: unknown; veri?: unknown }): PdfIslemKarari {
  if (!g.sayacVar || g.hata) return "ariza";
  if (g.veri === true) return "izin";
  if (g.veri === false) return "doldu";
  return "ariza";
}
