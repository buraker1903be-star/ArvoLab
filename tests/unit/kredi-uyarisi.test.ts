import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
  Asistan kapısı (lib/ai/erisim.ts) kredi azaldığında `uyari` döndürüyor.
  28.10.2026'ya kadar hiçbir yetenek onu kullanıcıya iletmiyordu: kapı
  hesaplıyor, sunucu işlemi atıyordu ve kredisi biten kullanıcı uyarı
  görmeden engelle karşılaşıyordu. Kapıyı çağıran her işlem uyarıyı da
  taşımalı.
*/
test("asistan kapısını çağıran her işlem kredi uyarısını iletiyor", () => {
  const klasor = "app/actions";
  const eksik = readdirSync(klasor)
    .filter((ad) => ad.endsWith(".ts"))
    .filter((ad) => {
      const metin = readFileSync(join(klasor, ad), "utf8");
      return /await asistanKapisi\(\)/.test(metin) && !/kapi\.uyari/.test(metin);
    });
  assert.deepEqual(eksik, []);
});
