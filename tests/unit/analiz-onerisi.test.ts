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
/*
  BÜTÜN DALLARIN SENARYOLARI. Hem "her analize bir yol var mı" hem de
  "gerekçeler mutlak hüküm kurmuyor" testleri aynı listeyi kullanıyor:
  iki ayrı liste olsa biri güncellenir öteki eskirdi.
*/
const TUM_SENARYOLAR: Yanitlar[] = [
  { amac: "betimle" },
  { amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "tek" },
  { amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "iki" },
  { amac: "fark", sonucTuru: "surekli", dagilim: "sorunlu", olcumDuzeni: "bagimsiz", grupSayisi: "iki" },
  { amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "tek", kovaryat: "yok" },
  { amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "tek", kovaryat: "var" },
  { amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "iki" },
  { amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "tekrarli", grupSayisi: "iki" },
  { amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" },
  { amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "karma" },
  { amac: "fark", sonucTuru: "sirali", olcumDuzeni: "bagimsiz", grupSayisi: "iki" },
  { amac: "fark", sonucTuru: "sirali", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok" },
  { amac: "fark", sonucTuru: "sirali", olcumDuzeni: "tekrarli", grupSayisi: "iki" },
  { amac: "fark", sonucTuru: "sirali", olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" },
  { amac: "fark", sonucTuru: "kategorik", kategoriSayisi: "iki", olcumDuzeni: "bagimsiz", grupSayisi: "iki" },
  { amac: "fark", sonucTuru: "kategorik", kategoriSayisi: "iki", olcumDuzeni: "tekrarli", grupSayisi: "iki" },
  { amac: "iliski", sonucTuru: "surekli", dagilim: "uygun", kontrolDegiskeni: "yok" },
  { amac: "iliski", sonucTuru: "surekli", dagilim: "uygun", kontrolDegiskeni: "var" },
  { amac: "iliski", sonucTuru: "sirali", kontrolDegiskeni: "yok" },
  { amac: "yordama", sonucTuru: "surekli" },
  { amac: "yordama", sonucTuru: "kategorik", kategoriSayisi: "iki" },
  { amac: "olcek", olcekAmaci: "guvenilirlik" },
  { amac: "olcek", olcekAmaci: "yapiKesfet" },
  { amac: "olcek", olcekAmaci: "yapiDogrula" },
  { amac: "model", modelTuru: "araci" },
  { amac: "model", modelTuru: "duzenleyici" },
];

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

  /*
    İKİNCİ SORU ÖLÇÜM DÜZEYİNE GÖRE DEĞİŞİYOR: sürekli sonuçta dağılım,
    kategorik sonuçta kategori sayısı. Sıralı sonuçta ikisi de sorulmaz.
  */
  test("sürekli sonuçta dağılım, kategorikte kategori sayısı sorulur", () => {
    assert.deepEqual(sorular({ amac: "fark", sonucTuru: "surekli" }), ["amac", "sonucTuru", "dagilim"]);
    assert.deepEqual(sorular({ amac: "fark", sonucTuru: "kategorik" }), ["amac", "sonucTuru", "kategoriSayisi"]);
    const sirali = sorular({ amac: "fark", sonucTuru: "sirali" });
    assert.ok(!sirali.includes("dagilim"), "sıralı sonuçta dağılım sorulmaz");
    assert.ok(!sirali.includes("kategoriSayisi"));
    assert.ok(sirali.includes("olcumDuzeni"));
  });

  test("ikinci soru cevaplanmadan ölçüm düzeni sorulmaz", () => {
    assert.ok(!sorular({ amac: "fark", sonucTuru: "surekli" }).includes("olcumDuzeni"));
    assert.ok(sorular({ amac: "fark", sonucTuru: "surekli", dagilim: "uygun" }).includes("olcumDuzeni"));
  });

  test("karma desende grup sayısı sorulmaz (desen zaten tanımlı)", () => {
    const y: Yanitlar = { amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "karma" };
    assert.ok(!sorular(y).includes("grupSayisi"));
    assert.deepEqual(turleri(y), ["karmaanova"]);
  });

  test("iki gruplu karşılaştırmada faktör ve kovaryat sorulmaz", () => {
    const s = sorular({ amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "iki" });
    assert.ok(!s.includes("faktorSayisi"));
    assert.ok(!s.includes("kovaryat"));
  });

  test("her soruda 'Bilmiyorum' var ve açıklaması yazılı", () => {
    const anahtarlar = ["amac", "sonucTuru", "dagilim", "kategoriSayisi", "olcumDuzeni", "grupSayisi", "faktorSayisi", "kovaryat", "cokluSonuc", "kontrolDegiskeni", "olcekAmaci", "modelTuru"] as const;
    for (const a of anahtarlar) {
      const soru = soruyuGetir(a);
      assert.ok(soru.secenekler.some((s) => s.anahtar === BILMIYORUM), `${a}: Bilmiyorum seçeneği yok`);
      assert.ok(soru.baslik.tr && soru.baslik.en, `${a}: iki dilde başlık`);
      for (const s of soru.secenekler) assert.ok(s.etiket.tr && s.etiket.en, `${a}/${s.anahtar}: iki dilde etiket`);
    }
  });
});

/*
  ÖLÇÜM DÜZEYİ ≠ DAĞILIM (22.11.2026 düzeltmesi).

  Eskiden "Sıralı ya da çarpık dağılan" tek seçenekti: çarpık dağılan
  SÜREKLİ bir puan sıralı ilan ediliyordu ve kullanıcı yöntem bölümüne
  ölçüm düzeyini yanlış yazıyordu. Şimdi ikisi ayrı soru; çarpıklık
  yalnızca sıra temelli karşılığı ADAYA EKLİYOR.
*/
describe("ölçüm düzeyi ile dağılım ayrı", () => {
  const fark = (ek: Yanitlar) => turleri({ amac: "fark", olcumDuzeni: "bagimsiz", grupSayisi: "iki", ...ek });

  test("dağılım uygunsa yalnızca parametrik aday", () => {
    assert.deepEqual(fark({ sonucTuru: "surekli", dagilim: "uygun" }), ["ttest"]);
  });

  test("çarpık/küçük örneklem değişkeni SIRALI yapmıyor: parametrik aday listede kalıyor", () => {
    const adaylar = fark({ sonucTuru: "surekli", dagilim: "sorunlu" });
    assert.deepEqual(adaylar, ["ttest", "mannwhitney"]);
    assert.equal(adaylar[0], "ttest", "parametrik aday önce");
  });

  test("gerçekten SIRALI değişkende parametrik aday YOK", () => {
    assert.deepEqual(fark({ sonucTuru: "sirali" }), ["mannwhitney"]);
  });

  test("çarpıklık uyarısı ölçüm düzeyinin değişmediğini söylüyor", () => {
    const o = oner({ amac: "fark", sonucTuru: "surekli", dagilim: "sorunlu", olcumDuzeni: "bagimsiz", grupSayisi: "iki" });
    assert.ok(o.sinirlar.some((s) => /ÖLÇÜM DÜZEYİNİ değiştirmez/.test(s.tr)));
    assert.ok(o.sinirlar.some((s) => /sürekli kalır/.test(s.tr)));
  });

  test("dağılım bilinmiyorsa iki aday birlikte, ayrı gerekçeyle", () => {
    const o = oner({ amac: "fark", sonucTuru: "surekli", dagilim: BILMIYORUM, olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["tekrarlianova", "friedman"]);
    assert.ok(o.sinirlar.some((s) => /Dağılım hakkında bilgi verilmedi/.test(s.tr)));
  });

  test("tek örneklemde sıra temelli karşılık eklenmiyor (ArvoLab'da yok)", () => {
    assert.deepEqual(fark({ sonucTuru: "surekli", dagilim: "sorunlu", grupSayisi: "tek" }), ["tekorneklem"]);
  });

  test("ilişkide de aynı ayrım: çarpıklık Spearman'ı EKLER, Pearson'ı kaldırmaz", () => {
    assert.deepEqual(turleri({ amac: "iliski", sonucTuru: "surekli", dagilim: "uygun", kontrolDegiskeni: "yok" }), ["correlation"]);
    assert.deepEqual(turleri({ amac: "iliski", sonucTuru: "surekli", dagilim: "sorunlu", kontrolDegiskeni: "yok" }), ["correlation", "spearman"]);
    assert.deepEqual(turleri({ amac: "iliski", sonucTuru: "sirali", kontrolDegiskeni: "yok" }), ["spearman"]);
  });
});

/*
  İKİLİ SONUÇ KOŞULU. McNemar, Cochran Q ve ikili lojistik regresyon
  İKİ kategorili sonuç ister. Üç kategoride bunları önermek, kullanıcıya
  kategorileri birleştirtir ve hangi kategorinin ayrıştığını gizler.
*/
describe("kategori sayısı koşulu açıkça denetleniyor", () => {
  const fark = (ek: Yanitlar) => oner({ amac: "fark", sonucTuru: "kategorik", ...ek });

  test("iki kategorili, iki tekrarlı ölçüm → McNemar", () => {
    assert.deepEqual(fark({ kategoriSayisi: "iki", olcumDuzeni: "tekrarli", grupSayisi: "iki" }).adaylar.map((a) => a.tur), ["mcnemar"]);
  });

  test("ÜÇ kategorili, iki tekrarlı ölçüm → McNemar ÖNERİLMİYOR", () => {
    const o = fark({ kategoriSayisi: "ucDahaCok", olcumDuzeni: "tekrarli", grupSayisi: "iki" });
    assert.deepEqual(o.adaylar, []);
    assert.match(o.desteklenmeyen?.tr ?? "", /McNemar–Bowker|marjinal homojenlik/);
    assert.match(o.desteklenmeyen?.tr ?? "", /kategorileri birleştirerek/i);
  });

  test("kategori sayısı bilinmiyorsa McNemar aday ama koşulu YAZILI", () => {
    const o = fark({ kategoriSayisi: BILMIYORUM, olcumDuzeni: "tekrarli", grupSayisi: "iki" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["mcnemar"]);
    assert.ok(o.sinirlar.some((s) => /YALNIZCA iki kategorili sonuç için geçerlidir/.test(s.tr)));
  });

  test("bağımsız gruplarda ki-kare kategori sayısından bağımsız", () => {
    for (const k of ["iki", "ucDahaCok", BILMIYORUM]) {
      assert.deepEqual(fark({ kategoriSayisi: k, olcumDuzeni: "bagimsiz", grupSayisi: "iki" }).adaylar.map((a) => a.tur), ["chisquare"], k);
    }
  });

  test("üç tekrarlı ölçüm → Cochran Q; kategori sayısı ne olursa olsun aday yok", () => {
    for (const k of ["iki", "ucDahaCok", BILMIYORUM]) {
      const o = fark({ kategoriSayisi: k, olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" });
      assert.deepEqual(o.adaylar, [], k);
      assert.match(o.desteklenmeyen?.tr ?? "", /Cochran Q/);
    }
  });

  test("düzen bilinmiyor + çok kategori: McNemar listeye GİRMİYOR", () => {
    const o = fark({ kategoriSayisi: "ucDahaCok", olcumDuzeni: BILMIYORUM, grupSayisi: "iki" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["chisquare"]);
  });

  test("yordamada iki kategorili sonuç → ikili lojistik", () => {
    assert.deepEqual(turleri({ amac: "yordama", sonucTuru: "kategorik", kategoriSayisi: "iki" }), ["lojistik"]);
  });

  test("yordamada ÜÇ kategorili sonuç → ikili lojistik ÖNERİLMİYOR", () => {
    const o = oner({ amac: "yordama", sonucTuru: "kategorik", kategoriSayisi: "ucDahaCok" });
    assert.deepEqual(o.adaylar, []);
    assert.match(o.desteklenmeyen?.tr ?? "", /multinom/);
    assert.match(o.desteklenmeyen?.tr ?? "", /bilgi atar/);
  });

  test("yordamada kategori sayısı bilinmiyorsa koşul yazılı", () => {
    const o = oner({ amac: "yordama", sonucTuru: "kategorik", kategoriSayisi: BILMIYORUM });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["lojistik"]);
    assert.ok(o.sinirlar.some((s) => /YALNIZCA iki kategorili/.test(s.tr)));
  });
});

describe("bağımsız / tekrarlı ayrımı", () => {
  const T: Yanitlar = { amac: "fark", sonucTuru: "surekli", dagilim: "uygun" };

  test("iki grup · sürekli · bağımsız → bağımsız örneklem t-testi", () => {
    assert.deepEqual(turleri({ ...T, olcumDuzeni: "bagimsiz", grupSayisi: "iki" }), ["ttest"]);
  });

  test("iki ölçüm · sürekli · tekrarlı → eşleştirilmiş t-testi", () => {
    assert.deepEqual(turleri({ ...T, olcumDuzeni: "tekrarli", grupSayisi: "iki" }), ["pairedttest"]);
  });

  test("üç grup bağımsız → ANOVA, üç ölçüm tekrarlı → tekrarlı ölçümler ANOVA", () => {
    assert.deepEqual(turleri({ ...T, olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "tek", kovaryat: "yok" }), ["anova"]);
    assert.deepEqual(turleri({ ...T, olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" }), ["tekrarlianova"]);
  });

  test("parametrik olmayan tarafta da ayrım korunuyor", () => {
    const S: Yanitlar = { amac: "fark", sonucTuru: "sirali" };
    assert.deepEqual(turleri({ ...S, olcumDuzeni: "bagimsiz", grupSayisi: "iki" }), ["mannwhitney"]);
    assert.deepEqual(turleri({ ...S, olcumDuzeni: "tekrarli", grupSayisi: "iki" }), ["wilcoxon"]);
    assert.deepEqual(turleri({ ...S, olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok" }), ["kruskalwallis"]);
    assert.deepEqual(turleri({ ...S, olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" }), ["friedman"]);
  });

  test("DÜZEN BİLİNMİYORSA tek testi kesin ilan etmez: iki aday ve açık sınır", () => {
    const o = oner({ ...T, olcumDuzeni: BILMIYORUM, grupSayisi: "iki" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["ttest", "pairedttest"]);
    assert.equal(o.guven, "aday");
    assert.ok(o.sinirlar.some((s) => /bağımsız mı tekrarlı mı/i.test(s.tr)));
  });

  test("düzen bilinmiyorsa üç gruplu karşılaştırmada da iki aday", () => {
    assert.deepEqual(turleri({ ...T, olcumDuzeni: BILMIYORUM, grupSayisi: "ucDahaCok" }), ["anova", "tekrarlianova"]);
  });
});

describe("eksik bilgi aday listesini daraltmaz", () => {
  test("ölçüm düzeyi bilinmiyorsa parametrik VE sıra temelli adaylar birlikte", () => {
    const o = oner({ amac: "fark", sonucTuru: BILMIYORUM, olcumDuzeni: "bagimsiz", grupSayisi: "iki" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["ttest", "mannwhitney"]);
    assert.ok(o.sinirlar.some((s) => /ölçüm düzeyine karar verin/i.test(s.tr)));
  });

  test("normallik sonucuna göre otomatik seçim yok: iki aday da listede kalır", () => {
    const o = oner({ amac: "fark", sonucTuru: BILMIYORUM, olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["tekrarlianova", "friedman"]);
  });

  test("grup sayısı bilinmiyorsa iki ve çok gruplu adaylar birlikte", () => {
    assert.deepEqual(
      turleri({ amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: BILMIYORUM }),
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
      turleri({ amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: BILMIYORUM }),
      ["anova", "ikiyonluanova"],
    );
  });

  test("kovaryat bilinmiyorsa ANOVA ve ANCOVA birlikte", () => {
    assert.deepEqual(
      turleri({ amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "tek", kovaryat: BILMIYORUM }),
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
    const y: Yanitlar = { amac: "fark", sonucTuru: "kategorik", kategoriSayisi: "iki", olcumDuzeni: "tekrarli", grupSayisi: "ucDahaCok" };
    desteklenmeyenDurum(y, /Cochran Q/);
    assert.ok(!oner(y).adaylar.some((a) => a.tur === "mcnemar"));
  });

  test("birden çok sonuç değişkeni tek testte → MANOVA yok, ANOVA eşdeğer sayılmaz", () => {
    const o = oner({ amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "iki", cokluSonuc: "cok" });
    assert.deepEqual(o.adaylar, []);
    assert.match(o.desteklenmeyen?.tr ?? "", /MANOVA/);
    assert.match(o.desteklenmeyen?.tr ?? "", /aynı şey değildir/);
  });

  test("karma desen · kategorik sonuç → GEE/GLMM gerekir, ki-kare önerilmez", () => {
    desteklenmeyenDurum({ amac: "fark", sonucTuru: "kategorik", kategoriSayisi: "iki", olcumDuzeni: "karma" }, /GEE\/GLMM/);
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
});

/*
  MUTLAK İFADE YOK. "Etkileşim ancak bu testte görünür" gibi cümleler
  öğrenciye savunamayacağı bir kesinlik veriyordu; gerekçe adayın neden
  UYGUN OLABİLECEĞİNİ anlatır.
*/
describe("gerekçeler mutlak hüküm kurmuyor", () => {
  const MUTLAK = [/\bancak bu testte\b/i, /\byalnızca bu test\b/i, /\btek doğru\b/i, /\bkesinlikle\b/i, /\bher zaman\b/i, /\bmutlaka\b/i];

  test("hiçbir aday gerekçesi mutlak ifade içermiyor", () => {
    const bulunan: string[] = [];
    for (const y of TUM_SENARYOLAR) {
      for (const a of oner(y).adaylar) {
        for (const k of MUTLAK) if (k.test(a.gerekce.tr)) bulunan.push(`${a.tur}: ${a.gerekce.tr}`);
      }
    }
    assert.deepEqual(bulunan, []);
  });

  test("iki yönlü ANOVA gerekçesi etkileşimi kestirdiğini söylüyor, tekelini değil", () => {
    const o = oner({ amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "ucDahaCok", faktorSayisi: "iki" });
    const g = o.adaylar[0].gerekce.tr;
    assert.match(g, /aynı modelde kestirir/);
    assert.ok(!/ancak bu testte/.test(g));
  });
});

describe("hiçbir öneri kesin hüküm değil", () => {
  test("guven alanı asla 'kesin' olamaz", () => {
    for (const y of TUM_SENARYOLAR) {
      const g: string = oner(y).guven;
      assert.ok(g === "aday" || g === "belirsiz", JSON.stringify(y));
    }
  });

  test("tek aday bulunduğunda da araştırma düzeni sınırı yazılır", () => {
    const o = oner({ amac: "fark", sonucTuru: "surekli", dagilim: "uygun", olcumDuzeni: "bagimsiz", grupSayisi: "iki" });
    assert.deepEqual(o.adaylar.map((a) => a.tur), ["ttest"]);
    assert.ok(o.sinirlar.some((s) => /öneridir, hüküm değil/.test(s.tr)));
    assert.ok(o.sinirlar.some((s) => /danışmanınızla/.test(s.tr)));
  });

  test("her adayın gerekçesi ve kontrol notu iki dilde yazılı", () => {
    const hepsi = new Set<string>();
    for (const y of TUM_SENARYOLAR) {
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
    const o = oner({ amac: "fark", sonucTuru: BILMIYORUM, olcumDuzeni: BILMIYORUM, grupSayisi: "iki" });
    for (const a of o.adaylar) assert.ok(gezgin.has(a.tur), a.tur);
  });
});
