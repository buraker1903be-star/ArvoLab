import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import nextConfig from "../../next.config";

/*
  OCR çekirdeğinin dağıtım paketine girdiğini sınar.

  getCore.js çekirdeği `require('tesseract.js-core/<ad>')` ile çalışma
  anında istiyor; Vercel'in dosya izleyicisi bunu görmüyor, dosyalar
  next.config.ts'te elle listeleniyor. Liste bir kez işçi betiğini, bir kez
  de tam çekirdeği unuttu (05–26.10.2026, iki ayrı gece hatası). Bu test
  listeyi kütüphanenin KENDİ koduna karşı sınar: tesseract.js güncellenip
  başka bir çekirdek isterse burada kırılır, canlıda değil.
*/
const getCore = readFileSync("node_modules/tesseract.js/src/worker-script/node/getCore.js", "utf8");
const istenen = [...getCore.matchAll(/require\(['"]tesseract\.js-core\/([^'"]+)['"]\)/g)].map((m) => m[1]);

const izler = nextConfig.outputFileTracingIncludes ?? {};

describe("OCR çekirdekleri dağıtım paketinde", () => {
  test("getCore'un istediği çekirdekler okunabildi", () => {
    // Desen kütüphanede değişirse liste boş kalır ve aşağıdaki test boşuna geçer.
    assert.ok(istenen.length >= 6, `getCore'da ${istenen.length} çekirdek bulundu`);
  });

  for (const rota of ["/api/cron/guideline-refresh", "/dashboard/editor", "/dashboard/editor/**"]) {
    test(`${rota}: getCore'un isteyebileceği her çekirdek izde`, () => {
      const liste = izler[rota] ?? [];
      const eksik = istenen.flatMap((ad) =>
        [".js", ".wasm"].map((u) => `./node_modules/tesseract.js-core/${ad}${u}`).filter((d) => !liste.includes(d)),
      );
      assert.deepEqual(eksik, []);
    });
  }

  test("işçi Node'da getCore'a OEM değil boolean geçiriyor", () => {
    /*
      Tam çekirdeğin neden gerektiğinin dayanağı. Kütüphane bunu düzeltirse
      (OEM sayısını geçirirse) bu test kırılır: o gün tam çekirdekler
      listeden çıkarılıp paket ~10 MB küçültülebilir.
    */
    const isci = readFileSync("node_modules/tesseract.js/src/worker-script/index.js", "utf8");
    assert.match(isci, /adapter\.getCore\(lstmOnly,/);
  });
});
