import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  uzmanYazismaDurumu,
  yanitBekliyor,
  yanitGeldi,
  yazanEtiketi,
  yazismaKur,
  type YazismaMesaji,
} from "../../lib/destek-yazisma";

const m = (id: string, taraf: YazismaMesaji["taraf"], zaman: string, yazanAdi: string | null = null): YazismaMesaji =>
  ({ id, taraf, zaman, yazanAdi, metin: id });

describe("destek yazışması", () => {
  test("eski tek yanıt yazışmanın içinde kendi zamanında durur", () => {
    const sira = yazismaKur(
      [m("b", "talep_sahibi", "2026-10-27T10:00:00Z"), m("a", "talep_sahibi", "2026-10-26T09:00:00Z")],
      { metin: "  Düzeltildi.  ", zaman: "2026-10-26T12:00:00Z" },
    );
    assert.deepEqual(sira.map((x) => x.id), ["a", "eski-yanit", "b"]);
    assert.equal(sira[1].metin, "Düzeltildi.");
    assert.equal(sira[1].taraf, "destek");
  });

  test("boş eski yanıt eklenmez", () => {
    assert.equal(yazismaKur([], { metin: "   ", zaman: null }).length, 0);
  });

  test("son söz kimdeyse bekleyen odur", () => {
    const soru = [m("a", "talep_sahibi", "1")];
    const cevap = [...soru, m("b", "uzman", "2")];
    assert.equal(yanitBekliyor(soru), true);
    assert.equal(yanitGeldi(soru), false);
    assert.equal(yanitBekliyor(cevap), false);
    assert.equal(yanitGeldi(cevap), true);
    assert.equal(yanitBekliyor([]), false);
  });

  test("uzman yazışması RLS'le aynı kuralı söyler", () => {
    assert.equal(uzmanYazismaDurumu("open", "talep_sahibi").yazabilir, true);
    assert.equal(uzmanYazismaDurumu("accepted", "talep_sahibi").yazabilir, true);
    assert.equal(uzmanYazismaDurumu("open", "uzman").yazabilir, false);
    assert.equal(uzmanYazismaDurumu("accepted", "uzman").yazabilir, true);
    assert.equal(uzmanYazismaDurumu("completed", "uzman").yazabilir, false);
    assert.equal(uzmanYazismaDurumu("cancelled", "talep_sahibi").yazabilir, false);
  });

  test("etiket: kendi mesajı Siz, karşı taraf adı ve rolüyle", () => {
    assert.equal(yazanEtiketi(m("a", "uzman", "1", "Meral Aydaç"), "talep_sahibi"), "Meral Aydaç · Uzman");
    assert.equal(yazanEtiketi(m("a", "uzman", "1"), "uzman"), "Siz");
    assert.equal(yazanEtiketi(m("a", "destek", "1"), "talep_sahibi"), "Destek ekibi");
    assert.equal(yazanEtiketi(m("a", "talep_sahibi", "1", "Ayşe"), "destek"), "Ayşe");
  });
});
