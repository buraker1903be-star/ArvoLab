import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { analizBetigi, PROGRAM_KARTLARI, programKartlari, YONTEM_GRUPLARI, YONTEM_KARTLARI, yontemGruplari, yontemKartlari } from "@/lib/analiz-betik";
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
  assert.match(analizBetigi("r", "descriptives", { dosyaAdi: "a.csv" }), /read\.table\("a\.csv", header = TRUE, sep = ",", dec = "\."/);
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

test("aracılık, düzenleyicilik ve DFA komutları", () => {
  assert.match(analizBetigi("spss", "aracilik", { varA: "x", varB: "m", varY: "y" }), /PROCESS y=y \/x=x \/m=m[\s\S]*model=4/);
  assert.match(analizBetigi("r", "aracilik", { varA: "x", varB: "m", varY: "y" }), /ind1 := a1\*b1/);
  assert.match(analizBetigi("spss", "duzenleyicilik", { varA: "x", varB: "w", varY: "y" }), /model=1 \/center=1 \/jn=1/);
  const dfa = { dfaFaktorleri: [{ ad: "Kaygı", maddeler: ["m1", "m2", "m3"] }, { ad: "Öz yeterlik", maddeler: ["m4", "m5"] }] };
  assert.match(analizBetigi("r", "dfa", dfa), /Kaygı =~ m1 \+ m2 \+ m3\nÖz_yeterlik =~ m4 \+ m5[\s\S]*std\.lv = TRUE/);
  assert.match(analizBetigi("python", "dfa", dfa), /semopy\.Model/);
});

test("DFA betiği serbest bırakılan hata kovaryanslarını taşır", () => {
  const s = { dfaFaktorleri: [{ ad: "F1", maddeler: ["m1", "m2", "m3"] }], dfaHataKovaryanslari: [["m1", "m2"]] as [string, string][] };
  assert.match(analizBetigi("r", "dfa", s), /F1 =~ m1 \+ m2 \+ m3\nm1 ~~ m2/);
});

test("çoklu aracı betikleri: PROCESS model numarası ve lavaan yolları", () => {
  const paralel = { varA: "x", varY: "y", aracilar: ["m1", "m2"], araciModeli: "paralel" as const };
  const seri = { ...paralel, araciModeli: "seri" as const };
  assert.match(analizBetigi("spss", "aracilik", paralel), /\/m=m1 m2[\s\S]*\/model=4[\s\S]*contrast=1/);
  assert.match(analizBetigi("spss", "aracilik", seri), /\/model=6/);
  const r = analizBetigi("r", "aracilik", seri);
  assert.match(r, /m2 ~ a2\*x \+ d21\*m1/);
  assert.match(r, /ind3 := a1\*d21\*b2/);
  assert.match(r, /toplam_dolayli := ind1 \+ ind2 \+ ind3/);
  assert.match(analizBetigi("python", "aracilik", paralel), /m=\["m1","m2"\]/);
  assert.match(analizBetigi("r", "aracilik", { varA: "x", varB: "m", varY: "y" }), /ind1 := a1\*b1/);
});

describe("İngilizce betik ve kartlar (28.10.2026)", () => {
  test("yorumlar İngilizce, kod Türkçe sürümle aynı", () => {
    const tr = analizBetigi("spss", "ttest", { varA: "puan", groupVar: "cinsiyet" });
    const en = analizBetigi("spss", "ttest", { varA: "puan", groupVar: "cinsiyet" }, "en");
    assert.match(en, /^\* Independent Samples t-Test — SPSS syntax/);
    assert.match(en, /Replace the group codes \(1 2\)/);
    const kod = (b: string) => b.split("\n").filter((l) => !l.startsWith("*")).join("\n");
    assert.equal(kod(en), kod(tr));
    assert.match(analizBetigi("r", "ancova", {}, "en"), /# adjusted means/);
  });

  test("kart ve grup başlıkları İngilizce", () => {
    assert.equal(yontemGruplari("en")[0].baslik, "Describe the data");
    assert.equal(yontemKartlari("en").find((k) => k.tur === "ttest")?.aciklama, "Compares the means of two groups");
    assert.match(programKartlari("en").find((k) => k.anahtar === "ansys")!.aciklama, /cannot run it/);
    assert.equal(programKartlari("tr"), PROGRAM_KARTLARI);
  });
});

/*
  Eskiden her CSV öntanımlı read.csv / pd.read_csv ile okunuyordu: Türkçe
  Excel'in noktalı virgüllü, virgül ondalıklı dosyası betikte tek sütun
  okunup düşüyordu; .tsv ve .txt read_excel'e gidiyordu.
*/
test("betik dosyayı ArvoLab'ın kararlarıyla okur", () => {
  const turkce = { dosyaAdi: "veri.csv", metinBicimi: { ayirici: ";", ondalik: "virgul", kodlama: "windows-1254" } } as const;
  assert.match(analizBetigi("r", "descriptives", turkce), /sep = ";", dec = ","[\s\S]*fileEncoding = "windows-1254"/);
  assert.match(analizBetigi("python", "descriptives", turkce), /sep=";", decimal=",", thousands="\.", encoding="cp1254"/);
  assert.match(analizBetigi("r", "descriptives", { dosyaAdi: "v.tsv" }), /read\.table\("v\.tsv", header = TRUE, sep = "\\t"/);
  assert.doesNotMatch(analizBetigi("python", "descriptives", { dosyaAdi: "v.txt" }), /read_excel/);
  assert.match(analizBetigi("r", "descriptives", { dosyaAdi: "v.xlsx" }), /read_excel/);
});
