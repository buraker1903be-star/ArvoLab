/*
  GÜVENLİK BAŞLIKLARI (Phase 2, 04.11.2026). next.config.ts her yanıta
  buradakileri ekler. Saf modül: test edilebilsin ve yapılandırma dosyası
  karar mantığı taşımasın diye.

  Eskiden hiçbir güvenlik başlığı yoktu (Phase 1 denetimi): başka bir site
  paneli görünmez bir çerçevede açıp kullanıcıya düğme tıklatabilirdi
  (clickjacking) — paylaşım bağlantısı oluşturmak, belge silmek, yöneticide
  kullanıcı kapatmak gibi tek tıklık işlemler.

  İKİ KATMAN:
  1. ZORLANAN: kırma riski olmayanlar. Çerçeveye alınma yasağı
     (frame-ancestors + X-Frame-Options; uygulamanın kendisi hiç iframe
     kullanmıyor), eklenti nesnesi yok (object-src), <base> ile adres
     kaçırma yok (base-uri), MIME tahmini yok (nosniff), HSTS, kamera/
     mikrofon/konum kapalı. Pano (kopyala düğmeleri) bilerek açık.
  2. YALNIZCA RAPOR (Content-Security-Policy-Report-Only): betik, bağlantı,
     resim ve form hedefleri. Hiçbir şeyi ENGELLEMEZ; ihlal tarayıcıdan
     /api/csp-raporu'na bildirilir ve sunucu günlüğüne düşer. Neden hemen
     zorlanmıyor: kart formu PayTR'nin adresine doğrudan gönderiliyor ve o
     adres ArvoOS'tan geliyor (önceden bilinmiyor); eksik yazılan tek bir
     alan adı ödemeyi SESSİZCE kırardı. Canlıda bir süre rapor toplanıp
     liste doğrulandıktan sonra bu politika zorlanana taşınır.

  'unsafe-inline' betikte gerekli: Next'in sayfa verisini taşıyan satır içi
  betikleri ve tema betiği (app/layout.tsx) var. Nonce tabanlı CSP bütün
  sayfaları dinamik çizime zorlar; ayrı bir karar konusu.
*/

export type Baslik = { key: string; value: string };

function supabaseKaynaklari(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return [];
  try {
    const adres = new URL(supabaseUrl);
    // Gerçek zamanlı kanal (bildirimler) wss üzerinden aynı makineye bağlanır.
    return [adres.origin, `wss://${adres.host}`];
  } catch {
    return [];
  }
}

export function zorlananCsp(): string {
  return ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"].join("; ");
}

export function raporCsp(secenek: { supabaseUrl?: string; gelistirme: boolean; raporAdresi: string }): string {
  const supabase = supabaseKaynaklari(secenek.supabaseUrl);
  const yonergeler: [string, string[]][] = [
    ["default-src", ["'self'"]],
    // Geliştirme sunucusunun anında yenileme betikleri eval kullanıyor.
    ["script-src", ["'self'", "'unsafe-inline'", ...(secenek.gelistirme ? ["'unsafe-eval'"] : [])]],
    // Editör ve kütüphaneler stil özniteliği yazıyor (Tiptap, sayfalama).
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // Belgedeki resimler: depo imzalı adresleri (Supabase) ve kullanıcının yapıştırdığı https resimleri.
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", ["'self'", ...supabase, ...(secenek.gelistirme ? ["ws:"] : [])]],
    ["worker-src", ["'self'", "blob:"]],
    ["frame-src", ["'none'"]],
    // Kart formu PayTR'ye doğrudan gönderiliyor; adresi ArvoOS'tan geliyor.
    ["form-action", ["'self'", "https:"]],
    ["frame-ancestors", ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["report-uri", [secenek.raporAdresi]],
  ];
  return yonergeler.map(([ad, degerler]) => `${ad} ${degerler.join(" ")}`).join("; ");
}

export function guvenlikBasliklari(secenek: { supabaseUrl?: string; gelistirme: boolean }): Baslik[] {
  return [
    { key: "Content-Security-Policy", value: zorlananCsp() },
    { key: "Content-Security-Policy-Report-Only", value: raporCsp({ ...secenek, raporAdresi: "/api/csp-raporu" }) },
    // Eski tarayıcılar frame-ancestors'u tanımıyor.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Paylaşım sayfası kendi meta etiketiyle no-referrer kullanıyor; o daha sıkı olduğu için geçerli kalır.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
    // Ön yükleme listesi (preload) bilerek yok: geri alınması aylar sürüyor.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ];
}
