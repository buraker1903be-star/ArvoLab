import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ANALIZ_TURLERI } from "@/lib/analiz-turleri";
import { ANALIZ_KATEGORILERI } from "@/lib/analiz-kategorileri";
import { BILMIYORUM, analizOnerisi, soruyuGetir, type Yanitlar } from "@/lib/analiz-onerisi";

const oner = (y: Yanitlar) => analizOnerisi(y);
const turleri = (y: Yanitlar) => oner(y).adaylar.map((a) => a.tur);
const sorular = (y: Yanitlar) => oner(y).sorular.map((s) => s.anahtar);

/*
  "HANGİ ANALİZİ SEÇMELİYİM?" YARDIMI (22.11.2026).

  Bu testler akışın üç yapısal kuralını sabitliyor:
  (1) hiçbir cevap "kesin doğru test" demiyor,
  (2) eksik bilgi aday listesini daraltmıyor, sınırı yazıyor,
  (3) desteklenmeyen desende aday verilmiyor — benzerine yönlendirilmiyor.

  Yardım akışının yanlış kesin yönlendirme yapması, yöntem bölümünde
  savunulamayan bir analize yol açar; bu yüzden kurallar kodda yapısal.
*/
describe("yardım akışı: soru sırası", () => {
  test("cevap yokken yalnızca amaç sorulur, aday verilmez", () => {
    const o = oner({});
    assert.deepEqual(o.sorular.map((s) => s.anahtar), ["amac"]);
    assert.deepEqual(o.adaylar, []);
    assert.equal(o.tamam, false);
    assert.equal(o.guven, "belirsiz");
  });

  test("herkese her soru sorulmaz: betimleme tek soruda biter", () => {
    const o = oner({ amac: "betimle" });
    assert.deepEqual(o.sorular.map((s) => s.anahtar), ["amac"]);
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["descriptives"]);
    assert.equal(o.tamam, true);
  });

  test("ölçek ve model dalları ikinci soruda biter", () => {
    assert.deepEqual(sorular({ amac: "olcek" }), ["amac", "olcekAmaci"]);
    assert.deepEqual(turleri({ amac: "olcek", olcekAmaci: "guvenilirlik" }), ["reliability"]);
    assert.deepEqual(turleri({ amac: "olcek", olcekAmaci: "yapiKesfet" }), ["faktor"]);
    assert.deepEqual(turleri({ amac: "olcek", olcekAmaci: "yapiDogrula" }), ["dfa"]);
    assert.deepEqual(turleri({ amac: "model", modelTuru: "araci" }), ["aracilik"]);
    assert.deepEqual(turleri({ amac: "model", modelTuru: "duzenleyici" }), ["duzenleyicilik"]);
  });

  test("karma desende grup sayısı sorulmaz (desen zaten tanımlı)", () => {
    const s = sorular({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "karma" });
    assert.ok(!s.includes("grupSayisi"));
    assert.deepEqual(turleri({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "karma" }), ["karmaanova"]);
  });

  test("iki gruplu karşılaştırmada faktör ve kovaryat sorulmaz", () => {
    const s = sorular({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "iki" });
    assert.ok(!s.includes("faktorSayisi"));
    assert.ok(!s.includes("kovaryat"));
  });

  test("her soruda 'Bilmiyorum' var ve açıklaması yazılı", () => {
    const anahtarlar = ["amac", "sonucTuru", "olcumDuzeni", "grupSayisi", "faktorSayisi", "kovaryat", "cokluSonuc", "kontrolDegiskeni", "olcekAmaci", "modelTuru"] as const;
    for (const a of anahtarlar) {
      const soru = soruyuGetir(a);
      const bilmiyorum = soru.secenekler.find((s) => s.anahtar === BILMIYORUM);
      assert.ok(bilmiyorum, `${a}: Bilmiyorum seçeneği yok`);
      assert.ok(soru.baslik.tr && soru.baslik.en, `${a}: iki dilde başlık`);
      for (const s of soru.secenekler) assert.ok(s.etiket.tr && s.etiket.en, `${a}/${s.anahtar}: iki dilde etiket`);
    }
  });
});

