import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kurumSecimi } from "../../lib/kurum-secimi";

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b1";

describe("kurum seçimi", () => {
  test("iç ekip listede olan kurumu seçebilir", () => {
    assert.equal(kurumSecimi(A, [{ id: A }, { id: B }], true), A);
  });
  test("iç ekip değilse, çerez bozuksa ya da kurum yoksa seçim yok sayılır", () => {
    assert.equal(kurumSecimi(A, [{ id: A }], false), null);
    assert.equal(kurumSecimi("akademikmerkez", [{ id: A }], true), null);
    assert.equal(kurumSecimi(B, [{ id: A }], true), null);
    assert.equal(kurumSecimi(null, [{ id: A }], true), null);
  });
});
