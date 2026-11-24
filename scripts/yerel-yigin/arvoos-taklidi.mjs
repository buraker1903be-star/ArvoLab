// ARVOOS KÖPRÜSÜNÜN YEREL TAKLİDİ (24.11.2026).
//
// Bireysel abonelik verisi ArvoOS'tan geliyor; yerel yığında o servis yok ve
// durum her zaman "unreachable" düşüyor. Ayarlar penceresinin abonelik
// sekmesinin VERİ DÖNEN yolunu (plan, durum, dönem bitişi, yerelleştirilmiş
// tarih) sınamak için sabit bir yanıt veren küçük bir sunucu.
//
// Yalnızca kabul içindir; ürün kodu değişmiyor, taklit ortam değişkeniyle
// devreye giriyor (ARVOOS_BRIDGE_URL).
import http from "node:http";

const PORT = Number(process.env.TAKLIT_PORT ?? 54777);
/* Dönem bitişi kabul metninde birebir aranıyor: 23 Mayıs 2027. */
const DONEM_BITISI = process.env.TAKLIT_DONEM_BITISI ?? "2027-05-23T00:00:00.000Z";


/*
  İKİ KATALOG BİÇİMİ, AYRI AYRI (24.11.2026).

  KATALOG_BUGUN gerçek ArvoOS'un BUGÜN bildirdiği biçim: yalnızca kod,
  dönem ve tutar. Ad ve plana dahil kredi YOK — ArvoOS ücreti tek bir
  `individual_monthly_fee` sütununda tutuyor (lib/billing-plan.ts'teki
  kayıtlı gözlem) ve kademe kavramı iki tarafta da yok. Varsayılan bu:
  kabul, müşterinin ÜRETİMDE gördüğü ekranı ölçmeli.

  KATALOG_DOLU ArvoOS adı ve krediyi bildirmeye BAŞLADIĞINDA oluşacak
  biçim; e-postası "ayar-katalog" ile başlayan kullanıcıya veriliyor ki
  karşılaştırma penceresinin dolu hâli de ölçülebilsin. Bu listedeki
  "Standart / Plus / Pro" ve fiyatlar UYDURMA örnek değerlerdir; gerçek
  katalogda karşılığı yoktur.

  PAKETLER'in biçimi gerçek (ArvoOS lib/ai-kredi-paketleri.ts, alanlar
  kod/ad/kredi/fiyat), ama buradaki MİKTAR ve FİYATLAR da uydurma örnek
  değerlerdir.
*/
const KATALOG_BUGUN = [
  { code: "arvolab-aylik", interval: "month", price: 14900 },
  { code: "arvolab-yillik", interval: "year", price: 149000 },
];

const KATALOG_DOLU = [
  { code: "standart-ay", ad: "Standart", interval: "month", price: 14900, kredi: 1000 },
  { code: "plus-ay", ad: "Plus", interval: "month", price: 24900, kredi: 2500 },
  { code: "pro-ay", ad: "Pro", interval: "month", price: 39900, kredi: 6000 },
  { code: "standart-yil", ad: "Standart", interval: "year", price: 149000, kredi: 1000 },
  { code: "pro-yil", ad: "Pro", interval: "year", price: 399000, kredi: 6000 },
];

const PAKETLER = [
  { kod: "k250", ad: "250 kredi", kredi: 250, fiyat: 12500 },
  { kod: "k500", ad: "500 kredi", kredi: 500, fiyat: 22500 },
  { kod: "k1000", ad: "1.000 kredi", kredi: 1000, fiyat: 40000 },
];

const sunucu = http.createServer((istek, yanit) => {
  if (istek.method !== "POST" || !istek.url?.startsWith("/api/bridge/subscription")) {
    yanit.writeHead(404).end("yok");
    return;
  }
  let govde = "";
  istek.on("data", (parca) => (govde += parca));
  istek.on("end", () => {
    let eylem = "ensure";
    let eposta = "";
    try {
      const g = JSON.parse(govde);
      eylem = g.action ?? "ensure";
      eposta = String(g.email ?? "");
    } catch { /* biçim bozuksa varsayılan */ }
    /*
      "ulaşılamıyor" yolunu da sınayabilmek için: e-postası ayar-kopuk ile
      başlayan kullanıcıya 503. Ürün bunu geçici arıza sayıp durumu
      "unreachable" yapıyor ve kimseyi engellemiyor.
    */
    if (eposta.startsWith("ayar-kopuk")) {
      yanit.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({ error: "taklit: ulaşılamıyor" }));
      return;
    }
    const cevap =
      eylem === "close"
        ? { closed: true }
        : {
            status: "active",
            access: true,
            trialEndsAt: null,
            currentPeriodEnd: DONEM_BITISI,
            plans: eposta.startsWith("ayar-katalog") ? KATALOG_DOLU : KATALOG_BUGUN,
            /* Kredi paketleri okuyucunun beklediği anahtarla: creditPackages. */
            creditPackages: PAKETLER,
            cardStorage: false,
          };
    yanit.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(cevap));
  });
});
sunucu.listen(PORT, "127.0.0.1", () => console.log(`arvoos taklidi: http://127.0.0.1:${PORT}`));
