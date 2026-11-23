import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GUC_YONTEMLERI, yontemMetni, yontemTanimi } from "@/lib/guc-yontemleri";
import { ornekemBuyuklugu, type GucGirdisi } from "@/lib/stats-guc";

/*
  Yöntemler ARAŞTIRMA SORUSUYLA anlatılıyor; üretilen yöntem metni tez
  önerisine ve etik kurul başvurusuna eklenebilecek biçimde, kullanılan
  VARSAYIMLARI da yazıyor. Gerçek arayüz
  scripts/yerel-yigin/analiz-alani-kabul.mjs S18'de sınanıyor.
*/
describe("güç yöntemleri", () => {
  test("beş yöntem: bağımsız t, eşleştirilmiş t, ANOVA, korelasyon, regresyon", () => {
    assert.deepEqual(GUC_YONTEMLERI.map((y) => y.anahtar), ["bagimsizT", "eslestirilmisT", "tekYonluAnova", "korelasyon", "regresyon"]);
  });

  test("her yöntem araştırma sorusuyla ve iki dilde anlatılıyor", () => {
    for (const y of GUC_YONTEMLERI) {
      for (const dil of ["tr", "en"] as const) {
        assert.ok(y.soru[dil].length > 20, `${y.anahtar} soru ${dil}`);
        assert.ok(y.testAdi[dil].length > 5, `${y.anahtar} test adı ${dil}`);
        assert.ok(y.etkiAdi[dil].length > 15, `${y.anahtar} etki adı ${dil}`);
      }
      /* Soru, testin ADIYLA değil yapılacak işle anlatılmalı. */
      assert.doesNotMatch(y.soru.tr, /t-testi|ANOVA|regresyon|korelasyon/i, y.anahtar);
    }
  });

  test("istenen iki örnek soru birebir var", () => {
    assert.equal(yontemTanimi("bagimsizT").soru.tr, "İki ayrı grubun puanlarını karşılaştıracağım");
    assert.equal(yontemTanimi("eslestirilmisT").soru.tr, "Aynı kişileri önce ve sonra ölçeceğim");
  });

  test("G*Power karşılığı her yöntem için yazılı", () => {
    for (const y of GUC_YONTEMLERI) {
      assert.match(y.gpower, /A priori/, y.anahtar);
      assert.ok(y.gpower.length > 40, y.anahtar);
    }
    assert.match(yontemTanimi("regresyon").gpower, /R² deviation from zero/);
    assert.match(yontemTanimi("korelasyon").gpower, /Bivariate normal model/);
    assert.match(yontemTanimi("tekYonluAnova").gpower, /Fixed effects, omnibus, one-way/);
  });

  /* F ailesinin omnibus sınavı tek kuyrukludur: olmayan bir ayar gösterilmez. */
  test("yön seçeneği yalnızca t ailesinde ve korelasyonda", () => {
    assert.deepEqual(GUC_YONTEMLERI.filter((y) => y.yonSecilir).map((y) => y.anahtar), ["bagimsizT", "eslestirilmisT", "korelasyon"]);
  });

  test("örnek değerler geçerli ve sonuç üretiyor", () => {
    for (const y of GUC_YONTEMLERI) {
      const g: GucGirdisi = {
        yontem: y.anahtar, etki: y.ornek.etki, alfa: y.ornek.alfa, hedefGuc: y.ornek.hedefGuc,
        yon: "iki", grupSayisi: y.ornek.grupSayisi, yordayiciSayisi: y.ornek.yordayiciSayisi,
      };
      const r = ornekemBuyuklugu(g);
      assert.equal(r.engel, null, y.anahtar);
      if (r.engel !== null) return;
      assert.ok(r.n > 0 && r.n < 10000, `${y.anahtar}: N=${r.n}`);
    }
  });
});

describe("yöntem metni", () => {
  const girdi: GucGirdisi = { yontem: "bagimsizT", etki: 0.5, alfa: 0.05, hedefGuc: 0.8, yon: "iki", kayipOrani: 0.1 };
  const sonuc = ornekemBuyuklugu(girdi);

  test("sayılar, varsayımlar ve kayıp payı metinde", () => {
    assert.ok(sonuc.engel === null);
    if (sonuc.engel !== null) return;
    const tr = yontemMetni(girdi, sonuc, "tr");
    assert.match(tr, /öncül \(a priori\) güç çözümlemesi/);
    assert.match(tr, /d = 0,5/);
    assert.match(tr, new RegExp(`${sonuc.n} gözlemdir`));
    assert.match(tr, /grup başına 64 \+ 64/);
    assert.match(tr, /ulaşılan güç/);
    assert.match(tr, new RegExp(`başlangıçta ${sonuc.baslangicN} kişi`));
    assert.match(tr, /Varsayımlar:/);
    assert.match(tr, /planlama varsayımıdır/);
    assert.match(tr, /merkezi olmayan dağılımıyla/);
    assert.match(tr, /G\*Power/);
  });

  test("İngilizcesi de eksiksiz ve Türkçe kalıntısı yok", () => {
    assert.ok(sonuc.engel === null);
    if (sonuc.engel !== null) return;
    const en = yontemMetni(girdi, sonuc, "en");
    assert.match(en, /a priori power analysis/);
    assert.match(en, /Assumptions:/);
    assert.match(en, /dropout/);
    assert.doesNotMatch(en, /[çğışöü]/i);
  });

  test("eşleştirilmiş testte KATILIMCI yazıyor", () => {
    const g: GucGirdisi = { yontem: "eslestirilmisT", etki: 0.4, alfa: 0.05, hedefGuc: 0.8, yon: "iki" };
    const s = ornekemBuyuklugu(g);
    assert.ok(s.engel === null);
    if (s.engel !== null) return;
    assert.match(yontemMetni(g, s, "tr"), /katılımcıdır/);
    assert.match(yontemMetni(g, s, "en"), /participants/);
  });

  test("kayıp yoksa kayıp cümlesi yazılmıyor", () => {
    const g: GucGirdisi = { yontem: "bagimsizT", etki: 0.5, alfa: 0.05, hedefGuc: 0.8, yon: "iki" };
    const s = ornekemBuyuklugu(g);
    assert.ok(s.engel === null);
    if (s.engel !== null) return;
    assert.doesNotMatch(yontemMetni(g, s, "tr"), /kayıp/);
    assert.doesNotMatch(yontemMetni(g, s, "en"), /dropout/);
  });

  test("ANOVA metninde eşit grup varsayımı yazılı", () => {
    const g: GucGirdisi = { yontem: "tekYonluAnova", etki: 0.25, alfa: 0.05, hedefGuc: 0.8, grupSayisi: 3 };
    const s = ornekemBuyuklugu(g);
    assert.ok(s.engel === null);
    if (s.engel !== null) return;
    assert.match(yontemMetni(g, s, "tr"), /grupların eşit büyüklükte olduğunu/);
    assert.match(yontemMetni(g, s, "en"), /equal group sizes/);
  });

  test("panel yöntem tanımlarını tek kaynaktan okuyor", () => {
    const panel = readFileSync("app/dashboard/analysis/guc-paneli.tsx", "utf8");
    assert.match(panel, /GUC_YONTEMLERI\.map/);
    assert.match(panel, /yontemMetni\(girdi, sonuc, dil\)/);
    assert.doesNotMatch(panel, /Cohen d \(iki grup/, "etiketler panelde kopyalanmamalı");
  });
});
