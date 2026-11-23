import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { karmaAnova, tekrarliIkiliKarsilastirmalar, tekrarliOlcumlerAnova } from "@/lib/stats-anova-ek";

/*
  TEKRARLI ÖLÇÜMLER SONRASI İKİLİ KARŞILAŞTIRMALAR — BAĞIMSIZ DOĞRULAMA
  (23.11.2026).

  Bu fonksiyon tekrarlı ölçümler ANOVA anlamlı çıkınca ekranda bir liste
  olarak görünüyor ve teze giriyordu; buna rağmen hiç testi yoktu
  (docs/analiz-envanteri.md, "Boşluklar"). Yeni yöntem eklemeden önce
  kapatılması önerilen ilk kalemdi.

  BEKLENEN DEĞERLER ARVOLAB'IN KENDİ FONKSİYONUNDAN ÜRETİLMEDİ. Hepsi
  SciPy ve statsmodels ile ayrıca hesaplandı:

    scipy.stats.ttest_rel(a, b)                                   → t, ham p
    numpy.mean(a - b)                                             → ortalama fark
    statsmodels.stats.multitest.multipletests(p, "bonferroni")    → düzeltilmiş p

  Üreten betik: scripts/referans/tekrarli-ikili-referans.py
  Çıktı:        tests/fixtures/tekrarli-ikili-referans.json
  Sürümler ve toleranslar JSON'un "uretim" bölümünde yazılı (koşu anında
  kaydedildi): Python 3.13, SciPy 1.18.1, NumPy 2.5.3, statsmodels 0.15.0.
  Veri setleri sentetiktir, bir yayından alınmadı.
*/
/* JSON sonsuzluk taşıyamadığı için üretici onları dizge yazıyor. */
type Sayi = number | "Infinity" | "-Infinity" | "NaN";
const oku = (x: Sayi): number => (x === "Infinity" ? Infinity : x === "-Infinity" ? -Infinity : x === "NaN" ? NaN : x);
type Cift = { a: string; b: string; fark: Sayi; t: Sayi; pHam: Sayi; p: Sayi; anlamli: boolean };
type Set = { olcumler: number[][]; adlar: string[]; ciftler: Cift[] };
const REFERANS = JSON.parse(readFileSync("tests/fixtures/tekrarli-ikili-referans.json", "utf8")) as {
  uretim: { scipy: string; statsmodels: string; tolerans: { fark: number; t: number; p: number } };
  setler: Record<string, Set>;
};
const TOL = REFERANS.uretim.tolerans;
const yakin = (a: number, b: number, tol: number, ad: string) =>
  assert.ok(Math.abs(a - b) < tol, `${ad}: ${a} ≈ ${b} değil (fark ${Math.abs(a - b)})`);

