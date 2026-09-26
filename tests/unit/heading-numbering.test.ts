import assert from "node:assert/strict";
import test from "node:test";
import { hasManualNumber, isUnnumberedHeading, numberHeadings, stripManualNumber } from "@/lib/heading-numbering";

/*
  Otomatik başlık numaralandırma. Numara metne yazılmıyor, Word ve baskı
  çıktısında başlığın önüne ekleniyor — yani buradaki bir kayma öğrencinin
  teslim ettiği belgede görünür ve kılavuz uygunluğunu doğrudan bozar.
*/
const bolum = (level: number, text: string) => ({ level, text });

test("başlık numaralandırma", async (t) => {
  await t.test("düzeyler arasında sayaçlar doğru ilerliyor", () => {
    assert.deepEqual(
      numberHeadings([
        bolum(1, "Giriş"),
        bolum(2, "Amaç"),
        bolum(2, "Kapsam"),
        bolum(3, "Sınırlılıklar"),
        bolum(1, "Yöntem"),
        bolum(2, "Örneklem"),
      ]),
      ["1.", "1.1.", "1.2.", "1.2.1.", "2.", "2.1."],
    );
  });

  await t.test("ön ve arka bölümler numara almıyor", () => {
    assert.deepEqual(
      numberHeadings([bolum(1, "Özet"), bolum(1, "İçindekiler"), bolum(1, "Giriş"), bolum(1, "KAYNAKÇA")]),
      [null, null, "1.", null],
    );
  });

  await t.test("numarasız bölümün alt başlıkları da numarasız", () => {
    // EKLER > Ek 1 > (derinlik 3) — hiçbiri numaralanmamalı.
    assert.deepEqual(
      numberHeadings([bolum(1, "EKLER"), bolum(2, "EK 1: Anket Formu"), bolum(3, "Alt Bölüm"), bolum(1, "Özgeçmiş")]),
      [null, null, null, null],
    );
  });

  await t.test("numarasız bölüm sayacı tüketmiyor", () => {
    /*
      Kaynakça araya girdiğinde sonraki ana bölüm "3." olmalı, "4." değil:
      numarasız bölüm bir numara yakarsa öğrencinin belgesindeki bütün
      numaralar kayar.
    */
    assert.deepEqual(
      numberHeadings([bolum(1, "Giriş"), bolum(1, "Yöntem"), bolum(1, "Kaynakça"), bolum(1, "Sonuç")]),
      ["1.", "2.", null, "3."],
    );
  });

  await t.test("üst düzey başlık olmadan başlayan alt başlık '0.1.' olmuyor", () => {
    assert.deepEqual(numberHeadings([bolum(2, "Amaç"), bolum(2, "Kapsam")]), ["1.", "2."]);
  });

  await t.test("EK öneki kelimenin içinde aranmıyor", () => {
    assert.ok(isUnnumberedHeading("EKLER"));
    assert.ok(isUnnumberedHeading("Ek 1: Anket Formu"));
    assert.ok(isUnnumberedHeading("EK-A"));
    // "Ekonomik Etkiler" bir ek değil, gövdenin bölümü — numara almalı.
    assert.equal(isUnnumberedHeading("Ekonomik Etkiler"), false);
    assert.equal(isUnnumberedHeading("Ekim Ayı Verileri"), false);
  });

  await t.test("elle yazılmış numara yıl ile karışmıyor", () => {
    assert.ok(hasManualNumber("1. Giriş"));
    assert.ok(hasManualNumber("1.2. Amaç"));
    assert.ok(hasManualNumber("2.3 Örneklem"));
    // Tek başına yıl numara değil; aksi halde "2023 Bulguları" başlığının
    // başı kırpılırdı.
    assert.equal(hasManualNumber("2023 yılında"), false);
    assert.equal(stripManualNumber("2023 yılında"), "2023 yılında");
    assert.equal(stripManualNumber("1.2. Amaç"), "Amaç");
  });
});
