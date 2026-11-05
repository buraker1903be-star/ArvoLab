import assert from "node:assert/strict";
import test from "node:test";
import { kararKaydet, oturumKararlari } from "@/lib/ai-kararlari";

/*
  AI KARARLARI (Signature OS 4.3): kabul/ret bir İŞLEM KARARI, memnuniyet
  puanı değil. Eskiden ekleme kayda otomatik "faydalı" yazıyordu. Karar
  yalnızca oturumda tutulur; depolama yoksa akış düşmez.
*/

function sahteDepo() {
  const veri = new Map<string, string>();
  return { getItem: (k: string) => veri.get(k) ?? null, setItem: (k: string, v: string) => void veri.set(k, v) };
}

test("karar oturuma yazılır, en fazla 200 kayıt tutulur", () => {
  (globalThis as { sessionStorage?: unknown }).sessionStorage = sahteDepo();
  kararKaydet("k1", "kabul");
  kararKaydet(undefined, "reddedildi");
  assert.deepEqual(
    oturumKararlari().map((k) => [k.kayitId, k.karar]),
    [
      ["k1", "kabul"],
      [null, "reddedildi"],
    ],
  );
  for (let i = 0; i < 250; i++) kararKaydet(`k${i}`, "geri_alindi");
  assert.equal(oturumKararlari().length, 200);
  assert.equal(oturumKararlari().at(-1)?.kayitId, "k249");
});

test("depolama yoksa ya da bozuksa hata fırlatmaz", () => {
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  assert.doesNotThrow(() => kararKaydet("k1", "kabul"));
  assert.deepEqual(oturumKararlari(), []);
  (globalThis as { sessionStorage?: unknown }).sessionStorage = { getItem: () => "{bozuk", setItem: () => undefined };
  assert.deepEqual(oturumKararlari(), []);
});

test("panel ve satır içi öneri kabulde puan yazmaz (yalnızca açık 'Beğenmedim')", async () => {
  const { readFileSync } = await import("node:fs");
  const panel = readFileSync("app/dashboard/editor/[id]/write/yazim-paneli.tsx", "utf8");
  const satirIci = readFileSync("app/dashboard/editor/[id]/write/satir-ici-oneri.tsx", "utf8");
  assert.equal(/asistanPuanla\([^)]*"faydali"/.test(panel), false);
  assert.equal(/asistanPuanla/.test(satirIci), false);
  assert.equal((panel.match(/asistanPuanla\(/g) ?? []).length, 1, "yalnızca Beğenmedim");
});
