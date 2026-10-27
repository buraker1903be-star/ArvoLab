/*
  DOĞRULAYICI FAKTÖR ANALİZİ.

  İki bağımsız kaynak:
  - semopy 2.3 (MLW): F_min, standartlaştırılmış yükler (Est. Std) ve
    faktör korelasyonları. semopy S'yi N'ye böldüğü için ham hata
    varyansları N/(N−1) oranında farklı; ölçekten bağımsız değerler
    karşılaştırılıyor.
  - SciPy BFGS ile AYNI amaç fonksiyonunun ayrı bir çözümü ve dört
    noktalı sayısal Hessian: ham yükler, SH'ler, χ² = (N−1)·F ve bütün
    indeksler (formüller lavaan/AMOS tanımlarıyla).
  Veri: tests/fixtures/dfa-maddeleri.json (9 madde, 3 faktör, n = 200).
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dogrulayiciFaktorAnalizi, uyumYorumu } from "@/lib/stats-dfa";

const yakin = (a: number, b: number, tolerans = 1e-5) => assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);
const V = JSON.parse(readFileSync("tests/fixtures/dfa-maddeleri.json", "utf8")) as Record<string, number[]>;
const AD = Object.keys(V);
const MODEL = { faktorler: ["F1", "F2", "F3"], maddeFaktoru: [0, 0, 0, 1, 1, 1, 2, 2, 2] };

describe("DFA (3 faktör, 9 madde)", () => {
  const r = dogrulayiciFaktorAnalizi(AD.map((k) => V[k]), AD, MODEL);
  if (typeof r === "string") throw new Error(r);

  test("semopy: F_min, standart yükler, faktör korelasyonları", () => {
    yakin(r.fMin, 0.213392, 1e-5);
    const std = [0.737087, 0.615733, 0.628155, 0.731249, 0.637363, 0.74056, 0.616294, 0.761117, 0.561772];
    /* semopy SLSQP ile daha gevşek yakınsıyor (amaç 1e−6 düzeyinde aynı); tolerans buna göre. */
    r.yukler.forEach((y, i) => yakin(y.std, std[i], 5e-4));
    yakin(r.faktorKorelasyonlari[0][1], 0.327377, 2e-4);
    yakin(r.faktorKorelasyonlari[0][2], 0.313798, 2e-4);
    yakin(r.faktorKorelasyonlari[1][2], 0.446932, 2e-4);
    assert.equal(r.yakinsadi, true);
  });

  test("SciPy: ham yükler, SH, hata varyansları", () => {
    const b = [0.87836, 0.657605, 0.615168, 0.825437, 0.630573, 0.815958, 0.631536, 0.823371, 0.536018];
    const se = [0.097668, 0.083687, 0.079274, 0.084059, 0.072945, 0.08237, 0.080078, 0.088274, 0.076551];
    const hata = [0.648685, 0.708233, 0.580739, 0.592924, 0.581247, 0.548183, 0.651389, 0.492689, 0.622333];
    r.yukler.forEach((y, i) => {
      yakin(y.b, b[i]);
      yakin(y.se, se[i], 2e-5);
      yakin(y.hata, hata[i]);
    });
  });

  test("uyum indeksleri, CR, AVE", () => {
    assert.deepEqual([r.df, r.parametreSayisi], [24, 21]);
    yakin(r.chiKare, 42.46509760959019, 1e-4);
    yakin(r.cfi, 0.9516784203276388);
    yakin(r.tli, 0.9275176304914583);
    yakin(r.rmsea, 0.06217898734837708);
    yakin(r.srmr, 0.051738561575094634);
    yakin(r.gfi, 0.9547670366883921);
    yakin(r.agfi, 0.9151881937907352);
    [0.699823934137833, 0.7464960009372384, 0.6855153718405114].forEach((c, i) => yakin(r.cr[i], c));
    [0.43896556735041736, 0.49644631543000006, 0.42491368666414453].forEach((a, i) => yakin(r.ave[i], a));
    assert.deepEqual(r.heywood, []);
  });
});

test("tanımlanamayan model: tek maddeli faktör", () => {
  assert.equal(dogrulayiciFaktorAnalizi(AD.map((k) => V[k]), AD, { faktorler: ["A", "B"], maddeFaktoru: [0, 0, 0, 0, 0, 0, 0, 0, 1] }), "tanimsiz");
});

test("uyum yorum eşikleri", () => {
  assert.equal(uyumYorumu("cfi", 0.96), "iyi");
  assert.equal(uyumYorumu("rmsea", 0.07), "kabul edilebilir");
  assert.equal(uyumYorumu("srmr", 0.11), "zayıf");
});
