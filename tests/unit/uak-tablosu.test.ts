import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { donemSecenekleri, metindeOlmayanSayilar, uakIstemi, uakOnerisiniCozumle } from "@/lib/ai/uak-tablosu";

const PDF = `SAĞLIK BİLİMLERİ TEMEL ALANI
1. Uluslararası makale
a) Q1 dergide yayımlanmış makale 30 puan
b) Q2 dergide yayımlanmış makale 20 puan
Çok yazarlı çalışmalarda başlıca yazar 0,8, diğer yazarlar 0,5 katsayı ile.
Toplam en az 100 puan; bunun en az 90 puanı doktora sonrası.`;

const yanit = (v: unknown) => "```json\n" + JSON.stringify(v) + "\n```";

describe("ÜAK tablosu", () => {
  test("öneri ayrıştırılır; bozuk ve tekrarlanan satır atılır, katsayı aralık dışıysa null", () => {
    const o = uakOnerisiniCozumle(yanit({
      kriterler: [
        { kod: "1.a", etiket: "Q1 dergide makale", grup: "Makale", puan: 30, baslica_katsayi: 0.8, diger_katsayi: "0,5" },
        { kod: "1.a", etiket: "tekrar", grup: "Makale", puan: 99 },
        { kod: "", etiket: "kodsuz", puan: 5 },
        { kod: "1.b", etiket: "Q2 dergide makale", grup: "Makale", puan: "20", baslica_katsayi: 2 },
      ],
      hedefler: [
        { grup: null, asgari_puan: 100 },
        { grup: null, asgari_puan: 50 },
        { grup: null, asgari_puan: 90, doktora_sonrasi: true },
        { grup: "Makale", azami_puan: 20 },
        { grup: "Makale", asgari_puan: 5, azami_puan: 10, doktora_sonrasi: true },
        { grup: "Boş", asgari_puan: null, azami_puan: null },
      ],
      notlar: ["Puanların en az 90'ı doktora sonrası."],
    }));
    assert.ok(o);
    assert.deepEqual(o.kriterler.map((k) => [k.kod, k.puan, k.baslica_katsayi, k.diger_katsayi]), [
      ["1.a", 30, 0.8, 0.5],
      ["1.b", 20, null, null],
    ]);
    assert.deepEqual(o.hedefler, [
      { grup: null, asgari_puan: 100, azami_puan: null, doktora_sonrasi: false },
      { grup: null, asgari_puan: 90, azami_puan: null, doktora_sonrasi: true },
      // Var olan tavan (20) ezilmez; tek satırdaki 10 boş alanı doldurmaz.
      { grup: "Makale", asgari_puan: null, azami_puan: 20, doktora_sonrasi: false },
      // "Doktora sonrası en az 5, en fazla 10" ikiye bölünür: tavan bütün faaliyetler satırına gider.
      { grup: "Makale", asgari_puan: 5, azami_puan: null, doktora_sonrasi: true },
    ]);
  });

  test("hiç kriter yoksa öneri yok: boş öneriyi onaylamak kriterleri silerdi", () => {
    assert.equal(uakOnerisiniCozumle(yanit({ kriterler: [], hedefler: [{ grup: null, asgari_puan: 100 }] })), null);
    assert.equal(uakOnerisiniCozumle("anlamadım"), null);
  });

  test("PDF'te geçmeyen sayı yakalanır; 100 de serbest DEĞİL", () => {
    const dogru = uakOnerisiniCozumle(yanit({
      kriterler: [{ kod: "1.a", etiket: "Q1 makale", grup: "Makale", puan: 30, baslica_katsayi: 0.8, diger_katsayi: 0.5 }],
      hedefler: [{ grup: null, asgari_puan: 100 }, { grup: null, asgari_puan: 90, doktora_sonrasi: true }],
      notlar: ["En az 90 puanı doktora sonrası."],
    }))!;
    assert.deepEqual(metindeOlmayanSayilar(dogru, PDF), []);

    const uydurma = { ...dogru, kriterler: [{ ...dogru.kriterler[0], puan: 25 }] };
    assert.deepEqual(metindeOlmayanSayilar(uydurma, PDF), ["25"]);
    const uydurmaHedef = { ...dogru, hedefler: [{ grup: null, asgari_puan: 100, azami_puan: null, doktora_sonrasi: false }] };
    assert.deepEqual(metindeOlmayanSayilar(uydurmaHedef, PDF.replace("100", "120")), ["100"]);
  });

  test("tek satırdaki doktora sonrası asgari ve tavan ayrılır (Atıf: en az 5 doktora sonrası, en fazla 10)", () => {
    const o = uakOnerisiniCozumle(yanit({
      kriterler: [{ kod: "5.a", etiket: "Atıf", grup: "Atıf", puan: 3 }],
      hedefler: [{ grup: "Atıf", asgari_puan: 5, azami_puan: 10, doktora_sonrasi: true }],
    }))!;
    assert.deepEqual(o.hedefler, [
      { grup: "Atıf", asgari_puan: 5, azami_puan: null, doktora_sonrasi: true },
      { grup: "Atıf", asgari_puan: null, azami_puan: 10, doktora_sonrasi: false },
    ]);
  });

  test("eşit bölüşüm yalnızca açık true ise", () => {
    const o = uakOnerisiniCozumle(yanit({
      kriterler: [
        { kod: "1.a", etiket: "Makale", grup: "Makale", puan: 30, esit_bolusum: true },
        { kod: "6.a", etiket: "Doktora tezi", grup: "Danışmanlık", puan: 5, esit_bolusum: "evet" },
      ],
    }))!;
    assert.deepEqual(o.kriterler.map((k) => k.esit_bolusum), [true, false]);
  });

  test("istem bütçeye sığdırılır ve kırpıldığını söyler", () => {
    const { kaynak, kirpildi } = uakIstemi("a".repeat(500), "Hukuk", 100);
    assert.equal(kaynak.length, 100);
    assert.equal(kirpildi, true);
    assert.equal(uakIstemi(PDF, "Sağlık").kirpildi, false);
  });

  test("dönem seçenekleri", () => {
    assert.deepEqual(donemSecenekleri("2026-10-27"), ["2026 Ekim", "2027 Mart"]);
    assert.deepEqual(donemSecenekleri("2026-02-01"), ["2026 Mart", "2026 Ekim"]);
  });
});