describe("bağımsız / tekrarlı ayrımı", () => {
  /*
    AYNI SAYILAR, İKİ AYRI TEST. Bu ayrım bilinmeden seçilen test
    yöntem bölümünde savunulamaz; akış bu yüzden iki aday birlikte
    gösterip bilgiyi istiyor.
  */
  test("iki grup · sürekli · bağımsız → bağımsız örneklem t-testi", () => {
    assert.deepEqual(turleri({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "iki" }), ["ttest"]);
  });

  test("iki ölçüm · sürekli · tekrarlı → eşleştirilmiş t-testi", () => {
    assert.deepEqual(turleri({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "tekrarli", grupSayisi: "iki" }), ["pairedttest"]);
  });

  test("üç grup bağımsız → ANOVA, üç ölçüm tekrarlı → tekrarlı ölçümler ANOVA", () => {
    assert.deepEqual(
      turleri({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "tek", kovaryat: "yok" }),
      ["anova"],
    );
    assert.deepEqual(turleri({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" }), ["tekrarlianova"]);
  });

  test("parametrik olmayan tarafta da ayrım korunuyor", () => {
    assert.deepEqual(turleri({ amac: "fark", sonucTuru: "sirali", olcumDuzeni: "bagimsiz", grupSayisi: "iki" }), ["mannwhitney"]);
    assert.deepEqual(turleri({ amac: "fark", sonucTuru: "sirali", olcumDuzeni: "tekrarli", grupSayisi: "iki" }), ["wilcoxon"]);
    assert.deepEqual(turleri({ amac: "fark", sonucTuru: "sirali", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok" }), ["kruskalwallis"]);
    assert.deepEqual(turleri({ amac: "fark", sonucTuru: "sirali", olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" }), ["friedman"]);
  });

  test("DÜZEN BİLİNMİYORSA tek testi kesin ilan etmez: iki aday ve açık sınır", () => {
    const o = oner({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: BILMIYORUM, grupSayisi: "iki" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["ttest", "pairedttest"]);
    assert.equal(o.guven, "aday");
    assert.ok(
      o.sinirlar.some((s) => /bağımsız mı tekrarlı mı/i.test(s.tr)),
      "düzen bilgisinin neden gerektiği yazılmalı",
    );
  });

  test("düzen bilinmiyorsa üç gruplu karşılaştırmada da iki aday", () => {
    assert.deepEqual(
      turleri({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: BILMIYORUM, grupSayisi: "ucDahaCok" }),
      ["anova", "tekrarlianova"],
    );
  });
});

describe("eksik bilgi aday listesini daraltmaz", () => {
  test("sonuç türü bilinmiyorsa parametrik VE parametrik olmayan adaylar birlikte", () => {
    const o = oner({ amac: "fark", sonucTuru: BILMIYORUM, olcumDuzeni: "bagimsiz", grupSayisi: "iki" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["ttest", "mannwhitney"]);
    assert.ok(o.sinirlar.some((s) => /Dağılım testinin sonucu tek başına/i.test(s.tr)));
  });

  test("normallik sonucuna göre otomatik seçim yok: iki aday da listede kalır", () => {
    const o = oner({ amac: "fark", sonucTuru: BILMIYORUM, olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["tekrarlianova", "friedman"]);
  });

  test("grup sayısı bilinmiyorsa iki ve çok gruplu adaylar birlikte", () => {
    assert.deepEqual(
      turleri({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: BILMIYORUM }),
      ["ttest", "anova"],
    );
  });

  test("amaç bilinmiyorsa aday verilmez ve ne yapılacağı yazılır", () => {
    const o = oner({ amac: BILMIYORUM });
    assert.deepEqual(o.adaylar, []);
    assert.equal(o.guven, "belirsiz");
    assert.ok(o.sinirlar.some((s) => /yüklemine bakın/i.test(s.tr)));
  });

  test("faktör sayısı bilinmiyorsa tek ve iki yönlü ANOVA birlikte", () => {
    assert.deepEqual(
      turleri({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: BILMIYORUM }),
      ["anova", "ikiyonluanova"],
    );
  });

  test("kovaryat bilinmiyorsa ANOVA ve ANCOVA birlikte", () => {
    assert.deepEqual(
      turleri({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "tek", kovaryat: BILMIYORUM }),
      ["anova", "ancova"],
    );
  });
});

describe("desteklenmeyen desen benzerine yönlendirilmez", () => {
  const desteklenmeyenDurum = (y: Yanitlar, kalip: RegExp) => {
    const o = oner(y);
    assert.deepEqual(o.adaylar, [], "desteklenmeyen desende aday verilmemeli");
    assert.ok(o.desteklenmeyen, "desteklenmeyen notu yazılmalı");
    assert.match(o.desteklenmeyen.tr, kalip);
    assert.equal(o.guven, "belirsiz");
  };

  test("üç tekrarlı ölçüm · kategorik → Cochran Q gerekir, McNemar ÖNERİLMEZ", () => {
    desteklenmeyenDurum(
      { amac: "fark", sonucTuru: "kategorik", olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" },
      /Cochran Q/,
    );
    const o = oner({ amac: "fark", sonucTuru: "kategorik", olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" });
    assert.ok(!o.adaylar.some((a) => a.tur === "mcnemar"));
  });

  test("birden çok sonuç değişkeni tek testte → MANOVA yok, ANOVA eşdeğer sayılmaz", () => {
    const o = oner({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "iki", cokluSonuc: "cok" });
    assert.deepEqual(o.adaylar, []);
    assert.match(o.desteklenmeyen?.tr ?? "", /MANOVA/);
    assert.match(o.desteklenmeyen?.tr ?? "", /aynı şey değildir/);
  });

  test("karma desen · kategorik sonuç → GEE/GLMM gerekir, ki-kare önerilmez", () => {
    desteklenmeyenDurum({ amac: "fark", sonucTuru: "kategorik", olcumDuzeni: "karma" }, /GEE\/GLMM/);
  });

  test("karma desen · sıralı sonuç → parametrik olmayan karşılığı yok", () => {
    desteklenmeyenDurum({ amac: "fark", sonucTuru: "sirali", olcumDuzeni: "karma" }, /parametrik olmayan karşılığı ArvoLab'da yok/);
  });

  test("tek örneklem · sıralı → tek örneklem Wilcoxon yok, t-testi önerilmez", () => {
    desteklenmeyenDurum(
      { amac: "fark", sonucTuru: "sirali", olcumDuzeni: "bagimsiz", grupSayisi: "tek" },
      /tek örneklem Wilcoxon/i,
    );
  });

  test("sıralı sonucu yordama → ordinal lojistik yok, doğrusal regresyon önerilmez", () => {
    desteklenmeyenDurum({ amac: "yordama", sonucTuru: "sirali" }, /sıralı \(ordinal\) lojistik regresyon/);
  });

  test("ikili lojistik önerilirken çok kategorili sınır açıkça yazılır", () => {
    const o = oner({ amac: "yordama", sonucTuru: "kategorik" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["lojistik"]);
    assert.ok(o.sinirlar.some((s) => /multinom/i.test(s.tr)));
  });
});

describe("hiçbir öneri kesin hüküm değil", () => {
  test("guven alanı asla 'kesin' olamaz", () => {
    const senaryolar: Yanitlar[] = [
      { amac: "betimle" },
      { amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "iki" },
      { amac: "iliski", sonucTuru: "surekli", kontrolDegiskeni: "yok" },
      { amac: "yordama", sonucTuru: "surekli" },
      { amac: "olcek", olcekAmaci: "guvenilirlik" },
      { amac: "model", modelTuru: "araci" },
    ];
    for (const y of senaryolar) {
      const g: string = oner(y).guven;
      assert.ok(g === "aday" || g === "belirsiz", JSON.stringify(y));
    }
  });

  test("tek aday bulunduğunda da araştırma düzeni sınırı yazılır", () => {
    const o = oner({ amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "iki" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["ttest"]);
    assert.ok(o.sinirlar.some((s) => /öneridir, hüküm değil/.test(s.tr)));
    assert.ok(o.sinirlar.some((s) => /danışmanınızla/.test(s.tr)));
  });

  test("her adayın gerekçesi ve kontrol notu iki dilde yazılı", () => {
    const hepsi = new Set<string>();
    const senaryolar: Yanitlar[] = [
      { amac: "betimle" },
      { amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "tek" },
      { amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "iki" },
      { amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "tek", kovaryat: "yok" },
      { amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "tek", kovaryat: "var" },
      { amac: "fark", sonucTuru: "surekli", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "iki" },
      { amac: "fark", sonucTuru: "surekli", olcumDuzeni: "tekrarli", grupSayisi: "iki" },
      { amac: "fark", sonucTuru: "surekli", olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" },
      { amac: "fark", sonucTuru: "surekli", olcumDuzeni: "karma" },
      { amac: "fark", sonucTuru: "sirali", olcumDuzeni: "bagimsiz", grupSayisi: "iki" },
      { amac: "fark", sonucTuru: "sirali", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok" },
      { amac: "fark", sonucTuru: "sirali", olcumDuzeni: "tekrarli", grupSayisi: "iki" },
      { amac: "fark", sonucTuru: "sirali", olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" },
      { amac: "fark", sonucTuru: "kategorik", olcumDuzeni: "bagimsiz", grupSayisi: "iki" },
      { amac: "fark", sonucTuru: "kategorik", olcumDuzeni: "tekrarli", grupSayisi: "iki" },
      { amac: "iliski", sonucTuru: "surekli", kontrolDegiskeni: "yok" },
      { amac: "iliski", sonucTuru: "surekli", kontrolDegiskeni: "var" },
      { amac: "iliski", sonucTuru: "sirali", kontrolDegiskeni: "yok" },
      { amac: "yordama", sonucTuru: "surekli" },
      { amac: "yordama", sonucTuru: "kategorik" },
      { amac: "olcek", olcekAmaci: "guvenilirlik" },
      { amac: "olcek", olcekAmaci: "yapiKesfet" },
      { amac: "olcek", olcekAmaci: "yapiDogrula" },
      { amac: "model", modelTuru: "araci" },
      { amac: "model", modelTuru: "duzenleyici" },
    ];
    for (const y of senaryolar) {
      for (const a of oner(y).adaylar) {
        hepsi.add(a.tur);
        assert.ok(a.gerekce.tr && a.gerekce.en, `${a.tur}: gerekçe`);
        assert.ok(a.kontrol.tr && a.kontrol.en, `${a.tur}: kontrol notu`);
      }
    }
    /*
      YARDIM AKIŞI VAR OLAN DESTEĞE BAĞLI: 25 analizin hepsine bir yol
      çıkmalı. Çıkmayan bir analiz, gezginde duran ama yardımın asla
      önermediği ölü bir seçenek olur.
    */
    const ulasilamayan = ANALIZ_TURLERI.filter((t) => !hepsi.has(t));
    assert.deepEqual(ulasilamayan, [], "her analize yardım akışından bir yol olmalı");
  });

  test("öneriler yalnızca var olan analizlerden: gezgindeki listeden dışarı çıkmaz", () => {
    const gezgin = new Set(ANALIZ_KATEGORILERI.flatMap((k) => k.turler));
    const o = oner({ amac: "fark", sonucTuru: BILMIYORUM, olcumDuzeni: BILMIYORUM });
    for (const a of o.adaylar) assert.ok(gezgin.has(a.tur), a.tur);
  });
});
