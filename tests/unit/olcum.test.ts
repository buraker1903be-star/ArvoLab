import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  aktivasyonAdimlari,
  BOS_SAYILAR,
  donusumYuzdesi,
  oran,
  sayilariOku,
  type OlcumSayilari,
} from "@/lib/olcum";

const sayilar = (ek: Partial<OlcumSayilari> = {}): OlcumSayilari => ({ ...BOS_SAYILAR, ...ek });

describe("ölçüm: oran", () => {
  test("normal oran yuvarlanır", () => {
    assert.equal(oran(1, 3), 33);
    assert.equal(oran(2, 3), 67);
  });

  test("payda sıfırken oran %0 değil, yok", () => {
    // "%0 dönüşüm" ile "ölçülecek kimse yok" aynı şey değil; ikisini
    // karıştırmak var olmayan bir sorunu var gösterir.
    assert.equal(oran(0, 0), null);
    assert.equal(oran(5, 0), null);
  });

  test("bozuk payda oran üretmez", () => {
    assert.equal(oran(1, Number.NaN), null);
    assert.equal(oran(1, -3), null);
  });
});

describe("ölçüm: dönüşüm", () => {
  test("payda denemeyi başlatanlar, kayıt değil", () => {
    // Kayıt paydaya konsaydı (10) oran %10 çıkardı; denemeyi hiç
    // başlatmamış kişi dönüşüm hunisinin o adımında yoktur.
    assert.equal(donusumYuzdesi(sayilar({ kayit: 10, denemeBaslatan: 4, odemeyeGecen: 1 })), 25);
  });

  test("hiç deneme başlamamışsa dönüşüm yok", () => {
    assert.equal(donusumYuzdesi(sayilar({ kayit: 10 })), null);
  });
});

describe("ölçüm: aktivasyon", () => {
  test("her adımın paydası kayıt sayısı; adımlar birbirine daralmaz", () => {
    // Zincir kurulsaydı "yazan / çalışma açan" = %50 çıkardı ve çalışma
    // açmadan bırakanlar görünmezdi. Bırakma noktası gizlenmemeli.
    const adimlar = aktivasyonAdimlari(sayilar({ kayit: 8, calismaAcan: 4, yazan: 2, asistanKullanan: 1 }));
    assert.deepEqual(adimlar, [
      { etiket: "Çalışma açtı", kisi: 4, yuzde: 50 },
      { etiket: "En az 500 kelime yazdı", kisi: 2, yuzde: 25 },
      { etiket: "Asistanı kullandı", kisi: 1, yuzde: 13 },
    ]);
  });

  test("hiç kayıt yoksa yüzdeler yok, sayılar sıfır", () => {
    const adimlar = aktivasyonAdimlari(BOS_SAYILAR);
    assert.deepEqual(adimlar.map((a) => a.yuzde), [null, null, null]);
  });
});

describe("ölçüm: ham sayıların okunması", () => {
  test("bigint metin olarak gelse de sayıya çevrilir", () => {
    // Postgres count() bigint döndürür; PostgREST bunu metin olarak taşıyabilir.
    // Çevirmeseydik "12" + 0 = "120" gibi sonuçlar ya da NaN oranlar çıkardı.
    const okunan = sayilariOku({ kayit: "12", denemeBaslatan: "5", odemeyeGecen: "2" });
    assert.equal(okunan.kayit, 12);
    assert.equal(donusumYuzdesi(okunan), 40);
  });

  test("ortalama puanda null ile sıfır ayrı tutulur", () => {
    // "Hiç puan yok" ile "ortalama sıfır" aynı şey değil; 0 gösterilirse
    // ürün berbat sanılır.
    assert.equal(sayilariOku({ geriBildirimOrtalamasi: null }).geriBildirimOrtalamasi, null);
    assert.equal(sayilariOku({}).geriBildirimOrtalamasi, null);
    assert.equal(sayilariOku({ geriBildirimOrtalamasi: "4.5" }).geriBildirimOrtalamasi, 4.5);
  });

  test("eksik ya da bozuk alan sıfır sayılır, çökmez", () => {
    assert.deepEqual(sayilariOku(null), BOS_SAYILAR);
    assert.deepEqual(sayilariOku("bozuk"), BOS_SAYILAR);
    assert.equal(sayilariOku({ kayit: "abc" }).kayit, 0);
  });
});
