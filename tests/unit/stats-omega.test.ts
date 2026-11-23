import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cronbachAlpha } from "@/lib/stats-tests-core";
import { mcdonaldOmega, OMEGA_ENGEL_METNI, type OmegaEngel } from "@/lib/stats-omega";

/*
  McDONALD OMEGA — BAĞIMSIZ DOĞRULAMA (23.11.2026).

  BEKLENEN DEĞERLER ARVOLAB'IN KENDİ KODUNDAN ÜRETİLMEDİ. Hepsi R ile
  ayrıca hesaplandı; üreten betik ve sürümler fixture'ın içinde:

    scripts/referans/omega-referans.R → tests/fixtures/omega-referans.json
    lavaan::cfa(model, std.lv = TRUE, likelihood = "wishart",
                missing = "listwise", estimator = "ML")
    semTools::reliability(fit)["omega", ]
    ω = (Σλ)² / ((Σλ)² + Σθ)   — ham madde toplam puanı

  Veri setleri de fixture'dan okunuyor: R ve TS AYNI sayıları görüyor.
*/
type Set = {
  ad: string;
  nSatir: number;
  n: number;
  dusen: number;
  maddeSayisi: number;
  adlar: string[];
  durum: string;
  alpha: number | null;
  omega: number | null;
  omegaStd: number | null;
  omegaSemTools: number | null;
  lambda: number[] | number | null;
  theta: number[] | number | null;
  yakinsadi: boolean;
};
const REFERANS = JSON.parse(readFileSync("tests/fixtures/omega-referans.json", "utf8")) as {
  uretim: { tolerans: { omega: number; alpha: number; lambda: number; theta: number } };
  setler: Set[];
  veri: Record<string, (number | null)[][]>;
};
const TOL = REFERANS.uretim.tolerans;
const set = (ad: string) => {
  const s = REFERANS.setler.find((x) => x.ad === ad);
  assert.ok(s, `referans seti yok: ${ad}`);
  return s;
};
/** Tek elemanlı diziler JSON'a skaler yazılıyor; dizi olarak oku. */
const dizi = (x: number[] | number | null): number[] => (x === null ? [] : Array.isArray(x) ? x : [x]);
/** Liste bazlı eleme: ekranın (lib/veri-eslestirme.ts) ve lavaan'ın yaptığı. */
function tamSatirlar(ad: string) {
  const sutunlar = REFERANS.veri[ad];
  const n = sutunlar[0].length;
  const cikti: number[][] = sutunlar.map(() => []);
  let dusen = 0;
  for (let i = 0; i < n; i += 1) {
    if (sutunlar.every((s) => s[i] !== null)) sutunlar.forEach((s, j) => cikti[j].push(s[i] as number));
    else dusen += 1;
  }
  return { sutunlar: cikti, dusen };
}

