/*
  TEK ÖRNEKLEM t, TEKRARLI ÖLÇÜMLER ANOVA, ANCOVA.

  Beklenen değerler bağımsız uygulamalardan: pingouin (ttest, rm_anova,
  sphericity, epsilon, ancova) ve statsmodels (OLS katsayıları, eğim
  homojenliği için iç içe model karşılaştırması).
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ancova, karmaAnova, tekOrneklemTTest, tekrarliOlcumlerAnova } from "@/lib/stats-anova-ek";

const yakin = (a: number, b: number, tolerans = 1e-4) => assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);

test("tek örneklem t (pingouin)", () => {
  const r = tekOrneklemTTest([3.2, 3.8, 4.1, 2.9, 3.5, 4.4, 3.9, 3.1, 3.6, 4.0], 3);
  yakin(r.t, 4.291159);
  assert.equal(r.df, 9);
  yakin(r.p, 0.002017, 1e-5);
  yakin(r.d, 1.356984);
  yakin(r.altSinir + 3, 3.31, 0.01);
  yakin(r.ustSinir + 3, 3.99, 0.01);
});

describe("tekrarlı ölçümler ANOVA (pingouin)", () => {
  const ON = [10, 12, 11, 14, 13, 15, 9, 12, 13, 11];
  const SON = [12, 15, 13, 15, 16, 18, 10, 14, 15, 12];
  const IZ = [13, 15, 15, 18, 16, 21, 10, 15, 17, 13];

  test("F, kısmi η², küresellik ve düzeltmeler", () => {
    const r = tekrarliOlcumlerAnova([ON, SON, IZ]);
    yakin(r.ssOlcum, 55.266667);
    yakin(r.ssHata, 11.4);
    assert.deepEqual([r.df1, r.df2], [2, 18]);
    yakin(r.f, 43.631579);
    yakin(r.p, 1.250158e-7, 1e-10);
    yakin(r.kismiEtaKare, 0.829, 1e-3);
    yakin(r.mauchlyW, 0.734585);
    yakin(r.mauchlyChi, 2.467597);
    assert.equal(r.mauchlyDf, 2);
    yakin(r.mauchlyP, 0.291184);
    yakin(r.ggEpsilon, 0.790255);
    yakin(r.hfEpsilon, 0.930326);
    yakin(r.ggP, 2.02207e-6, 1e-9);
    yakin(r.hfP, 3.145822e-7, 1e-10);
  });

  test("iki ölçümde küresellik tanım gereği sağlanır", () => {
    const r = tekrarliOlcumlerAnova([ON, SON]);
    assert.equal(r.mauchlyW, 1);
    yakin(r.ggEpsilon, 1);
  });
});

describe("ANCOVA (pingouin + statsmodels)", () => {
  const G = [..."aaaaaa", ..."bbbbbb", ..."cccccc"];
  const ON = [10, 12, 11, 13, 9, 14, 11, 13, 12, 10, 14, 12, 9, 10, 12, 11, 13, 10];
  const SON = [14, 15, 13, 17, 12, 18, 12, 15, 13, 11, 16, 14, 10, 11, 13, 12, 15, 11];
  const gozlemler = G.map((g, i) => ({ grup: g, y: SON[i], kovaryatlar: [ON[i]] }));

  test("grup ve kovaryat etkileri, düzeltilmiş ortalamalar, eğim homojenliği", () => {
    const r = ancova(gozlemler, ["on"], "g");
    assert.ok(typeof r === "object");
    const [kov, grup] = r.etkiler;
    yakin(grup.ss, 15.717167);
    assert.equal(grup.df, 2);
    yakin(grup.f, 28.017685, 1e-3);
    yakin(grup.p, 1.275482e-5, 1e-8);
    yakin(grup.kismiEtaKare, 0.800101);
    yakin(kov.ss, 56.406522);
    yakin(kov.f, 201.102417, 1e-3);
    yakin(kov.kismiEtaKare, 0.934915);
    yakin(r.hataSS, 3.926812);
    assert.equal(r.hataDf, 14);
    /* statsmodels katsayıları: sabit 0,883333; b −1,939855; c −2,024638; ön test 1,213043. */
    const onOrt = ON.reduce((t, x) => t + x, 0) / ON.length;
    const a = 0.883333 + 1.213043 * onOrt;
    yakin(r.duzeltilmisOrtalamalar[0], a);
    yakin(r.duzeltilmisOrtalamalar[1], a - 1.939855);
    yakin(r.duzeltilmisOrtalamalar[2], a - 2.024638);
    yakin(r.egimF, 0.169305);
    yakin(r.egimP, 0.846233);
    assert.deepEqual([r.egimDf1, r.egimDf2], [2, 12]);
  });

  test("tek grup ya da az gözlem: hesaplanmaz", () => {
    assert.equal(ancova(gozlemler.filter((g) => g.grup === "a"), ["on"]), "az-grup");
    assert.equal(ancova(gozlemler.slice(5, 9), ["on"]), "az-gozlem");
  });
});

describe("karma ANOVA (pingouin.mixed_anova, dengesiz gruplar)", () => {
  const DENEY = [[10, 12, 11, 14, 13, 9, 12], [15, 17, 15, 18, 17, 13, 16], [16, 18, 17, 18, 19, 14, 17]];
  const KONTROL = [[11, 10, 13, 12, 14, 10], [12, 11, 13, 13, 15, 10], [11, 12, 14, 13, 14, 11]];

  test("grup, ölçüm, etkileşim, küresellik", () => {
    const r = karmaAnova([DENEY, KONTROL], ["deney", "kontrol"]);
    assert.ok(typeof r === "object");
    yakin(r.grup.ss, 67.6978021978);
    assert.deepEqual([r.grup.df1, r.grup.df2], [1, 11]);
    yakin(r.grup.f, 8.9642833521);
    yakin(r.grup.p, 0.012209181976, 1e-8);
    yakin(r.grup.kismiEtaKare, 0.449016035);
    yakin(r.olcum.ss, 79.1282051282);
    yakin(r.olcum.f, 153.6018099547, 1e-3);
    yakin(r.olcum.ggP, 3.9706202426e-11, 1e-14);
    yakin(r.olcum.kismiEtaKare, 0.9331720593);
    yakin(r.etkilesim.ss, 37.8717948718);
    assert.deepEqual([r.etkilesim.df1, r.etkilesim.df2], [2, 22]);
    yakin(r.etkilesim.f, 73.5158371041, 1e-3);
    yakin(r.etkilesim.p, 1.8155176089e-10, 1e-13);
    yakin(r.etkilesim.ggP, 1.2581988927e-8, 1e-11);
    yakin(r.etkilesim.kismiEtaKare, 0.8698468787);
    yakin(r.mauchlyW, 0.7236777064);
    yakin(r.mauchlyP, 0.1984842131);
    yakin(r.ggEpsilon, 0.7835011619);
    /* Huynh-Feldt (gruplu): (N(m−1)ε − 2) / ((m−1)(N − a − (m−1)ε)) = 18,371 / 18,866. */
    yakin(r.hfEpsilon, 0.973764);
  });

  test("tek grup ya da tek ölçüm: hesaplanmaz", () => {
    assert.equal(karmaAnova([DENEY], ["deney"]), "az-grup");
    assert.equal(karmaAnova([[DENEY[0]], [KONTROL[0]]], ["a", "b"]), "az-olcum");
  });
});
