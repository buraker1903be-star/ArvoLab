import assert from "node:assert/strict";
import { test } from "node:test";
import { pasajParcalari } from "@/lib/pdf-pasaj";

const SAYFA = ["Remote learning increased reported isolation ", "among first-year students.", " The effect was strongest in ", "programmes without weekly live sessions."];

test("pasaj sayfada bütünüyle geçiyorsa kapsadığı parçalar", () => {
  assert.deepEqual(pasajParcalari(SAYFA, "The effect was strongest in programmes without weekly live sessions."), [2, 3]);
  // Satır sonu ve boşluk farkları eşleşmeyi bozmaz.
  assert.deepEqual(pasajParcalari(SAYFA, "isolation among   first-year\nstudents"), [0, 1]);
});

test("bulunamayan pasaj: hiçbir şey işaretlenmez", () => {
  assert.equal(pasajParcalari(SAYFA, "The effect was weakest in programmes with weekly sessions."), null);
  // Çok kısa pasaj vurgulanmaz (başka yerde de geçebilir).
  assert.equal(pasajParcalari(SAYFA, "students"), null);
  assert.equal(pasajParcalari([], "Remote learning increased reported isolation"), null);
});

test("satır sonu tirelemesi: metin katmanında 'com-' + 'pile', pasajda 'compile'", () => {
  // Gerçek iki sütunlu makalede (PLDI 2009) ölçülen parçalanma; eskiden null dönüyordu.
  const parcalar = ["Dynamic languages such as JavaScript are more difficult to com-", "pile than statically typed ones. Since no concrete type", "information is available."];
  assert.deepEqual(pasajParcalari(parcalar, "more difficult to compile than statically typed ones"), [0, 1]);
  // Gerçek tireli sözcük iki tarafta da tireli: yine eşleşir.
  assert.deepEqual(pasajParcalari(["a state-of-the-art tracing compiler for loops"], "state-of-the-art tracing compiler"), [0]);
});
