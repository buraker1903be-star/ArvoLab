import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ANALIZ_TURLERI, type AnalizTuru } from "@/lib/analiz-turleri";
import {
  alanKurali,
  havuzlariKur,
  hesaplanabilirMi,
  ikiDegerliSutunlariBul,
  secimiDuzelt,
  type DegiskenSecimi,
  type SecimAlani,
  type SutunHavuzlari,
} from "@/lib/analiz-secim";

/*
  DEĞİŞKEN SEÇİMİNİN DOĞRULANMASI (23.11.2026).

  Ekranda görünen sütun ile hesaplamanın kullandığı değer ayrışabiliyordu:
  analiz değişimi ve dosya yükleme AYRI kurallar uyguluyordu. Önce lojistik
  seçip sonra dosya yükleyen kullanıcıda state "yas" (sayısal) kalıyor,
  kutuda ise tek geçerli seçenek "basari (gecti/kaldi)" görünüyor, hesap
  "iki kategorili bir sütun seçin" diye düşüyordu. Kullanıcı ekrana
  bakarak bunu düzeltemiyordu çünkü ekran zaten doğru görünüyordu.
*/
const BOS: DegiskenSecimi = { varA: "", varB: "", groupVar: "", groupVar2: "", varY: "" };

/* (a) senaryosunun verisi: sayısal yordayıcılar + TEK ikili kategorik sonuç. */
const HAVUZ_A: SutunHavuzlari = { sayisal: ["yas", "puan", "sure"], grup: ["basari"], ikiDegerli: ["basari"] };
/* (b): iki ikili sütun + sayısal. */
const HAVUZ_B: SutunHavuzlari = { sayisal: ["puan"], grup: ["once", "sonra"], ikiDegerli: ["once", "sonra"] };
/* (d): uygun ikili sütun yok. */
const HAVUZ_D: SutunHavuzlari = { sayisal: ["puan", "sure"], grup: ["sinif"], ikiDegerli: [] };

describe("iki kategorili sütun bulma", () => {
  const satirlar = [
    { a: "evet", b: 1, c: "x", d: null },
    { a: "hayir", b: 2, c: "y", d: 5 },
    { a: "evet", b: 1, c: "z", d: null },
  ];
  test("tam olarak iki farklı değer taşıyan sütunlar", () => {
    assert.deepEqual(ikiDegerliSutunlariBul(["a", "b", "c", "d"], satirlar).map((x) => x.ad), ["a", "b"]);
  });
  test("değerler sıralı veriliyor (ekranda tutarlı görünsün)", () => {
    assert.deepEqual(ikiDegerliSutunlariBul(["a"], satirlar)[0].degerler, ["evet", "hayir"].sort());
  });
  test("boş ve eksik hücreler kategori sayılmıyor", () => {
    /* d: yalnızca tek dolu değer var → iki kategorili değil. */
    assert.deepEqual(ikiDegerliSutunlariBul(["d"], satirlar), []);
  });
});

describe("geçerli seçim korunuyor, geçersiz düzeltiliyor", () => {
  test("geçerli seçime dokunulmuyor", () => {
    const mevcut: DegiskenSecimi = { ...BOS, varA: "puan", groupVar: "basari" };
    const { secim, duzeltilenAlanlar } = secimiDuzelt("ttest", mevcut, HAVUZ_A);
    assert.equal(secim.varA, "puan");
    assert.equal(secim.groupVar, "basari");
    assert.deepEqual(duzeltilenAlanlar, []);
  });

  test("o analizde KULLANILMAYAN alana dokunulmuyor (geri dönülürse dursun)", () => {
    const mevcut: DegiskenSecimi = { ...BOS, varA: "puan", varB: "sure", groupVar: "basari" };
    /* t-testi varB kullanmıyor: değeri korunmalı. */
    const { secim } = secimiDuzelt("ttest", mevcut, HAVUZ_A);
    assert.equal(secim.varB, "sure");
  });

  test("isteğe bağlı alanda boş geçerli, listede olmayan ad temizleniyor", () => {
    const bos = secimiDuzelt("ikiyonluanova", { ...BOS, varA: "puan", groupVar: "basari" }, HAVUZ_A);
    assert.equal(bos.secim.groupVar2, "", "boş kalabilir");
    assert.deepEqual(bos.eksikAlanlar, []);
    const hatali = secimiDuzelt("ikiyonluanova", { ...BOS, varA: "puan", groupVar: "basari", groupVar2: "yokSutun" }, HAVUZ_A);
    assert.equal(hatali.secim.groupVar2, "basari", "geçersiz ad havuzdan düzeltilir");
  });
});

