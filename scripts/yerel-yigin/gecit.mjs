// Yerel yığının tek adresi (Supabase'deki Kong'un en küçük taklidi):
// /auth/v1/* → GoTrue (127.0.0.1:59998), /rest/v1/* → PostgREST (127.0.0.1:53001).
// Uygulama ve betikler NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54401 ile
// gerçek bir Supabase projesine gider gibi buraya gelir. Yalnızca 127.0.0.1.
//
// Kanca (/__gecit/kanca, yalnızca yerel): eşleşen ilk isteğin cevabı
// istemciye DÖNMEDEN önce başka bir oturumun isteğini çalıştırır. Yarış
// koşullarını (yedekle yazma arasındaki pencere) gerçek sunucu eylemi
// üzerinde belirlenimci kurmak için: "sunucu yedeği aldı, tam o anda öteki
// sekme kaydetti".
import http from "node:http";

const PORT = Number(process.env.GECIT_PORT ?? 54401);
// /storage/v1 → storage-api (kur-depo.sh ile; kur.sh kurmaz, o zaman istek bağlantı hatası alır).
const HEDEF = { "/auth/v1": 59998, "/rest/v1": 53001, "/storage/v1": 55000 };
let kanca = null; // { yontem, yolIcerir, eylem: { yontem, yol, basliklar, govde } }
const kancaGecmisi = [];

function ilet(port, yol, istek, govde) {
  return new Promise((coz, reddet) => {
    const basliklar = { ...istek.headers, host: `127.0.0.1:${port}` };
    delete basliklar["content-length"];
    if (govde.length) basliklar["content-length"] = String(govde.length);
    const ic = http.request({ host: "127.0.0.1", port, path: yol, method: istek.method, headers: basliklar }, (cevap) => {
      const parcalar = [];
      cevap.on("data", (p) => parcalar.push(p));
      cevap.on("end", () => coz({ durum: cevap.statusCode, basliklar: cevap.headers, govde: Buffer.concat(parcalar) }));
    });
    ic.on("error", reddet);
    ic.end(govde);
  });
}

async function kancaCalistir(eylem) {
  const govde = Buffer.from(eylem.govde ? JSON.stringify(eylem.govde) : "");
  const [onek, port] = Object.entries(HEDEF).find(([o]) => eylem.yol.startsWith(o));
  const sonuc = await ilet(port, eylem.yol.slice(onek.length), { method: eylem.yontem, headers: { "content-type": "application/json", ...eylem.basliklar } }, govde);
  return { durum: sonuc.durum, govde: sonuc.govde.toString().slice(0, 400) };
}

const sunucu = http.createServer(async (istek, cevap) => {
  const parcalar = [];
  for await (const p of istek) parcalar.push(p);
  const govde = Buffer.concat(parcalar);
  try {
    if (istek.url.startsWith("/__gecit/kanca")) {
      if (istek.method === "POST") {
        kanca = JSON.parse(govde.toString());
        cevap.writeHead(204).end();
      } else if (istek.method === "DELETE") {
        kanca = null;
        cevap.writeHead(204).end();
      } else {
        cevap.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ kanca, kancaGecmisi }));
      }
      return;
    }
    const giris = Object.entries(HEDEF).find(([onek]) => istek.url.startsWith(onek));
    if (!giris) {
      cevap.writeHead(404).end();
      return;
    }
    const [onek, port] = giris;
    const sonuc = await ilet(port, istek.url.slice(onek.length) || "/", istek, govde);
    if (kanca && istek.method === kanca.yontem && istek.url.includes(kanca.yolIcerir) && sonuc.durum < 300) {
      const k = kanca;
      kanca = null; // bir kez
      const eylemSonucu = await kancaCalistir(k.eylem);
      kancaGecmisi.push({ zaman: new Date().toISOString(), tetikleyen: `${istek.method} ${istek.url}`, eylemSonucu });
    }
    const basliklar = { ...sonuc.basliklar };
    delete basliklar["content-length"];
    delete basliklar["transfer-encoding"];
    cevap.writeHead(sonuc.durum, { ...basliklar, "content-length": String(sonuc.govde.length) }).end(sonuc.govde);
  } catch (hata) {
    cevap.writeHead(502, { "content-type": "text/plain" }).end(String(hata));
  }
});
sunucu.listen(PORT, "127.0.0.1", () => console.log(`yerel geçit http://127.0.0.1:${PORT}`));
