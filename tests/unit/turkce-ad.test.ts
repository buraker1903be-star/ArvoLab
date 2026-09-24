/*
  Kurum adı katlaması. Var olma sebebi ölçülmüş bir davranış:
  Postgres'te lower('IŞIK ÜNİVERSİTESİ') ile lower('Işık Üniversitesi')
  EŞİT DEĞİL, JavaScript'te "İSTANBUL".toLowerCase() de "istanbul" değil.
  Dizinde büyük harfle duran ad ile elle yazılan ad bu yüzden eşleşmiyordu.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ayniKurum, turkceKatla } from "@/lib/turkce-ad";

describe("Türkçe kurum adı katlaması", () => {
  test("i/ı/İ/I dört yazım da aynı anahtara iner", () => {
    const beklenen = "isik universitesi";
    for (const yazim of ["IŞIK ÜNİVERSİTESİ", "Işık Üniversitesi", "ışık üniversitesi", "IŞIK Üniversitesi"]) {
      assert.equal(turkceKatla(yazim), beklenen, yazim);
    }
  });

  test("İstanbul'un her yazımı eşleşir", () => {
    assert.ok(ayniKurum("İSTANBUL ÜNİVERSİTESİ", "İstanbul Üniversitesi"));
    assert.ok(ayniKurum("ISTANBUL UNIVERSITESI", "İstanbul Üniversitesi"));
  });

  test("şapkalar ve noktalama karşılaştırmayı bozmaz", () => {
    assert.ok(ayniKurum("Boğaziçi Üniversitesi", "BOGAZICI UNIVERSITESI"));
    assert.ok(ayniKurum("Orta Doğu Teknik Üniversitesi ", "  orta dogu teknik universitesi"));
    assert.ok(ayniKurum("Hacettepe Üniv.", "Hacettepe Üniv"));
  });

  test("farklı kurumlar eşleşmez", () => {
    // Katlama fazla geniş olmamalı: yanlış eşleşme, kılavuzu YANLIŞ kuruma
    // uygular — hiç uygulamamaktan kötüdür.
    assert.equal(ayniKurum("Işık Üniversitesi", "Iğdır Üniversitesi"), false);
    assert.equal(ayniKurum("Ankara Üniversitesi", "Ankara Hacı Bayram Veli Üniversitesi"), false);
  });

  test("boş ad hiçbir şeyle eşleşmez", () => {
    // Aksi halde adı boş iki kayıt aynı kurum sayılırdı.
    assert.equal(ayniKurum("", ""), false);
    assert.equal(ayniKurum(null, undefined), false);
    assert.equal(turkceKatla(null), "");
  });
});