/*
  HATANIN KENDİSİ: aşağıdaki dört senaryo düzeltmeden önce ayrışık
  seçim üretiyordu (ekranda doğru, state'te yanlış).
*/
describe("regresyon senaryoları", () => {
  test("(a) lojistik: bağımlı değişken İKİ KATEGORİLİ sütundan seçiliyor", () => {
    /* handleFile eskiden varA'yı ilk SAYISAL sütuna ("yas") atıyordu. */
    const { secim, eksikAlanlar } = secimiDuzelt("lojistik", { ...BOS, varA: "yas" }, HAVUZ_A);
    assert.equal(secim.varA, "basari");
    assert.ok(HAVUZ_A.ikiDegerli.includes(secim.varA));
    assert.deepEqual(eksikAlanlar, []);
    assert.equal(hesaplanabilirMi("lojistik", secim, HAVUZ_A), true);
  });

  test("(b) McNemar: İKİ AYRI iki kategorili sütun seçiliyor", () => {
    const { secim, eksikAlanlar } = secimiDuzelt("mcnemar", { ...BOS, varA: "puan", varB: "puan" }, HAVUZ_B);
    assert.equal(secim.varA, "once");
    assert.equal(secim.varB, "sonra");
    assert.notEqual(secim.varA, secim.varB, "aynı sütunla hesap yapılamaz");
    assert.deepEqual(eksikAlanlar, []);
  });

  test("(b2) McNemar: varA geçerliyse varB ondan FARKLI seçiliyor", () => {
    const { secim } = secimiDuzelt("mcnemar", { ...BOS, varA: "sonra", varB: "sonra" }, HAVUZ_B);
    assert.equal(secim.varA, "sonra");
    assert.equal(secim.varB, "once");
  });

  test("(c) veri değişti: eski sütun adları yeni dosyada yok → seçim yenileniyor", () => {
    const eski: DegiskenSecimi = { varA: "eskiPuan", varB: "eskiSure", groupVar: "eskiGrup", groupVar2: "", varY: "" };
    const { secim } = secimiDuzelt("ttest", eski, HAVUZ_A);
    assert.equal(secim.varA, "yas");
    assert.equal(secim.groupVar, "basari");
    assert.ok(HAVUZ_A.sayisal.includes(secim.varA));
  });

  test("(d) uygun ikili sütun yok: eksik alan bildiriliyor, hesap engelleniyor", () => {
    const { secim, eksikAlanlar } = secimiDuzelt("mcnemar", { ...BOS, varA: "puan", varB: "sure" }, HAVUZ_D);
    assert.equal(secim.varA, "");
    assert.equal(secim.varB, "");
    assert.deepEqual(eksikAlanlar, ["varA", "varB"]);
    assert.equal(hesaplanabilirMi("mcnemar", secim, HAVUZ_D), false);
  });

  test("(d2) tek ikili sütun varken McNemar'ın İKİNCİ alanı eksik kalıyor", () => {
    const { secim, eksikAlanlar } = secimiDuzelt("mcnemar", BOS, HAVUZ_A);
    assert.equal(secim.varA, "basari");
    assert.equal(secim.varB, "");
    assert.deepEqual(eksikAlanlar, ["varB"]);
    assert.equal(hesaplanabilirMi("mcnemar", secim, HAVUZ_A), false);
    /* Lojistik aynı veriyle çalışabilir: tek ikili sütun ona yetiyor. */
    assert.equal(hesaplanabilirMi("lojistik", secimiDuzelt("lojistik", BOS, HAVUZ_A).secim, HAVUZ_A), true);
  });

  test("(e) önce dosya sonra analiz: aynı fonksiyon aynı sonucu veriyor", () => {
    /* Dosya yüklendi (sayısal varsayılanlar), sonra lojistik seçildi. */
    const dosyaSonrasi = secimiDuzelt("ttest", BOS, HAVUZ_A).secim;
    const analizSonrasi = secimiDuzelt("lojistik", dosyaSonrasi, HAVUZ_A).secim;
    /* Önce lojistik seçilip sonra dosya yüklenseydi de aynı yere gelinmeli. */
    const tersSira = secimiDuzelt("lojistik", secimiDuzelt("lojistik", BOS, { sayisal: [], grup: [], ikiDegerli: [] }).secim, HAVUZ_A).secim;
    assert.equal(analizSonrasi.varA, "basari");
    assert.equal(tersSira.varA, "basari");
    assert.equal(analizSonrasi.varA, tersSira.varA);
  });
});

describe("havuz kuralları her analiz için tanımlı", () => {
  test("25 analizin her biri varA kuralını taşıyor ya da varA kullanmıyor", () => {
    const kuralsiz: AnalizTuru[] = [];
    for (const tur of ANALIZ_TURLERI) {
      const alanlar: SecimAlani[] = ["varA", "varB", "groupVar", "groupVar2", "varY"];
      const kurali = alanlar.some((a) => alanKurali(tur, a) !== null);
      /* Yalnızca madde listesiyle çalışanlar (güvenilirlik, faktör, DFA,
         tekrarlı ANOVA, Friedman) bu alanları hiç kullanmıyor. */
      if (!kurali && !["reliability", "faktor", "dfa", "tekrarlianova", "friedman", "descriptives", "regression", "karmaanova"].includes(tur)) {
        kuralsiz.push(tur);
      }
    }
    assert.deepEqual(kuralsiz, []);
  });

  test("iki kategorili havuzu yalnızca McNemar ve ikili lojistikte", () => {
    const ikiDegerliKullanan = ANALIZ_TURLERI.filter((tur) =>
      (["varA", "varB"] as SecimAlani[]).some((a) => alanKurali(tur, a)?.havuz === "ikiDegerli"),
    );
    assert.deepEqual(ikiDegerliKullanan.sort(), ["lojistik", "mcnemar"]);
  });

  test("ki-karenin iki değişkeni de kategorik havuzdan", () => {
    assert.equal(alanKurali("chisquare", "groupVar")?.havuz, "grup");
    assert.equal(alanKurali("chisquare", "varA")?.havuz, "grup");
  });

  test("havuzlariKur gerçek sütunlardan havuz üretiyor", () => {
    const satirlar = [
      { puan: 70, grup: "A", basari: "gecti" },
      { puan: 80, grup: "B", basari: "kaldi" },
      { puan: 75, grup: "A", basari: "gecti" },
    ];
    const h = havuzlariKur({ sayisal: ["puan"], kategorik: ["grup", "basari"] }, satirlar);
    assert.deepEqual(h.sayisal, ["puan"]);
    assert.ok(h.grup.includes("grup"));
    assert.deepEqual(h.ikiDegerli.sort(), ["basari", "grup"]);
  });
});
