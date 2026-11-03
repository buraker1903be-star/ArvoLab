import assert from "node:assert/strict";
import test from "node:test";
import { ANALIZ_GRUPLARI, ANALIZ_TURLERI } from "@/lib/analiz-turleri";

/* Analiz Merkezi'ndeki gruplu liste (04.11.2026): her tür tam olarak bir grupta. */
test("her analiz türü tam olarak bir grupta", () => {
  const gruplardaki = ANALIZ_GRUPLARI.flatMap((g) => g.turler);
  assert.deepEqual([...gruplardaki].sort(), [...ANALIZ_TURLERI].sort());
  assert.equal(new Set(gruplardaki).size, gruplardaki.length);
});
