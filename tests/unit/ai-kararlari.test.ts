import assert from "node:assert/strict";
import test from "node:test";
import { kararKaydet, oncekiUygulamalar, oncekiUygulamalariUnut, oturumKararlari, uygulamaIziEkle, uygulamaIziSil } from "@/lib/ai-kararlari";

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

/*
  Sayfa yenilenince AI geri alması (4.3 ek): panelin Geri al'ı ve AI
  adımının Ctrl+Z'si bellekteydi, yenilemeyle kaybolur. Önceki yüklemenin
  izleri ayrı görünmeli ki editör kullanıcıyı Sürümler'e yönlendirsin.
*/

test("önceki yüklemenin AI değişiklikleri ayrılır; bu yüklemeninkiler sayılmaz", () => {
  (globalThis as { sessionStorage?: unknown }).sessionStorage = sahteDepo();
  uygulamaIziEkle("p1", "a", true, "yukleme-1");
  uygulamaIziEkle("p1", "b", false, "yukleme-1");
  uygulamaIziEkle("p2", "c", false, "yukleme-1");
  // Aynı yüklemede uyarı yok: geri alma hâlâ panelde mümkün.
  assert.equal(oncekiUygulamalar("p1", "yukleme-1").length, 0);
  // Yenilemeden sonra (yeni yükleme kimliği) yalnızca bu çalışmanın izleri.
  assert.deepEqual(oncekiUygulamalar("p1", "yukleme-2").map((i) => i.id), ["a", "b"]);
});

test("geri alınan değişikliğin izi silinir; 'Anladım' yalnızca önceki yüklemeleri unutur", () => {
  (globalThis as { sessionStorage?: unknown }).sessionStorage = sahteDepo();
  uygulamaIziEkle("p1", "a", false, "y1");
  uygulamaIziEkle("p1", "b", false, "y1");
  uygulamaIziSil("p1", "a");
  assert.deepEqual(oncekiUygulamalar("p1", "y2").map((i) => i.id), ["b"]);
  uygulamaIziEkle("p1", "c", false, "y2");
  oncekiUygulamalariUnut("p1", "y2");
  assert.deepEqual(oncekiUygulamalar("p1", "y2"), []);
  assert.deepEqual(oncekiUygulamalar("p1", "y3").map((i) => i.id), ["c"]);
});

test("sürüm zorunlu: panelde sürümsüz uygulama yolu yok", async () => {
  const { readFileSync } = await import("node:fs");
  const panel = readFileSync("app/dashboard/editor/[id]/write/yazim-paneli.tsx", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.equal(/surumsuz|Sürüm almadan uygula|Apply without a version/.test(panel), false);
  // Sürüm gerekiyorsa koşulsuz denenir; başarısızsa dönülür (uygulama satırına inilmez).
  assert.match(panel, /if \(surumGerekir\(/);
  assert.match(panel, /if \(!alindi\) \{[\s\S]*?return;\s*\}/);
});
