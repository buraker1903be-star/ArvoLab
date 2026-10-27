import assert from "node:assert/strict";
import test from "node:test";
import { analizBetigi, PROGRAM_KARTLARI, YONTEM_GRUPLARI, YONTEM_KARTLARI } from "@/lib/analiz-betik";
import { ANALIZ_TURLERI } from "@/lib/analiz-turleri";

test("her analiz türünün kartı ve açıklaması var; ANSYS kapalı ve nedenini söylüyor", () => {
  assert.equal(YONTEM_KARTLARI.length, ANALIZ_TURLERI.length);
  assert.ok(YONTEM_KARTLARI.every((k) => k.aciklama));
  const ansys = PROGRAM_KARTLARI.find((k) => k.anahtar === "ansys")!;
  assert.equal(ansys.desteklenmiyor, true);
  assert.match(ansys.aciklama, /çalıştıramaz/);
});

test("her araç her türde betik üretir; seçilen değişkenler betikte geçer", () => {
  const secim = { varA: "puan", varB: "kaygi", groupVar: "grup", groupVar2: "cinsiyet", maddeler: ["m1", "m2"], yordayicilar: ["yas", "gelir"], dosyaAdi: "veri.xlsx" };
  for (const arac of ["spss", "r", "python"] as const) {
    for (const tur of ANALIZ_TURLERI) {
      const betik = analizBetigi(arac, tur, secim);
      assert.ok(betik.length > 40, `${arac}/${tur}`);
      if (tur !== "descriptives") assert.ok(betik.includes("puan") || betik.includes("m1"), `${arac}/${tur} değişkeni taşımıyor`);
    }
  }
});

test("komutlar doğru: SPSS ONEWAY, R aov + TukeyHSD, Python f_oneway", () => {
  const s = { varA: "puan", groupVar: "grup" };
  assert.match(analizBetigi("spss", "anova", s), /ONEWAY puan BY grup/);
  assert.match(analizBetigi("r", "anova", s), /aov\(puan ~ factor\(grup\)[\s\S]*TukeyHSD/);
  assert.match(analizBetigi("python", "anova", s), /f_oneway/);
  assert.match(analizBetigi("r", "regression", { varA: "y", yordayicilar: ["x1", "x2"] }), /lm\(y ~ x1 \+ x2/);
});

test("boşluklu ve Türkçe değişken adları her dilde güvenle yazılır", () => {
  const s = { varA: "sınav puanı", groupVar: "öğrenci grubu" };
  assert.match(analizBetigi("r", "ttest", s), /`sınav puanı` ~ `öğrenci grubu`/);
  assert.match(analizBetigi("python", "regression", { varA: "sınav puanı", yordayicilar: ["yaş"] }), /Q\(/);
  assert.match(analizBetigi("spss", "anova", s), /sınav_puanı BY öğrenci_grubu/);
  assert.match(analizBetigi("r", "descriptives", { dosyaAdi: "a.csv" }), /read\.csv\("a\.csv"\)/);
});

test("SPSS iki gruplu testte verideki grup değerleri yazılır; bilinmiyorsa (1 2) ve not", () => {
  assert.match(analizBetigi("spss", "ttest", { varA: "puan", groupVar: "grup", gruplar: ["A", "B"] }), /GROUPS=grup\('A' 'B'\)/);
  assert.match(analizBetigi("spss", "mannwhitney", { varA: "puan", groupVar: "grup", gruplar: ["1", "2"] }), /BY grup\(1 2\)/);
  const bilinmiyor = analizBetigi("spss", "ttest", { varA: "puan", groupVar: "grup" });
  assert.match(bilinmiyor, /GROUPS=grup\(1 2\)/);
  assert.match(bilinmiyor, /değiştirin/);
});

test("her analiz türü yöntem gruplarında tam bir kez geçiyor", () => {
  const hepsi = YONTEM_GRUPLARI.flatMap((g) => g.turler);
  assert.deepEqual([...hepsi].sort(), [...ANALIZ_TURLERI].sort());
});

test("Wilcoxon ve Friedman komutları", () => {
  assert.match(analizBetigi("spss", "wilcoxon", { varA: "on", varB: "son" }), /WILCOXON=on WITH son \(PAIRED\)/);
  assert.match(analizBetigi("r", "friedman", { maddeler: ["on", "son", "izleme"] }), /friedman\.test/);
  assert.match(analizBetigi("python", "wilcoxon", { varA: "on", varB: "son" }), /stats\.wilcoxon/);
});

test("yeni analizlerin komutları (27.10.2026)", () => {
  assert.match(analizBetigi("spss", "tekorneklem", { varA: "puan", testDegeri: 3 }), /TESTVAL=3/);
  assert.match(analizBetigi("spss", "tekrarlianova", { maddeler: ["on", "son", "iz"] }), /WSFACTOR=olcum 3/);
  assert.match(analizBetigi("spss", "ancova", { varA: "son", groupVar: "grup", kovaryatlar: ["on"] }), /UNIANOVA son BY grup WITH on[\s\S]*on=MEAN/);
  assert.match(analizBetigi("r", "lojistik", { varA: "gecti", yordayicilar: ["yas"] }), /family = binomial/);
  assert.match(analizBetigi("spss", "faktor", { maddeler: ["m1", "m2", "m3"], faktorSayisi: 2 }), /FACTORS\(2\)[\s\S]*VARIMAX/);
  assert.match(analizBetigi("python", "mcnemar", { varA: "once", varB: "sonra" }), /exact=True/);
});

test("karma ANOVA komutları", () => {
  const s = { groupVar: "grup", maddeler: ["on", "son", "iz"] };
  assert.match(analizBetigi("spss", "karmaanova", s), /GLM on son iz BY grup[\s\S]*WSFACTOR=olcum 3[\s\S]*DESIGN=grup/);
  assert.match(analizBetigi("r", "karmaanova", s), /between = grup/);
  assert.match(analizBetigi("python", "karmaanova", s), /mixed_anova/);
});
