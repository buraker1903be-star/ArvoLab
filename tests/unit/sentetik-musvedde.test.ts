import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test, { describe } from "node:test";
import { countWords, extractPlainText, type TiptapDoc } from "@/lib/tiptap-text";
import { musveddeSatiri } from "../../scripts/test-ortami/sentetik-musvedde.mjs";

/*
  SENTETİK MÜSVEDDE (05.11.2026). Betik örnek tezi word_count 0 ve boş
  plain_text ile yazıyordu; Çalışmalarım listesi tezi "0 kelime" gösterdi.
  Hiçbir veritabanına bağlanılmaz: yalnızca eklenecek satır hesaplanır.
*/
const tez = JSON.parse(readFileSync("tests/fixtures/tez-enflasyon-issizlik.json", "utf8")) as TiptapDoc;
const KIMLIK = { projeId: "00000000-0000-4000-8000-0000000000b1", sahipId: "00000000-0000-4000-8000-0000000000a1" };

describe("sentetik müsvedde satırı", () => {
  test("örnek tez 6.354 kelime; değer editörün kaydıyla aynı fonksiyondan", async () => {
    const satir = await musveddeSatiri(tez, KIMLIK);
    assert.equal(satir.word_count, 6354);
    assert.equal(satir.word_count, countWords(tez));
  });

  test("plain_text gerçek içerikten türetiliyor, boş değil", async () => {
    const satir = await musveddeSatiri(tez, KIMLIK);
    assert.equal(satir.plain_text, extractPlainText(tez));
    assert.ok(satir.plain_text.length > 1000);
    assert.match(satir.plain_text, /enflasyon/i);
  });

  test("satır yalnızca beklenen alanları taşıyor; içerik değiştirilmeden yazılıyor", async () => {
    const satir = await musveddeSatiri(tez, KIMLIK);
    assert.deepEqual(Object.keys(satir).sort(), ["content", "plain_text", "project_id", "updated_by", "word_count"]);
    assert.equal(satir.content, tez);
    assert.equal(satir.project_id, KIMLIK.projeId);
    assert.equal(satir.updated_by, KIMLIK.sahipId);
  });

  test("betiğin çalıştığı ortamda da (düz node, çözümleyici önceden yüklü değil) aynı sonuç", () => {
    const kod = `import("./scripts/test-ortami/sentetik-musvedde.mjs").then(async (m) => {
      const fs = await import("node:fs");
      const tez = JSON.parse(fs.readFileSync("tests/fixtures/tez-enflasyon-issizlik.json", "utf8"));
      const s = await m.musveddeSatiri(tez, { projeId: "p", sahipId: "u" });
      console.log(JSON.stringify({ k: s.word_count, d: s.plain_text.length > 0 }));
    });`;
    const s = spawnSync(process.execPath, ["--input-type=module", "-e", kod], { encoding: "utf8", timeout: 30_000 });
    assert.equal(s.status, 0, s.stderr);
    assert.deepEqual(JSON.parse(s.stdout.trim().split("\n").at(-1)!), { k: 6354, d: true });
  });
});

describe("sentetik veri betiği: yeniden çalıştırma güvenli", () => {
  const betik = readFileSync("scripts/test-ortami/sentetik-veri.mjs", "utf8");

  test("müsvedde yalnızca YOKSA ekleniyor; müsveddede güncelleme/upsert yok, betikte silme yok", () => {
    assert.match(betik, /const varMi = beklet\(await db\.from\("project_manuscripts"\)\.select\("project_id"\)\.eq\("project_id", tezA\)\.maybeSingle\(\)/);
    assert.match(betik, /if \(!varMi\) \{\s*const satir = await musveddeSatiri\(tez, \{ projeId: tezA, sahipId: A \}\);\s*beklet\(await db\.from\("project_manuscripts"\)\.insert\(satir\)/);
    const musveddeYazmalari = [...betik.matchAll(/from\("project_manuscripts"\)\.(\w+)\(/g)].map((m) => m[1]);
    assert.deepEqual(musveddeYazmalari.sort(), ["insert", "select"]);
    /* Abonelik ve kredi satırlarındaki upsert önceden var ve bilerek (kimliğe göre tek satır); müsvedde onların dışında. */
    assert.doesNotMatch(betik, /\.delete\(/);
  });

  test("eski boş değerler geri gelmedi", () => {
    assert.doesNotMatch(betik, /word_count:\s*0/);
    assert.doesNotMatch(betik, /plain_text:\s*""/);
  });

  test("üretim kapıları hesaplamadan ÖNCE duruyor (müsvedde yardımcısı veritabanına dokunmuyor)", () => {
    const kapi0 = betik.indexOf("uretimProjesiniGosteriyor(URL_");
    const musvedde = betik.indexOf("musveddeSatiri(tez");
    assert.ok(kapi0 > 0 && musvedde > kapi0);
    assert.doesNotMatch(readFileSync("scripts/test-ortami/sentetik-musvedde.mjs", "utf8"), /createClient|supabase-js|\.from\(/);
  });
});
