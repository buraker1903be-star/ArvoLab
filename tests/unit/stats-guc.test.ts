import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EN_COK_N,
  GUC_ENGEL_METNI,
  gucDegeri,
  noncentralFCDF,
  noncentralTCDF,
  ornekemBuyuklugu,
  type GucEngel,
  type GucGirdisi,
} from "@/lib/stats-guc";

/*
  GÜÇ ve ÖRNEKLEM — BAĞIMSIZ DOĞRULAMA (23.11.2026).

  BEKLENEN DEĞERLER ARVOLAB'IN KODUNDAN ÜRETİLMEDİ. İki ayrı uygulama:

    scripts/referans/guc-referans.R   → R 4.3.3 + pwr 1.3.0
      pt() / pf() ile merkezi olmayan dağılımlar, korelasyonda r'nin
      TAM yoğunluğu (Hotelling, 2F1 serisi).
    scripts/referans/guc-referans.py  → Python + statsmodels + SciPy
      TTestIndPower / TTestPower / FTestAnovaPower / FTestPower,
      korelasyonda ayrıca MONTE-CARLO (400.000 tur).

  Monte-Carlo, korelasyonda hangi modelin kullanıldığını ölçüyor:
  yaygın Fisher z yaklaşıklığı gücü düşük gösterip bir katılımcı fazla
  istiyor; ArvoLab tam dağılımı kullanıyor (G*Power "Exact" ile aynı).
*/
const R = JSON.parse(readFileSync("tests/fixtures/guc-referans.json", "utf8")) as {
  uretim: { tolerans: { dagilim: number; guc: number } };
  tNoktalari: { df: number; ncp: number; q: number; p: number }[];
  fNoktalari: { df1: number; df2: number; lambda: number; q: number; p: number }[];
  senaryolar: {
    ad: string; yontem: GucGirdisi["yontem"]; etki: number; alfa: number; hedefGuc: number;
    yon: "iki" | "tek"; grupSayisi: number | null; yordayiciSayisi: number | null; dagilimOrani: number | null;
    adim: number; enKucukN: number; ulasilanGuc: number; birKucukGuc: number | null;
    fisherZGuc: number | null; izgara: number[]; izgaraGuc: number[];
  }[];
};
const PY = JSON.parse(readFileSync("tests/fixtures/guc-referans-python.json", "utf8")) as {
  senaryolar: { ad: string; N: number; guc: number; birKucukGuc: number }[];
  korelasyonBenzetimi: { ad: string; N: number; fisherZ: number; guc: number; standartHata: number; tur: number }[];
};

const girdiden = (s: (typeof R.senaryolar)[number]): GucGirdisi => ({
  yontem: s.yontem,
  etki: s.etki,
  alfa: s.alfa,
  hedefGuc: s.hedefGuc,
  yon: s.yon,
  grupSayisi: s.grupSayisi ?? undefined,
  yordayiciSayisi: s.yordayiciSayisi ?? undefined,
  dagilimOrani: s.dagilimOrani ?? undefined,
});

describe("merkezi olmayan dağılımlar — R'ye karşı", () => {
  test("noncentral t: 210 nokta", () => {
    let enBuyuk = 0;
    for (const n of R.tNoktalari) enBuyuk = Math.max(enBuyuk, Math.abs(noncentralTCDF(n.q, n.df, n.ncp) - n.p));
    /* Sınır normalCDF'in kendi doğruluğu (~1e-8); dağılımın kendisi daha iyi. */
    assert.ok(enBuyuk < 1e-7, `en büyük fark ${enBuyuk}`);
  });

  test("noncentral F: 400 nokta", () => {
    let enBuyuk = 0;
    for (const n of R.fNoktalari) enBuyuk = Math.max(enBuyuk, Math.abs(noncentralFCDF(n.q, n.df1, n.df2, n.lambda) - n.p));
    assert.ok(enBuyuk < R.uretim.tolerans.dagilim, `en büyük fark ${enBuyuk}`);
  });
});

