import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EN_COK_N,
  gucKorelasyon,
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

/*
  KORELASYONDA BÜYÜK N (23.11.2026 regresyonu).

  Yoğunluktaki üç üs ayrı ayrı alınıp çarpılıyordu; büyük N'de
  (1 − r²)^((n−4)/2) sıfıra, (1 − ρr)^(−(n−1,5)) sonsuza gidiyor ve
  çarpım NaN oluyordu. ρ = 0,01 ile N = 78.500'de güç NaN dönüyor,
  arama bunu sayı sanıp 100.000 bildiriyordu — gücü olmayan bir
  örneklem. Üsler artık log uzayında (log1p) toplanıp TEK SEFERDE
  üsse çevriliyor; integral penceresi de N'e göre daralıyor.

  BAĞIMSIZ, YÜKSEK HASSASİYETLİ REFERANS: mpmath 40 basamak
  (scripts/referans/korelasyon-guc-mp.py). ArvoLab'ın kodundan hiçbir
  şey kullanılmıyor; kritik r SciPy'nin t niceliğinden.
*/
const MP = JSON.parse(readFileSync("tests/fixtures/korelasyon-guc-mp.json", "utf8")) as {
  uretim: { basamak: number; tolerans: { guc: number } };
  noktalar: { ad: string; rho: number; alfa: number; yon: "iki" | "tek"; n: number; guc: number; gucMetin: string }[];
};

