import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { kullanimSozlesmesi, sozlesmeDuzMetni, SOZLESME_SURUMU } from "@/lib/sozlesme/kullanim-sozlesmesi";

test("iki dilde aynı bölüm yapısı ve sürüm metinde yazılı", () => {
  const tr = kullanimSozlesmesi("tr");
  const en = kullanimSozlesmesi("en");
  assert.equal(tr.bolumler.length, en.bolumler.length);
  tr.bolumler.forEach((b, i) => assert.equal(b.paragraflar.length, en.bolumler[i].paragraflar.length, b.baslik));
  assert.ok(tr.giris.includes(SOZLESME_SURUMU) && en.giris.includes(SOZLESME_SURUMU));
});

test("kayda geçen özet gösterilen metinden ve kararlı", () => {
  const ozet = (dil: "tr" | "en") => createHash("sha256").update(sozlesmeDuzMetni(dil), "utf8").digest("hex");
  assert.equal(ozet("tr"), ozet("tr"));
  assert.notEqual(ozet("tr"), ozet("en"));
  // Düz metin, gösterilen her bölümü içerir: özet o metnin özetidir.
  for (const b of kullanimSozlesmesi("tr").bolumler) {
    assert.ok(sozlesmeDuzMetni("tr").includes(b.baslik));
    for (const p of b.paragraflar) assert.ok(sozlesmeDuzMetni("tr").includes(p));
  }
});

test("delil maddesi ve şirket künyesi metinde", () => {
  const tr = sozlesmeDuzMetni("tr");
  assert.match(tr, /Hukuk Muhakemeleri Kanunu m\.193/);
  assert.match(tr, /IP adresi, IP adresinden belirlenen yaklaşık konum \(ülke, bölge, şehir ve koordinat\), cihaz ve tarayıcı bilgisi/);
  assert.match(tr, /MERSİS: 0086178533500001/);
});

test("yaklaşık konum barındırıcının başlıklarından; yoksa uydurulmuyor", async () => {
  const { konumOku, konumYazisi } = await import("@/lib/sozlesme/konum");
  const h: Record<string, string> = { "x-vercel-ip-country": "TR", "x-vercel-ip-country-region": "34", "x-vercel-ip-city": "%C4%B0stanbul", "x-vercel-ip-latitude": "41.0082", "x-vercel-ip-longitude": "28.97" };
  const k = konumOku((ad) => h[ad] ?? null);
  assert.equal(konumYazisi(k), "İstanbul, 34, TR (41.0082, 28.97)");
  assert.equal(konumYazisi(konumOku(() => null)), null);
  assert.equal(konumOku((ad) => (ad === "x-vercel-ip-latitude" ? "999" : null)).enlem, null);
});
