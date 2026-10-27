/*
  ARACILIK VE DÜZENLEYİCİLİK.

  Beklenen değerler statsmodels OLS'ten (katsayı, SH, p, doğrusal
  birleşim t_test) ve pingouin.mediation_analysis'ten (bootstrap aralığı).
  Bootstrap örnekleri iki programda farklı olduğu için aralık GEVŞEK
  toleransla karşılaştırılıyor; nokta kestirimleri sıkı.
  Veri: tests/fixtures/aracilik-verisi.json (n = 120).
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aracilik, duzenleyicilik } from "@/lib/stats-aracilik";

const yakin = (a: number, b: number, tolerans = 1e-6) => assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);
const V = JSON.parse(readFileSync("tests/fixtures/aracilik-verisi.json", "utf8")) as Record<"x" | "m" | "y" | "w" | "z" | "k", number[]>;

describe("aracılık (Model 4)", () => {
  test("yollar statsmodels ile aynı; bootstrap aralığı pingouin'e yakın; tohumlu", () => {
    const r = aracilik(V.x, V.m, V.y)!;
    yakin(r.a.b, 0.4547337785);
    yakin(r.a.se, 0.0773743957);
    yakin(r.a.p, 3.9576813444778795e-8, 1e-12);
    yakin(r.b.b, 0.5711567862);
    yakin(r.b.se, 0.1005903495);
    yakin(r.c.b, 0.2454452249);
    yakin(r.c.p, 0.011063639484021111);
    yakin(r.cUs.b, -0.0142790586);
    yakin(r.cUs.p, 0.8821693757221258);
    yakin(r.dolayli, 0.4547337785 * 0.5711567862);
    /* pingouin (5000 örnek): [0.146, 0.413] */
    yakin(r.bootAlt, 0.1464, 0.03);
    yakin(r.bootUst, 0.4128, 0.03);
    yakin(r.rKareM, 0.22643142607311306);
    yakin(r.rKareY, 0.2579350331829513);
    const tekrar = aracilik(V.x, V.m, V.y)!;
    assert.deepEqual([tekrar.bootAlt, tekrar.bootUst], [r.bootAlt, r.bootUst], "aynı veri, aynı aralık");
  });

  test("kovaryatla", () => {
    const r = aracilik(V.x, V.m, V.y, [V.k], 500)!;
    yakin(r.a.b, 0.44880516);
    yakin(r.b.b, 0.5685701272);
    yakin(r.cUs.b, -0.0261322374);
  });
});

describe("düzenleyicilik (Model 1, merkezlenmiş)", () => {
  test("etkileşim, ΔR², koşullu etkiler", () => {
    const r = duzenleyicilik(V.x, V.w, V.z)!;
    const [b0, b1, b2, b3] = r.katsayilar;
    yakin(b0.b, 1.9835716289483154);
    yakin(b1.b, 0.3771729825349937);
    yakin(b2.b, 0.058913295120280304);
    yakin(b3.b, 0.12605931240228108);
    yakin(b3.se, 0.04014778829397069);
    yakin(b3.p, 0.0021442022994970712);
    yakin(r.rKare, 0.28325494491170344);
    yakin(r.deltaRKare, 0.28325494491170344 - 0.22233867066361834);
    yakin(r.deltaF, 9.858858129000092, 1e-5);
    yakin(r.deltaP, 0.0021442022994970712);
    const beklenen = [
      [0.1189520306484443, 0.11800803710790832, 0.3155527619614615],
      [0.3771729825349937, 0.07414030421353829, 1.4129114152015738e-6],
      [0.6353939344215431, 0.10292813289162911, 1.0145806412665174e-8],
    ];
    r.kosullu.forEach((k, i) => {
      yakin(k.etki, beklenen[i][0]);
      yakin(k.se, beklenen[i][1]);
      yakin(k.p, beklenen[i][2], 1e-9);
    });
    yakin(r.kosullu[1].w, 10.1625);
  });

  test("Johnson-Neyman sınırı: statsmodels t_test o W'de p = .05 veriyor", () => {
    const r = duzenleyicilik(V.x, V.w, V.z)!;
    /* statsmodels: W = 8,736481 için X'in koşullu etkisi p = 0,0500000. */
    assert.equal(r.jnSinirlari.length, 1);
    yakin(r.jnSinirlari[0], 8.736481278950908, 1e-6);
  });

  test("iki değerli W kendi değerlerinde", () => {
    const w = V.w.map((v) => (v > 10 ? 1 : 0));
    const r = duzenleyicilik(V.x, w, V.z)!;
    assert.deepEqual(r.kosullu.map((k) => k.w), [0, 1]);
    assert.deepEqual(r.jnSinirlari, []);
  });
});
