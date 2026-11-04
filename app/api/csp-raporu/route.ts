/*
  CSP İHLAL RAPORU (Phase 2, 04.11.2026). Tarayıcı, yalnızca-rapor
  politikasına (lib/guvenlik-basliklari.ts) uymayan bir yükleme gördüğünde
  buraya bildirir; politika zorlanmadan önce hangi kaynakların gerçekten
  kullanıldığını canlıda görmek için.

  Oturum istemez (tarayıcı raporu çerezsiz de gönderebilir) ve hiçbir şey
  YAZMAZ: yalnızca sunucu günlüğüne kısaltılmış bir satır düşer. Gövde 8 KB
  ile sınırlı; büyük ya da bozuk gövde sessizce yok sayılır, rapor için
  hata dönmek tarayıcıyı tekrar denemeye itmez ama günlüğü de kirletmez.
*/
const SINIR = 8 * 1024;

export async function POST(istek: Request) {
  const uzunluk = Number(istek.headers.get("content-length") ?? 0);
  if (uzunluk > SINIR) return new Response(null, { status: 204 });
  try {
    const metin = (await istek.text()).slice(0, SINIR);
    const govde = JSON.parse(metin) as { "csp-report"?: Record<string, unknown> };
    const rapor = govde["csp-report"] ?? {};
    console.warn(
      "[csp] ihlal",
      JSON.stringify({
        yonerge: rapor["violated-directive"] ?? rapor["effective-directive"],
        engellenen: rapor["blocked-uri"],
        sayfa: typeof rapor["document-uri"] === "string" ? String(rapor["document-uri"]).split("?")[0] : undefined,
      }).slice(0, 500),
    );
  } catch {
    // Bozuk rapor: yok sayılır.
  }
  return new Response(null, { status: 204 });
}