describe("bağımsız referansla karşılaştırma (SciPy + statsmodels)", () => {
  for (const [ad, set] of Object.entries(REFERANS.setler)) {
    /* Sonsuz t taşıyan set ayrı ele alınıyor: oradaki beklenti farklı. */
    if (ad === "sifir_fark_varyansi") continue;
    test(`${ad}: ortalama farkı, t, düzeltilmiş p, anlamlılık, çift sayısı ve etiketler`, () => {
      const bulunan = tekrarliIkiliKarsilastirmalar(set.olcumler, set.adlar);
      assert.equal(bulunan.length, set.ciftler.length, "çift sayısı");
      bulunan.forEach((c, i) => {
        const r = set.ciftler[i];
        assert.equal(c.a, r.a, `${i}. çiftin 1. etiketi`);
        assert.equal(c.b, r.b, `${i}. çiftin 2. etiketi`);
        yakin(c.fark, oku(r.fark), TOL.fark, `${r.a}-${r.b} ortalama fark`);
        yakin(c.t, oku(r.t), TOL.t, `${r.a}-${r.b} t`);
        yakin(c.p, oku(r.p), TOL.p, `${r.a}-${r.b} düzeltilmiş p`);
        assert.equal(c.anlamli, r.anlamli, `${r.a}-${r.b} anlamlılık`);
      });
    });
  }

  test("çift sayısı k(k−1)/2 ve sıra i<j", () => {
    const uc = REFERANS.setler.uc_olcum_anlamli;
    const dort = REFERANS.setler.dort_olcum_karisik;
    assert.equal(tekrarliIkiliKarsilastirmalar(uc.olcumler, uc.adlar).length, 3);
    assert.equal(tekrarliIkiliKarsilastirmalar(dort.olcumler, dort.adlar).length, 6);
    const etiketler = tekrarliIkiliKarsilastirmalar(uc.olcumler, uc.adlar).map((c) => `${c.a}-${c.b}`);
    assert.deepEqual(etiketler, ["on-son", "on-izleme", "son-izleme"]);
  });

  test("ölçüm sırası değişince fark ve t işaret değiştirir, p aynı kalır", () => {
    const duz = REFERANS.setler.dort_olcum_karisik;
    const ters = REFERANS.setler.dort_olcum_ters;
    const a = tekrarliIkiliKarsilastirmalar(duz.olcumler, duz.adlar);
    const b = tekrarliIkiliKarsilastirmalar(ters.olcumler, ters.adlar);
    /* o1-o2 düz listede 0. çift; ters listede o2-o1 son çift. */
    const o1o2 = a.find((c) => c.a === "o1" && c.b === "o2")!;
    const o2o1 = b.find((c) => c.a === "o2" && c.b === "o1")!;
    yakin(o1o2.fark, -o2o1.fark, TOL.fark, "fark işareti");
    yakin(o1o2.t, -o2o1.t, TOL.t, "t işareti");
    yakin(o1o2.p, o2o1.p, TOL.p, "p");
    assert.equal(o1o2.anlamli, o2o1.anlamli);
  });

  test("negatif ortalama fark referansla birebir", () => {
    const set = REFERANS.setler.dort_olcum_karisik;
    const bulunan = tekrarliIkiliKarsilastirmalar(set.olcumler, set.adlar);
    const negatifler = set.ciftler.filter((c) => oku(c.fark) < 0);
    assert.ok(negatifler.length > 0, "senaryoda negatif fark olmalı");
    for (const r of negatifler) {
      const c = bulunan.find((x) => x.a === r.a && x.b === r.b)!;
      yakin(c.fark, oku(r.fark), TOL.fark, `${r.a}-${r.b}`);
      assert.ok(c.fark < 0);
    }
  });

  test("Bonferroni p'yi 1'de sınırlar", () => {
    const set = REFERANS.setler.p_tavani;
    const bulunan = tekrarliIkiliKarsilastirmalar(set.olcumler, set.adlar);
    for (const c of bulunan) assert.ok(c.p <= 1, `p = ${c.p} > 1`);
    /* Referansta da hepsi tam 1'e sabitlenmiş. */
    assert.ok(set.ciftler.every((r) => oku(r.p) === 1));
    bulunan.forEach((c, i) => yakin(c.p, oku(set.ciftler[i].p), TOL.p, "p tavanı"));
  });

  test("düzeltme ham p × çift sayısı: ham p referanstan türetiliyor", () => {
    const set = REFERANS.setler.uc_olcum_anlamli;
    const bulunan = tekrarliIkiliKarsilastirmalar(set.olcumler, set.adlar);
    bulunan.forEach((c, i) => {
      const beklenen = Math.min(1, oku(set.ciftler[i].pHam) * set.ciftler.length);
      yakin(c.p, beklenen, TOL.p, `${c.a}-${c.b} Bonferroni`);
    });
  });
});

