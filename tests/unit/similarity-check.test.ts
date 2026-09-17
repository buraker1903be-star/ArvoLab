import assert from "node:assert/strict";
import test from "node:test";
import { buildShingles, computeSimilarity } from "@/lib/similarity-check";

const metin = (kelime: number) => Array.from({ length: kelime }, (_, i) => `kelime${i}`).join(" ");

test("6 kelimeden kısa metin parmak izi üretmez", () => {
  assert.equal(buildShingles(metin(5)).size, 0);
  assert.equal(buildShingles(metin(6)).size, 1);
  assert.equal(buildShingles(metin(10)).size, 5);
});

test("noktalama ve büyük/küçük harf farkı örtüşmeyi bozmaz", () => {
  const a = buildShingles("Bu çalışma, akademik yazımın temel ilkelerini ele alır.");
  const b = buildShingles("bu çalışma akademik yazımın temel ilkelerini ele alır");
  assert.deepEqual([...a.keys()], [...b.keys()]);
});

test("Türkçe küçültme kullanılıyor", () => {
  // tr-TR'de I → ı ve İ → i. Büyük harfle yazılmış bir başlık, doğru
  // Türkçe yazımıyla (İ noktalı) küçük hâline birebir eşleşmeli.
  const a = buildShingles("IŞIK HIZI İLE İLGİLİ TEMEL BİLGİLER");
  const b = buildShingles("ışık hızı ile ilgili temel bilgiler");
  assert.deepEqual([...a.keys()], [...b.keys()]);

  // Ayrım korunuyor: noktasız I küçüldüğünde ı olur, i değil.
  const c = buildShingles("ILE ILGILI TEMEL BILGILER SATIR SONU");
  assert.ok(![...c.keys()].some((k) => b.has(k)), "ILE ≠ İLE, ayrım silinmemeli");
});

test("boş havuzda skor 0", () => {
  assert.deepEqual(computeSimilarity(buildShingles(""), buildShingles(metin(20))), { score: 0, sampleOverlap: null });
  assert.deepEqual(computeSimilarity(buildShingles(metin(20)), buildShingles("")), { score: 0, sampleOverlap: null });
});

test("aynı metin 100 verir ve örnek döndürür", () => {
  const s = buildShingles(metin(30));
  const sonuc = computeSimilarity(s, s);
  assert.equal(sonuc.score, 100);
  assert.ok(sonuc.sampleOverlap);
});

test("tamamen farklı metinler 0 verir", () => {
  const a = buildShingles("bir iki üç dört beş altı yedi sekiz");
  const b = buildShingles("dokuz on onbir oniki onüç ondört onbeş onaltı");
  const sonuc = computeSimilarity(a, b);
  assert.equal(sonuc.score, 0);
  assert.equal(sonuc.sampleOverlap, null);
});

test("kısmi örtüşme 0 ile 100 arasında kalır", () => {
  const ortak = "bu cümle her iki belgede de aynen geçmektedir ve örtüşmeyi sağlar";
  const a = buildShingles(`${ortak} ${metin(40)}`);
  const b = buildShingles(`${ortak} ${Array.from({ length: 40 }, (_, i) => `farkli${i}`).join(" ")}`);
  const sonuc = computeSimilarity(a, b);
  assert.ok(sonuc.score > 0 && sonuc.score < 100, `skor=${sonuc.score}`);
  assert.ok(sonuc.sampleOverlap, "örnek örtüşme gösterilmeli");
});

test("skor hiçbir zaman 100'ü aşmaz", () => {
  // overlapRatio küçük belgeye göre hesaplandığı için, biri diğerini tamamen
  // kapsadığında jaccard<1 ama overlapRatio=1 olur; ortalama yine ≤100.
  const kucuk = buildShingles(metin(10));
  const buyuk = buildShingles(metin(200));
  const sonuc = computeSimilarity(kucuk, buyuk);
  assert.ok(sonuc.score <= 100 && sonuc.score > 0, `skor=${sonuc.score}`);
});

test("benzerlik simetriktir", () => {
  const a = buildShingles(`${metin(30)} ortak kisim burada yer alir simdi`);
  const b = buildShingles(`ortak kisim burada yer alir simdi ${Array.from({ length: 30 }, (_, i) => `x${i}`).join(" ")}`);
  assert.equal(computeSimilarity(a, b).score, computeSimilarity(b, a).score);
});
