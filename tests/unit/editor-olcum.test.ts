import assert from "node:assert/strict";
import test from "node:test";
import { Olcum, olc, olcumAcikMi, olcumKaydet, olcumuAc, olcumuKapat, yuzdelik } from "@/lib/editor-olcum";

test("editör ölçümü", async (t) => {
  await t.test("boş dizide yüzdelik 0", () => {
    assert.equal(yuzdelik([], 0.95), 0);
  });

  await t.test("yüzdelik en yakın sırayı veriyor", () => {
    const sirali = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.equal(yuzdelik(sirali, 0.5), 5);
    assert.equal(yuzdelik(sirali, 0.95), 10);
    // Tek değerde her yüzdelik o değer — panelde "—" yerine gerçek sayı görünmeli.
    assert.equal(yuzdelik([7], 0.95), 7);
  });

  await t.test("yalnızca son N ölçüm tutuluyor", () => {
    const olcum = new Olcum(3);
    for (const ms of [100, 1, 2, 3]) olcum.ekle("iş", ms);
    const [satir] = olcum.ozet();
    assert.equal(satir.sayi, 3);
    // 100 düşmüş olmalı: yarım saatlik oturumda eski tepe sonsuza kadar kalmamalı.
    assert.equal(satir.enKotu, 3);
  });

  await t.test("özet en kötüsü üstte sıralanıyor", () => {
    const olcum = new Olcum();
    olcum.ekle("ucuz", 1);
    olcum.ekle("pahalı", 50);
    assert.deepEqual(olcum.ozet().map((s) => s.ad), ["pahalı", "ucuz"]);
  });

  await t.test("?olcum=1 dışındaki hiçbir şey açmıyor", () => {
    assert.equal(olcumAcikMi("?olcum=1"), true);
    assert.equal(olcumAcikMi("?a=b&olcum=1"), true);
    assert.equal(olcumAcikMi("?olcum=0"), false);
    assert.equal(olcumAcikMi("?olcum"), false);
    assert.equal(olcumAcikMi(""), false);
  });

  await t.test("kapalıyken olc() işi çalıştırıyor ama kaydetmiyor", () => {
    olcumuKapat();
    let kez = 0;
    assert.equal(olc("iş", () => { kez += 1; return 42; }), 42);
    assert.equal(kez, 1);
    assert.deepEqual(olcumuAc().ozet(), []);
    olcumuKapat();
  });

  await t.test("açıkken olc() kaydediyor ve hata atsa da kaydı bırakıyor", () => {
    const olcum = olcumuAc();
    olc("iyi", () => 1);
    assert.throws(() => olc("kötü", () => { throw new Error("patla"); }), /patla/);
    // Hata atan iş de ölçülmeli: donmanın sebebi tam da patlayan iş olabilir.
    assert.deepEqual(olcum.ozet().map((s) => s.ad).sort(), ["iyi", "kötü"]);
    olcumuKapat();
  });

  await t.test("kapalıyken olcumKaydet sessizce yutuluyor", () => {
    olcumuKapat();
    assert.doesNotThrow(() => olcumKaydet("tuş", 12));
    assert.deepEqual(olcumuAc().ozet(), []);
    olcumuKapat();
  });
});
