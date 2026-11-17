// GERÇEK AI KABULÜ — SAĞLAYICIYA GİDEN İSTEK SAYACI (RC06g, 17.11.2026). Uygulama kodu DEĞİL.
//
// Uygulama (AI_TABAN_URL=http://127.0.0.1:<port>/v1, AI_BICIM=anthropic) buraya konuşur, vekil
// isteği olduğu gibi YUKARI_ADRES'e iletir. Sınır, sağlayıcıya İLETİLEN toplam istek sayısına
// uygulanır: yeniden denemeler ve paralel istekler dahil. Sayaç iletmeden ÖNCE, eşzamanlı olarak
// artırılır (Node tek iş parçacıklı: iki paralel istek aynı numarayı alamaz); sınırı aşan istek
// iletilmez, 429 ile döner ve sağlayıcıya hiç ulaşmaz. Başarısız iletiler de sayılır: sağlayıcıya
// ulaşmış olabilirler.
//
// Günlük yalnızca: sıra, zaman, yol, model, durum kodu, süre, kullanım jetonları. İstem, yanıt
// metni ve BAŞLIKLAR (anahtar dahil) yazılmaz. Anahtar bu süreçte yalnızca bellekte, gelen
// isteğin başlığında durur.
//
// Kullanım: SINIR=30 PORT=54950 YUKARI_ADRES=https://api.anthropic.com GUNLUK=<yol> node sayac-vekili.mjs
import http from "node:http";
import fs from "node:fs";

const SINIR = Number(process.env.SINIR ?? 30);
const PORT = Number(process.env.PORT ?? 54950);
const YUKARI = new URL(process.env.YUKARI_ADRES ?? "https://api.anthropic.com");
const GUNLUK = process.env.GUNLUK ?? "sayac-vekili.jsonl";
if (!Number.isInteger(SINIR) || SINIR < 1 || SINIR > 30) {
  console.error("SINIR 1–30 arasında olmalı");
  process.exit(2);
}
// Sayaç günlükten başlar: vekil yeniden başlatılınca sınır sıfırlanmasın (aynı GUNLUK = aynı kabul).
let iletilen = fs.existsSync(GUNLUK)
  ? fs.readFileSync(GUNLUK, "utf8").split("\n").filter((s) => s.includes('"iletildi":true')).length
  : 0;
const yaz = (kayit) => fs.appendFileSync(GUNLUK, `${JSON.stringify(kayit)}\n`);

http
  .createServer((istek, yanit) => {
    const parcalar = [];
    istek.on("data", (p) => parcalar.push(p));
    istek.on("end", async () => {
      const govde = Buffer.concat(parcalar);
      let model = null;
      try {
        model = JSON.parse(govde.toString("utf8")).model ?? null;
      } catch {
        /* gövde JSON değil */
      }
      // Sıra numarası ileti kararından ÖNCE alınır; sınır dışıysa iletilmez.
      if (iletilen >= SINIR) {
        yaz({ sira: null, zaman: new Date().toISOString(), yol: istek.url, model, durum: 429, iletildi: false });
        yanit.writeHead(429, { "content-type": "application/json" });
        yanit.end(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: `kabul sınırı (${SINIR}) doldu; istek sağlayıcıya iletilmedi` } }));
        return;
      }
      const sira = ++iletilen;
      const basla = Date.now();
      const basliklar = { ...istek.headers };
      delete basliklar.host;
      delete basliklar["content-length"];
      try {
        const r = await fetch(new URL(istek.url, YUKARI), { method: istek.method, headers: basliklar, body: ["GET", "HEAD"].includes(istek.method) ? undefined : govde });
        const metin = Buffer.from(await r.arrayBuffer());
        let kullanim = null;
        try {
          kullanim = JSON.parse(metin.toString("utf8")).usage ?? null;
        } catch {
          /* akış ya da JSON olmayan yanıt */
        }
        yaz({ sira, zaman: new Date().toISOString(), yol: istek.url, model, durum: r.status, sureMs: Date.now() - basla, kullanim, iletildi: true });
        const donen = {};
        r.headers.forEach((v, k) => {
          if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(k)) donen[k] = v;
        });
        yanit.writeHead(r.status, donen);
        yanit.end(metin);
      } catch (h) {
        yaz({ sira, zaman: new Date().toISOString(), yol: istek.url, model, durum: 502, hata: String(h?.message ?? h).slice(0, 120), iletildi: true });
        yanit.writeHead(502, { "content-type": "application/json" });
        yanit.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "sağlayıcıya iletilemedi" } }));
      }
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`sayaç vekili 127.0.0.1:${PORT} → ${YUKARI.origin}, sınır ${SINIR}, önceden iletilen ${iletilen}`));