/*
  SINIR DURUMLARI. Hiçbiri sessizce yanıltıcı bir sonuç üretmemeli:
  ekranda "anlamlı değil" yazan bir satır, kullanıcının o çifti
  raporlamamasına yol açar.
*/
describe("sınır durumları sessizce yanıltmıyor", () => {
  test("SIFIR FARK VARYANSI: her katılımcıda fark aynıysa 'anlamlı değil' denmez", () => {
    /*
      Farkların varyansı sıfırken t tanımsız (SciPy ±inf, p = 0 veriyor).
      ArvoLab p'yi NaN bırakıyordu ve `anlamli` false oluyordu: her
      katılımcıda tam olarak 3 puanlık tutarlı bir değişim, ekranda
      "anlamlı değil" diye görünüyordu — bulunabilecek en güçlü örüntü.
    */
    const set = REFERANS.setler.sifir_fark_varyansi;
    const bulunan = tekrarliIkiliKarsilastirmalar(set.olcumler, set.adlar);
    const sabit = bulunan.find((c) => c.a === "s1" && c.b === "s2")!;
    assert.ok(!Number.isFinite(sabit.t), "sabit farkta t tanımsız");
    assert.equal(sabit.anlamli, false, "anlamlı diye işaretlenmemeli");
    assert.equal(sabit.engel, "sabit-fark", "hesaplanamadığı AÇIKÇA bildirilmeli");
    /* Varyansı olan çiftler aynı listede normal hesaplanmaya devam etmeli. */
    const normal = bulunan.find((c) => c.a === "s1" && c.b === "s3")!;
    assert.ok(Number.isFinite(normal.t));
    assert.equal(normal.engel, null);
  });

  test("YETERSİZ GÖZLEM: tek katılımcıda çift hesaplanamadı diye işaretlenir", () => {
    const bulunan = tekrarliIkiliKarsilastirmalar([[5], [7], [9]], ["a", "b", "c"]);
    assert.equal(bulunan.length, 3);
    for (const c of bulunan) {
      assert.equal(c.anlamli, false);
      assert.equal(c.engel, "az-gozlem", `${c.a}-${c.b}`);
    }
  });

  test("EŞLEŞMEYEN UZUNLUK: çağrı reddedilir, sessizce kırpılmaz", () => {
    /*
      Eskiden eşleştirilmiş t fazlalığı kırpıyordu; farklı uzunluktaki
      ölçümlerde her çift BAŞKA bir n ile hesaplanıyor ve Bonferroni
      ailesi tutarsız kalıyordu. Arayüz zaten eşleşen satırları
      veriyor (lib/veri-eslestirme.ts); doğrudan çağrıda da sessiz
      kalınmamalı.
    */
    assert.throws(() => tekrarliIkiliKarsilastirmalar([[1, 2, 3], [4, 5]], ["a", "b"]), /uzunluğu eşit olmalı/i);
  });

  test("MAUCHLY HESAPLANAMADIYSA 'varsayım sağlanıyor' denmez", () => {
    /*
      Bir ölçüm ötekinin sabit kaydırılmışıysa (sabit = on + 3) kovaryans
      matrisi tekil; Mauchly W = 0, χ² ve p tanımsız kalıyor. Arayüz
      `isSignificant(NaN)` false döndüğü için "küresellik varsayımı
      sağlanıyor" yazıyordu: denetlenmemiş bir varsayım, denetlenip
      geçmiş gibi görünüyordu.
    */
    const on = [10, 12, 11, 14, 13, 15, 9, 12, 13, 11];
    const r = tekrarliOlcumlerAnova([on, on.map((x) => x + 3), [15, 18, 17, 19, 19, 21, 13, 18, 19, 15]]);
    assert.ok(!Number.isFinite(r.mauchlyP), "bu veride Mauchly p tanımsız olmalı");
    assert.equal(r.kuresellikDenetlendi, false, "denetlenemediği AÇIKÇA bildirilmeli");
  });

  test("Mauchly hesaplanabilen veride denetlendi olarak işaretlenir", () => {
    const r = tekrarliOlcumlerAnova([
      [10, 12, 11, 14, 13, 15, 9, 12, 13, 11],
      [12, 15, 13, 16, 15, 18, 11, 14, 16, 13],
      [15, 18, 17, 19, 19, 21, 13, 18, 19, 15],
    ]);
    assert.ok(Number.isFinite(r.mauchlyP));
    assert.equal(r.kuresellikDenetlendi, true);
  });

  /*
    KARMA DESENDE DE AYNI KURAL. Her grubun ölçümleri ortak bir
    kovaryans matrisine katkı veriyor; biri ötekinin sabit kaydırılmışı
    olunca matris tekil ve Mauchly tanımsız oluyor.
  */
  test("KARMA ANOVA: tekil kovaryansta küresellik denetlenemedi diye işaretlenir", () => {
    const g1 = [10, 12, 11, 14, 13, 15];
    const g2 = [9, 11, 10, 13, 12, 14];
    /* Üçüncü ölçüm, birincinin tam 3 puan kaydırılmışı: tekil matris. */
    const r = karmaAnova(
      [
        [g1, g1.map((x) => x + 2), g1.map((x) => x + 3)],
        [g2, g2.map((x) => x + 2), g2.map((x) => x + 3)],
      ],
      ["deney", "kontrol"],
    );
    assert.ok(typeof r === "object", "hesap yapılabilmeli");
    assert.ok(!Number.isFinite(r.mauchlyP), "bu desende Mauchly p tanımsız olmalı");
    assert.equal(r.kuresellikDenetlendi, false, "denetlenemediği AÇIKÇA bildirilmeli");
  });

  test("KARMA ANOVA: normal desende küresellik denetlendi olarak işaretlenir", () => {
    const r = karmaAnova(
      [
        [
          [10, 12, 11, 14, 13, 15, 9, 12],
          [12, 15, 13, 16, 15, 18, 11, 14],
          [15, 18, 17, 19, 19, 21, 13, 18],
        ],
        [
          [9, 11, 10, 13, 12, 14, 8, 11],
          [10, 12, 12, 14, 13, 16, 10, 12],
          [11, 14, 13, 15, 15, 17, 11, 14],
        ],
      ],
      ["deney", "kontrol"],
    );
    assert.ok(typeof r === "object");
    assert.ok(Number.isFinite(r.mauchlyP), "normal desende Mauchly hesaplanmalı");
    assert.equal(r.kuresellikDenetlendi, true);
    /* Etkiler de hesaplanabilir kalmalı: düzeltme kararı bunları bozmuyor. */
    assert.ok(Number.isFinite(r.olcum.f) && Number.isFinite(r.etkilesim.f));
    assert.ok(Number.isFinite(r.olcum.ggP) && Number.isFinite(r.etkilesim.ggP));
  });

  /*
    GG DE HESAPLANAMAYABİLİR. Mauchly determinant ister ve tekil
    matriste düşer; GG epsilon iz oranı olduğu için çoğu tekil desende
    hâlâ hesaplanır. İki ölçüm BİREBİR aynı olunca GG de düşüyor —
    ama F'ler sonlu kaldığı için hesap reddedilmiyor ve arayüz
    "düzeltilmiş p üretilemedi" durumuna giriyor.
  */
  test("KARMA ANOVA: iki ölçüm birebir aynıysa GG epsilon da üretilemiyor", () => {
    const deney = [10, 12, 11, 14, 13, 15, 9, 12];
    const kontrol = [9, 11, 10, 13, 12, 14, 8, 11];
    const r = karmaAnova(
      [
        [deney, deney.slice(), deney.map((x) => x + 2)],
        [kontrol, kontrol.slice(), kontrol.map((x) => x + 2)],
      ],
      ["deney", "kontrol"],
    );
    assert.ok(typeof r === "object");
    assert.equal(r.kuresellikDenetlendi, false);
    assert.ok(!Number.isFinite(r.ggEpsilon), "GG epsilon da tanımsız olmalı");
    /* F'ler sonlu: hesap reddedilmiyor, arayüz düzeltme dalına giriyor. */
    assert.ok([r.grup.f, r.olcum.f, r.etkilesim.f].every(Number.isFinite), "F değerleri sonlu kalmalı");
    /* Düzeltilmiş p üretilemiyor: bundan hüküm çıkarılmamalı. */
    assert.ok(!Number.isFinite(r.olcum.ggP));
    assert.ok(!Number.isFinite(r.etkilesim.ggP));
  });

  test("ETİKET EKSİKSE çağrı reddedilir", () => {
    assert.throws(() => tekrarliIkiliKarsilastirmalar([[1, 2, 3], [4, 5, 6]], ["a"]), /etiket/i);
  });
});
