import { test } from "node:test";
import assert from "node:assert/strict";


/*
  Kaynak indirme hataları (lib/safe-official-fetch.ts) err.message olarak
  kullanıcıya ulaşıyor; 29.10.2026'ya kadar İngilizce arayüzde Türkçe
  kalıyorlardı. Dosyadaki her sabit hata metni çevrilmeli: yeni bir hata
  eklenip çevirisi unutulursa bu test söyler.
*/
test("güvenli indirme hatalarının hepsi İngilizceye çevrilir", async () => {
  const { readFileSync } = await import("node:fs");
  const { taramaUyarisiCevir } = await import("@/lib/guideline-scan");
  const kod = readFileSync("lib/safe-official-fetch.ts", "utf8");
  const sabitler = [...kod.matchAll(/throw new Error\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(sabitler.length >= 4);
  for (const mesaj of sabitler) assert.notEqual(taramaUyarisiCevir(mesaj, "en"), mesaj, `Çevrilmeyen: ${mesaj}`);
  assert.equal(taramaUyarisiCevir("Kaynak alınamadı (HTTP 404).", "en"), "The source could not be retrieved (HTTP 404).");
  assert.equal(taramaUyarisiCevir("Kaynak dosya çok büyük (45 MB); en fazla 20 MB okunur.", "en"), "The source file is too large (45 MB); at most 20 MB is read.");
});
