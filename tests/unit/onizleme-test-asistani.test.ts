import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { onizlemeTakmalari } from "@/lib/onizleme-takmalari";
import { sor, testAsistaniAcik, testCevabi } from "../../scripts/onizleme/saglayici";
import { yazimDenetle, yazimIstemi, type YazimGorevi } from "@/lib/ai/yazim-asistani";

/*
  ÖNİZLEME TEST ASİSTANI — ÜRETİMDEN İZOLASYON (Signature OS 4.3).
  Sahte sağlayıcının canlıya çıkması, öğrenciye uydurma metnin "asistan
  cevabı" diye gösterilmesi demek. Üç kat koruma sınanıyor:
  1) takma kararı üretimde HATA verir (derleme durur);
  2) sağlayıcının kendisi üretimde ve bayraksız çağrılırsa hata verir;
  3) uygulama kodu (app/, lib/) önizleme klasörünü hiçbir yerden içe aktarmaz.
*/

test("takma: üretimde ARVOLAB_ONIZLEME ya da ONIZLEME_AI açıksa derleme durur", () => {
  assert.throws(() => onizlemeTakmalari({ NODE_ENV: "production", ARVOLAB_ONIZLEME: "1" }), /üretim/);
  assert.throws(() => onizlemeTakmalari({ NODE_ENV: "production", ONIZLEME_AI: "1" }), /üretim/);
  // Abonelik köprüsü taklidi (4.4): üretimde ve önizleme dışında açılamaz; açıkken yalnızca köprü modülü değişir.
  assert.throws(() => onizlemeTakmalari({ NODE_ENV: "production", ONIZLEME_ABONELIK: "aktif" }), /üretim/);
  assert.throws(() => onizlemeTakmalari({ ONIZLEME_ABONELIK: "aktif" }), /ARVOLAB_ONIZLEME/);
  assert.equal(onizlemeTakmalari({ ARVOLAB_ONIZLEME: "1", ONIZLEME_ABONELIK: "aktif" })?.["@/lib/subscription"], "./scripts/onizleme/abonelik.ts");
  assert.equal(onizlemeTakmalari({ ARVOLAB_ONIZLEME: "1" })?.["@/lib/subscription"], undefined);
  assert.throws(() => onizlemeTakmalari({ NODE_ENV: "production", ARVOLAB_ONIZLEME: "1", ONIZLEME_AI: "1" }), /üretim/);
});

test("takma: üretimde bayraksız hiçbir takma yok; AI bayrağı önizlemesiz kullanılamaz", () => {
  assert.equal(onizlemeTakmalari({ NODE_ENV: "production" }), null);
  assert.equal(onizlemeTakmalari({ NODE_ENV: "development" }), null);
  assert.throws(() => onizlemeTakmalari({ NODE_ENV: "development", ONIZLEME_AI: "1" }), /ARVOLAB_ONIZLEME/);
});

test("takma: sağlayıcı YALNIZCA ONIZLEME_AI=1 iken değişir; gerçek modül yolu değişmez", () => {
  const yalnizVeri = onizlemeTakmalari({ NODE_ENV: "development", ARVOLAB_ONIZLEME: "1" })!;
  assert.equal("@/lib/ai/saglayici" in yalnizVeri, false);
  const ai = onizlemeTakmalari({ NODE_ENV: "development", ARVOLAB_ONIZLEME: "1", ONIZLEME_AI: "1" })!;
  assert.equal(ai["@/lib/ai/saglayici"], "./scripts/onizleme/saglayici.ts");
});

test("sağlayıcı: üretimde ve bayraksız çağrılırsa HATA verir, cevap üretmez", async () => {
  assert.equal(testAsistaniAcik({ NODE_ENV: "production", ARVOLAB_ONIZLEME: "1", ONIZLEME_AI: "1" }), false);
  assert.equal(testAsistaniAcik({ NODE_ENV: "development", ARVOLAB_ONIZLEME: "1" }), false);
  assert.equal(testAsistaniAcik({ NODE_ENV: "development", ARVOLAB_ONIZLEME: "1", ONIZLEME_AI: "1" }), true);
  // Test ortamında bayraklar kapalı: gerçek çağrı reddedilmeli.
  await assert.rejects(() => sor([{ rol: "kullanici", metin: "merhaba" }]), /yalnızca geliştirme önizlemesinde/);
});

test("uygulama kodu (app/, lib/) önizleme klasörünü içe aktarmaz", () => {
  const ihlal: string[] = [];
  const tara = (klasor: string) => {
    for (const ad of readdirSync(klasor)) {
      const yol = join(klasor, ad);
      if (statSync(yol).isDirectory()) tara(yol);
      else if (/\.(tsx?|mjs)$/.test(ad) && /scripts\/onizleme/.test(readFileSync(yol, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))) ihlal.push(yol);
    }
  };
  tara("app");
  tara("lib");
  assert.deepEqual(ihlal.filter((y) => y !== join("lib", "onizleme-takmalari.ts")), []);
});

/* Sabit cevaplar gerçek doğrulamadan geçer (geçmesi gereken geçer, düşmesi gereken düşer). */
const SECIM = "Uzun dönemde bu ilişki zayıflar.";
const istem = (gorev: YazimGorevi, istek = "", secim: string | null = SECIM) =>
  yazimIstemi({ calisma: "Tez", belgeDili: "tr", atifStili: "APA 7", bolum: "Giriş", oncesi: "Enflasyon kısa dönemde işsizliği düşürür.", secim, kutuphane: [], gecmis: [], istek, gorev });

test("test cevapları: bütün görevler doğrulamadan geçer ve seçimle ilgili cevap seçimi kullanır", () => {
  for (const gorev of ["akademik", "kisalt", "genislet", "serbest", "devam", "paragraf", "anahat", "tamamla"] as YazimGorevi[]) {
    const secimli = ["akademik", "kisalt", "genislet", "serbest"].includes(gorev);
    const { mesajlar, kaynak } = istem(gorev, gorev === "serbest" ? "Bunu düzelt" : "", secimli ? SECIM : null);
    const cevap = testCevabi(mesajlar);
    assert.ok(cevap.metin.length > 0, gorev);
    assert.deepEqual(yazimDenetle(cevap.metin, [], [kaynak]), { gecti: true }, gorev);
    if (secimli && gorev !== "kisalt") assert.notEqual(cevap.metin, SECIM, gorev);
  }
});

test("test cevapları: UYDURMA_SAYI tetiği doğrulamada DÜŞER; UZUN tetiği 150 kelimeyi aşar", () => {
  const uydurma = istem("serbest", "UYDURMA_SAYI", null);
  assert.equal(yazimDenetle(testCevabi(uydurma.mesajlar).metin, [], [uydurma.kaynak]).gecti, false);
  const uzun = testCevabi(istem("paragraf", "UZUN", null).mesajlar).metin;
  assert.ok(uzun.split(/\s+/).length > 150);
});
