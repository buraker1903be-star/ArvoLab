import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { aiHataMesaji, sor } from "../../lib/ai/saglayici";
import { sor as onizlemeSor } from "../../scripts/onizleme/saglayici";

/*
  C2-7 (V4.3): GERÇEK SAĞLAYICININ ZAMAN AŞIMI VE HATA YOLU. Yerel bir
  sunucu ya hiç cevap vermiyor ya da HTTP 500 dönüyor; lib/ai/saglayici.ts
  gerçek fetch ile çağrılıyor (taklit yok).
    - Zaman aşımı kullanıcıya anlaşılır metin olarak döner.
    - Varsayılan süre 45 sn: AbortSignal.timeout'a giden değer yakalanır
      (45 sn beklemeden); AI_ZAMAN_ASIMI_MS ve çağıranın seçeneği onu ezer.
    - HTTP 500 tek istek: yeniden denenmez (maliyet), metin anlaşılır.
    - Önizlemenin sahte sağlayıcısındaki ZAMAN_ASIMI / SAGLAYICI_HATASI
      tetikleyicileri gerçek metinlerle AYNI (tarayıcı testi gerçek
      metni görsün diye).
*/
let sunucu: Server;
let adres = "";
let istekSayisi = 0;
const KAYITLI = { ...process.env };

before(async () => {
  sunucu = createServer((istek, cevap) => {
    istekSayisi++;
    if (istek.url?.includes("hata500")) {
      cevap.writeHead(500, { "content-type": "application/json" });
      cevap.end('{"error":"sunucu"}');
    }
    // Öteki yollar hiç cevap vermez (zaman aşımı).
  });
  await new Promise<void>((coz) => sunucu.listen(0, "127.0.0.1", () => coz()));
  const a = sunucu.address();
  adres = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
after(() => {
  sunucu.closeAllConnections();
  sunucu.close();
  for (const ad of Object.keys(process.env)) if (!(ad in KAYITLI)) delete process.env[ad];
  Object.assign(process.env, KAYITLI);
});
const kur = (yol: string, ek: Record<string, string> = {}) => {
  delete process.env.AI_ZAMAN_ASIMI_MS;
  delete process.env.AI_BICIM;
  Object.assign(process.env, { AI_TABAN_URL: `${adres}/${yol}`, AI_ANAHTAR: "test-anahtari", ...ek });
};
const MESAJ = [{ rol: "kullanici" as const, metin: "merhaba" }];
const ZAMAN = "Yapay zeka zamanında yanıt vermedi. Daha kısa bir metinle tekrar deneyin.";

async function hataOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (hata) {
    return hata;
  }
  throw new Error("hata bekleniyordu");
}

describe("C2-7 sağlayıcı hatası ve zaman aşımı", () => {
  test("zaman aşımı anlaşılır metne çevrilir", async () => {
    kur("v1");
    const hata = await hataOf(sor(MESAJ, { zamanAsimiMs: 200 }));
    assert.equal(aiHataMesaji(hata), ZAMAN);
    assert.equal(aiHataMesaji(hata, "en"), "The AI did not respond in time. Try again with a shorter text.");
  });

  test("varsayılan süre 45 sn; ortam değişkeni ve çağıranın seçeneği onu ezer", async () => {
    const asil = AbortSignal.timeout.bind(AbortSignal);
    const gorulen: number[] = [];
    AbortSignal.timeout = (ms: number) => {
      gorulen.push(ms);
      return asil(50); // gerçekten 45 sn beklenmez; yalnızca istenen süre okunur
    };
    try {
      kur("v1");
      assert.equal(aiHataMesaji(await hataOf(sor(MESAJ))), ZAMAN);
      kur("v1", { AI_ZAMAN_ASIMI_MS: "7000" });
      await hataOf(sor(MESAJ));
      kur("v1");
      await hataOf(sor(MESAJ, { zamanAsimiMs: 100_000 }));
    } finally {
      AbortSignal.timeout = asil;
    }
    assert.deepEqual(gorulen, [45_000, 7_000, 100_000]);
  });

  test("HTTP 500: tek istek (yeniden deneme yok), anlaşılır metin", async () => {
    kur("hata500/v1");
    istekSayisi = 0;
    const hata = await hataOf(sor(MESAJ));
    assert.match(aiHataMesaji(hata) ?? "", /ulaşılamıyor/);
    assert.equal(istekSayisi, 1);
  });

  test("önizlemenin sahte tetikleyicileri gerçek metinlerle aynı", async () => {
    Object.assign(process.env, { ARVOLAB_ONIZLEME: "1", ONIZLEME_AI: "1" });
    kur("v1");
    const gercekZaman = aiHataMesaji(await hataOf(sor(MESAJ, { zamanAsimiMs: 100 })));
    kur("hata500/v1");
    const gercek500 = aiHataMesaji(await hataOf(sor(MESAJ)));
    assert.equal(aiHataMesaji(await hataOf(onizlemeSor([{ rol: "kullanici", metin: "ZAMAN_ASIMI" }]))), gercekZaman);
    assert.equal(aiHataMesaji(await hataOf(onizlemeSor([{ rol: "kullanici", metin: "SAGLAYICI_HATASI" }]))), gercek500);
  });
});
