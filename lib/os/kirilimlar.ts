/*
  EKRAN KIRILIMLARI (Phase 3, 04.11.2026). CSS değişkeni medya
  sorgusunda kullanılamadığı için değerler burada; CSS'te
  (os-shell.css, tokens.css açıklaması) aynı sayılar elle yazılır.
  Gezinme üç biçim alır:
    telefon  ≤ 760px   alt çubuk (dört ana uygulama + "Daha fazla")
    tablet   761–1199  dar ray (simge + kısa ad)
    masaüstü ≥ 1200    geniş kenar çubuğu (+ çalışmanın kendi bölümleri)
*/
export const TELEFON_EN_FAZLA = 760;
export const MASAUSTU_EN_AZ = 1200;

export type EkranSinifi = "telefon" | "tablet" | "masaustu";

export function ekranSinifi(genislik: number): EkranSinifi {
  if (genislik <= TELEFON_EN_FAZLA) return "telefon";
  return genislik >= MASAUSTU_EN_AZ ? "masaustu" : "tablet";
}

/*
  SUNUCUDA EKRAN TAHMİNİ (Signature OS 4.2, 05.11.2026). Bazı bileşenler
  ekran sınıfına göre FARKLI öğe çiziyor (veri tablosu telefonda kart
  listesi, sayfa eylemleri telefonda menü). Sunucu ekranı bilemediği için
  hep masaüstü çiziyordu; telefonda hidrasyondan sonra görünüm
  değişiyordu: Kanıt Matrisi sunucu çıktısında tablo (sayfa 719 px),
  hidrasyondan sonra kart listesi (1613 px). Yavaş bağlantıda kullanıcı
  önce tabloyu görüp sonra sayfanın sıçradığını yaşıyordu.

  İpucu istek başlıklarından: Sec-CH-UA-Mobile (Chromium, "?1" telefon)
  önce, yoksa kullanıcı aracısı. Yalnızca İLK çizimi seçer; hidrasyondan
  sonra gerçek genişlik (matchMedia) geçerli. Tahmin yanlışsa davranış
  eskisiyle aynı: bir kez değişir. iPad Safari kendini Mac olarak
  tanıttığı için masaüstü sayılır; tablet ile masaüstü arasında bu
  bileşenlerde fark yok.
*/
export function ekranTahmini(basliklar: { chMobile?: string | null; ua?: string | null }): EkranSinifi {
  if (basliklar.chMobile === "?1") return "telefon";
  const ua = basliklar.ua ?? "";
  if (/iPhone|iPod|Windows Phone|Android.*Mobile|Mobile.*Firefox|Opera Mini/i.test(ua)) return "telefon";
  if (/iPad|Tablet|Android/i.test(ua)) return "tablet";
  return "masaustu";
}
