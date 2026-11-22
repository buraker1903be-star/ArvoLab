import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { BetikSecimi } from "@/lib/analiz-betik";
import { ANALIZ_TURLERI } from "@/lib/analiz-turleri";
import { ALAN_ADLARI, alanAdi, secimKunyesi, tazelikDenetle, tazelikMetni, turunAlanlari } from "@/lib/analiz-tazelik";

/*
  EKSİYEN SONUÇ DENETİMİ (22.11.2026).

  Eskiden analiz çalıştıktan sonra grup değişkeni değiştirilince
  ekrandaki tablo yerinde kalıyordu: başlık yeni seçimi, sayılar eski
  seçimi gösteriyordu ve o tablo teze ekleme sırasına konabiliyordu.
*/
const temel = (): BetikSecimi => ({
  varA: "puan",
  varB: "",
  groupVar: "cinsiyet",
  groupVar2: "",
  maddeler: [],
  yordayicilar: [],
  kovaryatlar: [],
  aracilar: undefined,
  araciModeli: "paralel",
  olayDegeri: "",
  testDegeri: 3,
  faktorSayisi: undefined,
  varY: "",
  dfaFaktorleri: [],
  dfaHataKovaryanslari: [],
  dosyaAdi: "veri.xlsx",
  metinBicimi: undefined,
  gruplar: ["kadın", "erkek"],
});