describe("örneklem büyüklüğü — R ve Python referansları", () => {
  for (const s of R.senaryolar) {
    test(`${s.ad}: en küçük N ve ulaşılan güç R ile aynı`, () => {
      const r = ornekemBuyuklugu(girdiden(s));
      assert.equal(r.engel, null);
      if (r.engel !== null) return;
      assert.equal(r.n, s.enKucukN, `N ${r.n} ≠ ${s.enKucukN}`);
      assert.ok(Math.abs(r.ulasilanGuc - s.ulasilanGuc) < R.uretim.tolerans.guc, `güç ${r.ulasilanGuc} ≠ ${s.ulasilanGuc}`);
      /* Hedef gerçekten karşılanıyor ve bir küçüğü karşılamıyor. */
      assert.ok(r.ulasilanGuc >= s.hedefGuc);
      if (s.birKucukGuc !== null) {
        assert.ok(s.birKucukGuc < s.hedefGuc, "referansta bir küçüğü hedefin altında");
        assert.ok(Math.abs((r.birKucukGuc as number) - s.birKucukGuc) < R.uretim.tolerans.guc);
        const kucuk = gucDegeri(girdiden(s), s.enKucukN - s.adim);
        assert.ok(typeof kucuk === "number" && kucuk < s.hedefGuc, "bir küçük örneklem hedefi karşılamamalı");
      }
    });

    test(`${s.ad}: N ızgarasının tamamında güç R ile aynı`, () => {
      s.izgara.forEach((N, i) => {
        const g = gucDegeri(girdiden(s), N);
        assert.ok(typeof g === "number");
        if (typeof g !== "number") return;
        assert.ok(Math.abs(g - s.izgaraGuc[i]) < R.uretim.tolerans.guc, `N=${N}: ${g} ≠ ${s.izgaraGuc[i]}`);
      });
    });
  }

  test("Python (statsmodels) ikinci bağımsız referans olarak da örtüşüyor", () => {
    for (const p of PY.senaryolar) {
      const s = R.senaryolar.find((x) => x.ad === p.ad);
      assert.ok(s, p.ad);
      const g = gucDegeri(girdiden(s), p.N);
      assert.ok(typeof g === "number");
      if (typeof g !== "number") return;
      /* Korelasyonda Python Fisher z kullanıyor; orada karşılaştırma benzetimle. */
      if (s.yontem === "korelasyon") continue;
      assert.ok(Math.abs(g - p.guc) < 1e-6, `${p.ad}: ${g} ≠ ${p.guc}`);
    }
  });
});

describe("korelasyonda tam dağılım, yaklaşıklık değil", () => {
  test("Monte-Carlo tam dağılımı doğruluyor; Fisher z sapıyor", () => {
    for (const b of PY.korelasyonBenzetimi) {
      const s = R.senaryolar.find((x) => x.ad === b.ad);
      assert.ok(s);
      const g = gucDegeri(girdiden(s), b.N);
      assert.ok(typeof g === "number");
      if (typeof g !== "number") return;
      /* Benzetimin kendi belirsizliği ±3 standart hata. */
      const sinir = 3 * b.standartHata;
      assert.ok(Math.abs(g - b.guc) < sinir, `${b.ad} N=${b.N}: ${g} benzetimden (${b.guc} ± ${sinir}) uzak`);
      /* Fisher z yaklaşıklığı gücü DÜŞÜK gösteriyor: raporlanan değer o değil. */
      assert.ok(b.fisherZ < g, `${b.ad}: Fisher z (${b.fisherZ}) tam dağılımın (${g}) altında kalmalı`);
    }
  });

  test("Fisher z kullanılsaydı bir katılımcı daha isterdi", () => {
    const s = R.senaryolar.find((x) => x.ad === "korelasyon-r03");
    assert.ok(s);
    assert.equal(s.enKucukN, 84);
    assert.ok((s.fisherZGuc as number) < 0.8, "Fisher z 84'te hedefi karşılamıyor");
    const r = ornekemBuyuklugu(girdiden(s));
    assert.ok(r.engel === null && r.n === 84);
  });
});

