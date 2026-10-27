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
import { aracilik, cokluAracilik, duzenleyicilik } from "@/lib/stats-aracilik";

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

describe("çoklu aracı (paralel ve seri)", () => {
  /*
    Katsayılar statsmodels OLS'ten; paralelde özgül dolaylı etkiler ve
    bootstrap aralıkları pingouin.mediation_analysis(m=[m1, m2])'den
    (aralıklar gevşek toleransla). Doğrusal modelde toplam dolaylı etki
    c − c′'ye tam eşittir: bu özdeşlik her modelde ayrıca sınanıyor.
    Veri: tests/fixtures/coklu-aracilik.json (n = 150).
  */
  const C = JSON.parse(readFileSync("tests/fixtures/coklu-aracilik.json", "utf8")) as Record<"x" | "m1" | "m2" | "m3" | "y", number[]>;

  test("paralel iki aracı (pingouin)", () => {
    const r = cokluAracilik(C.x, [C.m1, C.m2], C.y, "paralel")!;
    yakin(r.a[0].b, 0.5119917663);
    yakin(r.a[1].b, 0.476856015);
    yakin(r.b[0].b, 0.393943639913415);
    yakin(r.b[1].b, 0.29787440171473806);
    yakin(r.cUs.b, 0.21840493438013914);
    yakin(r.c.b, 0.5621440345884994);
    assert.deepEqual(r.yollar.map((y) => y.araciSirasi), [[0], [1]]);
    yakin(r.yollar[0].etki, 0.2016959);
    yakin(r.yollar[1].etki, 0.1420432002);
    yakin(r.yollar[0].bootAlt, 0.1078, 0.03);
    yakin(r.yollar[0].bootUst, 0.3255, 0.03);
    yakin(r.yollar[1].bootAlt, 0.0644, 0.03);
    yakin(r.yollar[1].bootUst, 0.2529, 0.03);
    yakin(r.toplamDolayli.etki, r.c.b - r.cUs.b, 1e-10);
    assert.equal(r.karsitliklar.length, 1);
    yakin(r.karsitliklar[0].fark, 0.2016959 - 0.1420432002);
  });

  test("seri iki aracı: üç yol, zincir a1·d21·b2", () => {
    const r = cokluAracilik(C.x, [C.m1, C.m2], C.y, "seri", [], 1000)!;
    yakin(r.a[1].b, 0.28237495834147786);
    yakin(r.d[1][0]!.b, 0.3798519223585512);
    assert.equal(r.d[0][1], null);
    assert.deepEqual(r.yollar.map((y) => y.araciSirasi), [[0], [1], [0, 1]]);
    yakin(r.yollar[0].etki, 0.5119917663267414 * 0.393943639913415);
    yakin(r.yollar[1].etki, 0.28237495834147786 * 0.29787440171473806);
    yakin(r.yollar[2].etki, 0.5119917663267414 * 0.3798519223585512 * 0.29787440171473806);
    yakin(r.toplamDolayli.etki, r.c.b - r.cUs.b, 1e-10);
    assert.equal(r.karsitliklar.length, 3);
  });

  test("seri üç aracı: yedi yol, toplam = c − c′", () => {
    const r = cokluAracilik(C.x, [C.m1, C.m2, C.m3], C.y, "seri", [], 500)!;
    assert.equal(r.yollar.length, 7);
    yakin(r.cUs.b, 0.18236264145453981);
    yakin(r.d[2][0]!.b, 0.14999100824890513);
    yakin(r.d[2][1]!.b, 0.3792000559867202);
    yakin(r.b[2].b, 0.13101572738975303);
    yakin(r.toplamDolayli.etki, r.c.b - r.cUs.b, 1e-10);
    const tekrar = cokluAracilik(C.x, [C.m1, C.m2, C.m3], C.y, "seri", [], 500)!;
    assert.deepEqual(tekrar.yollar.map((y) => y.bootAlt), r.yollar.map((y) => y.bootAlt), "tohumlu: aynı aralıklar");
  });

  test("sınırlar: tek aracı ya da seride dörtten çok aracı kabul edilmez", () => {
    assert.equal(cokluAracilik(C.x, [C.m1], C.y, "paralel"), null);
    assert.equal(cokluAracilik(C.x, [C.m1, C.m2, C.m3, C.m1, C.m2], C.y, "seri"), null);
  });
});