describe("korelasyonda büyük N: tam güç hesabı", () => {
  test("ρ = 0,01 · α = .05 · çift yönlü · hedef .80 — sonuç üretiliyor, NaN değil", () => {
    const g: GucGirdisi = { yontem: "korelasyon", etki: 0.01, alfa: 0.05, hedefGuc: 0.8, yon: "iki" };
    const r = ornekemBuyuklugu(g);
    assert.equal(r.engel, null, "eskiden gücü NaN olan bir N bildiriliyordu");
    if (r.engel !== null) return;
    assert.ok(Number.isFinite(r.ulasilanGuc), "ulaşılan güç sonlu olmalı");
    assert.ok(Number.isFinite(r.birKucukGuc as number), "bir önceki adayın gücü de sonlu olmalı");
    assert.equal(r.n, 78486);
    assert.ok(r.ulasilanGuc >= 0.8);
    assert.ok((r.birKucukGuc as number) < 0.8);
  });

  test("N = 78.500 ve üst sınır N = 100.000'de güç sonlu", () => {
    for (const n of [78500, 99999, EN_COK_N]) {
      const v = gucKorelasyon(n, 0.01, 0.05, "iki");
      assert.ok(Number.isFinite(v), `n=${n}: ${v}`);
      assert.ok(v > 0 && v <= 1, `n=${n}: ${v}`);
    }
    /* Geniş bir tarama: hiçbir N'de NaN/∞ olmamalı. */
    for (let n = 5; n <= EN_COK_N; n = Math.ceil(n * 1.7)) {
      for (const rho of [0.01, 0.05, 0.2, 0.5, 0.9]) {
        const v = gucKorelasyon(n, rho, 0.05, "iki");
        assert.ok(Number.isFinite(v), `n=${n} ρ=${rho}: ${v}`);
      }
    }
  });

  test("integral yüksek hassasiyetli referansla örtüşüyor (mpmath, 40 basamak)", () => {
    for (const nokta of MP.noktalar) {
      const v = gucKorelasyon(nokta.n, nokta.rho, nokta.alfa, nokta.yon);
      assert.ok(Number.isFinite(v), `${nokta.ad} n=${nokta.n}`);
      assert.ok(
        Math.abs(v - nokta.guc) < MP.uretim.tolerans.guc,
        `${nokta.ad} n=${nokta.n}: ${v} ≠ ${nokta.gucMetin}`,
      );
    }
  });

  test("referans, dönen N'nin hedefi karşıladığını ve bir öncekinin karşılamadığını gösteriyor", () => {
    const ciftler: [number, number, number, "iki" | "tek", number, number][] = [
      /* [ρ, α, hedef, yön, çözüm, bir önceki] */
      [0.3, 0.05, 0.8, "iki", 84, 83],
      [0.5, 0.05, 0.9, "tek", 31, 30],
      [0.01, 0.05, 0.8, "iki", 78486, 78485],
    ];
    for (const [rho, alfa, hedef, yon, cozum, onceki] of ciftler) {
      const bul = (n: number) => MP.noktalar.find((x) => x.n === n && x.rho === rho && x.yon === yon);
      const mpCozum = bul(cozum);
      const mpOnceki = bul(onceki);
      assert.ok(mpCozum && mpOnceki, `referansta ρ=${rho} n=${cozum}/${onceki} yok`);
      /* Bağımsız referansın kendisi iki yönlü koşulu sağlıyor. */
      assert.ok(mpCozum.guc >= hedef, `referans: n=${cozum} hedefi karşılamalı`);
      assert.ok(mpOnceki.guc < hedef, `referans: n=${onceki} hedefin altında olmalı`);
      /* ArvoLab aynı N'yi buluyor. */
      const r = ornekemBuyuklugu({ yontem: "korelasyon", etki: rho, alfa, hedefGuc: hedef, yon });
      assert.ok(r.engel === null && r.n === cozum, `ρ=${rho}: ${r.engel === null ? r.n : r.engel} ≠ ${cozum}`);
      if (r.engel !== null) continue;
      assert.ok(Math.abs(r.ulasilanGuc - mpCozum.guc) < MP.uretim.tolerans.guc);
      assert.ok(Math.abs((r.birKucukGuc as number) - mpOnceki.guc) < MP.uretim.tolerans.guc);
    }
  });

  /* Sayısal hata ile "ulaşılamıyor" ayrı iki durum: ayrı mesajları var. */
  test("sayısal hata ayrı bir engel ve ayrı mesaj", () => {
    assert.ok(GUC_ENGEL_METNI["sayisal-hata"].tr.includes("sayısal olarak hesaplanamadı"));
    assert.ok(GUC_ENGEL_METNI["sayisal-hata"].en.includes("could not be computed numerically"));
    assert.notEqual(GUC_ENGEL_METNI["sayisal-hata"].tr, GUC_ENGEL_METNI.ulasilamiyor.tr);
  });

  test("hiçbir yöntemde sonlu olmayan güçle sonuç dönmüyor", () => {
    const denemeler: GucGirdisi[] = [
      { yontem: "korelasyon", etki: 0.01, alfa: 0.05, hedefGuc: 0.8, yon: "iki" },
      { yontem: "korelasyon", etki: 0.02, alfa: 0.01, hedefGuc: 0.9, yon: "tek" },
      { yontem: "korelasyon", etki: 0.95, alfa: 0.05, hedefGuc: 0.99, yon: "iki" },
      { yontem: "bagimsizT", etki: 0.02, alfa: 0.05, hedefGuc: 0.8, yon: "iki" },
      { yontem: "eslestirilmisT", etki: 0.01, alfa: 0.05, hedefGuc: 0.8, yon: "iki" },
      { yontem: "tekYonluAnova", etki: 0.01, alfa: 0.05, hedefGuc: 0.8, grupSayisi: 3 },
      { yontem: "regresyon", etki: 0.001, alfa: 0.05, hedefGuc: 0.8, yordayiciSayisi: 2 },
    ];
    for (const g of denemeler) {
      const r = ornekemBuyuklugu(g);
      if (r.engel !== null) {
        assert.ok(["ulasilamiyor", "sayisal-hata"].includes(r.engel), `${JSON.stringify(g)}: ${r.engel}`);
        continue;
      }
      assert.ok(Number.isFinite(r.ulasilanGuc), JSON.stringify(g));
      assert.ok(r.birKucukGuc === null || Number.isFinite(r.birKucukGuc), JSON.stringify(g));
    }
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

  /*
    REGRESYON 1 (23.11.2026). `ikiGrup` gruplardan biri 2'nin altına
    düşünce onu BÜYÜTÜYOR ve n1 + n2 aranan N'yi aşabiliyordu: ekranda
    yazan toplam ile grupların toplamı ayrışıyordu.
  */
  test("her oranda n1 + n2 toplam N'ye eşit ve iki grup da en az 2", () => {
    for (const oran of [0.02, 0.05, 0.1, 0.5, 1, 2, 10, 50, 100]) {
      const r = ornekemBuyuklugu({ ...taban, dagilimOrani: oran });
      assert.equal(r.engel, null, `oran ${oran}`);
      if (r.engel !== null) continue;
      const [n1, n2] = r.grupBasina as number[];
      assert.equal(n1 + n2, r.n, `oran ${oran}: ${n1} + ${n2} ≠ ${r.n}`);
      assert.ok(n1 >= 2 && n2 >= 2, `oran ${oran}: ${n1}, ${n2}`);
      /* Yuvarlama kuralı: n1 = round(N/(1+κ)), [2, N−2] aralığına sıkıştırılmış. */
      const beklenen = Math.min(Math.max(2, Math.round(r.n / (1 + oran))), r.n - 2);
      assert.equal(n1, beklenen, `oran ${oran}: yuvarlama kuralı`);
    }
  });

  test("küçük toplamlarda da toplam aşılmıyor", () => {
    for (let N = 4; N <= 12; N += 1) {
      for (const oran of [0.02, 1, 100]) {
        const g = gucDegeri({ ...taban, dagilimOrani: oran }, N);
        assert.ok(typeof g === "number" && g >= 0 && g <= 1, `N=${N} oran=${oran}`);
      }
    }
  });

  /* Eşit dağılım 1:1 sunuluyorsa bir önceki aday da dengeli olmalı. */
  test("eşit dağılımda bir önceki geçerli aday da dengeli (64+64 → 63+63)", () => {
    const r = ornekemBuyuklugu(taban);
    assert.ok(r.engel === null);
    if (r.engel !== null) return;
    assert.equal(r.n, 128);
    assert.deepEqual(r.grupBasina, [64, 64]);
    assert.equal(r.adim, 2, "eşit dağılımda arama adımı 2");
    const onceki = r.n - r.adim;
    assert.equal(onceki, 126);
    const o = gucDegeri({ ...taban }, onceki);
    assert.ok(typeof o === "number" && Math.abs(o - (r.birKucukGuc as number)) < 1e-12);
    /* 126 = 63 + 63: dengeli. */
    const ayrinti = ornekemBuyuklugu({ ...taban, hedefGuc: 0.795 });
    assert.ok(ayrinti.engel === null && (ayrinti.grupBasina as number[])[0] === (ayrinti.grupBasina as number[])[1]);
  });

  test("oran 1 değilken adım 1, ANOVA'da grup sayısı", () => {
    const oranli = ornekemBuyuklugu({ ...taban, dagilimOrani: 2 });
    assert.ok(oranli.engel === null && oranli.adim === 1);
    const anova = ornekemBuyuklugu({ yontem: "tekYonluAnova", etki: 0.25, alfa: 0.05, hedefGuc: 0.8, grupSayisi: 3 });
    assert.ok(anova.engel === null && anova.adim === 3);
  });

  /*
    REGRESYON 2. Aralık ikiye katlanırken sonraki adım 100.000'i aşınca
    doğrudan "ulaşılamıyor" dönülüyordu; sınırın ALTINDAKİ son geçerli
    aday hedefi karşılıyor olsa bile.
  */
  test("üst sınıra yakın geçerli örneklem atlanmıyor", () => {
    const r = ornekemBuyuklugu({ ...taban, etki: 0.01775 });
    assert.equal(r.engel, null, "sınırın altında geçerli aday var, bulunmalı");
    if (r.engel !== null) return;
    assert.ok(r.n <= EN_COK_N && r.n > 99000, `N=${r.n}`);
    assert.ok(r.ulasilanGuc >= 0.8);
    assert.ok((r.birKucukGuc as number) < 0.8, "bir önceki aday hedefin altında");
  });

  test("dönen her sonuçta hedef karşılanıyor ve bir önceki aday altında", () => {
    const denemeler: GucGirdisi[] = [
      taban,
      { ...taban, yon: "tek" },
      { ...taban, dagilimOrani: 3 },
      { yontem: "eslestirilmisT", etki: 0.4, alfa: 0.05, hedefGuc: 0.9, yon: "iki" },
      { yontem: "tekYonluAnova", etki: 0.2, alfa: 0.01, hedefGuc: 0.85, grupSayisi: 5 },
      { yontem: "korelasyon", etki: 0.2, alfa: 0.05, hedefGuc: 0.8, yon: "iki" },
      { yontem: "regresyon", etki: 0.1, alfa: 0.05, hedefGuc: 0.9, yordayiciSayisi: 4 },
    ];
    for (const g of denemeler) {
      const r = ornekemBuyuklugu(g);
      assert.equal(r.engel, null, JSON.stringify(g));
      if (r.engel !== null) continue;
      const simdi = gucDegeri(g, r.n);
      assert.ok(typeof simdi === "number" && simdi >= g.hedefGuc, `${JSON.stringify(g)}: ${simdi} < ${g.hedefGuc}`);
      const onceki = gucDegeri(g, r.n - r.adim);
      assert.ok(typeof onceki === "number" && onceki < g.hedefGuc, `${JSON.stringify(g)}: bir önceki ${onceki} hedefin altında olmalı`);
    }
  });

  /*
    REGRESYON 3. `new Array(2.5)` RangeError atıyordu: kullanıcı sebep
    yerine çökme görüyordu.
  */
  test("tam sayı olmayan grup ve yordayıcı sayısı alan hatasıyla reddediliyor", () => {
    for (const k of [2.5, 3.1, Math.PI, NaN, Infinity]) {
      const r = ornekemBuyuklugu({ yontem: "tekYonluAnova", etki: 0.25, alfa: 0.05, hedefGuc: 0.8, grupSayisi: k });
      assert.equal(r.engel, "grup-gecersiz", `k=${k}`);
      assert.equal((gucDegeri({ yontem: "tekYonluAnova", etki: 0.25, alfa: 0.05, hedefGuc: 0.8, grupSayisi: k }, 60) as { engel: string }).engel, "grup-gecersiz");
    }
    for (const p of [1.5, 2.7, NaN, Infinity]) {
      const r = ornekemBuyuklugu({ yontem: "regresyon", etki: 0.15, alfa: 0.05, hedefGuc: 0.8, yordayiciSayisi: p });
      assert.equal(r.engel, "yordayici-gecersiz", `p=${p}`);
    }
  });

  test("geçerli grup sayısında ANOVA dizi hatası vermiyor", () => {
    for (const k of [2, 3, 7]) {
      const r = ornekemBuyuklugu({ yontem: "tekYonluAnova", etki: 0.3, alfa: 0.05, hedefGuc: 0.8, grupSayisi: k });
      assert.ok(r.engel === null && r.grupBasina?.length === k);
      assert.ok((r.grupBasina as number[]).every(Number.isInteger), `k=${k} grup başına tam sayı`);
      assert.equal((r.grupBasina as number[]).reduce((a, b) => a + b, 0), r.n);
    }
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