describe("tazelik denetimi", () => {
  test("hiç analiz çalışmadıysa eskimiş sayılmaz", () => {
    const t = tazelikDenetle(null, { tur: "ttest", secim: temel() });
    assert.equal(t.eskidi, false);
    assert.equal(tazelikMetni(t, "tr"), null);
  });

  test("aynı seçim taze", () => {
    const t = tazelikDenetle({ tur: "ttest", secim: temel() }, { tur: "ttest", secim: temel() });
    assert.equal(t.eskidi, false);
    assert.deepEqual(t.degisenAlanlar, []);
  });

  test("grup değişkeni değişince sonuç eskir ve alan adıyla yazılır", () => {
    const guncel = { ...temel(), groupVar: "sinif" };
    const t = tazelikDenetle({ tur: "ttest", secim: temel() }, { tur: "ttest", secim: guncel });
    assert.equal(t.eskidi, true);
    assert.deepEqual(t.degisenAlanlar, ["groupVar"]);
    assert.match(tazelikMetni(t, "tr") ?? "", /grup değişkeni/);
    assert.match(tazelikMetni(t, "en") ?? "", /grouping variable/);
  });

  test("analiz türü değişince ayrı mesaj: sonuç BAŞKA analize ait", () => {
    const t = tazelikDenetle({ tur: "ttest", secim: temel() }, { tur: "anova", secim: temel() });
    assert.equal(t.turDegisti, true);
    assert.equal(t.eskidi, true);
    assert.match(tazelikMetni(t, "tr") ?? "", /BAŞKA bir analize ait/);
  });

  test("dosya değişince ayrı mesaj: sonuç başka veriden", () => {
    const t = tazelikDenetle({ tur: "ttest", secim: temel() }, { tur: "ttest", secim: { ...temel(), dosyaAdi: "yeni.xlsx" } });
    assert.equal(t.veriDegisti, true);
    assert.match(tazelikMetni(t, "tr") ?? "", /başka bir veri dosyasından/);
  });

  test("dizi alanları içerikle karşılaştırılır (sıra ve uzunluk)", () => {
    const calisan = { tur: "reliability" as const, secim: { ...temel(), maddeler: ["m1", "m2", "m3"] } };
    assert.equal(tazelikDenetle(calisan, { tur: "reliability", secim: { ...temel(), maddeler: ["m1", "m2", "m3"] } }).eskidi, false);
    assert.equal(tazelikDenetle(calisan, { tur: "reliability", secim: { ...temel(), maddeler: ["m1", "m2"] } }).eskidi, true);
    assert.equal(tazelikDenetle(calisan, { tur: "reliability", secim: { ...temel(), maddeler: ["m2", "m1", "m3"] } }).eskidi, true);
  });

  test("iç içe nesneler karşılaştırılır (DFA faktör yapısı)", () => {
    const yapi = [{ ad: "F1", maddeler: ["m1", "m2"] }];
    const calisan = { tur: "dfa" as const, secim: { ...temel(), dfaFaktorleri: yapi } };
    assert.equal(tazelikDenetle(calisan, { tur: "dfa", secim: { ...temel(), dfaFaktorleri: [{ ad: "F1", maddeler: ["m1", "m2"] }] } }).eskidi, false);
    assert.equal(tazelikDenetle(calisan, { tur: "dfa", secim: { ...temel(), dfaFaktorleri: [{ ad: "F1", maddeler: ["m1", "m3"] }] } }).eskidi, true);
    assert.equal(tazelikDenetle(calisan, { tur: "dfa", secim: { ...temel(), dfaFaktorleri: [{ ad: "Faktör 1", maddeler: ["m1", "m2"] }] } }).eskidi, true);
  });

  /*
    YANLIŞ ALARM KAÇIRILAN FARKTAN SİNSİDİR: kullanıcı her seferinde
    çıkan uyarıyı okumamayı öğrenir. undefined, null ve "" aynı "boş"
    anlamına geliyor ve bu üçü arasındaki geçiş uyarı doğurmaz.
  */
  test("boş değerin biçimi (undefined/null/\"\") yanlış alarm vermez", () => {
    const calisan = { tur: "ttest" as const, secim: { ...temel(), varB: "", faktorSayisi: undefined } };
    const guncel = { tur: "ttest" as const, secim: { ...temel(), varB: undefined as unknown as string, faktorSayisi: undefined } };
    assert.equal(tazelikDenetle(calisan, guncel).eskidi, false);
  });

  test("birden çok alan değişince hepsi listelenir", () => {
    const t = tazelikDenetle(
      { tur: "regression", secim: temel() },
      { tur: "regression", secim: { ...temel(), varA: "basari", yordayicilar: ["yas", "sure"] } },
    );
    assert.deepEqual(t.degisenAlanlar, ["varA", "yordayicilar"]);
    const metin = tazelikMetni(t, "tr") ?? "";
    assert.match(metin, /1\. değişken/);
    assert.match(metin, /yordayıcılar/);
  });

  /*
    HER ANALİZ KENDİ ALANLARINA BAKAR. `BetikSecimi` ekrandaki bütün
    alanları taşıyor; bir t-testinde kullanılmayan "2. değişken" de
    içinde. Eskiden künye onu da yazıyor ("… 2. değişken on_test") ve
    testin iki sayısal değişkeni karşılaştırdığı sanılabiliyordu.
  */
  test("kullanılmayan alanın değişmesi sonucu eskitmiyor", () => {
    /* Bağımsız örneklem t-testi varB'yi kullanmıyor. */
    const t = tazelikDenetle({ tur: "ttest", secim: temel() }, { tur: "ttest", secim: { ...temel(), varB: "izleme" } });
    assert.equal(t.eskidi, false);
    /* Ama korelasyon kullanıyor. */
    const k = tazelikDenetle({ tur: "correlation", secim: temel() }, { tur: "correlation", secim: { ...temel(), varB: "izleme" } });
    assert.deepEqual(k.degisenAlanlar, ["varB"]);
  });

  test("lojistikte olay kategorisi değişince sonuç eskir", () => {
    const calisan = { tur: "lojistik" as const, secim: { ...temel(), olayDegeri: "gecti" } };
    const t = tazelikDenetle(calisan, { tur: "lojistik", secim: { ...temel(), olayDegeri: "kaldi" } });
    assert.deepEqual(t.degisenAlanlar, ["olayDegeri"]);
    assert.match(tazelikMetni(t, "tr") ?? "", /olay \(1\) kategorisi/);
  });

  test("her analiz türünün alan listesi tanımlı ve dosya adını içeriyor", () => {
    for (const tur of ANALIZ_TURLERI) {
      const alanlar = turunAlanlari(tur);
      assert.ok(alanlar.includes("dosyaAdi"), `${tur}: veri dosyası her zaman künyede`);
      for (const a of alanlar) assert.ok(ALAN_ADLARI[a], `${tur}: ${a} adsız`);
    }
  });

  test("künye yalnızca o analizin alanlarını yazıyor", () => {
    const secim = { ...temel(), varB: "izleme", yordayicilar: ["yas"], maddeler: ["m1", "m2"] };
    const ttest = secimKunyesi(secim, "tr", "ttest").map((x) => x.ad);
    assert.ok(ttest.includes("grup değişkeni"));
    assert.ok(!ttest.includes("değişken 2"), "t-testi varB kullanmıyor");
    assert.ok(!ttest.includes("2. değişken"), "t-testi varB kullanmıyor");
    assert.ok(!ttest.includes("yordayıcılar"));
    const reg = secimKunyesi(secim, "tr", "regression").map((x) => x.ad);
    assert.ok(reg.includes("yordayıcılar"));
    assert.ok(!reg.includes("grup değişkeni"));
    const rel = secimKunyesi(secim, "tr", "reliability").map((x) => x.ad);
    assert.ok(rel.includes("maddeler"));
    assert.ok(!rel.includes("sayısal değişken"));
  });

  test("künye tür verilmezse bütün dolu alanları yazar (geri uyum)", () => {
    const hepsi = secimKunyesi(temel(), "tr").map((x) => x.ad);
    assert.ok(hepsi.includes("1. değişken"));
    assert.ok(hepsi.includes("grup değişkeni"));
  });

  /*
    ALANIN ADI EKRANDAKİ ETİKETLE AYNI OLMALI. `varA` bir t-testinde
    "Sayısal değişken", korelasyonda "Değişken 1", regresyonda
    "Bağımlı değişken (Y)". Uyarıda genel adı ("1. değişken") yazmak,
    kullanıcının ekranda o adı aramasına yol açıyordu.
  */
  test("uyarıdaki alan adı analize göre değişiyor", () => {
    const degisti = (tur: Parameters<typeof turunAlanlari>[0], secim: BetikSecimi) =>
      tazelikMetni(tazelikDenetle({ tur, secim: temel() }, { tur, secim }), "tr", tur) ?? "";
    assert.match(degisti("ttest", { ...temel(), varA: "izleme" }), /sayısal değişken/);
    assert.match(degisti("correlation", { ...temel(), varA: "izleme" }), /değişken 1/);
    assert.match(degisti("regression", { ...temel(), varA: "izleme" }), /bağımlı değişken \(Y\)/);
    assert.match(degisti("pairedttest", { ...temel(), varA: "izleme" }), /önceki ölçüm/);
    assert.match(degisti("aracilik", { ...temel(), varA: "izleme" }), /bağımsız değişken \(X\)/);
    assert.match(degisti("chisquare", { ...temel(), groupVar: "basari" }), /birinci kategorik değişken/);
    assert.match(degisti("tekrarlianova", { ...temel(), maddeler: ["a"] }), /ölçümler/);
    assert.match(degisti("reliability", { ...temel(), maddeler: ["a"] }), /maddeler/);
  });

  test("künyedeki adlar da analizin etiketlerini kullanıyor", () => {
    const kor = secimKunyesi({ ...temel(), varB: "izleme" }, "tr", "correlation").map((x) => x.ad);
    assert.ok(kor.includes("değişken 1") && kor.includes("değişken 2"));
    const ttest = secimKunyesi(temel(), "tr", "ttest").map((x) => x.ad);
    assert.ok(ttest.includes("sayısal değişken"));
  });

  test("özel adı olmayan alan genel adını koruyor", () => {
    assert.equal(alanAdi("dosyaAdi", "tr", "ttest"), "veri dosyası");
    assert.equal(alanAdi("groupVar", "tr", "ttest"), "grup değişkeni");
    assert.equal(alanAdi("varA", "tr"), "1. değişken");
  });

  test("her alanın iki dilde görünen adı var (ham anahtar sızmaz)", () => {
    for (const [anahtar, ad] of Object.entries(ALAN_ADLARI)) {
      assert.ok(ad.tr.length > 0, `${anahtar}: tr`);
      assert.ok(ad.en.length > 0, `${anahtar}: en`);
      assert.ok(!/[A-Z]/.test(ad.tr) || !/^[a-z]+[A-Z]/.test(anahtar) || ad.tr !== anahtar, `${anahtar}: ham anahtar`);
    }
  });
});
