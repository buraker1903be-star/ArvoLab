/*
  /tasarim BİLEŞEN VİTRİNİ — kim görebilir (Signature OS 5, Phase 1).

  Vitrin bir kabul aracıdır, ürün rotası değil: yeni bileşenler Preview'da
  açık/koyu tema ve üç genişlikte görülsün diye var. Production'da sunucu
  tarafında gerçek 404 döner (kurum sahibinin şartı, 12.11.2026).

  Karar iki kaynaktan: çalışma anındaki VERCEL_ENV ve derlemede gömülen
  ARVOLAB_DAGITIM_ORTAMI (next.config.ts). Biri "production" diyorsa
  kapalı. Yalnızca çalışma anına bakmak yetmezdi: Production'da VERCEL_ENV
  çalışma anında gelmezse vitrin açık kalırdı — ortam güvenliğinde
  (lib/supabase/ortam-guvenligi.ts) aynı nedenle derleme yedeği var.
*/
export function vitrinAcikMi(env: { VERCEL_ENV?: string; ARVOLAB_DAGITIM_ORTAMI?: string }): boolean {
  const uretim = (deger?: string) => deger?.trim().toLowerCase() === "production";
  return !(uretim(env.VERCEL_ENV) || uretim(env.ARVOLAB_DAGITIM_ORTAMI));
}
