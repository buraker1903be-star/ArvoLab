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
            plans: [{ code: "yillik", label: "Yıllık", amount: 4800, currency: "TRY", interval: "year" }],
            krediPaketleri: [],
            cardStorage: false,
          };
    yanit.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(cevap));
  });
});
sunucu.listen(PORT, "127.0.0.1", () => console.log(`arvoos taklidi: http://127.0.0.1:${PORT}`));
