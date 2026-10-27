/*
  KISMİ KORELASYON, McNEMAR, LOJİSTİK REGRESYON, AÇIMLAYICI FAKTÖR ANALİZİ.

  Beklenen değerler bağımsız uygulamalardan:
  - kısmi korelasyon: pingouin.partial_corr
  - McNemar: statsmodels (exact=True; exact=False, correction=True)
  - lojistik: statsmodels Logit (tests/fixtures/lojistik-verisi.json)
  - faktör: factor_analyzer (KMO, Bartlett), NumPy (öz değerler) ve R'ın
    varimax algoritmasının (SVD) NumPy kopyası — bizimki ikili döndürme,
    yani AYNI optimuma farklı yoldan gidiyor (tests/fixtures/efa-maddeleri.json).
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kismiKorelasyon, mcnemar } from "@/lib/stats-iliski";
import { lojistikRegresyon } from "@/lib/stats-lojistik";
import { aciklayiciFaktorAnalizi, maddeUyarisi } from "@/lib/stats-faktor";

const yakin = (a: number, b: number, tolerans = 1e-4) => assert.ok(Math.abs(a - b) < tolerans, `${a} ≈ ${b} değil`);

test("kısmi korelasyon (pingouin)", () => {
  const r = kismiKorelasyon([2, 4, 5, 7, 8, 10, 11, 13, 15, 16], [1, 3, 4, 4, 6, 7, 9, 9, 12, 13], [[20, 22, 25, 24, 30, 31, 33, 35, 36, 40]])!;
  yakin(r.r, 0.664196);
  assert.equal(r.df, 7);
  yakin(r.p, 0.051034);
});

test("McNemar: kesin p ve süreklilik düzeltmeli χ² (statsmodels)", () => {
  /* Tablo [[20, 5], [15, 10]] satır satır kuruluyor. */
  const once = [...Array(25).fill("evet"), ...Array(25).fill("hayir")];
  const sonra = [...Array(20).fill("evet"), ...Array(5).fill("hayir"), ...Array(15).fill("evet"), ...Array(10).fill("hayir")];
  const r = mcnemar(once, sonra, ["evet", "hayir"]);
  assert.deepEqual(r.tablo, [[20, 5], [15, 10]]);
  yakin(r.pKesin, 0.041389465);
  yakin(r.chiKare, 4.05);
  yakin(r.pChiKare, 0.044171345);
});

describe("ikili lojistik regresyon (statsmodels Logit)", () => {
  const veri = JSON.parse(readFileSync("tests/fixtures/lojistik-verisi.json", "utf8")) as { a: number[]; b: number[]; y: number[] };
  test("katsayılar, SH, p, olabilirlik ve R²'ler", () => {
    const r = lojistikRegresyon(veri.y, [veri.a, veri.b], ["a", "b"]);
    assert.ok(typeof r === "object");
    const b = [-12.524385284169743, 0.24178814122996248, 1.80599141019456];
    const se = [2.7229587274695337, 0.054272181597864504, 0.6685990570545007];
    const p = [4.234042121970635e-6, 8.38530559598806e-6, 0.006909859166741893];
    r.katsayilar.forEach((k, i) => {
      yakin(k.b, b[i]);
      yakin(k.se, se[i]);
      yakin(k.p, p[i], 1e-7);
      yakin(k.expB, Math.exp(b[i]), 1e-4 * Math.exp(b[i]));
    });
    const llf = -31.63828064189716;
    const ll0 = -55.42677184106291;
    yakin(r.eksiIkiLL, -2 * llf);
    yakin(r.modelChiKare, 47.576982398331495);
    yakin(r.modelP, 4.664332903577018e-11, 1e-13);
    const cs = 1 - Math.exp((2 * (ll0 - llf)) / 80);
    yakin(r.coxSnell, cs);
    yakin(r.nagelkerke, cs / (1 - Math.exp((2 * ll0) / 80)));
    yakin(r.dogruOrani, 0.8);
  });

  test("tam ayrışma ve tek sınıf sonuç vermez", () => {
    assert.equal(lojistikRegresyon([0, 0, 0, 1, 1, 1], [[1, 2, 3, 4, 5, 6]], ["x"]), "ayrisma");
    assert.equal(lojistikRegresyon([1, 1, 1], [[1, 2, 3]], ["x"]), "tek-sinif");
  });
});

describe("açımlayıcı faktör analizi", () => {
  const maddeler = JSON.parse(readFileSync("tests/fixtures/efa-maddeleri.json", "utf8")) as number[][];
  test("KMO, Bartlett, öz değerler, varimax yükleri", () => {
    const r = aciklayiciFaktorAnalizi(maddeler);
    assert.ok(typeof r === "object");
    yakin(r.kmo, 0.714387780018345);
    [0.6506840520550903, 0.7734644175989603, 0.7583034631492527, 0.6832313870421276, 0.6725486602229996, 0.8045681830146126].forEach((k, i) =>
      yakin(r.maddeKmo[i], k),
    );
    yakin(r.bartlettChi, 174.80257072928197, 1e-3);
    assert.equal(r.bartlettDf, 15);
    [2.980556006822805, 1.700588959613828, 0.5085904691530188, 0.38638676671095973, 0.22742499243305103, 0.19645280526633654].forEach((d, i) =>
      yakin(r.ozDegerler[i], d),
    );
    assert.equal(r.faktorSayisi, 2, "Kaiser: öz değeri 1'den büyük iki faktör");
    /* R varimax (NumPy kopyası); işaret serbest, mutlak değerle. */
    const beklenen = [
      [0.927659750548377, 0.03526677316805167],
      [0.8404437176991856, 0.22832903485643655],
      [0.8643019295972578, 0.10864177235786689],
      [0.08635846000175096, 0.8820275174824709],
      [0.2010771969096851, 0.9015646870295668],
      [0.07824216413217937, 0.8107064030216737],
    ];
    r.yukler.forEach((satir, i) => satir.forEach((y, f) => yakin(Math.abs(y), beklenen[i][f], 1e-3)));
    [0.8617963580771639, 0.7584797907785001, 0.7588208602066018, 0.7854303252101645, 0.8532509240157771, 0.6633667081484275].forEach((h, i) =>
      yakin(r.ortakVaryans[i], h),
    );
    yakin(r.aciklananYuzde[0], 39.465462331534425, 1e-2);
    yakin(r.aciklananYuzde[1], 38.55362044240948, 1e-2);
  });

  test("madde uyarıları: düşük yük ve binişik", () => {
    assert.equal(maddeUyarisi([0.25, 0.1]), "dusuk");
    assert.equal(maddeUyarisi([0.45, 0.4]), "binisik");
    assert.equal(maddeUyarisi([0.7, 0.2]), null);
  });
});