describe("sınır senaryoları", () => {
  const taban: GucGirdisi = { yontem: "bagimsizT", etki: 0.5, alfa: 0.05, hedefGuc: 0.8, yon: "iki" };

  test("grup sayısı arttıkça eşit gruplu ANOVA'da toplam N büyüyor ve N gruba bölünüyor", () => {
    let onceki = 0;
    for (const k of [2, 3, 4, 6, 8]) {
      const r = ornekemBuyuklugu({ yontem: "tekYonluAnova", etki: 0.25, alfa: 0.05, hedefGuc: 0.8, grupSayisi: k });
      assert.ok(r.engel === null);
      if (r.engel !== null) return;
      assert.equal(r.n % k, 0, `N ${r.n} grup sayısına (${k}) bölünmeli`);
      assert.equal(r.grupBasina?.length, k);
      assert.ok(r.n > onceki, "grup sayısı artınca toplam N azalmamalı");
      onceki = r.n;
    }
  });

  test("dağılım oranı: eşit olmayan gruplar toplamda daha çok kişi ister", () => {
    const esit = ornekemBuyuklugu({ ...taban, dagilimOrani: 1 });
    const iki = ornekemBuyuklugu({ ...taban, dagilimOrani: 2 });
    const dort = ornekemBuyuklugu({ ...taban, dagilimOrani: 4 });
    assert.ok(esit.engel === null && iki.engel === null && dort.engel === null);
    if (esit.engel !== null || iki.engel !== null || dort.engel !== null) return;
    assert.ok(iki.n > esit.n && dort.n > iki.n, `${esit.n} < ${iki.n} < ${dort.n}`);
    /* Oran gerçekten uygulanıyor: ikinci grup yaklaşık iki katı. */
    const [n1, n2] = iki.grupBasina as number[];
    assert.ok(Math.abs(n2 / n1 - 2) < 0.05, `oran ${n2 / n1}`);
  });

  test("tek yönlü test çift yönlüden az kişi ister", () => {
    const iki = ornekemBuyuklugu({ ...taban, yon: "iki" });
    const tek = ornekemBuyuklugu({ ...taban, yon: "tek" });
    assert.ok(iki.engel === null && tek.engel === null);
    if (iki.engel !== null || tek.engel !== null) return;
    assert.ok(tek.n < iki.n, `${tek.n} < ${iki.n}`);
  });

  test("eşleştirilmiş testte birim KATILIMCI, bağımsızda gözlem", () => {
    const esl = ornekemBuyuklugu({ yontem: "eslestirilmisT", etki: 0.4, alfa: 0.05, hedefGuc: 0.8, yon: "iki" });
    assert.ok(esl.engel === null && esl.birim === "katilimci" && esl.grupBasina === null);
    const bag = ornekemBuyuklugu(taban);
    assert.ok(bag.engel === null && bag.birim === "gozlem");
  });

  test("katılımcı kaybı: analize gereken ile başlangıçta alınacak ayrı", () => {
    const kayipsiz = ornekemBuyuklugu(taban);
    const kayipli = ornekemBuyuklugu({ ...taban, kayipOrani: 0.2 });
    assert.ok(kayipsiz.engel === null && kayipli.engel === null);
    if (kayipsiz.engel !== null || kayipli.engel !== null) return;
    assert.equal(kayipsiz.baslangicN, null, "kayıp yoksa ikinci sayı gösterilmez");
    assert.equal(kayipli.n, kayipsiz.n, "kayıp, ANALİZE gereken sayıyı değiştirmez");
    assert.equal(kayipli.baslangicN, Math.ceil(kayipsiz.n / 0.8));
    assert.ok((kayipli.baslangicN as number) > kayipli.n);
  });

  test("geçersiz girişlerin her biri kendi sebebini veriyor", () => {
    const durumlar: [Partial<GucGirdisi>, GucEngel][] = [
      [{ etki: 0 }, "etki-gecersiz"],
      [{ etki: -0.3 }, "etki-gecersiz"],
      [{ etki: NaN }, "etki-gecersiz"],
      [{ yontem: "korelasyon", etki: 1 }, "etki-gecersiz"],
      [{ alfa: 0 }, "alfa-gecersiz"],
      [{ alfa: 1 }, "alfa-gecersiz"],
      [{ hedefGuc: 1 }, "guc-gecersiz"],
      [{ hedefGuc: 0 }, "guc-gecersiz"],
      [{ yontem: "tekYonluAnova", grupSayisi: 1 }, "grup-gecersiz"],
      [{ yontem: "regresyon", yordayiciSayisi: 0 }, "yordayici-gecersiz"],
      [{ dagilimOrani: 0 }, "dagilim-gecersiz"],
      [{ kayipOrani: 1 }, "kayip-gecersiz"],
      [{ kayipOrani: -0.1 }, "kayip-gecersiz"],
    ];
    for (const [yama, beklenen] of durumlar) {
      const r = ornekemBuyuklugu({ ...taban, ...yama });
      assert.equal(r.engel, beklenen, JSON.stringify(yama));
    }
  });

  test("ulaşılamayan hedef sessizce devasa bir sayı vermiyor", () => {
    const r = ornekemBuyuklugu({ ...taban, etki: 0.0005, hedefGuc: 0.99 });
    assert.equal(r.engel, "ulasilamiyor");
    assert.match(GUC_ENGEL_METNI.ulasilamiyor.tr, new RegExp(String(EN_COK_N / 1000)));
  });

  test("her engelin iki dilde açıklaması var", () => {
    for (const e of Object.keys(GUC_ENGEL_METNI) as GucEngel[]) {
      assert.ok(GUC_ENGEL_METNI[e].tr.length > 15, e);
      assert.ok(GUC_ENGEL_METNI[e].en.length > 15, e);
    }
  });
});
