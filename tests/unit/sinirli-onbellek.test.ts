import assert from "node:assert/strict";
import test from "node:test";
import { SinirliOnbellek } from "@/lib/sinirli-onbellek";

/* RELEASE CLOSURE 05: PDF sayfa metni önbelleği — kayıt, birim ve ömür sınırları. */

const kur = (enCokKayit = 3, enCokBirim = 100, omurMs = 1000) => {
  let simdi = 0;
  const o = new SinirliOnbellek<string>({ enCokKayit, enCokBirim, omurMs, birim: (d) => d.length, simdi: () => simdi });
  return { o, ilerlet: (ms: number) => (simdi += ms) };
};

test("kayıt sınırı: en az kullanılan önce çıkar; okunan kayıt korunur", () => {
  const { o } = kur(3);
  o.set("a", "1");
  o.set("b", "2");
  o.set("c", "3");
  assert.equal(o.get("a"), "1"); // a artık en yeni
  o.set("d", "4");
  assert.equal(o.get("b"), undefined);
  assert.deepEqual([o.get("a"), o.get("c"), o.get("d")], ["1", "3", "4"]);
  assert.equal(o.boyut, 3);
});

test("birim bütçesi: toplam aşılmaz; bütçeden büyük değer hiç saklanmaz", () => {
  const { o } = kur(10, 10);
  o.set("a", "xxxx");
  o.set("b", "xxxx");
  o.set("c", "xxxx"); // 12 > 10: a çıkar
  assert.equal(o.get("a"), undefined);
  assert.ok(o.toplamBirim <= 10);
  assert.equal(o.set("dev", "x".repeat(11)), false);
  assert.equal(o.get("dev"), undefined);
  assert.ok(o.toplamBirim <= 10);
});

test("ömür: süresi dolan kayıt verilmez ve bütçeden düşer", () => {
  const { o, ilerlet } = kur(3, 100, 1000);
  o.set("a", "abc");
  ilerlet(999);
  assert.equal(o.get("a"), "abc");
  ilerlet(1);
  assert.equal(o.get("a"), undefined);
  assert.equal(o.toplamBirim, 0);
});

test("aynı anahtarı yeniden yazmak birimi iki kez saymaz", () => {
  const { o } = kur(3, 100);
  o.set("a", "abcd");
  o.set("a", "ab");
  assert.equal(o.toplamBirim, 2);
  assert.equal(o.boyut, 1);
});