describe("McDonald ω — lavaan/semTools referansı", () => {
  for (const ad of ["esitVaryans", "farkliVaryans", "tersMadde", "eksikVeri"]) {
    test(`${ad}: ω, λ ve θ referansla aynı`, () => {
      const r = set(ad);
      const { sutunlar } = tamSatirlar(ad);
      const s = mcdonaldOmega(sutunlar, r.adlar);
      assert.equal(s.engel, null, `beklenmeyen engel: ${s.engel}`);
      if (s.engel !== null) return;
      assert.equal(s.n, r.n, "kullanılan gözlem sayısı");
      assert.equal(s.maddeSayisi, r.maddeSayisi);
      assert.ok(Math.abs(s.omega - (r.omega as number)) < TOL.omega, `ω ${s.omega} ≠ ${r.omega}`);
      /* semTools aynı sayıyı veriyor: iki bağımsız yol aynı yere çıkıyor. */
      assert.ok(Math.abs(s.omega - (r.omegaSemTools as number)) < TOL.omega, "semTools::reliability ile de aynı");
      /*
        Faktörün işareti keyfî (std.lv): iki uygulama bütün yükleri ters
        işaretle verebilir. Karşılaştırma yönü hizaladıktan sonra.
      */
      const refL = dizi(r.lambda);
      const yon = Math.sign(s.yukToplami) * Math.sign(refL.reduce((t, x) => t + x, 0)) || 1;
      s.maddeler.forEach((m, i) => {
        assert.ok(Math.abs(m.yuk * yon - refL[i]) < TOL.lambda, `${m.madde} λ ${m.yuk * yon} ≠ ${refL[i]}`);
        assert.ok(Math.abs(m.hata - dizi(r.theta)[i]) < TOL.theta, `${m.madde} θ`);
      });
      /* Formülün izlenebilirliği: ekranda Σλ ve Σθ yazılıyor. */
      assert.ok(Math.abs(s.omega - s.yukToplami ** 2 / (s.yukToplami ** 2 + s.hataToplami)) < 1e-12);
    });
  }

  test("α ve ω AYNI eksiksiz satırlar üzerinden: eksik veri setinde n ve düşen satır birebir", () => {
    const r = set("eksikVeri");
    const { sutunlar, dusen } = tamSatirlar("eksikVeri");
    assert.equal(dusen, r.dusen, "düşen satır sayısı");
    const a = cronbachAlpha(sutunlar);
    const o = mcdonaldOmega(sutunlar, r.adlar);
    assert.equal(a.n, r.n);
    assert.equal(o.engel, null);
    if (o.engel === null) assert.equal(o.n, a.n, "iki katsayı aynı N üzerinden");
    assert.ok(Math.abs(a.alpha - (r.alpha as number)) < TOL.alpha, `α ${a.alpha} ≠ ${r.alpha}`);
  });

  /*
    HAM PUAN ≠ STANDARTLAŞTIRILMIŞ PUAN. Madde varyansları birbirinden
    çok farklıysa, standartlaştırılmış yüklerden hesaplanan ω başka bir
    sayıdır. Bu sürüm HAM madde toplam puanını veriyor; test ikisinin
    karıştırılmadığını sabitliyor.
  */
  test("farklı madde varyanslarında ω ham puanın değeri, standartlaştırılmışın değil", () => {
    const r = set("farkliVaryans");
    const { sutunlar } = tamSatirlar("farkliVaryans");
    const s = mcdonaldOmega(sutunlar, r.adlar);
    assert.equal(s.engel, null);
    if (s.engel !== null) return;
    assert.ok(Math.abs(s.omega - (r.omega as number)) < TOL.omega, "ham puan ω");
    const fark = Math.abs((r.omega as number) - (r.omegaStd as number));
    assert.ok(fark > 0.02, `bu veri setinde iki değer ayrışmalı (fark ${fark})`);
    assert.ok(Math.abs(s.omega - (r.omegaStd as number)) > 0.02, "standartlaştırılmış değer raporlanmamalı");
  });

  test("benzer varyanslarda ham ve standartlaştırılmış ω birbirine yakın kalıyor", () => {
    const r = set("esitVaryans");
    assert.ok(Math.abs((r.omega as number) - (r.omegaStd as number)) < 0.01);
  });

  /*
    TERS MADDE ÇEVRİLMİYOR. Diğerlerinin tersine yüklenen madde λ'sı
    negatif girer ve Σλ'yı küçültür — ham toplam puanda olan budur.
    Mutlak değer alınsaydı ω yukarı kayar ve kullanıcının yapmadığı bir
    dönüşüm yapılmış gibi görünürdü.
  */
  test("ters yönlü madde kendiliğinden çevrilmiyor, bildiriliyor", () => {
    const r = set("tersMadde");
    const { sutunlar } = tamSatirlar("tersMadde");
    const s = mcdonaldOmega(sutunlar, r.adlar);
    assert.equal(s.engel, null);
    if (s.engel !== null) return;
    assert.deepEqual(s.tersYuklenen, ["m3"], "ters yüklenen madde bildirilmeli");
    assert.ok(Math.abs(s.omega - (r.omega as number)) < TOL.omega);
    /* Çevrilmiş olsaydı ω belirgin biçimde yükselirdi: mutlak değer alınmadığı görülsün. */
    const mutlak = s.maddeler.reduce((t, m) => t + Math.abs(m.yuk), 0);
    const cevrilmis = mutlak ** 2 / (mutlak ** 2 + s.hataToplami);
    assert.ok(cevrilmis - s.omega > 0.1, `çevrilmiş değer (${cevrilmis}) raporlanmıyor`);
  });

  test("iki maddede ω üretilmiyor ama α çalışmaya devam ediyor", () => {
    const r = set("ikiMadde");
    const { sutunlar } = tamSatirlar("ikiMadde");
    const s = mcdonaldOmega(sutunlar, r.adlar);
    assert.equal(s.engel, "az-madde");
    const a = cronbachAlpha(sutunlar);
    assert.ok(Math.abs(a.alpha - (r.alpha as number)) < TOL.alpha, "iki maddeli α referansla aynı");
    assert.equal(r.durum, "az-madde", "lavaan da model kurmuyor");
  });

  test("tekil veride sebep bildiriliyor, sayı uydurulmuyor; α yine hesaplanıyor", () => {
    const r = set("tekil");
    const { sutunlar } = tamSatirlar("tekil");
    const s = mcdonaldOmega(sutunlar, r.adlar);
    assert.notEqual(s.engel, null, "ω üretilmemeli");
    assert.equal(r.durum, "kestirilemedi", "lavaan da kestiremiyor");
    const a = cronbachAlpha(sutunlar);
    assert.ok(Number.isFinite(a.alpha), "α tekil veride de hesaplanıyor");
    assert.ok(Math.abs(a.alpha - (r.alpha as number)) < TOL.alpha);
  });

  test("her engelin iki dilde bir açıklaması var", () => {
    const engeller: OmegaEngel[] = ["az-madde", "az-gozlem", "tanimsiz", "yakinsamadi", "gecersiz-hata-varyansi", "kestirilemedi"];
    for (const e of engeller) {
      assert.ok(OMEGA_ENGEL_METNI[e].tr.length > 10, e);
      assert.ok(OMEGA_ENGEL_METNI[e].en.length > 10, e);
      /* Sebep yazılmalı: "hesaplanamadı" tek başına kullanıcıya bir şey söylemez. */
      assert.ok(/ω/.test(OMEGA_ENGEL_METNI[e].tr), e);
    }
  });

  test("gözlem sayısı madde sayısından azsa sebep veriliyor", () => {
    const sutunlar = [[1, 2, 3], [2, 1, 3], [3, 2, 1], [1, 3, 2]];
    const s = mcdonaldOmega(sutunlar, ["a", "b", "c", "d"]);
    assert.equal(s.engel, "az-gozlem");
  });

  test("uzunluk ve ad uyuşmazlığı sessizce kırpılmıyor", () => {
    assert.throws(() => mcdonaldOmega([[1, 2, 3], [1, 2]], ["a", "b"]), /aynı sayıda gözlem/i);
    assert.throws(() => mcdonaldOmega([[1, 2, 3], [1, 2, 3], [1, 2, 3]], ["a", "b"]), /ad gerekiyor/i);
  });
});
