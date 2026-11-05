import assert from "node:assert/strict";
import test from "node:test";
import { calismaSec, secimAdresi } from "@/lib/calisma-secimi";

/*
  MODÜL SAYFASININ ÇALIŞMASI (Signature OS 4.3.5, B1). Eskiden
  `find(id) ?? calismalar[0]`: adresteki çalışma bulunamayınca ya da
  adreste çalışma yokken listedeki ilk çalışma SESSİZCE açılıyordu.
*/
const A = { id: "00000000-0000-4000-8000-0000000000b1", title: "Tez A" };
const B = { id: "00000000-0000-4000-8000-0000000000b2", title: "Makale B" };

test("adresteki çalışma: yalnızca o (büyük/küçük harf ve boşluk önemsiz)", () => {
  assert.deepEqual(calismaSec([A, B], B.id), { tur: "secili", calisma: B, adrestenMi: true });
  assert.deepEqual(calismaSec([A, B], ` ${B.id.toUpperCase()} `), { tur: "secili", calisma: B, adrestenMi: true });
});

test("adresteki çalışma bulunamazsa BAŞKA ÇALIŞMAYA GEÇİLMEZ", () => {
  // Geçersiz, var olmayan ya da erişilemeyen (listede olmayan) kimlik aynı sonucu verir.
  for (const id of ["00000000-0000-4000-8000-0000000000ff", "abc", "'; select 1"]) {
    assert.deepEqual(calismaSec([A, B], id), { tur: "bulunamadi" });
  }
  // Tek çalışması olan kullanıcıda da: yanlış bağlantı tek çalışmayı açmaz.
  assert.deepEqual(calismaSec([A], B.id), { tur: "bulunamadi" });
});

test("adreste çalışma yokken: tek çalışma açılır, birden çoksa kullanıcı seçer", () => {
  assert.deepEqual(calismaSec([A], undefined), { tur: "secili", calisma: A, adrestenMi: false });
  assert.deepEqual(calismaSec([A, B], undefined), { tur: "secim-gerekli" });
  assert.deepEqual(calismaSec([A, B], "  "), { tur: "secim-gerekli" });
  assert.deepEqual(calismaSec([], undefined), { tur: "yok" });
});

test("liste okunamadıysa karar verilmez (bulunamadı da denmez)", () => {
  assert.deepEqual(calismaSec([], A.id, true), { tur: "okunamadi" });
});

test("seçim bağlantısı sayfanın ek parametrelerini (DOI) korur", () => {
  assert.equal(secimAdresi("/dashboard/literature", A.id, { doi: "10.1000/abc", ekle: undefined }), `/dashboard/literature?calisma=${A.id}&doi=10.1000%2Fabc`);
});
