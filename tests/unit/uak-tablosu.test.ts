import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { donemSecenekleri, metindeOlmayanSayilar, onerileriBirlestir, sayfaSusunuAyikla, uakIstemi, uakIstemleri, uakOnerisiniCozumle, uakParcalari } from "@/lib/ai/uak-tablosu";

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

/*
  27.10.2026: Güzel Sanatlar tablosu (12 sayfa, 29 bin karakter) tek
  çağrıda süreyi aştı. Tablo bölüm başlıklarından parçalanıyor.
*/
describe("parçalı okuma", () => {
  const madde = (n: number, uzunluk: number) => `${n}. Madde başlığı\na) ${"x".repeat(uzunluk)} 10\n`;
  const UZUN =
    "TABLO 4. GÜZEL SANATLAR TEMEL ALANI\nGenel kural: puan yazarlar arasında eşit bölünür.\n" +
    madde(1, 4000) + madde(2, 4000) +
    "MÜZİK BİLİM/SANAT ALANI\nKlasik Batı Müziği\n" + madde(1, 6000) +
    "SAHNE SANATLARI BİLİM/SANAT ALANI\n" + madde(1, 6000);

  test("bölüm başlıklarından bölünür; giriş genel kuralları taşır", () => {
    const { giris, parcalar } = uakParcalari(UZUN);
    assert.match(giris, /eşit bölünür/);
    assert.equal(parcalar.length, 3);
    assert.match(parcalar[1], /^MÜZİK BİLİM\/SANAT ALANI/);
    assert.match(parcalar[2], /^SAHNE SANATLARI/);
    // Kısa komşu bölümler tek parçada birleşir: gereksiz çağrı açılmasın.
    assert.equal(uakParcalari("A\n1. x\nMÜZİK BİLİM/SANAT ALANI\n1. y\nSAHNE SANATLARI ALANI\n1. z").parcalar.length, 1);
  });

  test("kısa tablo tek istem, uzun tablo parça başına istem; ilk parça dışında toplam hedef istenmez", () => {
    assert.equal(uakIstemleri("1. Makale\na) Q1 30", "Hukuk").istemler.length, 1);
    const { istemler } = uakIstemleri(UZUN, "Güzel Sanatlar");
    assert.equal(istemler.length, 3);
    assert.doesNotMatch(istemler[0][1].metin, /Toplam puan hedeflerini \(grup null\) yazma/);
    assert.match(istemler[1][1].metin, /Toplam puan hedeflerini \(grup null\) yazma/);
    assert.match(istemler[2][1].metin, /eşit bölünür/);
  });

  test("sayfa süsü ayıklanır", () => {
    const temiz = sayfaSusunuAyikla("Ü n i v e r s i t e l e r a r a s ı\nS a y f a 1 / 12\n1. Makale\n-- 1 of 12 --\na) Q1 30");
    assert.equal(temiz, "1. Makale\na) Q1 30");
  });

  test("parça önerileri birleşir: kod tekrarı atılır, hedefler tamamlanır, kriteri olmayan parça kabul", () => {
    const k = (kod: string) => ({ kod, etiket: kod, grup: "G", puan: 5, esit_bolusum: false, baslica_katsayi: null, diger_katsayi: null });
    const bos = uakOnerisiniCozumle(JSON.stringify({ kriterler: [], hedefler: [], notlar: ["Kısaltmalar"] }), true);
    assert.ok(bos);
    const birlesik = onerileriBirlestir([
      { kriterler: [k("1.a"), k("2.a")], hedefler: [{ grup: "Atıf", asgari_puan: null, azami_puan: 10, doktora_sonrasi: false }], notlar: ["n1"] },
      { kriterler: [k("2.a"), k("Müzik-a")], hedefler: [{ grup: "Atıf", asgari_puan: 2, azami_puan: null, doktora_sonrasi: false }], notlar: ["n1", "n2"] },
      bos!,
    ])!;
    assert.deepEqual(birlesik.kriterler.map((x) => x.kod), ["1.a", "2.a", "Müzik-a"]);
    assert.deepEqual(birlesik.hedefler, [{ grup: "Atıf", asgari_puan: 2, azami_puan: 10, doktora_sonrasi: false }]);
    assert.deepEqual(birlesik.notlar, ["n1", "n2", "Kısaltmalar"]);
    assert.equal(onerileriBirlestir([bos!]), null);
  });
});
