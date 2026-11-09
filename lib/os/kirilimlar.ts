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

/*
  YAZIM RAYI (V4.3-C1, R23). Yazım sayfasında yerleşik panel açıkken
  geniş kenar çubuğu (236) + kâğıt + panel (340/360) masaüstünün alt
  ucunda sığmıyor: 638 px sütun 1200–~1340 px'te panelle birlikte
  ancak kenar çubuğu RAYA (64) inerse sabit kalır. Tasarım kararı
  (docs/tasarim/asama-4/signature-os-v4/09-v43-risk-kapatma.md, R23):
  "≥1200: yerleşik panel; gerekirse kenar çubuğu raya iner".

  Eşik sabit bir kırılım DEĞİL, ölçüm: geniş kenar çubuğuyla belgenin
  kabı ne olurdu, sütun + iki yanda en az pay sığar mı? Sabit eşik
  kılavuzun dar sütununu (A4, 4/2,5 cm → 548 px; rayı gerektirmez) ve
  işletim sisteminin kaydırma çubuğunu (Windows'ta ~17 px) bilemezdi.

  Kullanıcının kenar tercihi DEĞİŞMEZ (localStorage): panel kapanınca ya
  da yer açılınca kenar çubuğu kendiliğinden geri gelir. Tercih zaten
  "dar" ise gerek yok. Kap ölçümü raydayken yapılıyorsa geniş hâle
  çevrilir (kenarFarki); karar iki hâlde de aynı çıkar, ray açılıp
  kapanarak titremez.
*/
export function yazimRayiGerekli(girdi: {
  panelYerlesik: boolean;
  kenarDar: boolean;
  rayAcik: boolean;
  kap: number;
  sutun: number;
  payMin: number;
  kenarFarki: number;
}): boolean {
  if (!girdi.panelYerlesik || girdi.kenarDar) return false;
  const genisKap = girdi.rayAcik ? girdi.kap - girdi.kenarFarki : girdi.kap;
  return genisKap < girdi.sutun + 2 * girdi.payMin - 0.5;
}

/** CSS uzunluğu ("638px", "14.5cm") → piksel; okunamazsa null. */
export function cssUzunlugu(deger: string): number | null {
  const m = /^\s*(-?[\d.]+)(px|cm)\s*$/.exec(deger);
  if (!m) return null;
  const sayi = Number(m[1]);
  return m[2] === "cm" ? (sayi * 96) / 2.54 : sayi;
}
